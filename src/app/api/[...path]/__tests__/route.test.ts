// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DELETE, GET, PATCH, POST } from "../route";

const params = (...path: string[]) => ({ params: Promise.resolve({ path }) });

let fetchMock: ReturnType<typeof vi.fn>;

const upstream = (body: BodyInit | null, init?: ResponseInit) =>
  Promise.resolve(new Response(body, init));

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("BFF proxy", () => {
  it("keeps every Set-Cookie header separate", async () => {
    // Better Auth sets the session and the CSRF-ish data cookie in one
    // response. Copying headers with `new Headers(upstream.headers)` or a
    // forEach loop joins them into one comma-separated string, the browser
    // stores a single malformed cookie, and the user is silently never signed
    // in. Only getSetCookie() + append survives the trip.
    fetchMock.mockReturnValue(
      upstream(JSON.stringify({ ok: true }), {
        headers: [
          ["content-type", "application/json"],
          ["set-cookie", "better-auth.session_token=abc; Path=/; HttpOnly"],
          ["set-cookie", "better-auth.session_data=xyz; Path=/; HttpOnly"],
        ],
      })
    );

    const response = await POST(
      new Request("http://localhost:3002/api/auth/sign-in/email", {
        method: "POST",
        body: JSON.stringify({ email: "a@b.co", password: "nine-chars" }),
        headers: { "content-type": "application/json" },
      }),
      params("auth", "sign-in", "email")
    );

    const cookies = response.headers.getSetCookie();
    expect(cookies).toHaveLength(2);
    expect(cookies[0]).toContain("session_token=abc");
    expect(cookies[1]).toContain("session_data=xyz");
  });

  it("forwards to the API origin under its /api prefix, keeping the query", async () => {
    fetchMock.mockReturnValue(upstream("[]", { status: 200 }));

    await GET(
      new Request(
        "http://localhost:3002/api/v1/dashboard/orders?status=PENDING_BRAND&limit=20"
      ),
      params("v1", "dashboard", "orders")
    );

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "http://127.0.0.1:3001/api/v1/dashboard/orders?status=PENDING_BRAND&limit=20"
    );
    expect(init.method).toBe("GET");
    expect(init.redirect).toBe("manual");
  });

  it("never resolves the API through localhost", async () => {
    fetchMock.mockReturnValue(upstream("{}"));

    await GET(
      new Request("http://localhost:3002/api/v1/health"),
      params("v1", "health")
    );

    expect(String(fetchMock.mock.calls[0][0])).not.toContain("localhost");
  });

  it("forwards the browser's cookies upstream", async () => {
    fetchMock.mockReturnValue(upstream("{}"));

    await GET(
      new Request("http://localhost:3002/api/v1/dashboard/me", {
        headers: { cookie: "better-auth.session_token=abc" },
      }),
      params("v1", "dashboard", "me")
    );

    const sent = new Headers(fetchMock.mock.calls[0][1].headers);
    expect(sent.get("cookie")).toBe("better-auth.session_token=abc");
    expect(sent.get("host")).toBeNull();
  });

  it("streams a request body with duplex: half", async () => {
    fetchMock.mockReturnValue(upstream("{}"));

    await PATCH(
      new Request("http://localhost:3002/api/v1/dashboard/orders/1", {
        method: "PATCH",
        body: JSON.stringify({ to: "CONFIRMED" }),
        headers: { "content-type": "application/json" },
      }),
      params("v1", "dashboard", "orders", "1")
    );

    const init = fetchMock.mock.calls[0][1];
    expect(init.duplex).toBe("half");
    expect(init.body).not.toBeUndefined();
  });

  it("drops framing headers it is not entitled to repeat", async () => {
    fetchMock.mockReturnValue(
      upstream("{}", {
        headers: {
          "content-type": "application/json",
          "content-encoding": "gzip",
          "content-length": "2",
          "transfer-encoding": "chunked",
        },
      })
    );

    const response = await GET(
      new Request("http://localhost:3002/api/v1/health"),
      params("v1", "health")
    );

    expect(response.headers.get("content-encoding")).toBeNull();
    expect(response.headers.get("content-length")).toBeNull();
    expect(response.headers.get("transfer-encoding")).toBeNull();
    expect(response.headers.get("content-type")).toBe("application/json");
  });

  it("passes an upstream failure through untouched", async () => {
    fetchMock.mockReturnValue(
      upstream(
        JSON.stringify({ statusCode: 403, message: "Forbidden", error: "Forbidden" }),
        { status: 403, headers: { "content-type": "application/json" } }
      )
    );

    const response = await DELETE(
      new Request("http://localhost:3002/api/v1/dashboard/products/1", {
        method: "DELETE",
      }),
      params("v1", "dashboard", "products", "1")
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ statusCode: 403 });
  });

  it("reads the API origin from the environment", async () => {
    vi.stubEnv("LOQAL_API_ORIGIN", "http://10.0.0.4:4000");
    vi.resetModules();
    const { GET: freshGet } = await import("../route");
    fetchMock.mockReturnValue(upstream("{}"));

    await freshGet(
      new Request("http://localhost:3002/api/v1/health"),
      params("v1", "health")
    );

    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "http://10.0.0.4:4000/api/v1/health"
    );
    vi.unstubAllEnvs();
  });
});

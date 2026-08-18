// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { ApiError, ApiShapeError, api } from "../api";

const schema = z.object({ id: z.string(), name: z.string() }).strict();

let fetchMock: ReturnType<typeof vi.fn>;

const reply = (body: unknown, init?: ResponseInit) =>
  Promise.resolve(
    new Response(typeof body === "string" ? body : JSON.stringify(body), {
      headers: { "content-type": "application/json" },
      ...init,
    })
  );

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("api client", () => {
  it("turns a 403 body into a typed error carrying its statusCode", async () => {
    // The three consoles differ mostly by what a user may NOT see, so a 403 is
    // ordinary traffic rather than an exception. It has to arrive as data the
    // UI can branch on — a permission-denied panel — not as a generic Error.
    fetchMock.mockReturnValue(
      reply(
        {
          statusCode: 403,
          message: "Only the brand owner can open Money",
          error: "Forbidden",
        },
        { status: 403 }
      )
    );

    const failure = await api.get(schema, "/v1/dashboard/money").catch((e) => e);

    expect(failure).toBeInstanceOf(ApiError);
    expect(failure.statusCode).toBe(403);
    expect(failure.isPermissionDenied).toBe(true);
    expect(failure.message).toBe("Only the brand owner can open Money");
    expect(failure.error).toBe("Forbidden");
  });

  it("throws rather than hand a component a body that does not match its schema", async () => {
    // A field the API renamed must fail here, at one place, and not surface as
    // `undefined` inside a table cell three screens away.
    fetchMock.mockReturnValue(reply({ id: "1", nmae: "typo" }));

    const failure = await api.get(schema, "/v1/dashboard/thing").catch((e) => e);

    expect(failure).toBeInstanceOf(ApiShapeError);
    expect(failure.path).toBe("/api/v1/dashboard/thing");
    expect(failure.issues.length).toBeGreaterThan(0);
  });

  it("returns parsed data on success", async () => {
    fetchMock.mockReturnValue(reply({ id: "1", name: "Nefertari" }));

    await expect(api.get(schema, "/v1/dashboard/thing")).resolves.toEqual({
      id: "1",
      name: "Nefertari",
    });
  });

  it("calls the same origin under /api and sends the cookie", async () => {
    fetchMock.mockReturnValue(reply({ id: "1", name: "x" }));

    await api.get(schema, "/v1/dashboard/thing");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/v1/dashboard/thing");
    expect(init.credentials).toBe("same-origin");
  });

  it("serialises a body and a query without the caller building strings", async () => {
    fetchMock.mockReturnValue(reply({ id: "1", name: "x" }));

    await api.post(schema, "/v1/dashboard/orders/1/transition", { to: "CONFIRMED" }, {
      query: { locale: "ar", cursor: undefined },
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/v1/dashboard/orders/1/transition?locale=ar");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ to: "CONFIRMED" }));
    expect(new Headers(init.headers).get("content-type")).toBe("application/json");
  });

  it("reports an unparseable error body as the transport failure it is", async () => {
    fetchMock.mockReturnValue(
      reply("<html>502 Bad Gateway</html>", {
        status: 502,
        headers: { "content-type": "text/html" },
      })
    );

    const failure = await api.get(schema, "/v1/dashboard/thing").catch((e) => e);

    expect(failure).toBeInstanceOf(ApiError);
    expect(failure.statusCode).toBe(502);
  });

  it("accepts an empty 204 body for a void schema", async () => {
    fetchMock.mockReturnValue(Promise.resolve(new Response(null, { status: 204 })));

    await expect(api.delete(z.void(), "/v1/dashboard/products/1")).resolves.toBeUndefined();
  });

  it("does not double the prefix when a caller writes /api itself", async () => {
    fetchMock.mockReturnValue(reply({ id: "1", name: "x" }));

    await api.get(schema, "/api/v1/dashboard/thing");

    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/dashboard/thing");
  });
});

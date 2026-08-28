// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { ApiError, ApiShapeError, api, describeFailure } from "../api";

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

/**
 * THE FAILURES A SCREEN HAS TO TELL APART. The sign-in screen once said
 * "wrong password" for a rejected dev origin. `ApiError` already carried what
 * would have avoided it; every caller threw it away in a bare `catch {}`.
 */
describe("ApiError, on the statuses a form actually meets", () => {
  const of = (status: number, message = "said something") =>
    new ApiError(status, message, "Error");

  it("names a conflict, which is a real answer and not a rejection", () => {
    expect(of(409).isConflict).toBe(true);
    expect(of(422).isConflict).toBe(false);
  });

  it("names an unprocessable body, which is the API explaining itself", () => {
    expect(of(422).isUnprocessable).toBe(true);
    expect(of(409).isUnprocessable).toBe(false);
    expect(of(400).isUnprocessable).toBe(false);
  });

  it("keeps the statuses it already knew", () => {
    expect(of(404).isNotFound).toBe(true);
    expect(of(403).isPermissionDenied).toBe(true);
    expect(of(401).isUnauthenticated).toBe(true);
  });
});

describe("describeFailure", () => {
  const copy = {
    conflict: "That email already has an account.",
    notFound: "Not available here.",
    refused: "Refused what was sent.",
    generic: "That did not go through.",
  };

  it("repeats the API's own sentence for a conflict", () => {
    const said = "A user with this email already exists";

    expect(describeFailure(new ApiError(409, said, "Conflict"), copy)).toEqual({
      title: copy.conflict,
      detail: said,
    });
  });

  it("repeats it for a refused body too — that is why it was sent", () => {
    const said = "phone must be an Egyptian mobile number";

    expect(
      describeFailure(new ApiError(422, said, "UnprocessableEntity"), copy)
    ).toEqual({ title: copy.refused, detail: said });
  });

  it("says a missing route is unavailable, not that the input was rejected", () => {
    const failure = describeFailure(
      new ApiError(404, "Cannot POST /v1/admin/brands/1/resend-invite", "NotFound"),
      copy
    );

    expect(failure.title).toBe(copy.notFound);
  });

  it("stays generic where genuinely nothing is known", () => {
    // A 500 says "boom" and a dropped connection says nothing at all. Dressing
    // either up as a diagnosis is the bug this whole helper exists to stop.
    expect(describeFailure(new ApiError(500, "boom", "Internal"), copy)).toEqual({
      title: copy.generic,
      detail: null,
    });
    expect(describeFailure(new TypeError("Failed to fetch"), copy)).toEqual({
      title: copy.generic,
      detail: null,
    });
  });

  it("drops a blank sentence rather than rendering an empty line", () => {
    expect(describeFailure(new ApiError(409, "   ", "Conflict"), copy).detail).toBeNull();
  });
});

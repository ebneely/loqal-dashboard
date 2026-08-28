/**
 * The typed API client.
 *
 * Every call takes the zod schema it expects back and returns that schema's
 * type. Nothing reaches a component unparsed: a body that no longer matches its
 * contract fails here, once, with the path and the issues attached, instead of
 * arriving three screens away as `undefined` inside a table cell.
 *
 * Requests are same-origin and relative — /api/... — so they land on the BFF
 * proxy in src/app/api/[...path]/route.ts and carry the session cookie without
 * any CORS or cookie-domain configuration existing anywhere.
 */
import type { z } from "zod";

import { apiErrorSchema } from "@loqal/contracts/errors";

/**
 * A failure the API described. `statusCode` is the API's own number, taken from
 * its single error body ({ statusCode, message, error }) rather than guessed
 * from the transport, so a screen can branch on 403 the same way the Nest
 * RolesGuard decided it.
 */
export class ApiError extends Error {
  readonly statusCode: number;
  readonly error: string;

  constructor(statusCode: number, message: string, error: string) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.error = error;
  }

  /** Permission-denied is a first-class screen state, not an exception. */
  get isPermissionDenied(): boolean {
    return this.statusCode === 403;
  }

  get isUnauthenticated(): boolean {
    return this.statusCode === 401;
  }

  get isNotFound(): boolean {
    return this.statusCode === 404;
  }

  /**
   * The state already exists — an email that already has an account, a slug
   * already taken. Not a rejection of what was typed; an answer about the
   * world, and one the API always describes in words.
   */
  get isConflict(): boolean {
    return this.statusCode === 409;
  }

  /** The API read the body, refused it, and said which field and why. */
  get isUnprocessable(): boolean {
    return this.statusCode === 422;
  }
}

/** A success body that did not match the contract it was requested under. */
export class ApiShapeError extends Error {
  readonly path: string;
  readonly issues: readonly { path: string; message: string }[];

  constructor(path: string, issues: readonly { path: string; message: string }[]) {
    super(
      `The API answered ${path} with a body that does not match its contract: ` +
        issues.map((i) => `${i.path || "(root)"} — ${i.message}`).join("; ")
    );
    this.name = "ApiShapeError";
    this.path = path;
    this.issues = issues;
  }
}

export type QueryValue = string | number | boolean | null | undefined;

export type RequestOptions = {
  /** Undefined and null entries are dropped rather than sent as "undefined". */
  query?: Record<string, QueryValue>;
  signal?: AbortSignal;
  headers?: HeadersInit;
};

const withPrefix = (path: string) => {
  const rooted = path.startsWith("/") ? path : `/${path}`;
  return rooted.startsWith("/api/") || rooted === "/api" ? rooted : `/api${rooted}`;
};

const withQuery = (path: string, query: RequestOptions["query"]) => {
  if (!query) return path;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `${path}?${qs}` : path;
};

async function request<T>(
  method: string,
  schema: z.ZodType<T>,
  path: string,
  body?: unknown,
  options: RequestOptions = {}
): Promise<T> {
  const url = withQuery(withPrefix(path), options.query);

  const headers = new Headers(options.headers);
  headers.set("accept", "application/json");
  if (body !== undefined) headers.set("content-type", "application/json");

  const response = await fetch(url, {
    method,
    headers,
    credentials: "same-origin",
    cache: "no-store",
    signal: options.signal,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  let payload: unknown = undefined;
  if (text.length > 0) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = undefined;
    }
  }

  if (!response.ok) {
    const described = apiErrorSchema.safeParse(payload);
    if (described.success) {
      throw new ApiError(
        described.data.statusCode,
        described.data.message,
        described.data.error
      );
    }
    // Not the API talking — a proxy, a gateway, or a process that fell over.
    throw new ApiError(
      response.status,
      response.statusText || `Request to ${url} failed`,
      "TransportError"
    );
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiShapeError(
      url,
      parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      }))
    );
  }

  return parsed.data;
}

export const api = {
  get: <T>(schema: z.ZodType<T>, path: string, options?: RequestOptions) =>
    request("GET", schema, path, undefined, options),

  post: <T>(
    schema: z.ZodType<T>,
    path: string,
    body?: unknown,
    options?: RequestOptions
  ) => request("POST", schema, path, body ?? {}, options),

  patch: <T>(
    schema: z.ZodType<T>,
    path: string,
    body?: unknown,
    options?: RequestOptions
  ) => request("PATCH", schema, path, body ?? {}, options),

  put: <T>(
    schema: z.ZodType<T>,
    path: string,
    body?: unknown,
    options?: RequestOptions
  ) => request("PUT", schema, path, body ?? {}, options),

  delete: <T>(
    schema: z.ZodType<T>,
    path: string,
    body?: unknown,
    options?: RequestOptions
  ) => request("DELETE", schema, path, body, options),
};

/** True for the one error every list screen has to draw a panel for. */
export const isPermissionDenied = (error: unknown): error is ApiError =>
  error instanceof ApiError && error.isPermissionDenied;

/**
 * The four copy slots a failing action needs, already translated. Named for
 * what the API said, not for the screen that asked.
 */
export type FailureCopy = {
  /** 409 — the thing already exists. */
  conflict: string;
  /** 404 — the endpoint or the record is not there. */
  notFound: string;
  /** 422 — the API read the input and refused it. */
  refused: string;
  /** Everything else, including a connection that never answered. */
  generic: string;
};

/** A headline the status supports, and the API's own sentence beneath it. */
export type Failure = { title: string; detail: string | null };

/**
 * WHAT A FAILED ACTION IS ALLOWED TO CLAIM.
 *
 * "That did not go through. Nothing was changed." is a diagnosis, and for three
 * of these statuses it is the wrong one — the sign-in screen's "wrong password"
 * over a rejected origin, again. A bare `catch {}` throws away both the API's
 * number and the API's sentence.
 *
 * The generic wording survives for the one case it was always true about:
 * nothing is known. A 500 says "boom" and a dropped socket says nothing at
 * all, so neither gets a detail line.
 */
export function describeFailure(error: unknown, copy: FailureCopy): Failure {
  if (!(error instanceof ApiError)) return { title: copy.generic, detail: null };

  const said = error.message.trim();
  const detail = said.length > 0 ? said : null;

  if (error.isConflict) return { title: copy.conflict, detail };
  if (error.isNotFound) return { title: copy.notFound, detail };
  if (error.isUnprocessable) return { title: copy.refused, detail };
  return { title: copy.generic, detail: null };
}

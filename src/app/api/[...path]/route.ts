/**
 * The BFF proxy. Every /api/* request the browser makes lands here and is
 * forwarded, unopened, to the NestJS API.
 *
 * Same-origin is the whole point. Because the browser only ever talks to
 * localhost:3002, the session cookie needs no SameSite=None, no Domain
 * attribute and no CORS entry — in development or in production — and the API
 * origin never appears in the client bundle. That includes /api/auth/*, which
 * Better Auth owns: it is proxied like everything else, so the cookie it sets
 * is a first-party cookie for this origin.
 *
 * The backend mounts a global `api` prefix and URI versioning, so a real path
 * is http://127.0.0.1:3001/api/v1/dashboard/orders. 127.0.0.1 rather than
 * localhost is deliberate: localhost resolves to ::1 first on Windows and Nest
 * listens on IPv4, so `localhost` here fails to connect for no visible reason.
 */
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
/** A proxy that caches is a proxy that serves one brand another brand's data. */
export const dynamic = "force-dynamic";

/**
 * Where to forward to, decided per request rather than at module load.
 *
 * This used to be `process.env.LOQAL_API_ORIGIN ?? "http://127.0.0.1:3001"`,
 * which is right in development and silently wrong in production: with the
 * variable unset, a deployed serverless function dials its own loopback,
 * nothing answers, and `fetch` throws. Next turns that into a 500 with an
 * empty body — no status, log line or response names the missing variable.
 * The storefront shipped exactly that failure; this proxy is the same code and
 * had the same hole, so it is closed here too rather than left to be found the
 * same way.
 *
 * Per request, not at module load: a throw at import time fails `next build`
 * outright, including for pages that need no API at all.
 */
function resolveApiOrigin(): string {
  const configured = process.env.LOQAL_API_ORIGIN;
  if (configured) return configured;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "LOQAL_API_ORIGIN is not set. This proxy has no backend to forward to — " +
        "set it to the API's origin (for example https://api.loqal.com) in the " +
        "deployment's environment variables."
    );
  }

  // 127.0.0.1 rather than localhost: localhost resolves to ::1 first on
  // Windows and Nest listens on IPv4, so `localhost` fails to connect here for
  // no visible reason.
  return "http://127.0.0.1:3001";
}

/**
 * What the browser is told when the forward never happened.
 *
 * Deliberately says nothing about the origin. Keeping the API origin out of
 * anything the client can see is the reason this proxy exists at all, and an
 * error body is still a response — the detail belongs in the server log, which
 * is where whoever can fix it is looking.
 */
const unreachable = (status: number) =>
  Response.json(
    {
      statusCode: status,
      error: status === 503 ? "Service Unavailable" : "Bad Gateway",
      message: "The API could not be reached. See the server logs for why.",
    },
    { status }
  );

/**
 * Framing is ours to decide, not the upstream's. We hand Next an unencoded
 * stream of unknown length; repeating the upstream's content-encoding or
 * content-length would describe a body that no longer exists.
 */
const NOT_OURS_TO_REPEAT = new Set([
  "content-encoding",
  "content-length",
  "transfer-encoding",
  "connection",
  "keep-alive",
]);

type RouteContext = { params: Promise<{ path: string[] }> };

async function proxy(request: NextRequest | Request, context: RouteContext) {
  const { path } = await context.params;
  const { search } = new URL(request.url);

  let target: string;
  try {
    target = `${resolveApiOrigin()}/api/${path.map(encodeURIComponent).join("/")}${search}`;
  } catch (error) {
    console.error("[api-proxy] misconfigured:", error);
    return unreachable(503);
  }

  const headers = new Headers(request.headers);
  // Host must describe the upstream, not us, or Nest builds wrong absolute URLs.
  headers.delete("host");
  // Length is recomputed by undici once the body is a stream.
  headers.delete("content-length");

  const hasBody = request.method !== "GET" && request.method !== "HEAD";

  // A connection that never opens is not an exception the caller can read.
  // Uncaught, it becomes a 500 with an empty body — indistinguishable from the
  // API itself failing, which sends whoever is debugging to the wrong service.
  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      body: hasBody ? request.body : undefined,
      // Streaming a request body through undici requires this; without it the
      // fetch throws "RequestInit: duplex option is required when sending a body".
      ...(hasBody ? { duplex: "half" } : {}),
      redirect: "manual",
      cache: "no-store",
    } as RequestInit);
  } catch (error) {
    console.error(`[api-proxy] ${request.method} ${target} failed:`, error);
    return unreachable(502);
  }

  const responseHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    const name = key.toLowerCase();
    if (NOT_OURS_TO_REPEAT.has(name) || name === "set-cookie") return;
    responseHeaders.set(key, value);
  });

  // Set-Cookie is the one header that legitimately repeats. Reading it through
  // the ordinary header API collapses several cookies into one comma-joined
  // string, which no browser will split back apart — the session then silently
  // never gets set. getSetCookie() is the only accessor that keeps them apart.
  for (const cookie of upstream.headers.getSetCookie()) {
    responseHeaders.append("set-cookie", cookie);
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const PUT = proxy;
export const DELETE = proxy;
export const HEAD = proxy;
export const OPTIONS = proxy;

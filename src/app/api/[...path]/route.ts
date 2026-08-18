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

const API_ORIGIN = process.env.LOQAL_API_ORIGIN ?? "http://127.0.0.1:3001";

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
  const target = `${API_ORIGIN}/api/${path.map(encodeURIComponent).join("/")}${search}`;

  const headers = new Headers(request.headers);
  // Host must describe the upstream, not us, or Nest builds wrong absolute URLs.
  headers.delete("host");
  // Length is recomputed by undici once the body is a stream.
  headers.delete("content-length");

  const hasBody = request.method !== "GET" && request.method !== "HEAD";

  const upstream = await fetch(target, {
    method: request.method,
    headers,
    body: hasBody ? request.body : undefined,
    // Streaming a request body through undici requires this; without it the
    // fetch throws "RequestInit: duplex option is required when sending a body".
    ...(hasBody ? { duplex: "half" } : {}),
    redirect: "manual",
    cache: "no-store",
  } as RequestInit);

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

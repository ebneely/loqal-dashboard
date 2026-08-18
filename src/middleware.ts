/**
 * Cookie presence, and deliberately nothing more.
 *
 * This is NOT an authorization check. Better Auth owns the session and the Nest
 * RolesGuard owns authorization; a middleware that also decided who may see
 * what would be a second policy, written in a second place, drifting out of
 * sync with the first the day a role changes. So this asks one question — is
 * there a session cookie at all — and lets the API answer everything else.
 *
 * getSessionCookie only reads the cookie. It does not validate the session: a
 * forged cookie gets past this and is then rejected by the API, which is the
 * correct division of labour and why nothing here is a security boundary.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export function middleware(request: NextRequest) {
  if (getSessionCookie(request)) return NextResponse.next();

  const signIn = request.nextUrl.clone();
  signIn.pathname = "/sign-in";
  signIn.search = "";
  // Where they were going, so signing in resumes it instead of dumping them on
  // a home screen that is not the thing they clicked.
  signIn.searchParams.set(
    "next",
    `${request.nextUrl.pathname}${request.nextUrl.search}`
  );

  return NextResponse.redirect(signIn);
}

export const config = {
  /**
   * Everything except the routes that must stay reachable without a session:
   * /sign-in and /set-password (a user with mustChangePassword has a session
   * but no usable password), /api (the proxy, including Better Auth's own
   * endpoints — redirecting those would break sign-in itself), and the static
   * assets.
   */
  matcher: [
    "/((?!sign-in|set-password|api|_next/static|_next/image|favicon.ico).*)",
  ],
};

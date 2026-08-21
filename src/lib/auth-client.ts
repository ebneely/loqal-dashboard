/**
 * The Better Auth browser client.
 *
 * No baseURL is set on purpose. Every call goes to /api/auth/... on this
 * origin, through the BFF proxy, so the session cookie is first-party: no
 * SameSite=None, no cookie Domain, no CORS entry, and the API origin never
 * reaches the browser bundle.
 */
"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";

import type { UserRole } from "@loqal/contracts/enums";

/**
 * The three columns the backend adds to Better Auth's user table.
 *
 * All three are declared `input: false` on the server: they are server-set,
 * readable by a client and settable by none. A screen that offers to change a
 * role or a brand is offering something the API will refuse, so no such UI
 * exists anywhere in this dashboard.
 */
export const authClient = createAuthClient({
  basePath: "/api/auth",
  plugins: [
    inferAdditionalFields({
      user: {
        role: { type: "string", input: false },
        brandId: { type: "string", required: false, input: false },
        mustChangePassword: { type: "boolean", input: false },
      },
    }),
  ],
});

/** Roles that can sign in to a console. SHOPPER buys; it never sees this app. */
export type ConsoleRole = Exclude<UserRole, "SHOPPER">;

/**
 * The user as the dashboard reads it. `inferAdditionalFields` can only widen
 * `role` to `string` — the server schema has no notion of a union — so the
 * union from the shared contract is reapplied here, which is what lets
 * `role === "BRAND_EMPLOYEE"` narrow instead of merely compile.
 */
export type SessionUser = Omit<
  typeof authClient.$Infer.Session.user,
  "role" | "brandId" | "mustChangePassword"
> & {
  role: ConsoleRole;
  brandId: string | null;
  mustChangePassword: boolean;
};

export type Session = Omit<typeof authClient.$Infer.Session, "user"> & {
  user: SessionUser;
};

export const { signIn, signOut, signUp, changePassword, getSession } = authClient;

/**
 * useSession, narrowed. Screens branch on `role`, so they need the union rather
 * than `string`; every consumer in this app goes through here.
 */
export function useSession() {
  const query = authClient.useSession();
  return query as Omit<typeof query, "data"> & { data: Session | null };
}

/**
 * Signing out, awaited.
 *
 * All three consoles used to do this inline:
 *
 *     void signOut();
 *     router.replace("/sign-in");
 *
 * which is a race, and a nasty one because it fails on the NEXT action rather
 * than this one. `signOut()` is a request whose response carries a Set-Cookie
 * that DELETES the session. Navigating without waiting means that response is
 * still in flight while the sign-in form is already on screen — so a user who
 * types fast enough gets their brand-new session cookie deleted by the tail of
 * the sign-out they triggered a second earlier. The sign-in looks like it did
 * nothing, tapping it again works, and nothing in the console explains why.
 *
 * So: await it, and refuse to fire twice while it is in flight. `pending` is
 * returned so the button can disable itself rather than queueing a second
 * request that would land even later than the first.
 *
 * The navigation happens whether or not the request succeeded. A failed
 * sign-out leaves a valid cookie, which the sign-in page will simply replace —
 * stranding somebody on a console they asked to leave is the worse answer.
 */
export function useConsoleSignOut() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const run = useCallback(async () => {
    if (pending) return;
    setPending(true);
    try {
      await signOut();
    } catch {
      // Deliberately swallowed — see the note above on navigating regardless.
    }
    router.replace("/sign-in");
    // The layouts are client components but the route they land on is
    // rendered by the server, which has just been told the cookie is gone.
    router.refresh();
  }, [pending, router]);

  return { signOut: run, pending };
}

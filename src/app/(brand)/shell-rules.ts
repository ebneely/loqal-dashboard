/**
 * The two decisions the brand shell makes, kept out of `layout.tsx`.
 *
 * A Next `layout.tsx` may export a default and a fixed set of route options and
 * nothing else; an extra named export fails `next build` with a type error
 * about an index signature that never mentions exports.
 */
import type { AppShellRole } from "@/components/loqal";

/**
 * Least privilege by construction.
 *
 * The session can carry SUPER_ADMIN or SALES — both have their own consoles —
 * and it can carry a value this build has never heard of after a backend
 * deploy. Only the literal string BRAND_OWNER opens the owner nav; everything
 * else is drawn as an employee. The failure mode of guessing wrong in the other
 * direction is showing a shop's balance to somebody who was never meant to see
 * it, so the default is the one that reveals less.
 */
export function shellRoleFor(role: string | undefined): AppShellRole {
  return role === "BRAND_OWNER" ? "BRAND_OWNER" : "BRAND_EMPLOYEE";
}

/** `/orders/0199…` is still the Orders screen. Match on the first segment. */
export function activeNavId(pathname: string): string {
  return pathname.split("/").filter(Boolean)[0] ?? "today";
}

/**
 * The two decisions the admin shell makes, kept out of `layout.tsx`.
 *
 * A Next `layout.tsx` may export a default and a fixed set of route options and
 * nothing else; an extra named export fails `next build` with a type error
 * about an index signature that never mentions exports. Same rule as
 * `(brand)/shell-rules.ts`, same reason.
 */
import type { AppShellRole } from "@/components/loqal";

/**
 * WHY THE ADMIN SCREENS SIT UNDER /admin RATHER THAN AT THE ROOT.
 *
 * `adminNav` in the domain layer already names every admin route, and it names
 * them `/admin/...`. That prefix is not decoration: the admin console has a
 * Products screen, an Orders screen and a Settings screen, and so does the
 * brand console. `(brand)/orders` and `(admin)/orders` both resolve to
 * `/orders`, which is not a styling clash — it is a hard `next build` failure
 * about two parallel pages resolving to the same path. So the route group is
 * `(admin)` (which contributes no URL segment and exists to hang this layout
 * on) and the folder beneath it is `admin/`, which contributes the segment the
 * nav already points at.
 */

/**
 * `AppShell`'s `role` is `BRAND_OWNER | BRAND_EMPLOYEE` — the two roles whose
 * navs differ from one another. The only thing the shell does with it is drop
 * `ownerOnly` entries, and `adminNav` marks none, so either value draws the
 * same eleven rows. `BRAND_OWNER` is passed because it is the value that hides
 * nothing, and hiding something here would be a silent lie about what a
 * SUPER_ADMIN can reach.
 *
 * BACKEND/DESIGN GAP, reported rather than worked around: `AppShellRole` has no
 * `SUPER_ADMIN` member, so this console cannot say what it is in the one prop
 * that asks. Every screen underneath still draws its own denied panel from the
 * API's own 403, which is the boundary that actually holds.
 */
export const ADMIN_SHELL_ROLE: AppShellRole = "BRAND_OWNER";

/** The role the API demands of every route in this console. */
export const ADMIN_REQUIRED_ROLE = "SUPER_ADMIN";

/**
 * `/admin/brands/0199…` is still the Brands screen. Match on the segment AFTER
 * `admin`, so a detail route keeps its list's nav entry lit.
 */
export function activeNavId(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  const afterAdmin = segments[0] === "admin" ? segments[1] : segments[0];
  return afterAdmin ?? "applications";
}

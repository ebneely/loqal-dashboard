import type { UserRole } from "@loqal/contracts/enums";

/**
 * The decisions the auth screens make that are worth testing on their own.
 *
 * They live beside the pages rather than inside them because a Next `page.tsx`
 * may export a default and a fixed set of route options and NOTHING else — an
 * extra named export fails `next build` with "Property 'X' is incompatible with
 * index signature ... not assignable to type 'never'", which does not mention
 * exports at all. Same rule for `layout.tsx`.
 */

/**
 * Better Auth's own minimum, from `minPasswordLength: 9` in
 * loqal-backend/src/core/auth/auth.instance.ts. Not a policy this screen
 * invented, and the reason the form checks length before it submits rather than
 * letting the API say no after the user has typed a password twice.
 */
export const MIN_PASSWORD_LENGTH = 9;

/**
 * `?next=` comes off the URL, so it is attacker-controlled.
 *
 * Only a rooted, same-origin path is honoured. "//evil.test/steal" is a
 * protocol-relative URL that a bare `startsWith("/")` check waves straight
 * through, and the result is a sign-in form that redirects a shop owner to
 * somebody else's site immediately after they typed their password.
 */
export function safeNext(raw: string | null, role: UserRole): string {
  const home = homeFor(role);

  if (!raw) return home;
  // "//evil.test/steal" is protocol-relative; a bare startsWith("/") waves it
  // through. Backslashes because some parsers normalise "/\evil.test" the same
  // way, and a "next" carrying its own scheme is never ours.
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return home;
  }

  // Same-origin is necessary but not sufficient. A SALES rep resuming
  // "/settings" would land on a brand screen that answers 403 to every call —
  // a broken page that also confirms the route exists. Sending them home is
  // both kinder and quieter.
  return mayEnter(raw, role) ? raw : home;
}

/**
 * Where a role belongs when it has not asked for anywhere in particular.
 *
 * ONE source of truth for landing. The root page, sign-in and the "wrong
 * console" bounce all read this, so a role can never be routed to two different
 * homes by two different files.
 */
export function homeFor(role: UserRole): string {
  switch (role) {
    case "SUPER_ADMIN":
      return "/admin/applications";
    case "SALES":
      return "/sales/pack";
    case "BRAND_OWNER":
    case "BRAND_EMPLOYEE":
      return "/today";
    case "SHOPPER":
    default:
      // A shopper has no console at all. Sending them to /today would 403 every
      // call and read as a broken dashboard rather than as "this account is not
      // for this app", so they land back on sign-in with an explanation.
      return "/sign-in?denied=no-console";
  }
}

/**
 * Which console a path belongs to, by prefix. Unlisted paths are shared
 * (/settings-less pages, /set-password), so every role may reach them.
 */
const CONSOLE_PREFIXES = [
  { prefix: "/admin", roles: ["SUPER_ADMIN"] },
  { prefix: "/sales", roles: ["SALES"] },
] as const satisfies readonly { prefix: string; roles: readonly UserRole[] }[];

/**
 * Everything that is not /admin or /sales is the brand console, and only the
 * two brand roles belong there. Stated as its own list rather than as "not a
 * shopper": a SALES rep is not a shopper either, and the looser reading let a
 * rep resume /settings — a brand screen that answers 403 to every call.
 */
const BRAND_CONSOLE_ROLES: readonly UserRole[] = ["BRAND_OWNER", "BRAND_EMPLOYEE"];

/**
 * NOT A SECURITY CHECK, and it must never become one.
 *
 * The Nest RolesGuard decides what a caller may read; this only decides where
 * the browser points. Duplicating authorization here would be a second policy
 * in a second place, drifting out of sync with the first the day a role
 * changes — the same reason `middleware.ts` refuses to decode the session and
 * asks only whether a cookie exists.
 *
 * So this is deliberately coarse: it keeps a role out of a console that would
 * only 403 at them, and nothing more.
 */
export function mayEnter(path: string, role: UserRole): boolean {
  const owner = CONSOLE_PREFIXES.find(
    (entry) => path === entry.prefix || path.startsWith(`${entry.prefix}/`)
  );

  // Admin and sales consoles are for their own role only.
  if (owner) return (owner.roles as readonly UserRole[]).includes(role);

  // Everything else is the brand console.
  return BRAND_CONSOLE_ROLES.includes(role);
}

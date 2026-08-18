/**
 * The two decisions the auth screens make that are worth testing on their own.
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
export function safeNext(raw: string | null): string {
  if (!raw) return "/today";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/today";
  return raw;
}

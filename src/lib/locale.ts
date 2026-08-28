/**
 * Bilingual AR/EN seam.
 *
 * The catalogues were complete long before anything could reach them: every
 * string in all three consoles exists in Arabic, held in step with English by
 * a type and a test. What was missing was the switch. The source of truth is
 * now a cookie, read on the server so the first paint is already in the right
 * language and the right direction — no flash of English, no layout flipping
 * after hydration.
 *
 * Reading a cookie makes these routes dynamic. That costs nothing here: every
 * page in this console is behind a session and was already rendered per
 * request. (The storefront makes the opposite call for the opposite reason —
 * its catalogue pages are static and must stay that way.)
 */

export type Locale = "en" | "ar";

export const locales: readonly Locale[] = ["en", "ar"];

export const defaultLocale: Locale = "en";

/** Where the choice lives. A preference, not a credential. */
export const LOCALE_COOKIE = "loqal_locale";

export const isLocale = (value: unknown): value is Locale =>
  value === "en" || value === "ar";

export function localeDir(locale: Locale): "ltr" | "rtl" {
  return locale === "ar" ? "rtl" : "ltr";
}

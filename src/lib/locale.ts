/**
 * Bilingual AR/EN seam.
 *
 * There is no locale routing or translation system wired up yet — that is
 * a separate task. This module exists so RootLayout never hardcodes `lang`
 * / `dir` as disconnected literals: both are derived from a single
 * `Locale` value here, so swapping the source of truth later (a route
 * param, a cookie, a user preference) is a one-line change in this file,
 * not a rewrite of the layout.
 */

export type Locale = "en" | "ar";

export const defaultLocale: Locale = "en";

export function localeDir(locale: Locale): "ltr" | "rtl" {
  return locale === "ar" ? "rtl" : "ltr";
}

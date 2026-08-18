"use client";

/**
 * The current locale, in one place.
 *
 * Domain components take an explicit `locale` prop — a screen that renders an
 * Arabic preview inside an English console has to be able to say so — but no
 * screen should have to thread it through five levels of props to get there, so
 * the prop falls back to this context and the context falls back to the app
 * default.
 */
import { createContext, useContext, useMemo, type ReactNode } from "react";

import { defaultLocale, localeDir, type Locale } from "@/lib/locale";
import { getMessages, type Messages } from "@/messages";

const LocaleContext = createContext<Locale>(defaultLocale);

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  return (
    <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
  );
}

export const useLocale = (): Locale => useContext(LocaleContext);

/** The direction that belongs to the current locale. */
export const useDir = (): "ltr" | "rtl" => localeDir(useLocale());

/** The catalogue for the current locale, or for one named explicitly. */
export function useMessages(locale?: Locale): Messages {
  const current = useLocale();
  const resolved = locale ?? current;
  return useMemo(() => getMessages(resolved), [resolved]);
}

/**
 * The prop every domain component shares. Omitted means "whatever the console
 * is set to", which is the right default everywhere except a deliberate
 * side-by-side preview.
 */
export type WithLocale = { locale?: Locale };

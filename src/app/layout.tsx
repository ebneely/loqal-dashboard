import type { Metadata } from "next";
import { Noto_Kufi_Arabic } from "next/font/google";

import { DirectionProvider } from "@/components/ui/direction";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cookies } from "next/headers";

import { LOCALE_COOKIE, defaultLocale, isLocale, localeDir } from "@/lib/locale";
import { LocaleProvider } from "@/lib/locale-context";

import "./globals.css";

// The storefront's face, so the shop and its back office read as one brand:
// Noto Kufi Arabic for everything, in both scripts. Self-hosted via
// next/font (zero layout shift, no runtime request to fonts.googleapis.com).
const notoKufi = Noto_Kufi_Arabic({
  subsets: ["latin", "arabic"],
  variable: "--font-noto-kufi",
  display: "swap",
});

export const metadata: Metadata = {
  title: "loqaaal Dashboard",
  description: "loqaaal back-office console",
};

/**
 * Resolved on the SERVER, from the cookie the switch writes.
 *
 * `lang` and `dir` are attributes of <html>, which only the server renders.
 * Deciding the language on the client instead would paint an English,
 * left-to-right console first and flip it after hydration — visible on every
 * load, and worse on a slow connection than no switch at all.
 *
 * This makes the routes dynamic, which costs nothing: every page in this
 * console is behind a session and was already rendered per request.
 */
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const stored = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale = isLocale(stored) ? stored : defaultLocale;
  const dir = localeDir(locale);

  return (
    <html
      lang={locale}
      dir={dir}
      className={notoKufi.variable}
      suppressHydrationWarning
    >
      <body>
        <DirectionProvider dir={dir}>
          <LocaleProvider locale={locale}>
            <TooltipProvider>{children}</TooltipProvider>
            {/* sonner's Toaster, mounted once. Toasts are for things that
                succeeded; a refusal gets a ListState panel that stays put. */}
            <Toaster position="top-center" dir={dir} />
          </LocaleProvider>
        </DirectionProvider>
      </body>
    </html>
  );
}

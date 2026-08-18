import type { Metadata } from "next";
import { Readex_Pro, Source_Code_Pro } from "next/font/google";

import { DirectionProvider } from "@/components/ui/direction";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { defaultLocale, localeDir } from "@/lib/locale";
import { LocaleProvider } from "@/lib/locale-context";

import "./globals.css";

// Readex Pro: the interface face. One family covering Latin and Arabic
// with matched proportions — its Arabic is a first-class design, not a
// fallback, so an Arabic row and an English row sit at the same height
// in the same table. Self-hosted via next/font (zero layout shift, no
// runtime request to fonts.googleapis.com).
const readexPro = Readex_Pro({
  subsets: ["latin", "arabic"],
  variable: "--font-readex-pro",
  display: "swap",
});

// Source Code Pro: the figures face for money, SKUs, IDs, phone numbers.
// A humanist mono with a dotted zero, footed 1 and true tabular widths.
const sourceCodePro = Source_Code_Pro({
  subsets: ["latin"],
  variable: "--font-source-code-pro",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Loqal Dashboard",
  description: "Loqal back-office console",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = defaultLocale;
  const dir = localeDir(locale);

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${readexPro.variable} ${sourceCodePro.variable}`}
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

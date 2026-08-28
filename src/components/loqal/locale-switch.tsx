"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { LOCALE_COOKIE, locales, type Locale } from "@/lib/locale";
import { useLocale } from "@/lib/locale-context";
import { cn } from "@/lib/utils";

/**
 * العربية / English, as a segmented control showing both at once.
 *
 * NOT a single button that flips. A one-button toggle has to answer "does this
 * label name the language I am in, or the one I would get?", and every product
 * answers it differently — so the person has to press it to find out. Showing
 * both with one marked cannot be read the wrong way.
 *
 * Each label is written in its OWN script and carries `lang`, so a screen
 * reader pronounces "English" in English inside an Arabic console instead of
 * spelling it out letter by letter, and so neither label is a translation of
 * the other. That is also why these two strings are not in the message
 * catalogues: a language names itself the same way whatever console it sits in.
 *
 * `aria-pressed` on both rather than `aria-current`: these are two toggle
 * buttons in a group, one of which is on, which is exactly what a pressed state
 * announces.
 *
 * The cookie is written here and the page is refreshed rather than re-rendered
 * from context. The layout resolves `lang` and `dir` on the SERVER, so a
 * client-only flip would leave an Arabic console still laid out left-to-right
 * until the next navigation.
 */

const LABEL: Record<Locale, string> = { ar: "العربية", en: "English" };

export function LocaleSwitch({ className }: { className?: string }) {
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div
      role="group"
      /* Named in both languages: this control is the one thing on the page
         somebody reading the "wrong" language still has to be able to find. */
      aria-label="اللغة / Language"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md border border-border bg-background p-0.5",
        className
      )}
    >
      {locales.map((code) => {
        const active = locale === code;

        return (
          <button
            key={code}
            type="button"
            lang={code}
            aria-pressed={active}
            disabled={pending}
            onClick={() => {
              // Pressing the language already in effect would reload the page
              // to arrive where it already is.
              if (active) return;

              document.cookie = `${LOCALE_COOKIE}=${code}; path=/; max-age=${
                60 * 60 * 24 * 365
              }; samesite=lax`;
              startTransition(() => router.refresh());
            }}
            className={cn(
              "min-h-8 rounded-sm px-2.5 text-xs font-medium transition-colors disabled:opacity-60",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            {LABEL[code]}
          </button>
        );
      })}
    </div>
  );
}

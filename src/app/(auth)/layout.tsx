"use client";

/**
 * The frame both auth screens share.
 *
 * Composed from shadcn primitives: none — this is plain layout around the
 * children, which supply their own Field/Input/Button/Alert.
 *
 * Bottom-anchored below md, centred at md and up. On a 390px phone the card
 * sits at the foot of the viewport so the submit button lands under a thumb
 * without the phone being shuffled down the palm; on a laptop a form pinned to
 * the bottom edge looks broken, so it centres.
 *
 * There is deliberately no nav, no back link and no console chrome. A user
 * reaching either of these screens either has no session or has one that cannot
 * be used yet, and every link out of here would go somewhere the API refuses.
 */
import type { ReactNode } from "react";

import { useMessages } from "@/lib/locale-context";

export default function AuthLayout({ children }: { children: ReactNode }) {
  const t = useMessages();

  return (
    <main className="flex min-h-svh flex-col justify-end px-gutter-phone py-6 md:justify-center md:px-gutter-md lg:px-gutter-lg">
      <div className="mx-auto grid w-full max-w-[380px] gap-5">
        <div className="flex items-baseline gap-2">
          <span className="text-base font-semibold tracking-tight text-foreground">
            Loqal
          </span>
          <span className="text-xs font-medium uppercase tracking-caps text-muted-foreground">
            {t.brand.consoleLabel}
          </span>
        </div>
        {children}
      </div>
    </main>
  );
}

/**
 * Composed from shadcn primitives: Separator (the buttons inside are the
 * caller's, normally shadcn Button).
 *
 * Thumb reach. The primary action of a phone screen lives at the bottom of the
 * viewport, not in the top right of a header where a one-handed user has to
 * shuffle the phone down their palm to reach it — with a customer waiting and,
 * often, something in the other hand.
 *
 * It is fixed to the viewport below md and gone at md and up, where the action
 * belongs beside the thing it acts on. It also pads for the home indicator, so
 * on an iPhone the button is not sitting under the swipe bar.
 *
 * `hideAt="never"` is the third case, and it exists to fix an ACCESSIBILITY
 * bug rather than a duplication one. A detail screen that wants one primary
 * button at all widths had to render the control twice — once in a
 * `hidden md:block` and once inside the bar — which puts two elements with the
 * same accessible name in the tree. A screen-reader user hears "Mark packed,
 * button" twice with nothing distinguishing them. With `never` the bar keeps
 * its thumb-reach position below md and becomes an ordinary block in the flow
 * at md and up, so ONE control serves both breakpoints. Place it where the
 * action belongs at a desk, because at md that is exactly where it will sit.
 */
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type MobileActionBarProps = {
  /** The primary action. One button; if there are two, pass `secondary`. */
  children: ReactNode;
  /** A quieter action, placed at the inline start of the primary one. */
  secondary?: ReactNode;
  /** One line under the buttons — what will happen, not how to do it. */
  hint?: ReactNode;
  /**
   * Breakpoint at which the bar stops existing, or `never` to keep the same
   * control at every width — fixed below md, static and unstyled at md and up.
   */
  hideAt?: "md" | "lg" | "never";
  className?: string;
};

const HIDE_AT = {
  md: "md:hidden",
  lg: "lg:hidden",
  /**
   * Not hidden — unwrapped. At md it stops being a bar: no fixed position, no
   * top border, no backdrop, no bar shadow and no phone gutter, so it reads as
   * whatever block it was placed inside rather than as a floating tray stuck to
   * the bottom of a desktop window.
   */
  never:
    "md:static md:z-auto md:bg-transparent md:px-0 md:pt-0 md:pb-0 md:shadow-none md:backdrop-blur-none",
} as const;

export function MobileActionBar({
  children,
  secondary,
  hint,
  hideAt = "md",
  className,
}: MobileActionBarProps) {
  return (
    <div
      data-slot="mobile-action-bar"
      data-hide-at={hideAt}
      className={cn(
        // `.lq-actionbar`. STICKY, not fixed: a sticky bar keeps a placeholder
        // in the flow, so it cannot cover the last row of a list and needs no
        // spacer under it. It also drops from z-40 to z-20 — the sheet overlay
        // sits at 40, and a fixed bar at 40 was painting over the overlay of
        // the very sheet its own button opened.
        "lq-actionbar sticky inset-x-0 bottom-0 z-20 grid gap-2 px-gutter-phone pt-3 backdrop-blur-[10px]",
        // 88% of --background, not `/95`: the design system's one permitted
        // translucency, mixed rather than composited, so it lands on the same
        // value in light and dark.
        "bg-[color-mix(in_oklab,var(--background)_88%,transparent)]",
        // shadow-bar already carries the 1px top rule as its first layer,
        // which is why there is no border-t here.
        "shadow-bar",
        // The home indicator lives here on iOS; without this the button's
        // bottom half is under the system swipe area.
        "pb-[max(0.75rem,env(safe-area-inset-bottom))]",
        secondary && "grid-cols-[auto_1fr] items-center",
        HIDE_AT[hideAt],
        className
      )}
    >
      {secondary ? <div className="shrink-0">{secondary}</div> : null}
      <div className="[&>a]:w-full [&>button]:w-full">{children}</div>
      {hint ? (
        <p className="lq-actionbar-hint col-span-full">{hint}</p>
      ) : null}
    </div>
  );
}

/**
 * Kept as an export, and now renders nothing.
 *
 * It existed because the bar was `fixed` and therefore out of flow, so the
 * last row of a list sat permanently underneath it. The bar is `sticky` now,
 * as the design system specifies, which means it reserves its own space in
 * the flow — a spacer on top of that is 96px of dead scroll at the end of
 * every list. Call sites can drop it; leaving it in place is harmless.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function MobileActionBarSpacer(props: {
  hideAt?: "md" | "lg" | "never";
}) {
  return null;
}

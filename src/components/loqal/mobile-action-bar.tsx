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
    "md:static md:z-auto md:border-t-0 md:bg-transparent md:px-0 md:pt-0 md:pb-0 md:shadow-none md:backdrop-blur-none",
} as const;

/**
 * The spacer's rule is different from the bar's: it exists wherever the bar is
 * FIXED, which for `never` is still everything below md.
 */
const SPACER_AT = {
  md: "md:hidden",
  lg: "lg:hidden",
  never: "md:hidden",
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
        "fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-gutter-phone pt-3 backdrop-blur",
        // The home indicator lives here on iOS; without this the button's
        // bottom half is under the system swipe area.
        "pb-[max(0.75rem,env(safe-area-inset-bottom))]",
        "shadow-bar",
        HIDE_AT[hideAt],
        className
      )}
    >
      <div className="flex items-center gap-2 [&>*]:min-h-11">
        {secondary ? <div className="shrink-0">{secondary}</div> : null}
        <div className="flex-1 [&>button]:w-full [&>a]:w-full">{children}</div>
      </div>
      {hint ? (
        <p className="mt-1.5 text-center text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Spacer for the bottom of a scrolling list, so the last row is not permanently
 * hidden behind the bar. Screens that use MobileActionBar should end with it.
 */
export function MobileActionBarSpacer({
  hideAt = "md",
}: {
  hideAt?: "md" | "lg" | "never";
}) {
  return (
    <div
      aria-hidden="true"
      className={cn("h-24", SPACER_AT[hideAt])}
      data-slot="mobile-action-bar-spacer"
    />
  );
}

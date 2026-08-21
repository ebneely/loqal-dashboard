"use client"

import * as React from "react"
import { Progress as ProgressPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * Values transcribed from `.lq-progress` / `.lq-progress-bar`. Two changes
 * from the stock shadcn progress: the track is 8px, not 6; and the bar
 * animates its own `inline-size` over 320ms rather than translating a
 * full-width indicator, which is what the design system specifies and what
 * keeps the bar's `rounded-full` end cap where the value actually is.
 */
function Progress({
  className,
  value,
  tone = "default",
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & {
  tone?: "default" | "wait" | "bad"
}) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      data-tone={tone}
      className={cn("relative h-2 w-full rounded-full bg-muted", className)}
      value={value}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className="absolute inset-y-0 start-0 rounded-full bg-primary [transition:inline-size_320ms_var(--ease-out),background-color_var(--dur-fast)_var(--ease-in-out)] in-data-[tone=bad]:bg-destructive in-data-[tone=wait]:bg-state-wait-fg"
        style={{ inlineSize: `${value ?? 0}%` }}
      />
    </ProgressPrimitive.Root>
  )
}

/**
 * `.lq-progress-mark` — a target line on the track (a settlement threshold,
 * a stock reorder point). Positioned by percentage along the inline axis.
 */
function ProgressMark({
  className,
  at,
  style,
  ...props
}: React.ComponentProps<"span"> & { at: number }) {
  return (
    <span
      data-slot="progress-mark"
      aria-hidden
      className={cn(
        "absolute inset-y-[-3px] w-0.5 -translate-x-1/2 rounded-[1px] bg-foreground opacity-45",
        className
      )}
      style={{ insetInlineStart: `${at}%`, ...style }}
      {...props}
    />
  )
}

export { Progress, ProgressMark }

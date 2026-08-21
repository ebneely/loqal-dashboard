import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Values transcribed from the design system's `.lq-card*` rules. The stock
 * shadcn card differed on every dimension that reads: it drew a `ring-1`
 * instead of the system's 1px `--border` (a ring paints outside the box, so
 * adjacent cards sat 2px apart instead of 1), `rounded-xl` instead of
 * `--radius-lg`, 24px padding instead of 16, a medium title instead of
 * semibold, and a 14px description instead of 12.
 */
function Card({
  className,
  size = "default",
  interactive = false,
  ...props
}: React.ComponentProps<"div"> & {
  size?: "default" | "sm"
  /**
   * `.lq-card--interactive`: a 1px lift and a border shift toward the
   * foreground on hover, dropping to `--accent` on press. For a whole card
   * that is one tap target — a list row, a nav card.
   */
  interactive?: boolean
}) {
  return (
    <div
      data-slot="card"
      data-size={size}
      className={cn(
        // py + gap on the root reproduce the design system's per-part
        // paddings exactly: 16 above the header, 16 between each part, 16
        // below the footer. `.lq-card-content` gets `padding-block-start:0`
        // there for the same reason the gap supplies it here.
        "group/card flex flex-col gap-(--card-spacing) rounded-lg border border-border bg-card py-(--card-spacing) text-sm text-card-foreground shadow-xs [--card-spacing:--spacing(4)] has-[>img:first-child]:pt-0 data-[size=sm]:[--card-spacing:--spacing(3)] *:[img:first-child]:rounded-t-lg *:[img:last-child]:rounded-b-lg",
        interactive &&
          "cursor-pointer [transition:border-color_var(--dur-fast)_var(--ease-in-out),background-color_var(--dur-fast)_var(--ease-in-out),transform_var(--dur-fast)_var(--ease-out),box-shadow_var(--dur-fast)_var(--ease-out)] hover:-translate-y-px hover:border-[color-mix(in_oklab,var(--border)_45%,var(--foreground))] hover:bg-[color-mix(in_oklab,var(--card)_97%,var(--foreground))] hover:shadow-sm active:translate-y-0 active:scale-[0.995] active:bg-accent active:shadow-none",
        className
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-t-lg px-(--card-spacing) has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-(--card-spacing)",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        "font-heading text-base font-semibold tracking-tight [unicode-bidi:plaintext] group-data-[size=sm]/card:text-sm",
        className
      )}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-xs text-muted-foreground [unicode-bidi:plaintext]", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

/**
 * `.lq-card-content` is a plain block in the design system — the call site
 * supplies its own grid and gap, because a card body is as often a two-column
 * field grid as it is a stack. It used to be `flex flex-col gap-3` here.
 */
function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-(--card-spacing)", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center gap-2 rounded-b-lg px-(--card-spacing) [.border-t]:pt-(--card-spacing)",
        className
      )}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}

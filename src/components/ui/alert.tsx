import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * `.lq-alert` — a 12/16 grid with a 16px leading glyph. The class name is
 * kept on the element on purpose: the design system's entrance-motion
 * section (copied verbatim into loqal-components.css) attaches
 * `loqal-rise` to `.lq-alert`, so wearing the class is what makes an alert
 * arrive rather than appear. Everything else here is Tailwind.
 *
 * The three tinted variants are the state tones, not `--destructive` —
 * `destructive` is a button fill; an alert is a `--state-bad-*` triplet, so
 * it needs no opacity arithmetic to sit on a card.
 */
const alertVariants = cva(
  "lq-alert group/alert relative grid w-full gap-0.5 rounded-lg border border-border px-4 py-3 text-start text-sm has-data-[slot=alert-action]:relative has-data-[slot=alert-action]:pe-18 has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-3 *:[svg]:row-span-2 *:[svg]:mt-px *:[svg]:text-current *:[svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground",
        info: "border-state-live-border bg-state-live-bg text-state-live-fg *:data-[slot=alert-description]:text-current *:data-[slot=alert-description]:opacity-86",
        wait: "border-state-wait-border bg-state-wait-bg text-state-wait-fg *:data-[slot=alert-description]:text-current *:data-[slot=alert-description]:opacity-86",
        destructive:
          "border-state-bad-border bg-state-bad-bg text-state-bad-fg *:data-[slot=alert-description]:text-current *:data-[slot=alert-description]:opacity-86",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "font-semibold [unicode-bidi:plaintext] group-has-[>svg]/alert:col-start-2 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "text-xs leading-snug text-balance text-muted-foreground [unicode-bidi:plaintext] md:text-pretty [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground [&_p:not(:last-child)]:mb-4",
        className
      )}
      {...props}
    />
  )
}

function AlertAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-action"
      className={cn("absolute top-2.5 end-3", className)}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription, AlertAction }

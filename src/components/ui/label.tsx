"use client"

import * as React from "react"
import { Label as LabelPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * `.lq-label`. The design system's rule carries `margin-block-end: 8px`;
 * that is deliberately NOT reproduced here because every call site already
 * wraps the label and its field in `grid gap-2`, which is the same 8px —
 * adding the margin too would double it. What did change: `leading-none`
 * is gone, so the label sits on the system's 1.5 line height like the rest
 * of the body copy rather than collapsing to its own cap height.
 */
function Label({
  className,
  optional = false,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root> & {
  /** `.lq-label[data-optional]` — appends a muted, regular-weight " optional". */
  optional?: boolean
}) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      data-optional={optional || undefined}
      className={cn(
        "flex items-center gap-2 text-sm font-medium text-foreground select-none",
        "data-optional:after:font-normal data-optional:after:text-xs data-optional:after:text-muted-foreground data-optional:after:content-['_optional']",
        "group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

/**
 * `.lq-field-hint` — shadcn's FormMessage without react-hook-form, which
 * this system does not carry. `plaintext` bidi so an English hint inside an
 * RTL form keeps its own punctuation.
 */
function FieldHint({
  className,
  invalid = false,
  ...props
}: React.ComponentProps<"p"> & { invalid?: boolean }) {
  return (
    <p
      data-slot="field-hint"
      data-invalid={invalid || undefined}
      className={cn(
        "text-xs text-muted-foreground [unicode-bidi:plaintext] data-invalid:text-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Label, FieldHint }

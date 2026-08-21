"use client"

import * as React from "react"
import { Checkbox as CheckboxPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { CheckIcon } from "lucide-react"

/**
 * `.lq-check-box` — 18px, `--radius-sm`, an opaque `--background` fill.
 * Two motions the design system specifies and the stock component had
 * neither of: the box squashes to 0.9 while held, and the tick scales in
 * from 0.3 (`loqal-check-in`) rather than appearing on a frame.
 */
function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer relative grid size-[18px] shrink-0 place-items-center rounded-sm border border-input bg-background outline-none [transition:background-color_var(--dur-fast)_var(--ease-in-out),border-color_var(--dur-fast)_var(--ease-in-out),scale_var(--dur-fast)_var(--ease-out)]",
        // Expands the hit area to the 44px tap floor without moving the box.
        "after:absolute after:-inset-x-3 after:-inset-y-2",
        "hover:border-[color-mix(in_oklab,var(--input)_55%,var(--foreground))] active:scale-90",
        "data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground",
        "disabled:pointer-events-none disabled:opacity-50 group-has-disabled/field:opacity-50",
        "aria-invalid:border-destructive aria-invalid:aria-checked:border-primary",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current [&>svg]:size-[13px] [&>svg]:animate-[loqal-check-in_var(--dur-base)_var(--ease-out)]"
      >
        <CheckIcon />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }

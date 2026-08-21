"use client"

import * as React from "react"
import { Switch as SwitchPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * `.lq-switch-track` / `.lq-switch-thumb` — a 38x22 track with an 18px
 * thumb that slides on `inset-inline-start`, not `translateX`. That is the
 * design system's RTL rule working: a logical offset mirrors under
 * `dir="rtl"` on its own, so none of the six `rtl:-translate-x-*` overrides
 * the stock component carried are needed. The thumb also stretches to 22px
 * while held.
 */
function Switch({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: "sm" | "default"
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer group/switch relative inline-flex shrink-0 rounded-full border border-transparent outline-none [transition:background-color_var(--dur-fast)_var(--ease-in-out)]",
        "after:absolute after:-inset-x-3 after:-inset-y-2",
        // default is the design system's 38x22; sm is an app extension,
        // stepped down proportionally rather than given invented numbers.
        "data-[size=default]:h-[22px] data-[size=default]:w-[38px] data-[size=sm]:h-[18px] data-[size=sm]:w-[30px]",
        "data-checked:bg-primary data-unchecked:bg-input",
        "data-disabled:cursor-not-allowed data-disabled:opacity-50",
        "aria-invalid:border-destructive",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none absolute top-0.5 block rounded-full bg-background shadow-xs ring-0 [transition:inset-inline-start_var(--dur-base)_var(--ease-out),inline-size_var(--dur-fast)_var(--ease-out)]",
          "group-data-[size=default]/switch:size-[18px] group-data-[size=sm]/switch:size-[14px]",
          "start-0.5 group-data-[size=default]/switch:data-checked:start-[18px] group-data-[size=sm]/switch:data-checked:start-[14px]",
          "group-active/switch:group-data-[size=default]/switch:w-[22px] group-active/switch:group-data-[size=sm]/switch:w-[18px]",
          "dark:data-checked:bg-primary-foreground dark:data-unchecked:bg-foreground"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }

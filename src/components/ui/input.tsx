import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * `.lq-input` — 40px tall, 12px inline padding, an opaque `--background`
 * fill. Focus is the design system's own treatment: the border becomes
 * `--ring` and takes a 3px 22%-alpha ring, and the global
 * `:focus-visible` outline is suppressed so the field does not read twice.
 * Disabled is a `--muted` fill, not 50% opacity — a greyed-out field on a
 * dense card still has to be legible.
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "block h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none [transition:border-color_var(--dur-fast)_var(--ease-in-out),box-shadow_var(--dur-fast)_var(--ease-in-out)]",
        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground",
        "hover:border-[color-mix(in_oklab,var(--input)_60%,var(--foreground))]",
        "focus:border-ring focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--ring)_22%,transparent)] focus:outline-none",
        "disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground",
        "data-invalid:border-destructive aria-invalid:border-destructive",
        // A figures field (money, SKU, phone) is monospace and tabular.
        "data-num:font-mono",
        className
      )}
      {...props}
    />
  )
}

export { Input }

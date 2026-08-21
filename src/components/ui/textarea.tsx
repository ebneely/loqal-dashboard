import * as React from "react"

import { cn } from "@/lib/utils"

/** `.lq-textarea` — shares the input's chrome; 80px floor, 10/12 padding. */
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "block min-h-20 w-full resize-y rounded-md border border-input bg-background px-3 py-2.5 text-sm leading-snug text-foreground outline-none [transition:border-color_var(--dur-fast)_var(--ease-in-out),box-shadow_var(--dur-fast)_var(--ease-in-out)]",
        "placeholder:text-muted-foreground",
        "hover:border-[color-mix(in_oklab,var(--input)_60%,var(--foreground))]",
        "focus:border-ring focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--ring)_22%,transparent)] focus:outline-none",
        "disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground",
        "data-invalid:border-destructive aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }

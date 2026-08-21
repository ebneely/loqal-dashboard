import * as React from "react"

import { cn } from "@/lib/utils"
import { ChevronDownIcon } from "lucide-react"

/**
 * `.lq-select-trigger`, on a native <select>. The 17 screens that use this
 * are the design system's Select as far as the user is concerned, so it takes
 * the same chrome as Input: 40px, 12px inline padding, an opaque
 * `--background` fill, a `color-mix` hover on the border and the 3px
 * 22%-alpha focus ring — not the stock component's `focus-visible:ring-3
 * ring-ring/50` stacked on top of the global outline.
 *
 * `w-full` rather than `w-fit`: a select whose width tracks its longest
 * option makes a form column ragged, and every call site here sits in a
 * labelled field.
 */

type NativeSelectProps = Omit<React.ComponentProps<"select">, "size"> & {
  size?: "sm" | "default"
}

function NativeSelect({
  className,
  size = "default",
  ...props
}: NativeSelectProps) {
  return (
    <div
      className={cn(
        "group/native-select relative w-full",
        className
      )}
      data-slot="native-select-wrapper"
      data-size={size}
    >
      <select
        data-slot="native-select"
        data-size={size}
        className={cn(
          "h-10 w-full min-w-0 cursor-pointer appearance-none rounded-md border border-input bg-background ps-3 pe-8 text-start text-sm text-foreground outline-none select-none [transition:border-color_var(--dur-fast)_var(--ease-in-out),box-shadow_var(--dur-fast)_var(--ease-in-out)]",
          "hover:border-[color-mix(in_oklab,var(--input)_60%,var(--foreground))]",
          "focus:border-ring focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--ring)_22%,transparent)] focus:outline-none",
          "disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground",
          "data-invalid:border-destructive aria-invalid:border-destructive",
          // The design system has one select height; sm is an app extension
          // stepped off the button's own sm row.
          "data-[size=sm]:h-8 data-[size=sm]:text-xs"
        )}
        {...props}
      />
      <ChevronDownIcon
        className="pointer-events-none absolute top-1/2 end-2.5 size-4 -translate-y-1/2 text-muted-foreground select-none"
        aria-hidden="true"
        data-slot="native-select-icon"
      />
    </div>
  )
}

function NativeSelectOption({
  className,
  ...props
}: React.ComponentProps<"option">) {
  return (
    <option
      data-slot="native-select-option"
      className={cn("bg-[Canvas] text-[CanvasText]", className)}
      {...props}
    />
  )
}

function NativeSelectOptGroup({
  className,
  ...props
}: React.ComponentProps<"optgroup">) {
  return (
    <optgroup
      data-slot="native-select-optgroup"
      className={cn("bg-[Canvas] text-[CanvasText]", className)}
      {...props}
    />
  )
}

export { NativeSelect, NativeSelectOptGroup, NativeSelectOption }

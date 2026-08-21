"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * Values transcribed from the design system's `.lq-btn` rules
 * (ClaudeDesignSystem/_ds/.../css/components.css). Three things the stock
 * shadcn button did that this system explicitly forbids and that are fixed
 * here: hover was an opacity change (`bg-primary/80`) where the system says
 * darken 12% via color-mix — opacity on a dense card reveals the row behind
 * it; press was `translate-y-px` where the system's whole press language is
 * `scale(0.985)`; and focus stacked a 3px ring on top of the global
 * `2px solid var(--ring)` outline, so it read twice.
 */
const buttonVariants = cva(
  "group/button relative isolate inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-md border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap outline-none select-none active:scale-[0.985] disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [transition:background-color_var(--dur-fast)_var(--ease-in-out),color_var(--dur-fast)_var(--ease-in-out),border-color_var(--dur-fast)_var(--ease-in-out),transform_var(--dur-fast)_var(--ease-out)] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-[color-mix(in_oklab,var(--primary)_88%,black)]",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklab,var(--secondary)_92%,black)]",
        outline:
          "border-border bg-background text-foreground hover:bg-accent aria-expanded:bg-accent",
        ghost: "bg-transparent text-foreground hover:bg-accent aria-expanded:bg-accent",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-[color-mix(in_oklab,var(--destructive)_88%,black)]",
        link: "h-auto bg-transparent px-0 text-primary underline-offset-[3px] hover:underline",
      },
      size: {
        default: "h-9 px-3.5 in-data-[slot=button-group]:rounded-md",
        sm: "h-8 rounded-sm px-2.5 text-xs in-data-[slot=button-group]:rounded-md",
        lg: "h-11 px-5 text-base",
        icon: "size-9 px-0",
        /**
         * The thumb-reach primary action — 52px, full width, bottom of the
         * screen. `MobileActionBar` is the container this size assumes.
         */
        tap: "h-tap-primary w-full rounded-lg px-5 text-base",
        /**
         * Not in the design system, which stops at sm/default/lg/icon. Kept
         * because call sites already use them; stepped off the sm and lg
         * rows above rather than given invented numbers. Icon-only, so the
         * system's 14px floor for interactive *text* does not apply.
         */
        xs: "h-6 gap-1 rounded-sm px-2 text-xs in-data-[slot=button-group]:rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-xs":
          "size-6 rounded-sm px-0 in-data-[slot=button-group]:rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8 rounded-sm px-0 in-data-[slot=button-group]:rounded-md",
        "icon-lg": "size-11 px-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

type Ripple = { key: number; x: number; y: number; size: number }

/**
 * "A ripple from the touch point, 520ms, currentColor at 32% — the only
 * confirmation a tap landed before the network answers." Sits at z-index -1
 * under the label, which is why the root is `isolate`.
 */
function useRipple(disabled?: boolean) {
  const [ripples, setRipples] = React.useState<Ripple[]>([])
  const nextKey = React.useRef(0)

  const spawn = React.useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (disabled) return
      const rect = event.currentTarget.getBoundingClientRect()
      // Diameter that still covers the far corner from wherever the tap landed.
      const size =
        2 *
        Math.hypot(
          Math.max(event.clientX - rect.left, rect.width - (event.clientX - rect.left)),
          Math.max(event.clientY - rect.top, rect.height - (event.clientY - rect.top))
        )
      const key = nextKey.current++
      setRipples((current) => [
        ...current,
        { key, x: event.clientX - rect.left, y: event.clientY - rect.top, size },
      ])
      window.setTimeout(
        () => setRipples((current) => current.filter((r) => r.key !== key)),
        520
      )
    },
    [disabled]
  )

  return { ripples, spawn }
}

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  onPointerDown,
  children,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"
  const { ripples, spawn } = useRipple(props.disabled)

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      onPointerDown={(event: React.PointerEvent<HTMLButtonElement>) => {
        spawn(event)
        onPointerDown?.(event)
      }}
      {...props}
    >
      {/*
        Slot merges onto exactly ONE element child, and it counts array
        entries — so an asChild button must pass `children` through
        untouched rather than `children` plus a guarded-out ripple list,
        which is still a two-item array as far as Slot is concerned.
      */}
      {asChild ? (
        children
      ) : (
        <>
          {children}
          {ripples.map((ripple) => (
            <span
              key={ripple.key}
              aria-hidden
              className="lq-ripple"
              style={{
                insetInlineStart: ripple.x - ripple.size / 2,
                top: ripple.y - ripple.size / 2,
                inlineSize: ripple.size,
                blockSize: ripple.size,
              }}
            />
          ))}
        </>
      )}
    </Comp>
  )
}

export { Button, buttonVariants }

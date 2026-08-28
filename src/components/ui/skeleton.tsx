import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        // THE RULE DRAWS, rather than a grey block fading.
        //
        // This console is built from 1px rules — its tables, its cards, its
        // whole separation logic is hairlines and not shadows. So a placeholder
        // that draws a rule and settles content behind it is the page's own
        // structure arriving in order, rather than a loader borrowed from a
        // product that looks nothing like this one.
        //
        // 14px is the design system's bar height; the geometry is unchanged.
        // Only what it does while it waits is different.
        "lq-draw h-3.5 rounded-sm bg-muted",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }

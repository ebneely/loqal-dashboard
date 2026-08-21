import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        // .lq-skel — 14px is the design system's default bar height, and
        // loqal-pulse (1.6s) is one of only two looping animations in the
        // system. Tailwind's animate-pulse is a different curve and period.
        "h-3.5 animate-[loqal-pulse_1.6s_var(--ease-in-out)_infinite] rounded-sm bg-muted",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }

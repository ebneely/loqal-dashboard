"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Tabs as TabsPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn("group/tabs flex gap-2 data-horizontal:flex-col", className)}
      {...props}
    />
  )
}

/**
 * `.lq-tabs-list` — a `--muted` trough with 3px of padding, and it scrolls
 * horizontally with the scrollbar hidden, because a brand console tab row
 * on a 390px phone routinely runs past the edge. The `line` variant is the
 * design system's `--underline`: no trough, a 1px rule underneath, and the
 * active tab carries a 2px `--primary` border on its own bottom edge rather
 * than an absolutely-positioned pseudo-element.
 */
const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center justify-center gap-1 overflow-x-auto p-[3px] text-muted-foreground [scrollbar-width:none] group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col [&::-webkit-scrollbar]:hidden",
  {
    variants: {
      variant: {
        default: "rounded-md bg-muted",
        line: "gap-4 rounded-none border-b border-border bg-transparent p-0",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex min-h-[34px] flex-auto shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-sm border-0 bg-transparent px-3 text-sm font-medium whitespace-nowrap text-muted-foreground outline-none [transition:background-color_var(--dur-fast)_var(--ease-in-out),color_var(--dur-fast)_var(--ease-in-out)] group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start hover:text-foreground disabled:pointer-events-none disabled:opacity-50 has-data-[icon=inline-end]:pe-1.5 has-data-[icon=inline-start]:ps-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "data-active:animate-[loqal-pop_var(--dur-base)_var(--ease-out)] data-active:bg-background data-active:text-foreground data-active:shadow-xs",
        "group-data-[variant=line]/tabs-list:min-h-10 group-data-[variant=line]/tabs-list:flex-none group-data-[variant=line]/tabs-list:rounded-none group-data-[variant=line]/tabs-list:border-b-2 group-data-[variant=line]/tabs-list:border-transparent group-data-[variant=line]/tabs-list:px-0",
        "group-data-[variant=line]/tabs-list:data-active:border-b-primary group-data-[variant=line]/tabs-list:data-active:bg-transparent group-data-[variant=line]/tabs-list:data-active:shadow-none",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 text-sm outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }

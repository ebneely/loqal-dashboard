"use client";

/**
 * Composed from the design system's chart primitive: ChartContainer, over
 * recharts' Area. The first chart in this codebase, together with TrendChart
 * and StatusDonut.
 *
 * The shape of a window, at KPI size: no axes, no grid, no tooltip, no
 * numbers. It belongs under a figure that already says how much — its job is
 * to say whether the amount arrived steadily, all at once, or is falling
 * away, which is the one thing a single total cannot tell you.
 *
 * `ChartContainer` hard-codes `aspect-video`, which at a tile's width is a
 * third of the card. The className overrides it to a fixed height.
 *
 * Colour comes from the ChartConfig, which generates `--color-value` on the
 * container, so `--chart-1` being redefined under `.dark` is all dark mode
 * needs. A literal colour here would be a light-mode colour forever.
 */
import { Area, AreaChart } from "recharts";

import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { cn } from "@/lib/utils";

export type SparklinePoint = {
  /** The bucket this point covers — a day. Not drawn, but it orders the line. */
  label: string;
  value: number;
};

export type SparklineProps = {
  data: readonly SparklinePoint[];
  /** What the line is a picture of. This is the whole accessible name. */
  label: string;
  className?: string;
};

const CONFIG = {
  value: { color: "var(--chart-1)" },
} satisfies ChartConfig;

export function Sparkline({ data, label, className }: SparklineProps) {
  /**
   * One point is not a trend, and an empty window is not a flat one. Either
   * draws a one-pixel dash under a KPI figure — a decoration that looks like
   * information. Two points is the least that can slope.
   */
  if (data.length < 2) return null;

  return (
    <ChartContainer
      config={CONFIG}
      role="img"
      aria-label={label}
      className={cn("aspect-auto h-10 w-full", className)}
    >
      <AreaChart
        data={[...data]}
        margin={{ top: 2, right: 0, bottom: 2, left: 0 }}
      >
        <Area
          dataKey="value"
          type="monotone"
          stroke="var(--color-value)"
          strokeWidth={1.5}
          fill="var(--color-value)"
          fillOpacity={0.18}
          dot={false}
          /**
           * The tile itself rises in on `.lq-kpi`. A second animation inside
           * it is double motion, and it replays on every range change, which
           * reads as the number flickering rather than updating.
           */
          isAnimationActive={false}
        />
      </AreaChart>
    </ChartContainer>
  );
}

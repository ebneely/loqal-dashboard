"use client";

/**
 * Composed from the design system's chart primitive: ChartContainer,
 * ChartTooltip and ChartTooltipContent, over recharts' Area.
 *
 * One series over a window — orders per day, or revenue per day. ONE, not
 * both: two quantities in different units on one pair of axes need a second
 * scale, and a second scale is a chart where the crossings mean nothing. The
 * screen switches between them instead.
 *
 * There is deliberately no Y axis. recharts places an axis on a physical side
 * and cannot mirror it, so in Arabic it would sit on the wrong edge of the
 * plot with no way to move it; and the exact figure is in the tooltip and in
 * the KPI above. The X axis carries the days, which is the reading that makes
 * the shape mean anything.
 *
 * `formatValue` is not decoration. Without a formatter `ChartTooltipContent`
 * falls back to `value.toLocaleString()` with no locale — the RUNTIME's
 * locale, not the page's — which on an Arabic machine returns ١٢٬٤٠٠ into a
 * figures face with no Arabic glyphs at all. The default here groups the
 * digits textually and keeps them Latin.
 */
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/lib/use-reduced-motion";

export type TrendChartPoint = {
  /** The x label, already formatted — "01 Aug". Never a raw ISO string. */
  label: string;
  value: number;
};

export type TrendChartProps = {
  data: readonly TrendChartPoint[];
  /** Names the series in the tooltip — "Orders", "Revenue". */
  seriesLabel: string;
  /** What the chart is a picture of. This is its accessible name. */
  label: string;
  /** Shown instead of the chart when there is no window to draw. */
  emptyLabel: string;
  /** Formats a point for the tooltip. Defaults to grouped Latin digits. */
  formatValue?: (value: number) => string;
  className?: string;
};

/** Grouped textually — no Intl, so the digits stay Latin in both languages. */
const grouped = (value: number): string =>
  String(Math.trunc(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

export function TrendChart({
  data,
  seriesLabel,
  label,
  emptyLabel,
  formatValue = grouped,
  className,
}: TrendChartProps) {
  const reduced = useReducedMotion();

  const config = {
    value: { label: seriesLabel, color: "var(--chart-1)" },
  } satisfies ChartConfig;

  /**
   * An empty window and a window of zeros are different answers and are drawn
   * differently. A run of zero days IS the reading — the line stays on the
   * floor — and only the absence of a window at all says so in words.
   */
  if (data.length === 0) {
    return (
      <div
        className={cn(
          "flex h-52 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground",
          className
        )}
      >
        {emptyLabel}
      </div>
    );
  }

  return (
    <ChartContainer
      config={config}
      role="img"
      aria-label={label}
      className={cn("w-full", className)}
    >
      <AreaChart
        data={[...data]}
        margin={{ top: 8, right: 8, bottom: 0, left: 8 }}
      >
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={16}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => formatValue(Number(value))}
            />
          }
        />
        <Area
          dataKey="value"
          type="monotone"
          stroke="var(--color-value)"
          strokeWidth={2}
          fill="var(--color-value)"
          fillOpacity={0.16}
          dot={false}
          /** Replays on every range change, which reads as a flicker. */
          /**
           * On, and 420ms rather than recharts' 1500ms default.
           *
           * A trend that draws itself left to right says "this is time" before
           * a single label is read. It was switched off wholesale, which is why
           * the screen felt inert — `globals.css` clamps CSS durations under
           * `prefers-reduced-motion`, but recharts interpolates path data in
           * JavaScript, so the preference has to be read here.
           */
          isAnimationActive={!reduced}
          animationDuration={420}
          animationEasing="ease-out"
        />
      </AreaChart>
    </ChartContainer>
  );
}

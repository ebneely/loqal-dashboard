"use client";

/**
 * Composed from the design system's chart primitive: ChartContainer, over
 * recharts' Pie.
 *
 * The mix of order statuses in a window. A ring rather than a stack because
 * the question it answers is "what proportion", and the total is already a
 * KPI above it.
 *
 * The ring never stands alone. Every slice is repeated in a list beside it
 * with its own figure, because a ring is a set of shades and a shade is not a
 * number — and because the two slices that matter most in this product,
 * cancelled and refunded, are usually the two thinnest.
 *
 * Colour is `--chart-1` to `--chart-5` in order, through the ChartConfig, so
 * the same status keeps the same colour on both halves and dark mode follows
 * the tokens.
 */
import { Cell, Pie, PieChart } from "recharts";

import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { cn } from "@/lib/utils";

export type StatusDonutSlice = {
  /** The status enum value. Becomes a `--color-<key>` custom property. */
  key: string;
  /** The status in the reader's language. */
  label: string;
  value: number;
};

export type StatusDonutProps = {
  data: readonly StatusDonutSlice[];
  /** What the ring is a picture of. This is its accessible name. */
  label: string;
  /** Shown instead of the ring when every slice is zero. */
  emptyLabel: string;
  /** Formats a slice's figure. Defaults to the plain integer. */
  formatValue?: (value: number) => string;
  className?: string;
};

/** Five tokens, cycled. The sixth status reuses the first hue. */
const PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export function StatusDonut({
  data,
  label,
  emptyLabel,
  formatValue = (value) => String(value),
  className,
}: StatusDonutProps) {
  /**
   * A status with no orders is dropped, not drawn at zero width. A zero-width
   * sector is invisible and its legend row then claims a colour that is
   * nowhere on the chart.
   */
  const slices = data.filter((slice) => slice.value > 0);

  if (slices.length === 0) {
    return (
      <div
        className={cn(
          "flex aspect-video items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground",
          className
        )}
      >
        {emptyLabel}
      </div>
    );
  }

  const config: ChartConfig = Object.fromEntries(
    slices.map((slice, index) => [
      slice.key,
      { label: slice.label, color: PALETTE[index % PALETTE.length] },
    ])
  );

  return (
    <div
      className={cn(
        "grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:items-center",
        className
      )}
    >
      <ChartContainer
        config={config}
        role="img"
        aria-label={label}
        className="aspect-square w-full"
      >
        <PieChart>
          <Pie
            data={[...slices]}
            dataKey="value"
            nameKey="key"
            innerRadius="58%"
            outerRadius="88%"
            paddingAngle={1}
            stroke="var(--background)"
            strokeWidth={2}
            /** Replays on every range change, which reads as a flicker. */
            isAnimationActive={false}
          >
            {slices.map((slice) => (
              <Cell key={slice.key} fill={`var(--color-${slice.key})`} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>

      <ul className="grid content-start gap-2">
        {slices.map((slice, index) => (
          <li
            key={slice.key}
            className="flex items-baseline justify-between gap-x-3 text-sm"
          >
            <span className="flex min-w-0 items-baseline gap-x-2">
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full"
                style={{ background: PALETTE[index % PALETTE.length] }}
              />
              <span className="truncate">{slice.label}</span>
            </span>
            <span className="shrink-0 font-mono tabular-nums" data-num="">
              {formatValue(slice.value)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

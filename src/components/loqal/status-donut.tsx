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
import type { ReactNode } from "react";
import { Cell, Pie, PieChart } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/lib/use-reduced-motion";

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
  /**
   * Drawn in the ring's hole — the total the slices divide up.
   *
   * A ring with an empty middle asks the reader to estimate the whole from
   * the parts. Stating it turns the ring into a breakdown of a number that is
   * already on screen, which is the only reading a donut is good for.
   */
  centre?: ReactNode;
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
  centre,
  className,
}: StatusDonutProps) {
  const reduced = useReducedMotion();

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
          "flex h-44 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground",
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
      <div className="relative">
        <ChartContainer
          config={config}
          role="img"
          aria-label={label}
          /**
           * A fixed height, not `aspect-square w-full`. A square that fills its
           * column is 500px of ring on a desktop for a figure the centre already
           * states — the ring is a breakdown, not the headline. `mx-auto` keeps
           * it centred once it stops being as wide as its column.
           */
          className="mx-auto aspect-square h-44"
        >
          <PieChart>
            {/*
              The ring had no tooltip at all: hovering a slice said nothing, so
              the only way to read a figure was the list beside it. The list
              still carries every value — this is for the slice being pointed
              at, which is the one being asked about.
            */}
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent nameKey="key" hideLabel />}
            />
            <Pie
              data={[...slices]}
              dataKey="value"
              nameKey="key"
              innerRadius="58%"
              outerRadius="88%"
              paddingAngle={1}
              stroke="var(--background)"
              strokeWidth={2}
              /**
               * The ring sweeps in once. 420ms, ease-out, and off entirely for
               * a reader who asked for less motion — recharts animates in JS,
               * so the CSS clamp in globals.css cannot reach it.
               */
              isAnimationActive={!reduced}
              animationDuration={420}
              animationEasing="ease-out"
            >
              {slices.map((slice) => (
                <Cell key={slice.key} fill={`var(--color-${slice.key})`} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        {/*
          Overlaid rather than drawn as an SVG label: it is text, it should
          wrap and scale as text, and `inset-0` pins to no physical side.
        */}
        {centre ? (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            {centre}
          </div>
        ) : null}
      </div>

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

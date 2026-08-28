/**
 * Composed from shadcn primitives: Card.
 *
 * The three layout helpers the design system ships as CSS rather than as
 * components — `.lq-section-head`, `.lq-kpis` and `.lq-kpi`. Every console
 * was hand-rolling all three, and each screen drifted a little differently:
 * section subtitles at 14px instead of 12, stacked under their titles rather
 * than set beside them, KPI figures in the body face instead of the figures
 * face, and no two grids with the same breakpoint.
 *
 * These are thin on purpose. The classes carry the geometry, straight out of
 * loqal-components.css; the components exist so a screen cannot forget one.
 */
import * as React from "react";
import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * `.lq-section-head` — title and subtitle on ONE row, pushed apart, with the
 * subtitle at 12px. Not a stack: these screens are a column of sections and a
 * stacked two-line head at every boundary is most of a phone viewport.
 *
 * `action` takes the inline-end slot when a section has its own control — a
 * "See all" link, a filter — instead of the subtitle.
 */
export function SectionHead({
  title,
  sub,
  action,
  as: Heading = "h2",
  className,
}: {
  title: ReactNode;
  sub?: ReactNode;
  action?: ReactNode;
  as?: "h2" | "h3";
  className?: string;
}) {
  return (
    <div className={cn("lq-section-head", className)}>
      <Heading className="lq-section-title">{title}</Heading>
      {action ?? (sub ? <div className="lq-section-sub">{sub}</div> : null)}
    </div>
  );
}

/**
 * `.lq-kpis` — two columns on a phone, four at md and up, and it is a
 * CONTAINER query, so a KPI row inside a narrow column stays two-up.
 */
export function KpiGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("lq-kpis", className)}>{children}</div>;
}

/**
 * `.lq-kpi` — a Card with 12/16 padding and a 4px stack.
 *
 * The padding and gap are Tailwind rather than left to `.lq-kpi`, because
 * `Card`'s own `py-(--card-spacing)` and `gap-(--card-spacing)` are
 * utilities and utilities beat the components layer. The class stays on the
 * element for what only it can do: `loqal-rise`, and the 40ms-apart entrance
 * delays `.lq-kpis > *:nth-child(n)` hangs off it.
 *
 * The value is `.lq-kpi-val` — Source Code Pro, tabular, 26px. A KPI is a
 * figure someone compares against last week's, and comparing figures set in
 * a proportional face is what the figures face exists to prevent.
 *
 * `chart` and `delta` are the two things that turn a figure into a reading:
 * the shape of the window it came from, and which way it moved. Both are
 * optional and both are additive — every existing call site passes three
 * props and keeps working.
 *
 * One constraint on the grid this sits in: `.lq-kpis > *:nth-child(n)`
 * entrance delays stop at `nth-child(4)` in loqal-components.css. A fifth
 * tile in one row appears with no delay and breaks the cascade, so extend the
 * CSS before adding one.
 */
export function Kpi({
  label,
  value,
  note,
  chart,
  delta,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  note?: ReactNode;
  /** A sparkline or any small figure, drawn under the value. */
  chart?: ReactNode;
  /** Movement against the previous window. */
  delta?: KpiDelta;
  className?: string;
}) {
  return (
    <Card className={cn("lq-kpi gap-1 px-4 py-3", className)}>
      <span className="lq-kpi-key">{label}</span>
      <span className="lq-kpi-val">{value}</span>
      {chart ? <div className="min-w-0">{chart}</div> : null}
      {delta ? (
        <span
          data-direction={delta.direction}
          className={cn("lq-kpi-note", DELTA_TONE[delta.direction])}
        >
          {delta.label}
        </span>
      ) : null}
      {note ? <span className="lq-kpi-note">{note}</span> : null}
    </Card>
  );
}

/**
 * Movement against the previous window, with the direction stated rather than
 * worked out.
 *
 * `direction` is NOT the sign of the number. Up is not always good: a refund
 * rate rising is bad, a return rate falling is good, and a component holding
 * an unlabelled figure cannot tell which of those it has. So the caller — who
 * knows what the tile counts — says which way is which, and this only colours
 * it. Inferring from the sign is how a KPI grid ends up congratulating a shop
 * on its refunds.
 *
 * The colour is never the only signal: `label` carries the movement in words,
 * because a green chip means nothing to a reader who cannot see the green.
 */
export type KpiDelta = {
  direction: "up" | "down" | "flat";
  label: ReactNode;
};

const DELTA_TONE: Record<KpiDelta["direction"], string> = {
  up: "text-state-good-fg",
  down: "text-state-bad-fg",
  flat: "text-muted-foreground",
};

/**
 * `.lq-rl-fields` — the design system's field block, the same one
 * `ResponsiveList` draws inside a card.
 *
 * Two columns, and the key sits ABOVE its value rather than beside it: an
 * 11px uppercase `.lq-rl-key` over a 14px `.lq-rl-val`. Nine screens were
 * hand-rolling this as a `flex items-baseline justify-between` row, which
 * puts one field per line and pushes the value to the far edge — on a 390px
 * phone that is four lines of ragged dot-leader instead of two tidy columns,
 * and under RTL the eye has to cross the whole card to pair a label with its
 * figure.
 *
 * Kept as `dl`/`dt`/`dd`: the design system uses divs, but this is a
 * description list and the classes do not care which element wears them.
 */
export function FieldGrid({
  children,
  className,
  ...props
}: React.ComponentProps<"dl">) {
  return (
    <dl className={cn("lq-rl-fields", className)} {...props}>
      {children}
    </dl>
  );
}

/**
 * One labelled, read-only field. `wide` spans both columns — for an address or any other
 * value that would wrap badly in half a card, which is what the reference
 * screens use `grid-column: 1 / -1` for.
 *
 * `numeric` sets `data-num`, and the global `[data-num]` rule is what makes it
 * Source Code Pro and tabular. Money, SKUs, IDs, phone numbers, timestamps.
 */
export function DataField({
  label,
  value,
  numeric = false,
  wide = false,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  numeric?: boolean;
  wide?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("lq-rl-field", wide && "col-span-full", className)}>
      <dt className="lq-rl-key">{label}</dt>
      <dd className="lq-rl-val" {...(numeric ? { "data-num": "" } : {})}>
        {value}
      </dd>
    </div>
  );
}

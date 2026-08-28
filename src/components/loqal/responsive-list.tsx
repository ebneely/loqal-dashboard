"use client";

/**
 * Composed from shadcn primitives: Table (+Header/Body/Row/Head/Cell/Caption),
 * Card (+CardContent), Item (+ItemContent/ItemTitle/ItemDescription).
 * Navigation is next/link, which is the platform's anchor, not a primitive.
 *
 * The system-level rule, in one component: a card stack below md, a real table
 * at md and up, from ONE dataset and ONE column definition.
 *
 * shadcn's Table does not collapse on a phone — it scrolls sideways, which on a
 * 390px screen means a shop owner drags a table around one-handed to find the
 * order number. shadcn ships no responsive data table either. So this is how
 * "shadcn only" and "mobile-first" are made to coexist: not by restyling
 * Table, but by rendering the other shape beside it and letting the breakpoint
 * choose. Both renderings read the same `columns`, so a column added for the
 * desktop table cannot go missing on the phone.
 */
import Link from "next/link";
import * as React from "react";
import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type ResponsiveListColumn<T> = {
  /** Stable id, also the React key for the cell. */
  key: string;
  /** Already translated. This component never looks copy up. */
  header: string;
  cell: (row: T) => ReactNode;
  /**
   * The one column that titles a card. Exactly one column should set it; the
   * first column is used when none does.
   */
  primary?: boolean;
  /** Rendered under the card title rather than as a labelled field. */
  meta?: boolean;
  /**
   * Figures: monospaced, and aligned to the inline end in the table — HEADER
   * INCLUDED. The alignment is stated here rather than left to whatever the
   * vendored `ui/table.tsx` does with `data-num`, which the shadcn CLI can
   * regenerate. `data-num` stays on the values only: it is the mark for "this
   * is a figure" and sets the mono face, and a column heading is a label.
   */
  numeric?: boolean;
  /** Kept out of the card stack — a column that only earns its space at md. */
  tableOnly?: boolean;
  headerClassName?: string;
  cellClassName?: string;
};

export type ResponsiveListProps<T> = {
  rows: readonly T[];
  columns: readonly ResponsiveListColumn<T>[];
  getRowKey: (row: T) => string;
  /** Replaces the default card entirely, for a row that needs its own shape. */
  renderCard?: (row: T) => ReactNode;
  onRowClick?: (row: T) => void;
  /**
   * THE ROW'S OWN ADDRESS.
   *
   * Return a path and the primary cell becomes a real anchor at BOTH
   * breakpoints — a keyboard target, a middle-clickable tab, and a URL a shop
   * owner can copy into a WhatsApp message to a driver. `onRowClick` cannot do
   * any of those, which is why every screen was hand-rolling a Link inside its
   * own primary cell before this existed.
   *
   * Return null for a row that genuinely has no address — a returns row carries
   * an order NUMBER and no id, and an anchor to a guessed path is worse than
   * text. Additive: `onRowClick` still works, and a screen may pass both.
   */
  getRowHref?: (row: T) => string | null | undefined;
  /** Read by screen readers; describes what the table lists. */
  caption?: string;
  className?: string;
};

export function ResponsiveList<T>({
  rows,
  columns,
  getRowKey,
  renderCard,
  onRowClick,
  getRowHref,
  caption,
  className,
}: ResponsiveListProps<T>) {
  const primary =
    columns.find((column) => column.primary) ?? columns[0] ?? undefined;
  const rest = columns.filter((column) => column !== primary);
  const cardFields = rest.filter((column) => !column.meta && !column.tableOnly);
  const metaFields = rest.filter((column) => column.meta);

  const hrefFor = (row: T): string | null => getRowHref?.(row) ?? null;

  /**
   * `text-align` cannot move a block, and that is the BALANCE column on
   * /admin/brands: its cell renders `MoneyRow`, whose root is a flex container
   * filling the cell, so the header sat at the end and every figure at the
   * start. An end-justified box moves a block and a bare string alike, and
   * `justify-end` follows the writing direction rather than a physical side.
   */
  const numericCell = (content: ReactNode) => (
    <div
      data-slot="numeric-value"
      className="flex items-center justify-end gap-2"
    >
      {content}
    </div>
  );

  /**
   * The primary cell, as an anchor when the row has an address.
   *
   * `after:absolute after:inset-0` is the stretched-link pattern: one anchor in
   * the DOM, but the whole card or cell is its hit area, so a thumb on a 390px
   * phone does not have to find a line of text. `inset-0` is direction-agnostic
   * — it sets all four edges, so nothing here pins to a physical side.
   */
  const primaryCell = (row: T) => {
    const content = primary ? primary.cell(row) : null;
    const href = hrefFor(row);
    if (!href) return content;

    return (
      <Link
        href={href}
        className="underline-offset-4 outline-none after:absolute after:inset-0 after:content-[''] hover:underline focus-visible:underline"
      >
        {content}
      </Link>
    );
  };

  /**
   * The design system's own card markup: `Card > .lq-rl-row`, with the row
   * supplying the 12/16 padding, so `Card` is stripped to `py-0`.
   *
   * The fields used to be a definition list with the key and the value on the
   * same baseline, pushed apart. `.lq-rl-fields` is a two-column grid with the
   * key STACKED above its value — an 11px uppercase key over a 14px value.
   * That is what makes four fields fit a 390px card without wrapping, and it
   * is what the reference screens draw.
   */
  const defaultCard = (row: T) => (
    <Card
      interactive={Boolean(hrefFor(row) || onRowClick)}
      className={cn("py-0", hrefFor(row) && "relative")}
      onClick={onRowClick ? () => onRowClick(row) : undefined}
    >
      <div className="lq-rl-row">
        <div className="lq-rl-row-top">
          <div className="min-w-0 flex-1">
            <div className="lq-rl-title truncate">{primaryCell(row)}</div>
            {metaFields.length > 0 ? (
              /*
                `relative` on the wrappers below the title, so anything a screen
                puts in a non-primary cell — a status filter chip, an Approve
                button — paints ABOVE the stretched anchor and stays clickable.
                Without it the overlay would swallow every control on the card.
              */
              <div className="lq-rl-meta relative">
                {metaFields.map((column) => (
                  <span key={column.key}>{column.cell(row)}</span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        {cardFields.length > 0 ? (
          <div className="lq-rl-fields relative">
            {cardFields.map((column) => (
              <div key={column.key} className="lq-rl-field">
                <span className="lq-rl-key">{column.header}</span>
                <span
                  {...(column.numeric ? { "data-num": "" } : {})}
                  className={cn("lq-rl-val truncate", column.cellClassName)}
                >
                  {column.cell(row)}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </Card>
  );

  return (
    /*
      `.lq-rl` sets `container-type: inline-size`, and the card/table switch
      below is a CONTAINER query at 768px, not a media query. That is a
      system-level rule, not a preference: a 390px phone frame embedded in a
      desktop page has to render cards, and `md:hidden` reads the viewport, so
      it rendered a table inside the phone frame. Nothing here sets a
      breakpoint utility — loqal-components.css owns the switch.

      Each card is a DIRECT child of `.lq-rl-cards` because the entrance
      motion sequences `> *` 35ms apart; the keyed wrapper div that used to sit
      between them absorbed the delay and every row arrived at once.
    */
    <div className={cn("lq-rl", className)} data-slot="responsive-list">
      <div className="lq-rl-cards">
        {rows.map((row) => (
          <React.Fragment key={getRowKey(row)}>
            {renderCard ? renderCard(row) : defaultCard(row)}
          </React.Fragment>
        ))}
      </div>

      <div className="lq-rl-table">
        <Table>
          {/* A <caption> is the table's accessible NAME — what a screen
              reader announces before reading the rows. It is not body copy,
              and shadcn's TableCaption renders it as visible centred text, so
              every list in this console ended with a stray sentence floating
              under it ("Every brand, whatever its status"). Sighted users
              already have the page heading and the filters; this is for people
              who cannot see either. */}
          {caption ? (
            <TableCaption className="sr-only">{caption}</TableCaption>
          ) : null}
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead
                  key={column.key}
                  className={cn(column.numeric && "text-end", column.headerClassName)}
                >
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={getRowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(onRowClick && "cursor-pointer")}
              >
                {columns.map((column) => (
                  <TableCell
                    key={column.key}
                    {...(column.numeric ? { "data-num": "" } : {})}
                    className={cn(
                      // The anchor stretches over its own CELL, not the row: a
                      // positioned child of a <tr> is not reliable across
                      // browsers, and a cell-wide target is still a real one.
                      column === primary && hrefFor(row) && "relative",
                      column.numeric && "text-end",
                      column.cellClassName
                    )}
                  >
                    {column === primary
                      ? primaryCell(row)
                      : column.numeric
                        ? numericCell(column.cell(row))
                        : column.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

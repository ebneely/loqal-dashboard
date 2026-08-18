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
import type { ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";
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
  /** Figures: monospaced and aligned to the inline end in the table. */
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

  const defaultCard = (row: T) => (
    <Card
      className={cn(
        "shadow-none",
        // `relative` is what the stretched anchor measures itself against.
        hrefFor(row) && "relative transition-colors hover:bg-muted/40",
        onRowClick && "cursor-pointer transition-colors hover:bg-muted/40"
      )}
      onClick={onRowClick ? () => onRowClick(row) : undefined}
    >
      <CardContent className="flex flex-col gap-3 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-base font-semibold text-foreground">
              {primaryCell(row)}
            </div>
            {metaFields.length > 0 ? (
              /*
                `relative` on the wrappers below the title, so anything a screen
                puts in a non-primary cell — a status filter chip, an Approve
                button — paints ABOVE the stretched anchor and stays clickable.
                Without it the overlay would swallow every control on the card.
              */
              <div className="relative mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                {metaFields.map((column) => (
                  <span key={column.key}>{column.cell(row)}</span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        {cardFields.length > 0 ? (
          <dl className="relative grid gap-1.5">
            {cardFields.map((column) => (
              <div
                key={column.key}
                className="flex items-baseline justify-between gap-3"
              >
                <dt className="text-xs text-muted-foreground">
                  {column.header}
                </dt>
                <dd
                  className={cn(
                    "text-sm text-foreground",
                    column.numeric && "font-mono tabular-nums",
                    column.cellClassName
                  )}
                >
                  {column.cell(row)}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
      </CardContent>
    </Card>
  );

  return (
    <div className={cn("w-full", className)} data-slot="responsive-list">
      {/* Phone: a stack of cards. */}
      <div className="flex flex-col gap-3 md:hidden">
        {rows.map((row) => (
          <div key={getRowKey(row)}>
            {renderCard ? renderCard(row) : defaultCard(row)}
          </div>
        ))}
      </div>

      {/* md and up: the same data as a table. */}
      <div className="hidden md:block">
        <Table>
          {caption ? <TableCaption>{caption}</TableCaption> : null}
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead
                  key={column.key}
                  className={cn(
                    column.numeric && "text-end",
                    column.headerClassName
                  )}
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
                    className={cn(
                      column.numeric && "text-end font-mono tabular-nums",
                      // The anchor stretches over its own CELL, not the row: a
                      // positioned child of a <tr> is not reliable across
                      // browsers, and a cell-wide target is still a real one.
                      column === primary && hrefFor(row) && "relative",
                      column.cellClassName
                    )}
                  >
                    {column === primary ? primaryCell(row) : column.cell(row)}
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

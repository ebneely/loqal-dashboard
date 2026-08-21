"use client";

/**
 * /inventory — per-variant stock, with availability and reservations kept apart.
 *
 * Composed from the domain layer: ResponsiveList, ListState — plus shadcn's
 * Card, Button, Input, Textarea, NativeSelect and Field.
 *
 * The rule the whole screen is built to hold: AVAILABLE and RESERVED are two
 * numbers and are never merged into one. Availability is stock on hand minus
 * what other shoppers are already holding at checkout, computed on read and
 * never stored. A single figure that quietly includes held stock is how a shop
 * sells the same last item twice.
 *
 * And a gap, said out loud on the screen rather than papered over: there is no
 * low-stock endpoint. The variant list comes from the products route, which
 * carries stock ON HAND only, so the on-hand column is labelled as on-hand and
 * availability is fetched per variant for a bounded set of the emptiest
 * shelves. A row whose availability has not been fetched shows a dash — never
 * its on-hand count standing in for a number it is not.
 */
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { StockAdjustmentReasonSchema } from "@loqal/contracts/enums";
import type { StockAdjustmentReason } from "@loqal/contracts/enums";
import type { StockAdjustment } from "@loqal/contracts/catalog.contract";

import {
  ListState,
  ResponsiveList,
  listStateFor,
  type ResponsiveListColumn,
} from "@/components/loqal";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useLocale, useMessages } from "@/lib/locale-context";

import { displayName } from "../products/catalog-wire";
import { useAdjustStock, useAdjustments, useInventory } from "./inventory-data";
import {
  isUsefulDelta,
  parseDelta,
  runningOut,
  type InventoryRow,
} from "./stock";

const REASONS: readonly StockAdjustmentReason[] =
  StockAdjustmentReasonSchema.options;

/** Fixed and locale-neutral: a stock log is read against a bank-style ledger. */
const stamp = (iso: string) => iso.slice(0, 16).replace("T", " ");

export function InventoryScreen() {
  const t = useMessages();
  const b = t.brand;
  const locale = useLocale();
  const router = useRouter();
  const params = useSearchParams();

  const feed = useInventory();
  const selectedId = params.get("variant");
  const history = useAdjustments(selectedId);
  const write = useAdjustStock();

  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");

  const rows = feed.rows;
  const low = useMemo(() => runningOut(rows), [rows]);
  const selected = rows.find((row) => row.variantId === selectedId) ?? null;

  const select = (variantId: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (variantId) next.set("variant", variantId);
    else next.delete("variant");
    const query = next.toString();
    router.replace(query ? `/inventory?${query}` : "/inventory");
  };

  const state = listStateFor(feed.error, {
    isLoading: feed.isLoading,
    isEmpty: rows.length === 0,
  });

  const canAdjust = isUsefulDelta(delta) && reason !== "" && !write.pending;

  const submitAdjustment = async () => {
    if (!selected || !canAdjust) return;
    const ok = await write.adjust(selected.variantId, {
      delta: parseDelta(delta),
      reason,
      ...(note.trim() ? { note: note.trim() } : {}),
    });
    if (ok) {
      setDelta("");
      setReason("");
      setNote("");
      history.reload();
      feed.reload();
    }
  };

  const productCell = (row: InventoryRow) =>
    displayName(row.productName, locale) ?? b.needsName;

  /**
   * Three columns, never two. `availableQty` and `reservedQty` are separate
   * facts about the same shelf and a shop owner has to see both to know what it
   * may still sell.
   */
  const stockColumns: readonly ResponsiveListColumn<InventoryRow>[] = [
    {
      key: "sku",
      header: b.sku,
      cell: (row) => <span className="font-mono">{row.sku}</span>,
      primary: true,
    },
    { key: "product", header: b.product, cell: productCell, meta: true },
    {
      key: "variant",
      header: b.variant,
      cell: (row) => row.variantLabel,
      tableOnly: true,
    },
    {
      key: "onHand",
      header: b.onHand,
      cell: (row) => String(row.stockOnHand),
      numeric: true,
    },
    {
      key: "available",
      header: b.available,
      // A dash, never the on-hand count. Standing one in for the other is the
      // merge this screen exists to refuse.
      cell: (row) =>
        row.stock === null ? (
          <span title={b.availabilityUnknown}>—</span>
        ) : (
          <span data-testid={`available-${row.variantId}`}>
            {row.stock.availableQty}
          </span>
        ),
      numeric: true,
    },
    {
      key: "reserved",
      header: b.reserved,
      cell: (row) =>
        row.stock === null ? (
          "—"
        ) : (
          <span data-testid={`reserved-${row.variantId}`}>
            {row.stock.reservedQty}
          </span>
        ),
      numeric: true,
    },
    {
      key: "open",
      header: b.adjust,
      cell: (row) => (
        <Button
          size="sm"
          variant="outline"
          className="min-h-11"
          onClick={() => select(row.variantId)}
        >
          {b.adjust}
        </Button>
      ),
    },
  ];

  const historyColumns: readonly ResponsiveListColumn<StockAdjustment>[] = [
    {
      key: "when",
      header: b.whenField,
      cell: (entry) => <span className="font-mono">{stamp(entry.createdAt)}</span>,
      primary: true,
    },
    {
      key: "reason",
      header: b.reason,
      cell: (entry) => b.stockReason[entry.reason],
      meta: true,
    },
    {
      key: "delta",
      header: b.deltaField,
      cell: (entry) => (entry.delta > 0 ? `+${entry.delta}` : String(entry.delta)),
      numeric: true,
    },
    {
      key: "balance",
      header: b.balanceAfter,
      cell: (entry) => String(entry.balanceAfter),
      numeric: true,
    },
    {
      key: "who",
      // The row carries an actor id and no name — there is no user lookup for a
      // brand, so this says which KIND of actor it was rather than inventing a
      // person.
      header: b.whoField,
      cell: (entry) => (entry.actorId === null ? b.whoSystem : b.whoStaff),
    },
    {
      key: "note",
      header: b.noteField,
      cell: (entry) => entry.note ?? "—",
      tableOnly: true,
    },
  ];

  return (
    <div className="grid gap-6">
      <section aria-label={b.stockNote} className="grid gap-1">
        <p className="text-sm text-muted-foreground">{b.stockNote}</p>
        {/* The gap, on the screen rather than only in a comment. */}
        <p className="text-xs text-muted-foreground">
          {b.availabilityUnknownNote.replace("{n}", String(feed.scanned))}
        </p>
      </section>

      {state === "loading" ? <ListState state="loading" rows={4} /> : null}

      {state === "error" ? (
        <ListState
          state="error"
          title={b.inventoryErrorTitle}
          body={b.errorBody}
          actionLabel={b.retry}
          onAction={feed.reload}
        />
      ) : null}

      {state === "denied" ? (
        <ListState
          state="denied"
          title={b.catalogOnlyTitle}
          body={b.catalogOnlyBody}
          requiredRole="BRAND_OWNER"
        />
      ) : null}

      {state === "empty" ? (
        <ListState
          state="empty"
          title={b.inventoryEmptyTitle}
          body={b.inventoryEmptyBody}
          actionLabel={b.addPhotos}
          actionHref="/products/bulk"
        />
      ) : null}

      {state === null ? (
        <>
          {low.length > 0 ? (
            <section
              aria-label={b.runningOut}
              data-testid="inventory-running-out"
              className="grid gap-3"
            >
              <Card className="border-state-act-border bg-state-act-bg">
                <CardHeader className="gap-1">
                  <CardTitle className="text-base">{b.runningOut}</CardTitle>
                  {/* Measured on availability, not on on-hand. */}
                  <CardDescription>{b.runningOutNote}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveList
                    rows={low}
                    columns={stockColumns}
                    getRowKey={(row) => `low-${row.variantId}`}
                    caption={b.runningOut}
                  />
                </CardContent>
              </Card>
            </section>
          ) : null}

          <section
            aria-label={b.nav.inventory}
            data-testid="inventory-all"
            className="grid gap-3"
          >
            <h2 className="text-base font-semibold text-foreground">
              {b.nav.inventory}
            </h2>
            <ResponsiveList
              rows={rows}
              columns={stockColumns}
              getRowKey={(row) => row.variantId}
              caption={b.nav.inventory}
            />
          </section>
        </>
      ) : null}

      {selected ? (
        <section
          aria-label={b.adjustTitle}
          data-testid="inventory-variant"
          className="grid gap-3"
        >
          <Card className="">
            <CardHeader className="gap-1">
              <CardTitle className="text-base font-mono">
                {selected.sku}
              </CardTitle>
              <CardDescription>{selected.variantLabel}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {/*
                On hand / available / reserved — three figures a shop owner
                reads against each other, so they are a KPI row, not a field
                list: `.lq-kpi-key` (11px uppercase, --tracking-caps) over a
                figure at --text-xl, which the type scale reserves for exactly
                this "KPI small". The keys used to be 12px sentence case,
                which read as three captions rather than as a column set.

                Three columns rather than `.lq-kpis`' two-then-four: these
                three belong together and splitting them 2 + 1 on a phone
                would invite reading the pair as the whole story.
              */}
              <dl className="grid grid-cols-3 gap-3">
                <div className="grid gap-0.5">
                  <dt className="lq-kpi-key">{b.onHand}</dt>
                  <dd className="text-xl font-semibold" data-num>
                    {selected.stockOnHand}
                  </dd>
                </div>
                <div className="grid gap-0.5">
                  <dt className="lq-kpi-key">{b.available}</dt>
                  <dd
                    className="text-xl font-semibold"
                    data-num
                    data-testid="variant-available"
                  >
                    {selected.stock ? selected.stock.availableQty : "—"}
                  </dd>
                </div>
                <div className="grid gap-0.5">
                  <dt className="lq-kpi-key">{b.reserved}</dt>
                  <dd
                    className="text-xl font-semibold"
                    data-num
                    data-testid="variant-reserved"
                  >
                    {selected.stock ? selected.stock.reservedQty : "—"}
                  </dd>
                </div>
              </dl>

              <div className="grid gap-3 md:grid-cols-3">
                <Field>
                  <FieldLabel htmlFor="adjust-delta">{b.deltaField}</FieldLabel>
                  <Input
                    id="adjust-delta"
                    inputMode="numeric"
                    className="min-h-12"
                    value={delta}
                    onChange={(event) => setDelta(event.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">{b.deltaHint}</p>
                </Field>

                <Field>
                  <FieldLabel htmlFor="adjust-reason">{b.reason}</FieldLabel>
                  <NativeSelect
                    id="adjust-reason"
                    className="min-h-12"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                  >
                    <NativeSelectOption value="">
                      {b.chooseReason}
                    </NativeSelectOption>
                    {REASONS.map((value) => (
                      <NativeSelectOption key={value} value={value}>
                        {b.stockReason[value]}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>

                <Field>
                  <FieldLabel htmlFor="adjust-note">{b.noteField}</FieldLabel>
                  <Textarea
                    id="adjust-note"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                  />
                </Field>
              </div>

              {/* A reason is required, so "where did my stock go" has an answer. */}
              <p className="text-xs text-muted-foreground">{b.adjustDesc}</p>
              {!canAdjust ? (
                <p className="text-xs text-muted-foreground">
                  {b.adjustBlockedHint}
                </p>
              ) : null}
              {write.failed ? (
                <p role="alert" className="text-sm text-destructive">
                  {b.adjustFailed}
                </p>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <Button
                  className="min-h-12"
                  disabled={!canAdjust}
                  onClick={() => void submitAdjustment()}
                >
                  {write.pending ? b.saving : b.saveAdjust}
                </Button>
                <Button
                  variant="ghost"
                  className="min-h-12"
                  onClick={() => select(null)}
                >
                  {b.cancel}
                </Button>
              </div>
            </CardContent>
          </Card>

          <section aria-label={b.history} className="grid gap-2">
            <h2 className="text-base font-semibold text-foreground">
              {b.history}
            </h2>
            {history.isLoading ? (
              <ListState state="loading" rows={2} />
            ) : (history.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">{b.historyEmpty}</p>
            ) : (
              <ResponsiveList
                rows={history.data ?? []}
                columns={historyColumns}
                getRowKey={(entry) => entry.id}
                caption={b.history}
              />
            )}
          </section>
        </section>
      ) : null}
    </div>
  );
}

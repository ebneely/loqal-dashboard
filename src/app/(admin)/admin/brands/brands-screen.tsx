"use client";

/**
 * /admin/brands — every brand, whatever its status.
 *
 * Composed from the domain layer: ResponsiveList, StatusPill, MoneyRow,
 * ListState — plus shadcn's Badge, Button, Input, NativeSelect and Alert.
 *
 * THE BALANCE IS SIGNED, AND THE SIGN IS NOT THE MESSAGE.
 *
 * Positive means Loqal owes the brand; negative means the brand owes Loqal, and
 * the SAME brand flips between the two in consecutive weeks — card orders
 * settle to Loqal, cash orders settle to the brand. A minus sign in a column of
 * right-aligned figures is not a sentence anybody reads correctly on the way
 * into a meeting, so `MoneyRow` is used with `perspective="platform"`, which
 * names the party in words: "Loqal owes this brand" / "This brand owes Loqal".
 * The sign is still there and still coloured; neither is load-bearing alone.
 *
 * GROSS SALES IS NOT THE BALANCE, and the two sit in adjacent columns, so the
 * screen says what it is: `SUM(BrandOrder.subtotal)` excluding CANCELLED and
 * REFUNDED. It excludes shipping, because shipping is never Loqal's money —
 * Loqal runs no fulfilment and pays no courier, and a delivery fee that passed
 * through a shop's till is not revenue anybody here can claim.
 *
 * BADGE COUNTS ARE TWO NUMBERS AND NEVER ONE. Computed badges are earned from
 * delivered orders; verified badges are issued by a person at Loqal. A single
 * total would let the second kind hide inside the first, which is the whole
 * argument for keeping them apart on the row too.
 *
 * PAID PLACEMENT: see `placement-order.ts`. The rule this screen enforces is
 * that the ordering and its disclosure are one value, and that a promoted brand
 * is labelled on the row regardless of ordering.
 */
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { BrandStatusSchema, type BrandStatus } from "@loqal/contracts/enums";

import {
  ListState,
  MoneyRow,
  ResponsiveList,
  StatusPill,
  listStateFor,
  statusLabel,
  type ResponsiveListColumn,
} from "@/components/loqal";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { useLocale, useMessages } from "@/lib/locale-context";
import { formatMoney } from "@/lib/money";
import { ADMIN_REQUIRED_ROLE } from "../../shell-rules";

import { useAdminBrands, type AdminBrandRow } from "./brands-data";
import { NewShopButton, NewShopSheet } from "./new-shop-sheet";
import {
  BRAND_SORTS,
  isBrandSort,
  orderBrands,
  placementIsKnown,
  type BrandSort,
} from "./placement-order";

const STATUSES: readonly BrandStatus[] = BrandStatusSchema.options;

const isStatus = (value: string | null): value is BrandStatus =>
  value !== null && (STATUSES as readonly string[]).includes(value);

export function BrandsScreen() {
  const t = useMessages();
  const a = t.admin;
  const locale = useLocale();
  const router = useRouter();
  const params = useSearchParams();

  const rawStatus = params.get("status");
  const status = isStatus(rawStatus) ? rawStatus : null;
  const search = params.get("q") ?? "";
  const rawSort = params.get("sort");
  const requestedSort: BrandSort = isBrandSort(rawSort) ? rawSort : "name";

  const feed = useAdminBrands(status, search);
  const [adding, setAdding] = useState(false);

  /**
   * The placement ordering is REFUSED, not silently applied, while the list
   * endpoint returns no placement fields. Sorting every row into `false` and
   * calling the result "the storefront's order" would be a ranking presented as
   * a fact — the precise failure mode this screen is built to avoid.
   */
  const placementKnown = placementIsKnown(feed.rows);
  const sort: BrandSort =
    requestedSort === "placement" && !placementKnown ? "name" : requestedSort;

  const { rows, disclosure } = useMemo(
    () => orderBrands(feed.rows, sort),
    [feed.rows, sort]
  );

  const state = listStateFor(feed.error, {
    isLoading: feed.isLoading,
    isEmpty: rows.length === 0,
  });

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    const query = next.toString();
    router.replace(query ? `/admin/brands?${query}` : "/admin/brands");
  };

  const sortLabel: Record<BrandSort, string> = {
    name: a.sortName,
    balance: a.sortBalance,
    grossSales: a.sortGrossSales,
    placement: a.sortPlacement,
  };

  /**
   * The per-row label, in three states rather than two.
   *
   * `true`  — promoted, and said so wherever the row appears.
   * `false` — not promoted.
   * absent  — the endpoint did not answer with the field, which is NOT the same
   *           claim as "not promoted" and must not be rendered as one.
   */
  const placementCell = (row: AdminBrandRow) => {
    if (row.isPromoted === undefined) {
      return (
        <span className="text-xs text-muted-foreground">
          {a.placementUnknown}
        </span>
      );
    }
    if (!row.isPromoted) {
      return <span className="text-sm text-muted-foreground">{a.notPromoted}</span>;
    }
    return (
      <Badge
        variant="outline"
        data-promoted="true"
        className="border bg-state-wait-bg text-state-wait-fg border-state-wait-border font-medium"
      >
        {a.promotedLabel}
      </Badge>
    );
  };

  const columns: readonly ResponsiveListColumn<AdminBrandRow>[] = [
    {
      key: "name",
      header: a.brand,
      cell: (row) => row.name,
      primary: true,
    },
    {
      key: "status",
      header: a.status,
      cell: (row) => (
        <StatusPill
          kind="BrandStatus"
          value={row.status}
          size="sm"
          locale={locale}
        />
      ),
      meta: true,
    },
    {
      key: "placement",
      header: a.placement,
      // Meta, so the label sits beside the status pill on a phone card rather
      // than being buried at the bottom of a field list somebody scrolls past.
      cell: placementCell,
      meta: true,
    },
    {
      key: "grossSales",
      header: a.grossSales,
      cell: (row) => formatMoney(row.grossSales),
      numeric: true,
    },
    {
      key: "balance",
      header: a.balance,
      // Inline MoneyRow: the party is in the accessible name even where the
      // column has no room to print it, so a signed figure is never just a
      // signed figure.
      cell: (row) => (
        <MoneyRow
          amount={row.balance}
          perspective="platform"
          variant="inline"
          locale={locale}
        />
      ),
      numeric: true,
    },
    {
      key: "badges",
      header: a.badges,
      cell: (row) => (
        <span className="text-sm text-foreground">
          {a.badgeCounts
            .replace("{c}", String(row.badgeCounts.computed))
            .replace("{v}", String(row.badgeCounts.verified))}
        </span>
      ),
      tableOnly: true,
    },
  ];

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-2">
          <label
            htmlFor="brands-status-filter"
            className="text-sm font-medium text-foreground"
          >
            {a.filterStatus}
          </label>
          <NativeSelect
            id="brands-status-filter"
            className="w-full max-w-xs"
            value={status ?? ""}
            onChange={(event) => setParam("status", event.target.value)}
          >
            <NativeSelectOption value="">{a.filterAll}</NativeSelectOption>
            {STATUSES.map((value) => (
              <NativeSelectOption key={value} value={value}>
                {statusLabel({ kind: "BrandStatus", value }, locale)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>

        <div className="grid gap-2">
          <label
            htmlFor="brands-search"
            className="text-sm font-medium text-foreground"
          >
            {a.searchLabel}
          </label>
          <Input
            id="brands-search"
            className="w-full max-w-xs"
            defaultValue={search}
            placeholder={a.searchBrands}
            onBlur={(event) => setParam("q", event.target.value.trim())}
          />
        </div>

        <div className="grid gap-2">
          <label
            htmlFor="brands-sort"
            className="text-sm font-medium text-foreground"
          >
            {a.sortLabel}
          </label>
          <NativeSelect
            id="brands-sort"
            className="w-full max-w-xs"
            value={sort}
            onChange={(event) => setParam("sort", event.target.value)}
          >
            {BRAND_SORTS.map((value) => (
              <NativeSelectOption
                key={value}
                value={value}
                // Refused rather than hidden: an admin who wants the
                // storefront's order should be told why they cannot have it.
                disabled={value === "placement" && !placementKnown}
              >
                {sortLabel[value]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>

        {/*
          The only way to create a shop from this console. Three routes existed
          in the API and none was reachable from here: POST /v1/brands had no
          screen, the sales onboard screen refuses SUPER_ADMIN, and the
          applications list is empty until somebody applies.
        */}
        <div className="ms-auto">
          <NewShopButton onClick={() => setAdding(true)} />
        </div>
      </div>

      <NewShopSheet
        open={adding}
        onOpenChange={setAdding}
        onCreated={feed.reload}
      />

      {/*
        The disclosure comes back from `orderBrands` with the rows. There is no
        branch here deciding whether to show it — if the ordering consulted
        anything anybody paid for, the sentence is present.
      */}
      {disclosure ? (
        <Alert data-testid="placement-disclosure">
          <AlertTitle>{a.promotedTitle}</AlertTitle>
          <AlertDescription>{a[disclosure]}</AlertDescription>
        </Alert>
      ) : null}

      {requestedSort === "placement" && !placementKnown ? (
        <p role="status" className="text-sm text-state-wait-fg">
          {a.placementSortUnavailable}
        </p>
      ) : null}

      {/* Skeletons only when there is nothing yet. A reload over a list already
          on screen keeps the list; replacing it with grey boxes would lose the
          reader's place for no gain. */}
      {state === "loading" && rows.length === 0 ? (
        <ListState state="loading" rows={4} />
      ) : null}

      {/*
        THE TRAP EVERY LIST SCREEN SO FAR HAS FALLEN INTO.
        `listStateFor(feed.error)` returns "error" whether the FIRST page failed
        or the fourth did — and `useCursorFeed` deliberately keeps the rows it
        already has when a later page fails. Returning the full-page error here
        would throw away sixty rows already on screen because page four timed
        out. So the full panel is only drawn when there is nothing to protect.
      */}
      {state === "error" && rows.length === 0 ? (
        <ListState
          state="error"
          title={a.errorTitle}
          body={a.errorBody}
          actionLabel={a.retry}
          onAction={feed.reload}
        />
      ) : null}

      {state === "denied" ? (
        <ListState
          state="denied"
          title={a.deniedTitle}
          body={a.deniedBody}
          requiredRole={ADMIN_REQUIRED_ROLE}
        />
      ) : null}

      {state === "empty" ? (
        <ListState
          state="empty"
          title={a.brandsEmptyTitle}
          body={a.brandsEmptyBody}
        />
      ) : null}

      {rows.length > 0 ? (
        <>
          <ResponsiveList
            rows={rows}
            columns={columns}
            getRowKey={(row) => row.id}
            getRowHref={(row) => `/admin/brands/${row.id}`}
            caption={a.brandsCaption}
          />

          <p className="text-xs text-muted-foreground">{a.grossSalesNote}</p>
          <p className="text-xs text-muted-foreground">{a.promotedRule}</p>

          {/* An inline retry, beside the rows it did not manage to extend. */}
          {feed.error ? (
            <div
              role="alert"
              data-testid="brands-inline-error"
              className="flex flex-wrap items-center gap-3 rounded-md border border-state-bad-border bg-state-bad-bg px-3 py-2"
            >
              <span className="text-sm text-foreground">{a.pageFailedBody}</span>
              <Button variant="outline" size="sm" onClick={feed.loadMore}>
                {a.retry}
              </Button>
            </div>
          ) : null}

          {feed.nextCursor && !feed.error ? (
            <Button
              variant="outline"
              className="min-h-11 justify-self-start"
              disabled={feed.isLoadingMore}
              onClick={feed.loadMore}
            >
              {feed.isLoadingMore ? a.saving : a.loadMore}
            </Button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

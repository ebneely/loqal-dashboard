"use client";

/**
 * /admin/orders — every parent order, newest first.
 *
 * Composed from the domain layer: ResponsiveList, StatusPill, ListState — plus
 * shadcn's Alert, Button and NativeSelect.
 *
 * THE GRAND TOTAL IS THE WHOLE BASKET AND NO BRAND EVER SEES IT. That is the
 * one fact this screen exists to carry, so it is written under the list in
 * words rather than left implicit in a column header. `brandCount` is beside it
 * because a basket of one and a basket of three are different objects and the
 * figure means something different in each.
 *
 * There is no brand column and no search box, because the endpoint has neither.
 * See `orders-data.ts`.
 */
import { useRouter, useSearchParams } from "next/navigation";

import { OrderStatusSchema, type OrderStatus } from "@loqal/contracts/enums";

import {
  ListState,
  ResponsiveList,
  StatusPill,
  listStateFor,
  statusLabel,
  type ResponsiveListColumn,
} from "@/components/loqal";
import { Button } from "@/components/ui/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { useLocale, useMessages } from "@/lib/locale-context";
import { formatMoney } from "@/lib/money";

import { ADMIN_REQUIRED_ROLE } from "../../shell-rules";
import {
  isOrderStatus,
  useAdminOrders,
  type AdminOrderListItem,
} from "./orders-data";

const STATUSES: readonly OrderStatus[] = OrderStatusSchema.options;

export function OrdersScreen() {
  const t = useMessages();
  const a = t.admin;
  const locale = useLocale();
  const router = useRouter();
  const params = useSearchParams();

  const rawStatus = params.get("status");
  const status = isOrderStatus(rawStatus) ? rawStatus : null;

  const feed = useAdminOrders(status);
  const rows = feed.rows;

  const state = listStateFor(feed.error, {
    isLoading: feed.isLoading,
    isEmpty: rows.length === 0,
  });

  const setStatus = (value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set("status", value);
    else next.delete("status");
    const query = next.toString();
    router.replace(query ? `/admin/orders?${query}` : "/admin/orders");
  };

  const columns: readonly ResponsiveListColumn<AdminOrderListItem>[] = [
    {
      key: "orderNumber",
      header: a.orderNumber,
      cell: (row) => row.orderNumber,
      primary: true,
    },
    {
      key: "status",
      header: a.status,
      cell: (row) => (
        <StatusPill
          kind="OrderStatus"
          value={row.status}
          size="sm"
          locale={locale}
        />
      ),
      meta: true,
    },
    {
      key: "shops",
      header: a.shops,
      cell: (row) => String(row.brandCount),
      numeric: true,
    },
    {
      key: "itemsSubtotal",
      header: a.itemsSubtotal,
      cell: (row) => formatMoney(row.itemsSubtotal),
      numeric: true,
      tableOnly: true,
    },
    {
      key: "shippingTotal",
      header: a.shippingTotal,
      cell: (row) => formatMoney(row.shippingTotal),
      numeric: true,
      tableOnly: true,
    },
    {
      key: "grandTotal",
      header: a.grandTotal,
      cell: (row) => formatMoney(row.grandTotal),
      numeric: true,
    },
    {
      key: "placedAt",
      header: a.placed,
      cell: (row) => new Date(row.placedAt).toLocaleDateString(locale),
      meta: true,
    },
  ];

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <label
          htmlFor="admin-orders-status"
          className="text-sm font-medium text-foreground"
        >
          {a.filterStatus}
        </label>
        <NativeSelect
          id="admin-orders-status"
          className="w-full max-w-xs"
          value={status ?? ""}
          onChange={(event) => setStatus(event.target.value)}
        >
          <NativeSelectOption value="">{a.filterAll}</NativeSelectOption>
          {STATUSES.map((value) => (
            <NativeSelectOption key={value} value={value}>
              {statusLabel({ kind: "OrderStatus", value }, locale)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      {state === "loading" && rows.length === 0 ? (
        <ListState state="loading" rows={4} />
      ) : null}

      {/*
        A failed LATER page must not throw away the rows already on screen —
        `useCursorFeed` keeps them deliberately, and the full-page panel here
        would discard them. Only drawn when there is nothing to protect.
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
          title={a.ordersEmptyTitle}
          body={a.ordersEmptyBody}
        />
      ) : null}

      {rows.length > 0 ? (
        <>
          <ResponsiveList
            rows={rows}
            columns={columns}
            getRowKey={(row) => row.id}
            getRowHref={(row) => `/admin/orders/${row.id}`}
            caption={a.ordersCaption}
          />

          <p className="text-xs text-muted-foreground">
            {a.combinedTotalNote}
          </p>

          {feed.error ? (
            <div
              role="alert"
              data-testid="admin-orders-inline-error"
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

"use client";

/**
 * /orders — every order this shop has, and nothing about any other shop.
 *
 * Composed from the domain layer: ResponsiveList, StatusPill, ListState,
 * MobileActionBar — plus shadcn's NativeSelect and Button. The one thing this
 * screen decides for itself is which rows exist, and it decides it twice:
 *
 *  a. `liveRoutesOnly` drops SHIPPING_SERVICE before anything is drawn. It is
 *     modelled and not live, no brand carries it, and "must never render" has
 *     to hold even when the API answers with one anyway.
 *  b. `byLongestWait` ranks by `waitingSince`, not `placedAt`. Those two
 *     diverge the moment an order sits through a payment retry, and the number
 *     a shop owner needs is how long the person has been waiting.
 *
 * There is no total across brands here and no column that could hold one — the
 * contract has no parent figure to render, on purpose.
 */
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";

import { BrandOrderStatusSchema } from "@loqal/contracts/enums";
import type { BrandOrderStatus } from "@loqal/contracts/enums";
import type { BrandOrderListItem } from "@loqal/contracts/order.contract";

import {
  ListState,
  MobileActionBar,
  MobileActionBarSpacer,
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

import { byLongestWait, waitedLabel } from "../today/waited";
import {
  isLiveRoute,
  liveRoutesOnly,
  paymentLabelKey,
  routeLabelKey,
} from "./fulfilment";
import { useBrandOrders } from "./orders-data";

/** All twelve, in the order an order actually moves through them. */
const STATUSES: readonly BrandOrderStatus[] = BrandOrderStatusSchema.options;

const isStatus = (value: string | null): value is BrandOrderStatus =>
  value !== null && (STATUSES as readonly string[]).includes(value);

export function OrdersScreen() {
  const t = useMessages();
  const b = t.brand;
  const locale = useLocale();
  const router = useRouter();
  const params = useSearchParams();

  const raw = params.get("status");
  const status = isStatus(raw) ? raw : null;

  const feed = useBrandOrders(status);

  /**
   * One clock for the whole render. Reading Date.now() per row would let two
   * orders placed in the same second render "3 h" and "2 h" because the hour
   * boundary fell between them.
   */
  const now = useMemo(
    () => Date.now(),
    // The dependency is the point: the clock is re-read when new rows arrive
    // and not on every render. The linter cannot see that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [feed.rows]
  );

  const rows = useMemo(
    () => byLongestWait(liveRoutesOnly(feed.rows), now),
    [feed.rows, now]
  );

  const state = listStateFor(feed.error, {
    isLoading: feed.isLoading,
    isEmpty: rows.length === 0,
  });

  const onFilter = (value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set("status", value);
    else next.delete("status");
    const query = next.toString();
    router.replace(query ? `/orders?${query}` : "/orders");
  };

  /** The one action worth taking from a list: the shopper who has waited most. */
  const oldestShelfCheck =
    rows.find((order) => order.status === "PENDING_BRAND") ?? null;

  const columns: readonly ResponsiveListColumn<BrandOrderListItem>[] = [
    {
      key: "orderNumber",
      header: b.order,
      // A real link, not a click handler on the card: a row that only navigates
      // on click has no keyboard target and no address a shop owner can copy to
      // a driver.
      cell: (order) => (
        <Link
          href={`/orders/${order.id}`}
          className="font-mono font-semibold text-foreground underline-offset-4 hover:underline"
        >
          #{order.orderNumber}
        </Link>
      ),
      primary: true,
    },
    {
      key: "status",
      header: b.status,
      cell: (order) => (
        <StatusPill
          kind="BrandOrderStatus"
          value={order.status}
          size="sm"
          locale={locale}
        />
      ),
      meta: true,
    },
    {
      key: "items",
      header: b.items,
      cell: (order) => String(order.itemCount),
      numeric: true,
    },
    {
      key: "itemsTotal",
      header: b.itemsTotal,
      // This brand's subtotal. There is no basket figure in the contract.
      cell: (order) => formatMoney(order.itemsTotal),
      numeric: true,
    },
    {
      key: "route",
      header: b.route,
      cell: (order) =>
        isLiveRoute(order.deliveryMethod)
          ? b[routeLabelKey(order.deliveryMethod)]
          : "—",
    },
    {
      key: "payment",
      header: b.payment,
      cell: (order) => b[paymentLabelKey(order.paymentMethod)],
      tableOnly: true,
    },
    {
      key: "waiting",
      header: b.waiting,
      cell: (order) => waitedLabel(order.waitingSince, t, now) ?? "—",
    },
  ];

  return (
    <div className="grid gap-4">
      {/*
        A control, not a landmark. Giving it `aria-label` would make the filter
        a region a screen-reader user has to walk past to reach the list, and it
        would collide with the select's own accessible name.
      */}
      <div className="grid gap-2">
        <label
          htmlFor="orders-status-filter"
          className="text-sm font-medium text-foreground"
        >
          {b.filterStatus}
        </label>
        <NativeSelect
          id="orders-status-filter"
          className="w-full max-w-xs"
          value={status ?? ""}
          onChange={(event) => onFilter(event.target.value)}
        >
          <NativeSelectOption value="">{b.filterAll}</NativeSelectOption>
          {STATUSES.map((value) => (
            <NativeSelectOption key={value} value={value}>
              {statusLabel({ kind: "BrandOrderStatus", value }, locale)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      <section aria-label={b.allOrders} className="grid gap-3">
        {state === "loading" ? <ListState state="loading" rows={4} /> : null}

        {state === "error" ? (
          <ListState
            state="error"
            title={b.ordersErrorTitle}
            body={b.errorBody}
            actionLabel={b.retry}
            onAction={feed.reload}
          />
        ) : null}

        {/*
          Denied gets no retry. Pressing it again changes nothing, and a button
          that cannot work is a worse answer than none.
        */}
        {state === "denied" ? (
          <ListState
            state="denied"
            title={b.brandOnlyTitle}
            body={b.brandOnlyBody}
            requiredRole="BRAND_OWNER"
          />
        ) : null}

        {state === "empty" ? (
          <ListState
            state="empty"
            title={b.ordersEmptyTitle}
            body={b.ordersEmptyBody}
          />
        ) : null}

        {state === null ? (
          <>
            <ResponsiveList
              rows={rows}
              columns={columns}
              getRowKey={(order) => order.id}
              caption={b.allOrders}
            />
            <p className="text-xs text-muted-foreground">{b.sliceOnly}</p>
            {feed.nextCursor ? (
              <Button
                variant="outline"
                className="min-h-11 justify-self-start"
                disabled={feed.isLoadingMore}
                onClick={feed.loadMore}
              >
                {feed.isLoadingMore ? b.saving : b.loadMore}
              </Button>
            ) : null}
          </>
        ) : null}
      </section>

      {oldestShelfCheck ? (
        <>
          <MobileActionBar hint={b.hintConfirm}>
            <span className="block" data-testid="orders-action-bar">
              <Button asChild className="min-h-14 w-full text-base">
                <Link href={`/orders/${oldestShelfCheck.id}`}>
                  {b.actConfirm}
                </Link>
              </Button>
            </span>
          </MobileActionBar>
          <MobileActionBarSpacer />
        </>
      ) : null}
    </div>
  );
}

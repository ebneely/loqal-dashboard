"use client";

/**
 * Everything /admin/orders and /admin/orders/[id] read.
 *
 * THIS IS THE ONLY PLACE A MULTI-BRAND ORDER IS VISIBLE WHOLE.
 *
 * A shopper can buy from two shops in one basket and one checkout, and each
 * shop fulfils independently. `order.contract.ts` is built around refusing to
 * let a brand see the basket — no parent total, no sibling brand, no combined
 * status — and this console is the single exception to that rule. Everything
 * below therefore reads `adminOrder*`, never `brandOrder*`, and no schema here
 * is shared with the brand plane.
 *
 * Both shapes come straight from `@loqal/contracts/order.contract` and were
 * checked line by line against `OrderQueryService.listForAdmin` /
 * `findForAdmin`: money is `.toFixed(2)`, dates are `.toISOString()`, and the
 * parent status is `OrderStatus` (derived from the children) rather than the
 * `BrandOrderStatus` each child carries.
 */
import {
  adminOrderDetailSchema,
  adminOrderPageSchema,
  type AdminOrderDetail,
  type AdminOrderListItem,
} from "@loqal/contracts/order.contract";
import { OrderStatusSchema, type OrderStatus } from "@loqal/contracts/enums";

import { api } from "@/lib/api";
import { useCursorFeed, useResource, type CursorFeed, type Resource } from "@/lib/resource";

const ORDERS_PATH = "/v1/admin/orders";

export type { AdminOrderDetail, AdminOrderListItem };

/** Narrower than a cast: a status the enum has never heard of is dropped. */
export const isOrderStatus = (value: string | null): value is OrderStatus =>
  value !== null && (OrderStatusSchema.options as readonly string[]).includes(value);

/**
 * The list.
 *
 * BACKEND GAP, and a small one: `ListOrdersContract` on the backend accepts
 * `status`, `cursor` and `limit` and NOTHING else — no brand filter, no date
 * range, no order-number search. `packages/contracts` has no
 * `listAdminOrdersQuerySchema` at all, so there is nothing to import; the three
 * keys below are the whole surface. An admin looking for one order number has
 * to page to it.
 */
export function useAdminOrders(status: OrderStatus | null): CursorFeed<AdminOrderListItem> {
  return useCursorFeed(`admin-orders:${status ?? "all"}`, true, (cursor, signal) =>
    api.get(adminOrderPageSchema, ORDERS_PATH, {
      signal,
      query: { status: status ?? undefined, cursor: cursor ?? undefined },
    })
  );
}

export function useAdminOrder(id: string): Resource<AdminOrderDetail> {
  return useResource(`admin-order:${id}`, true, (signal) =>
    api.get(adminOrderDetailSchema, `${ORDERS_PATH}/${id}`, { signal })
  );
}

// ---------------------------------------------------------------------------
// Reading a frozen snapshot
// ---------------------------------------------------------------------------

/**
 * The product name as it was at purchase.
 *
 * `productSnapshot.name` is `{ ar?, en? }` and BOTH sides are optional, because
 * a photo-only draft can be bought before anybody named it. That is a real
 * state and not a defect, so it gets a sentence rather than an empty cell.
 */
export function snapshotName(
  snapshot: { name: { ar?: string; en?: string } },
  locale: "en" | "ar",
  fallback: string
): string {
  const preferred = locale === "ar" ? snapshot.name.ar : snapshot.name.en;
  return preferred ?? snapshot.name.en ?? snapshot.name.ar ?? fallback;
}

/**
 * The variant's own attributes, as a label.
 *
 * `attributes` is `Record<string, unknown>` in the contract ON PURPOSE — the
 * backend copies an unconstrained JSON column verbatim into a snapshot that is
 * then frozen forever, so a value-typed schema would permanently reject any
 * order whose variant happened to carry `{ size: 42 }`. The looseness is paid
 * for HERE, by coercing at the point of display, which is the only place where
 * being wrong is recoverable.
 */
export function attributeLabel(attributes: Record<string, unknown>): string {
  return Object.entries(attributes)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(" · ");
}

/**
 * Sum of the child shops' commission, and of their payouts.
 *
 * Done as STRINGS via integer piastres rather than with parseFloat: this is the
 * screen an admin reads before a settlement conversation, and a float sum of
 * twelve two-decimal figures is the classic way to print 1,203.9999999.
 *
 * Returns null when any figure is outside the range that can be held exactly,
 * so the screen says "add these by hand" instead of printing a number it
 * cannot stand behind.
 */
export function sumMoney(amounts: readonly string[]): string | null {
  let total = 0;
  for (const amount of amounts) {
    const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(amount);
    if (!match) return null;
    const [, sign, whole, fraction = ""] = match;
    const piastres = Number(whole) * 100 + Number(`${fraction}00`.slice(0, 2));
    if (!Number.isSafeInteger(piastres)) return null;
    total += sign === "-" ? -piastres : piastres;
    if (!Number.isSafeInteger(total)) return null;
  }
  const negative = total < 0;
  const abs = Math.abs(total);
  return `${negative ? "-" : ""}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/**
 * The parent order's own delivery method, refused when it is the one that is
 * modelled but not live.
 *
 * `SHIPPING_SERVICE` has no courier contract behind it and no brand carries it.
 * `StatusPill` already returns null for it, and its `value` prop is typed to
 * exclude it — this narrows at the data edge so the type holds at the call
 * site too, rather than being cast away there.
 */
export const liveDeliveryMethod = (
  method: AdminOrderListItem["deliveryMethod"]
): "RIDER_PER_BRAND" | "BRAND_OWN_DELIVERY" | null =>
  method === "SHIPPING_SERVICE" ? null : method;

/*
 * Nothing on this plane WRITES an order. There is no admin transition route —
 * the backend's orders admin controller has two GETs and nothing else — so this
 * file exports no mutation and the screens below draw no buttons. An admin who
 * has to move an order does it through the shop's own console.
 */

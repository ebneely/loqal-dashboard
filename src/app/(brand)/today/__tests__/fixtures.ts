/**
 * Fixtures for the Today screen. They live here and only here — shipped source
 * carries no sample orders, no sample shopper and no sample balance.
 *
 * Every order fixture is checked against `brandOrderPageSchema` in the suite, so
 * a contract change breaks these before it breaks a shop.
 */
import type { BrandOrderPage } from "@loqal/contracts/order.contract";
import type { BrandBalance } from "@loqal/contracts/ledger.contract";

/** Fixed clock. Waiting times are asserted, so "now" cannot be Date.now(). */
export const NOW = new Date("2026-08-14T12:00:00.000Z");

const iso = (minutesAgo: number) =>
  new Date(NOW.getTime() - minutesAgo * 60_000).toISOString();

export const pendingOrders: BrandOrderPage = {
  items: [
    {
      id: "0199a000-0000-7000-8000-000000000001",
      orderNumber: "1042",
      status: "PENDING_BRAND",
      deliveryMethod: "RIDER_PER_BRAND",
      paymentMethod: "CASH",
      itemCount: 3,
      itemsTotal: "1240.00",
      placedAt: iso(22),
      waitingSince: iso(22),
    },
    {
      id: "0199a000-0000-7000-8000-000000000002",
      orderNumber: "1041",
      status: "PENDING_BRAND",
      deliveryMethod: "BRAND_OWN_DELIVERY",
      paymentMethod: "CARD",
      itemCount: 1,
      itemsTotal: "385.50",
      placedAt: iso(220),
      waitingSince: iso(220),
    },
  ],
  nextCursor: null,
};

export const packedOrders: BrandOrderPage = {
  items: [
    {
      id: "0199a000-0000-7000-8000-000000000003",
      orderNumber: "1040",
      status: "PACKED",
      deliveryMethod: "RIDER_PER_BRAND",
      paymentMethod: "CARD",
      itemCount: 2,
      itemsTotal: "640.00",
      placedAt: iso(300),
      waitingSince: null,
    },
  ],
  nextCursor: null,
};

export const emptyOrders: BrandOrderPage = { items: [], nextCursor: null };

/**
 * `GET /v1/dashboard/products` — the dashboard product shape, which carries
 * variants with `stockOnHand`. There is no low-stock endpoint, so Today derives
 * the section from this.
 */
export const productsPage = {
  items: [
    {
      id: "0199b000-0000-7000-8000-000000000001",
      name: { en: "Linen shirt", ar: "قميص كتان" },
      status: "ACTIVE",
      variants: [
        { id: "v-1", sku: "NEF-LS-S", stockOnHand: 2 },
        { id: "v-2", sku: "NEF-LS-M", stockOnHand: 40 },
      ],
    },
    {
      id: "0199b000-0000-7000-8000-000000000002",
      name: { en: "Cotton scarf", ar: "إيشارب قطن" },
      status: "ACTIVE",
      variants: [{ id: "v-3", sku: "NEF-CS-1", stockOnHand: 0 }],
    },
  ],
  total: 2,
  page: 1,
  perPage: 50,
};

export const productsPageAllStocked = {
  items: [
    {
      id: "0199b000-0000-7000-8000-000000000001",
      name: { en: "Linen shirt", ar: "قميص كتان" },
      status: "ACTIVE",
      variants: [{ id: "v-2", sku: "NEF-LS-M", stockOnHand: 40 }],
    },
  ],
  total: 1,
  page: 1,
  perPage: 50,
};

/** `GET /v1/dashboard/chat/threads` — raw thread rows, no read state on them. */
export const chatThreads = [
  {
    id: "0199c000-0000-7000-8000-000000000001",
    customerId: "0199d000-0000-7000-8000-000000000001",
    guestId: null,
    brandId: "0199e000-0000-7000-8000-000000000001",
    lastMessageAt: iso(22),
    createdAt: iso(400),
  },
  {
    id: "0199c000-0000-7000-8000-000000000002",
    customerId: null,
    guestId: "guest-1",
    brandId: "0199e000-0000-7000-8000-000000000001",
    lastMessageAt: iso(8),
    createdAt: iso(90),
  },
];

export const balanceOwed: BrandBalance = {
  amount: "1875.25",
  direction: "LOQAL_OWES_BRAND",
  asOf: NOW.toISOString(),
};

/**
 * Admin orders fixtures, parsed by the contract's OWN schemas at module load.
 *
 * `.parse` rather than a cast: a fixture that drifts from the shipped contract
 * fails here, once, instead of making every test below pass against a shape the
 * API never sends.
 */
import {
  adminOrderDetailSchema,
  adminOrderPageSchema,
} from "@loqal/contracts/order.contract";

export const twoShopOrder = {
  id: "0199aaaa-0000-7000-8000-000000000001",
  orderNumber: "LQ-100234",
  status: "PROCESSING",
  deliveryMethod: "RIDER_PER_BRAND",
  itemsSubtotal: "1840.00",
  shippingTotal: "90.00",
  discountTotal: "40.00",
  grandTotal: "1890.00",
  brandCount: 2,
  placedAt: "2026-08-10T09:15:00.000Z",
} as const;

export const oneShopOrder = {
  id: "0199aaaa-0000-7000-8000-000000000002",
  orderNumber: "LQ-100235",
  status: "DELIVERED",
  deliveryMethod: "BRAND_OWN_DELIVERY",
  itemsSubtotal: "320.00",
  shippingTotal: "0.00",
  discountTotal: "0.00",
  grandTotal: "320.00",
  brandCount: 1,
  placedAt: "2026-08-11T12:00:00.000Z",
} as const;

export const ordersPage = adminOrderPageSchema.parse({
  items: [twoShopOrder, oneShopOrder],
  nextCursor: null,
});

export const ordersPageWithCursor = adminOrderPageSchema.parse({
  items: [twoShopOrder, oneShopOrder],
  nextCursor: "0199aaaa-0000-7000-8000-000000000002",
});

export const emptyOrdersPage = adminOrderPageSchema.parse({
  items: [],
  nextCursor: null,
});

/**
 * A basket split across TWO shops with DIFFERENT statuses, and paid with a
 * single Paymob row covering the whole thing. That combination is the case this
 * screen exists for, so it is the default fixture rather than an edge one.
 */
export const twoShopDetail = adminOrderDetailSchema.parse({
  ...twoShopOrder,
  shopperId: null,
  guestId: "0199bbbb-0000-7000-8000-000000000001",
  guestEmail: null,
  guestPhone: null,
  phoneVerifiedAt: null,
  shippingAddress: {
    fullName: "Nour Hassan",
    governorate: "Cairo",
    city: "Maadi",
    street: "Road 9",
    building: "14",
    phone: "0100 0000 000",
  },
  brandOrders: [
    {
      id: "0199cccc-0000-7000-8000-000000000001",
      brandId: "0199dddd-0000-7000-8000-000000000001",
      status: "DELIVERED",
      subtotal: "1200.00",
      shippingCost: "45.00",
      discountAmount: "40.00",
      commissionAmount: "144.00",
      payoutAmount: "1016.00",
      items: [
        {
          id: "0199eeee-0000-7000-8000-000000000001",
          variantId: "0199ffff-0000-7000-8000-000000000001",
          qty: 2,
          unitPrice: "600.00",
          lineTotal: "1200.00",
          productSnapshot: {
            name: { en: "Linen shirt", ar: "قميص كتان" },
            sku: "LIN-SHIRT-M",
            // Deliberately NOT all strings — the contract types these values as
            // `unknown` because the column behind them is unconstrained.
            attributes: { size: 42, colour: "sand" },
            imageMediaId: null,
          },
        },
      ],
    },
    {
      id: "0199cccc-0000-7000-8000-000000000002",
      brandId: "0199dddd-0000-7000-8000-000000000002",
      status: "PENDING_BRAND",
      subtotal: "640.00",
      shippingCost: "45.00",
      discountAmount: "0.00",
      commissionAmount: "76.80",
      payoutAmount: "563.20",
      items: [
        {
          id: "0199eeee-0000-7000-8000-000000000002",
          variantId: null,
          qty: 1,
          unitPrice: "640.00",
          lineTotal: "640.00",
          productSnapshot: {
            // The never-named draft. `{}` is a real state, not a defect.
            name: {},
            sku: "DRAFT-0001",
            attributes: {},
            imageMediaId: null,
          },
        },
      ],
    },
  ],
  payments: [
    {
      id: "0199a1a1-0000-7000-8000-000000000001",
      // Null: one charge covering the whole basket rather than one per shop.
      brandOrderId: null,
      provider: "PAYMOB",
      method: "CARD",
      settlesTo: "PLATFORM",
      amount: "1890.00",
      amountCollected: "1890.00",
      status: "PAID",
      paidAt: "2026-08-10T09:16:00.000Z",
    },
  ],
});

/** A cash basket where the courier brought back less than was charged. */
export const shortCollectedDetail = adminOrderDetailSchema.parse({
  ...twoShopDetail,
  payments: [
    {
      id: "0199a1a1-0000-7000-8000-000000000002",
      brandOrderId: "0199cccc-0000-7000-8000-000000000001",
      provider: "NONE",
      method: "CASH",
      settlesTo: "BRAND",
      amount: "1890.00",
      amountCollected: "1200.00",
      status: "PARTIALLY_PAID",
      paidAt: null,
    },
  ],
});

/** No payment row exists yet. A real state, and not an error. */
export const unpaidDetail = adminOrderDetailSchema.parse({
  ...twoShopDetail,
  payments: [],
});

/**
 * The route that is MODELLED BUT NOT LIVE. No brand carries it, and nothing in
 * this console may render it — not as a greyed chip and not as an em-dash.
 */
export const shippingServiceDetail = adminOrderDetailSchema.parse({
  ...twoShopDetail,
  deliveryMethod: "SHIPPING_SERVICE",
});

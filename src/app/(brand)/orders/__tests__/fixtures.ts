/**
 * Fixtures for /orders. They live here and only here — the route source ships
 * no sample order, no sample shopper and no sample mailbox, and a scan over
 * src/app enforces that.
 *
 * Every order fixture is checked against the shipped contracts in the suite, so
 * a contract change breaks these before it breaks a shop.
 */
import type { BrandOrderStatus } from "@loqal/contracts/enums";
import type {
  BrandOrderDetail,
  BrandOrderListItem,
  BrandOrderPage,
  ShippingAddress,
} from "@loqal/contracts/order.contract";

/** Fixed clock. Waiting times are asserted, so "now" cannot be Date.now(). */
export const NOW = new Date("2026-08-14T12:00:00.000Z");

export const iso = (minutesAgo: number) =>
  new Date(NOW.getTime() - minutesAgo * 60_000).toISOString();

const id = (n: number) =>
  `0199a000-0000-7000-8000-00000000000${n.toString(16)}`;

const listItem = (
  over: Partial<BrandOrderListItem> & Pick<BrandOrderListItem, "id">
): BrandOrderListItem => ({
  orderNumber: "1000",
  status: "PENDING_BRAND",
  deliveryMethod: "RIDER_PER_BRAND",
  paymentMethod: "CARD",
  itemCount: 2,
  itemsTotal: "640.00",
  placedAt: iso(60),
  waitingSince: iso(60),
  ...over,
});

/**
 * Ranked deliberately AGAINST placedAt: the row placed most recently has waited
 * longest, because the older one sat through a payment retry and its clock
 * restarted. A list that sorts by placedAt puts these in the wrong order.
 */
export const ordersPage: BrandOrderPage = {
  items: [
    listItem({
      id: id(1),
      orderNumber: "1042",
      status: "PENDING_BRAND",
      deliveryMethod: "RIDER_PER_BRAND",
      paymentMethod: "CARD",
      itemCount: 3,
      itemsTotal: "1240.00",
      placedAt: iso(400),
      waitingSince: iso(22),
    }),
    listItem({
      id: id(2),
      orderNumber: "1041",
      status: "PACKED",
      deliveryMethod: "BRAND_OWN_DELIVERY",
      paymentMethod: "CASH",
      itemCount: 1,
      itemsTotal: "385.50",
      placedAt: iso(60),
      waitingSince: iso(220),
    }),
  ],
  nextCursor: null,
};

/** The route that is modelled and NOT live. The list must drop it. */
export const shippingServiceRow: BrandOrderListItem = listItem({
  id: id(3),
  orderNumber: "9001",
  status: "PACKED",
  deliveryMethod: "SHIPPING_SERVICE",
  paymentMethod: "CASH",
});

export const pageWithShippingService: BrandOrderPage = {
  items: [...ordersPage.items, shippingServiceRow],
  nextCursor: null,
};

export const emptyOrdersPage: BrandOrderPage = { items: [], nextCursor: null };

export const pageWithCursor: BrandOrderPage = {
  items: [ordersPage.items[0]!],
  nextCursor: "cursor-1",
};

export const secondPage: BrandOrderPage = {
  items: [listItem({ id: id(4), orderNumber: "1039", status: "DELIVERED" })],
  nextCursor: null,
};

// ---------------------------------------------------------------------------
// Details.
// ---------------------------------------------------------------------------

/**
 * The BRAND column of the backend's TRANSITIONS table, exactly as
 * `OrderTransitionService.allowedNextStatuses` answers it for a brand actor.
 *
 * It lives in the FIXTURE on purpose. `allowedTransitions` is a fact the SERVER
 * states and the screen reads; the moment a copy of it appears in shipped
 * source we are back to a client-side state machine that can only ever agree by
 * coincidence. Here it is standing in for the API, which is what a fixture is.
 */
export const brandAllowedFrom = (
  status: BrandOrderStatus
): BrandOrderStatus[] => {
  switch (status) {
    // Waiting on payment or on verification. Only SYSTEM and ADMIN move these.
    case "PENDING_VERIFICATION":
    case "PENDING_PAYMENT":
      return [];
    case "PENDING_BRAND":
      return ["CONFIRMED", "CANCELLED"];
    // CANCELLED is ADMIN-only from here and from PACKED.
    case "CONFIRMED":
      return ["PACKED"];
    case "PACKED":
      return ["HANDED_OVER"];
    case "HANDED_OVER":
      return ["DELIVERED", "DELIVERY_FAILED"];
    // The one the old client-side switch got WRONG: a brand may give up on a
    // refused parcel, and the screen offered no way to.
    case "DELIVERY_FAILED":
      return ["HANDED_OVER", "CANCELLED"];
    // RETURNED is drivable by a brand and NOT by this endpoint — the returns
    // flow owns it, and `transitionBrandOrderBodySchema` refuses it with a 400.
    case "RETURN_REQUESTED":
      return ["RETURNED", "DELIVERED"];
    default:
      return [];
  }
};

/** A snapshot, not a foreign key. Structured, because a rider reads the parts. */
const address: ShippingAddress = {
  label: "Home",
  governorate: "Cairo",
  city: "Maadi",
  street: "12 Test Street",
  building: "4",
  phone: "+20 100 000 0000",
};

export const detail = (
  over: Partial<BrandOrderDetail> = {}
): BrandOrderDetail => {
  const status = over.status ?? "PENDING_BRAND";

  return {
    id: id(1),
    orderNumber: "1042",
    status,
    deliveryMethod: "RIDER_PER_BRAND",
    paymentMethod: "CARD",
    itemCount: 2,
    itemsTotal: "1240.00",
    shippingCost: "45.00",
    commissionAmount: "124.00",
    payoutAmount: "1116.00",
    placedAt: iso(400),
    waitingSince: iso(22),
    items: [
      {
        id: "0199f000-0000-7000-8000-000000000001",
        variantId: "0199f000-0000-7000-8000-0000000000a1",
        qty: 2,
        unitPrice: "620.00",
        lineTotal: "1240.00",
        // Frozen at purchase. Editing the product never changes this, which is
        // why the row reads its name and SKU from here and not the catalogue.
        productSnapshot: {
          name: { en: "Linen shirt", ar: "قميص كتان" },
          sku: "MINE-LS-S",
          // No stored variant label — the label is composed from these, and
          // the attribute set differs per product.
          attributes: { size: "Small" },
          imageUrl: null,
        },
      },
    ],
    shopper: {
      name: "Test Shopper",
      phone: "+20 100 000 0000",
      address,
      isGuest: false,
    },
    statusHistory: [
      {
        from: null,
        to: "PENDING_BRAND",
        at: iso(22),
        byUserId: null,
        note: null,
      },
    ],
    allowedTransitions: brandAllowedFrom(status),
    courierName: null,
    trackingNumber: null,
    ...over,
  };
};

/** A guest who left only a phone. Both name and phone are nullable now. */
export const guestOrder = detail({
  shopper: { name: null, phone: null, address, isGuest: true },
});

/** The shopper books and pays their own rider. Prepaid, nothing to enter. */
export const riderPacked = detail({
  status: "PACKED",
  deliveryMethod: "RIDER_PER_BRAND",
  paymentMethod: "CARD",
});

/** The brand's own driver or courier account. Types a tracking number. */
export const ownPacked = detail({
  status: "PACKED",
  deliveryMethod: "BRAND_OWN_DELIVERY",
  paymentMethod: "CASH",
});

/** Refused at the door with nothing paid — there is nothing to refund. */
export const cashHandedOver = detail({
  status: "HANDED_OVER",
  deliveryMethod: "BRAND_OWN_DELIVERY",
  paymentMethod: "CASH",
  courierName: "Own driver",
  trackingNumber: "TRK-1",
});

/** Refused at the door on a prepaid order — Loqal refunds. */
export const cardHandedOver = detail({
  status: "HANDED_OVER",
  deliveryMethod: "RIDER_PER_BRAND",
  paymentMethod: "CARD",
});

export const deliveredOrder = detail({ status: "DELIVERED" });

export const returnRequestedOrder = detail({ status: "RETURN_REQUESTED" });

/** Modelled, not live. The detail screen must refuse rather than render it. */
export const shippingServiceDetail = detail({
  deliveryMethod: "SHIPPING_SERVICE",
  status: "PACKED",
});

// ---------------------------------------------------------------------------
// The leak fixture.
// ---------------------------------------------------------------------------

/**
 * Every string in here belongs to the OTHER brand on the same basket, or to the
 * basket itself. None of it is in `brandOrderDetailSchema` — there is no
 * parentTotal and no sibling brand in the contract, deliberately — so none of
 * it can reach a screen through the parser.
 *
 * The point of the test is what happens when it arrives anyway: a field nobody
 * thought to check, spread into a card by a component that iterates its props.
 * A leak in a field nobody named is the leak that ships.
 */
export const SIBLING_CANARIES = [
  "Zephyr Threads",
  "ZEPH-JK-L",
  "Wool jacket",
  "8420.00",
  "9660.00",
  "TRK-ZEPHYR-9",
  "0199c111-0000-7000-8000-00000000beef",
] as const;

/** A two-brand order as it would arrive if the API over-answered. */
export const twoBrandOrderRaw = {
  ...detail({ orderNumber: "1042", status: "PACKED" }),

  // ---- none of the following is in the contract ----
  parentTotal: "9660.00",
  grandTotal: "9660.00",
  brandOrders: [
    {
      brandOrderId: "0199c111-0000-7000-8000-00000000beef",
      brandName: "Zephyr Threads",
      status: "PENDING_BRAND",
      itemsTotal: "8420.00",
      trackingNumber: "TRK-ZEPHYR-9",
      items: [
        {
          id: "0199c111-0000-7000-8000-00000000cafe",
          sku: "ZEPH-JK-L",
          productName: { en: "Wool jacket" },
          quantity: 1,
          lineTotal: "8420.00",
        },
      ],
    },
  ],
  siblingBrandName: "Zephyr Threads",
};

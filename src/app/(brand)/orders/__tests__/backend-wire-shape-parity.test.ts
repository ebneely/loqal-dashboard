/**
 * The dashboard schema, shown a body built from the BACKEND's field names.
 *
 * WHY THIS FILE EXISTS. `fixtures.ts` next to it is typed `BrandOrderDetail`,
 * so it is authored FROM the dashboard's own schema — it can only ever agree
 * with it. That is exactly why it never caught the bug this test was written
 * for: `shippingAddressSchema` declared `{ label?, governorate, city, street,
 * building?, phone }` while checkout freezes and the API echoes `{ fullName,
 * phone, governorate, city, street, building?, notes? }`, and
 * `orderItemSnapshotSchema` demanded `imageUrl` where OrderPricingService
 * writes `imageMediaId`. Both schemas are `.strict()`, so every real order
 * failed to parse and the fulfilment screen drew its error panel instead of a
 * single fulfilment button. No shop could move an order at all.
 *
 * So the payload below is deliberately UNTYPED and its keys are copied from
 * the backend source, not from `src/contracts`:
 *
 *   - address: loqal-backend/src/modules/orders/contracts/create-order.contract.ts
 *     (frozen verbatim onto Order.shippingAddress by OrderCheckoutService and
 *     echoed back verbatim by OrderQueryService: `address: row.order.shippingAddress`)
 *   - productSnapshot: loqal-backend/src/modules/orders/services/order-pricing.service.ts
 *
 * A type annotation here would defeat the whole point: it would make the
 * compiler rewrite the wire into whatever the dashboard already believes.
 */
import { describe, expect, it } from "vitest";

import { brandOrderDetailSchema } from "@loqal/contracts/order.contract";

/** create-order.contract.ts addressSchema, key for key. */
const backendShippingAddress = {
  fullName: "Nour Hassan",
  phone: "01022884471",
  governorate: "Cairo",
  city: "Maadi",
  street: "14 Road 9",
  building: "3",
  notes: "Third floor, ring twice",
};

/** The same address with only what the backend marks required. */
const backendShippingAddressMinimal = {
  fullName: "Nour Hassan",
  phone: "01022884471",
  governorate: "Cairo",
  city: "Maadi",
  street: "14 Road 9",
};

/** order-pricing.service.ts productSnapshot, key for key. */
const backendProductSnapshot = {
  name: { ar: "عباية كتان", en: "Linen Abaya" },
  sku: "NEF-LIN-M",
  attributes: { size: "M", colour: "black" },
  imageMediaId: "0199a000-0000-7000-8000-0000000000ff",
};

const wireDetail = (address: unknown, snapshot: unknown) => ({
  id: "0199a000-0000-7000-8000-000000000001",
  orderNumber: "LQ-1042",
  status: "PENDING_BRAND",
  deliveryMethod: "RIDER_PER_BRAND",
  paymentMethod: "CASH",
  itemCount: 2,
  itemsTotal: "1240.00",
  shippingCost: "45.00",
  commissionAmount: "124.00",
  payoutAmount: "1116.00",
  placedAt: "2026-08-13T14:20:00.000Z",
  waitingSince: "2026-08-13T14:20:00.000Z",
  items: [
    {
      id: "0199a000-0000-7000-8000-000000000002",
      variantId: "0199a000-0000-7000-8000-000000000003",
      qty: 2,
      unitPrice: "620.00",
      lineTotal: "1240.00",
      productSnapshot: snapshot,
    },
  ],
  shopper: {
    name: "Nour Hassan",
    phone: "01022884471",
    address,
    isGuest: false,
  },
  statusHistory: [
    {
      from: null,
      to: "PENDING_BRAND",
      at: "2026-08-13T14:20:00.000Z",
      byUserId: null,
      note: null,
    },
  ],
  allowedTransitions: ["CONFIRMED", "CANCELLED"],
  courierName: null,
  trackingNumber: null,
});

describe("brandOrderDetailSchema against the shape the backend really sends", () => {
  it("parses an order whose address carries fullName and notes", () => {
    const parsed = brandOrderDetailSchema.parse(
      wireDetail(backendShippingAddress, backendProductSnapshot)
    );

    // fullName is on EVERY order — checkout requires it — so a schema that
    // does not declare it rejects every order in the system.
    expect(parsed.shopper.address.fullName).toBe("Nour Hassan");
    expect(parsed.shopper.address.notes).toBe("Third floor, ring twice");
  });

  it("parses an order whose address omits the optional building and notes", () => {
    const parsed = brandOrderDetailSchema.parse(
      wireDetail(backendShippingAddressMinimal, backendProductSnapshot)
    );

    expect(parsed.shopper.address.building).toBeUndefined();
    expect(parsed.shopper.address.notes).toBeUndefined();
  });

  it("parses the snapshot's imageMediaId — the backend never writes a URL", () => {
    const parsed = brandOrderDetailSchema.parse(
      wireDetail(backendShippingAddress, backendProductSnapshot)
    );

    expect(parsed.items[0].productSnapshot.imageMediaId).toBe(
      "0199a000-0000-7000-8000-0000000000ff"
    );
  });

  it("parses a snapshot whose product has no media at all", () => {
    // `variant.product.media[0]?.mediaId ?? null` — null is a normal state.
    const parsed = brandOrderDetailSchema.parse(
      wireDetail(backendShippingAddress, {
        ...backendProductSnapshot,
        imageMediaId: null,
      })
    );

    expect(parsed.items[0].productSnapshot.imageMediaId).toBeNull();
  });

  it("still refuses fields the backend does not send, so drift keeps failing loudly", () => {
    // `.strict()` catching drift is the feature this file protects, not the
    // bug it works around. Loosening either schema to `.passthrough()` would
    // make the assertions above pass for the wrong reason.
    expect(() =>
      brandOrderDetailSchema.parse(
        wireDetail(
          { ...backendShippingAddress, label: "Home" },
          backendProductSnapshot
        )
      )
    ).toThrow();

    expect(() =>
      brandOrderDetailSchema.parse(
        wireDetail(backendShippingAddress, {
          ...backendProductSnapshot,
          imageUrl: "https://cdn.example.com/a.jpg",
        })
      )
    ).toThrow();
  });
});

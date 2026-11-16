import { describe, expect, it } from "vitest";

import { toServerBody } from "../settings-data";

/**
 * The shape `PATCH /v1/brands/me` accepts.
 *
 * The server groups its fields — `trading`, `invoiceIdentity`, `hours` — and
 * its DTO is strict, so a flat `deliveryFee` is a 400 ("Unrecognized keys").
 * This screen sent them flat for weeks after the server grouped them, and every
 * save touching a delivery fee or a tax number failed in front of the shop.
 * These are the cases that would have caught it.
 */
describe("toServerBody", () => {
  it("nests the trading fields under `trading`", () => {
    expect(
      toServerBody({ deliveryFee: "35.00", returnWindowDays: 14 })
    ).toEqual({ trading: { deliveryFee: "35.00", returnWindowDays: 14 } });
  });

  it("nests the invoice fields under `invoiceIdentity`", () => {
    expect(
      toServerBody({ legalName: "Nefertari LLC", taxNumber: "123-456" })
    ).toEqual({
      invoiceIdentity: { legalName: "Nefertari LLC", taxNumber: "123-456" },
    });
  });

  it("keeps a cleared value — null is a change, not an omission", () => {
    expect(toServerBody({ deliveryFee: null })).toEqual({
      trading: { deliveryFee: null },
    });
  });

  it("leaves top-level fields and the already-grouped hours where they are", () => {
    const hours = { opensAt: "10:00", closesAt: "23:00", closedDays: [5] };

    expect(toServerBody({ name: "Nefertari", hours })).toEqual({
      name: "Nefertari",
      hours,
    });
  });

  it("sends the location whole, at the top level, and null to clear it", () => {
    const location = { latitude: 30.0444, longitude: 31.2357 };

    expect(toServerBody({ location })).toEqual({ location });
    expect(toServerBody({ location: null })).toEqual({ location: null });
  });

  it("sends the delivery time whole, at the top level, and null to clear it", () => {
    const deliveryTime = { minMinutes: 60, maxMinutes: 120 };

    expect(toServerBody({ deliveryTime })).toEqual({ deliveryTime });
    expect(toServerBody({ deliveryTime: null })).toEqual({ deliveryTime: null });
    expect("trading" in toServerBody({ deliveryTime })).toBe(false);
  });

  it("sends no empty group for a save that touched nothing in it", () => {
    const body = toServerBody({ notificationPhone: "+201000000000" });

    expect(body).toEqual({ notificationPhone: "+201000000000" });
    expect("trading" in body).toBe(false);
    expect("invoiceIdentity" in body).toBe(false);
  });

  it("never sends a flat trading or invoice key", () => {
    const body = toServerBody({
      deliveryFee: "35.00",
      minimumOrderValue: "0.00",
      supportedDelivery: ["RIDER_PER_BRAND"],
      stockSetup: "SHOP_SHARED_STOCK",
      legalName: "X",
      taxNumber: "Y",
      invoiceAddress: "Z",
    });

    for (const flat of [
      "deliveryFee",
      "minimumOrderValue",
      "supportedDelivery",
      "stockSetup",
      "legalName",
      "taxNumber",
      "invoiceAddress",
    ]) {
      expect([flat, flat in body]).toEqual([flat, false]);
    }
  });
});

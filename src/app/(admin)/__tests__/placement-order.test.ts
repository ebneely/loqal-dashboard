// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { AdminBrandRow } from "../admin/brands/brands-data";
import {
  BRAND_ORDERINGS,
  BRAND_SORTS,
  compareSignedMoney,
  orderBrands,
  placementIsKnown,
} from "../admin/brands/placement-order";
import { brandOwedMoney, brandOwingMoney, brandSuspended } from "./fixtures";

/** Which fields anybody paid for. Reading one obliges a disclosure. */
const PAID_FIELDS = ["isPromoted", "featuredUntil", "sortOrder"];

/**
 * A row that records every field a comparator touches.
 *
 * This is the whole point of the file it tests. "Remember to show the banner"
 * is a rule and rules rot; this asks the comparator itself what it read.
 */
const spy = (row: AdminBrandRow, seen: Set<string>): AdminBrandRow =>
  new Proxy(row, {
    get(target, key) {
      if (typeof key === "string") seen.add(key);
      return Reflect.get(target, key);
    },
  });

describe("paid placement cannot be ranked by without saying so", () => {
  it.each(BRAND_SORTS)(
    "%s discloses itself exactly when it reads a paid field",
    (sort) => {
      const seen = new Set<string>();
      const ordering = BRAND_ORDERINGS[sort];

      // Both argument orders, because a comparator may short-circuit.
      ordering.compare(spy(brandOwedMoney, seen), spy(brandOwingMoney, seen));
      ordering.compare(spy(brandOwingMoney, seen), spy(brandOwedMoney, seen));

      const readsPaidField = PAID_FIELDS.some((field) => seen.has(field));

      expect(
        readsPaidField,
        `ordering "${sort}" ${
          readsPaidField ? "reads" : "does not read"
        } a paid-placement field, but its disclosure is ${
          ordering.disclosure ?? "null"
        }`
      ).toBe(ordering.disclosure !== null);
    }
  );

  it("hands the disclosure back with the rows, not beside them", () => {
    const ranked = orderBrands([brandOwingMoney, brandOwedMoney], "placement");

    expect(ranked.disclosure).toBe("placementOrderBanner");
    // The promoted brand is first, which is exactly why the banner is required.
    expect(ranked.rows[0].id).toBe(brandOwedMoney.id);
  });

  it("carries no disclosure for an ordering nobody bought", () => {
    expect(orderBrands([brandOwedMoney], "name").disclosure).toBeNull();
    expect(orderBrands([brandOwedMoney], "balance").disclosure).toBeNull();
    expect(orderBrands([brandOwedMoney], "grossSales").disclosure).toBeNull();
  });

  it("refuses to claim placement is known when the endpoint omits it", () => {
    const withoutPlacement = {
      id: brandOwedMoney.id,
      name: brandOwedMoney.name,
      slug: brandOwedMoney.slug,
      status: brandOwedMoney.status,
      grossSales: brandOwedMoney.grossSales,
      balance: brandOwedMoney.balance,
      badgeCounts: brandOwedMoney.badgeCounts,
    } satisfies AdminBrandRow;

    expect(placementIsKnown([withoutPlacement])).toBe(false);
    expect(placementIsKnown([brandOwedMoney, brandOwingMoney])).toBe(true);
    // An empty page cannot be evidence that placement is readable.
    expect(placementIsKnown([])).toBe(false);
  });
});

describe("signed money is compared as text, never as a float", () => {
  it("puts the largest debt first and the largest credit last", () => {
    const sorted = orderBrands(
      [brandOwedMoney, brandOwingMoney, brandSuspended],
      "balance"
    ).rows.map((row) => row.balance);

    expect(sorted).toEqual(["-860.50", "0.00", "1240.00"]);
  });

  it("orders by magnitude rather than by digit, which string sort gets wrong", () => {
    // "900.00" > "1000.00" lexicographically. It is not a larger amount.
    expect(compareSignedMoney("900.00", "1000.00")).toBeLessThan(0);
    expect(compareSignedMoney("-900.00", "-1000.00")).toBeGreaterThan(0);
  });

  it("treats a negative zero as settled rather than as a debt", () => {
    expect(compareSignedMoney("-0.00", "0.00")).toBe(0);
    expect(compareSignedMoney("-0.00", "1.00")).toBeLessThan(0);
  });

  it("compares to the piastre", () => {
    expect(compareSignedMoney("10.01", "10.00")).toBeGreaterThan(0);
    expect(compareSignedMoney("10.10", "10.09")).toBeGreaterThan(0);
  });
});

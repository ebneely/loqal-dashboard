// @vitest-environment node
/**
 * The one rule this whole screen exists to hold, checked without a DOM:
 * available and reserved are two numbers and are never merged.
 */
import { describe, expect, it } from "vitest";

import { toCatalogDetail } from "../../products/catalog-wire";
import {
  LOW_STOCK_THRESHOLD,
  inventoryRows,
  isRunningOut,
  isUsefulDelta,
  parseDelta,
  runningOut,
  scanTargets,
  toVariantStock,
  variantLabel,
  withAvailability,
} from "../stock";
import { V_HEALTHY_ON_HAND, V_PLAIN, levelHealthyOnHand, levelPlain, products } from "./fixtures";

const rows = () => inventoryRows(products.items.map(toCatalogDetail));

describe("reserved is derived exactly, never merged away", () => {
  it("recovers the held quantity from on hand minus available", () => {
    const stock = toVariantStock(levelHealthyOnHand);
    expect(stock.stockOnHand).toBe(20);
    expect(stock.availableQty).toBe(2);
    expect(stock.reservedQty).toBe(18);
  });

  it("still keeps the three numbers apart when nothing is held", () => {
    const stock = toVariantStock(levelPlain);
    expect(stock.reservedQty).toBe(0);
    expect(stock.availableQty).toBe(40);
    expect(stock.stockOnHand).toBe(40);
  });
});

describe("low stock reads availability, not the shelf count", () => {
  it("calls twenty on the shelf with eighteen held LOW", () => {
    const row = {
      ...(rows()[0] as ReturnType<typeof rows>[number]),
      stock: toVariantStock(levelHealthyOnHand),
    };
    // On hand is 20 — four times the threshold. Availability is 2.
    expect(row.stockOnHand).toBe(20);
    expect(row.stockOnHand).toBeGreaterThan(LOW_STOCK_THRESHOLD);
    expect(isRunningOut(row)).toBe(true);
  });

  it("never calls a row low on a guess when availability is unknown", () => {
    const row = rows()[0] as ReturnType<typeof rows>[number];
    expect(row.stock).toBeNull();
    expect(isRunningOut(row)).toBe(false);
  });

  it("ranks the emptiest first", () => {
    const merged = withAvailability(rows(), {
      [V_HEALTHY_ON_HAND]: toVariantStock(levelHealthyOnHand),
      [V_PLAIN]: toVariantStock(levelPlain),
    });
    const low = runningOut(merged);
    expect(low).toHaveLength(1);
    expect(low[0]?.variantId).toBe(V_HEALTHY_ON_HAND);
  });
});

describe("deriving the variant list from the products route", () => {
  it("flattens every variant of every product", () => {
    expect(rows()).toHaveLength(3);
    expect(rows()[0]?.sku).toBe("NEF-LS-S");
    expect(rows()[2]?.productName).toEqual({ en: "Cotton scarf" });
  });

  it("labels a variant by its attributes, falling back to its SKU", () => {
    expect(variantLabel({ id: "v", sku: "X", attributes: { size: "S" }, price: "1.00", compareAtPrice: null, stockOnHand: 0 })).toBe("size: S");
    expect(variantLabel({ id: "v", sku: "X", attributes: {}, price: "1.00", compareAtPrice: null, stockOnHand: 0 })).toBe("X");
  });

  it("bounds the per-variant scan and asks about the emptiest shelves first", () => {
    const targets = scanTargets(rows(), 2);
    expect(targets).toHaveLength(2);
    // 6 on hand before 20 before 40.
    expect(targets[0]).toBe("0199b000-0000-7000-8000-000000000003");
  });
});

describe("an adjustment has to actually move something", () => {
  it("refuses a zero, which records nothing", () => {
    expect(isUsefulDelta("0")).toBe(false);
    expect(isUsefulDelta("")).toBe(false);
    expect(isUsefulDelta("two")).toBe(false);
    expect(isUsefulDelta("-3")).toBe(true);
    expect(isUsefulDelta("+3")).toBe(true);
    expect(parseDelta(" -3 ")).toBe(-3);
  });
});

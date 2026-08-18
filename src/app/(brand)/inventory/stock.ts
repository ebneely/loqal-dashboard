/**
 * Stock arithmetic, kept out of the DOM so it can be checked without one.
 *
 * The single rule this file exists to protect: AVAILABLE and RESERVED are two
 * numbers and are never merged. Availability is `stockOnHand` minus the stock
 * other shoppers are already holding at checkout, computed on read and never
 * stored. One merged figure is exactly how a brand oversells — it reads a
 * number that silently includes stock it does not have.
 */
import { variantStockSchema } from "@loqal/contracts/catalog.contract";
import type { LowStockRow, VariantStock } from "@loqal/contracts/catalog.contract";
import type { Bilingual } from "@loqal/contracts/contracts";

import type {
  CatalogProductDetail,
  CatalogVariant,
} from "../products/catalog-wire";

/**
 * A variant at or under this is "low". The same number /today uses, and the
 * same number the message catalogue says out loud ("variants under 5").
 */
export const LOW_STOCK_THRESHOLD = 5;

/** How many variants the screen will ask the per-variant endpoint about. */
export const AVAILABILITY_SCAN_LIMIT = 25;

/**
 * `GET /v1/dashboard/inventory/variants/:id` answers on-hand and available and
 * NOT reserved.
 *
 * Reserved is the exact difference of the two — the endpoint computes
 * availability as on-hand minus active holds, so the subtraction recovers the
 * held quantity precisely rather than estimating it. It is derived here, once,
 * so no screen is tempted to show a single number instead.
 */
export function toVariantStock(level: {
  stockOnHand: number;
  availableQty: number;
}): VariantStock {
  return variantStockSchema.parse({
    stockOnHand: level.stockOnHand,
    reservedQty: level.stockOnHand - level.availableQty,
    availableQty: level.availableQty,
  });
}

/**
 * A row of the inventory screen: the contract's `LowStockRow`, with the stock
 * split in two.
 *
 * `stock` is null until the per-variant endpoint has answered for it, because
 * the product list carries `stockOnHand` alone. A null here draws a dash — it
 * never falls back to on-hand, which would be the merged number this whole file
 * exists to prevent.
 */
export type InventoryRow = Omit<LowStockRow, "stock"> & {
  stockOnHand: number;
  stock: VariantStock | null;
};

/** "size: XL · colour: black", or the SKU when a variant has no attributes. */
export function variantLabel(variant: CatalogVariant): string {
  const pairs = Object.entries(variant.attributes);
  if (pairs.length === 0) return variant.sku;
  return pairs.map(([key, value]) => `${key}: ${value}`).join(" · ");
}

/** Every variant of every product, flattened into one countable list. */
export function inventoryRows(
  products: readonly CatalogProductDetail[]
): InventoryRow[] {
  return products.flatMap((product) =>
    product.variants.map((variant) => ({
      variantId: variant.id,
      productId: product.id,
      sku: variant.sku,
      productName: (product.name ?? null) as Bilingual | null,
      variantLabel: variantLabel(variant),
      stockOnHand: variant.stockOnHand,
      stock: null,
    }))
  );
}

/**
 * Which variants are worth asking the per-variant endpoint about.
 *
 * There is no low-stock endpoint, so availability has to be fetched one variant
 * at a time and the list has to be bounded. The emptiest shelves first is the
 * right bound: those are the rows where the difference between on-hand and
 * available decides whether a shop can still sell the thing.
 */
export function scanTargets(
  rows: readonly InventoryRow[],
  limit = AVAILABILITY_SCAN_LIMIT
): string[] {
  return [...rows]
    .sort((a, b) => a.stockOnHand - b.stockOnHand)
    .slice(0, limit)
    .map((row) => row.variantId);
}

export function withAvailability(
  rows: readonly InventoryRow[],
  known: Readonly<Record<string, VariantStock>>
): InventoryRow[] {
  return rows.map((row) =>
    known[row.variantId] ? { ...row, stock: known[row.variantId] as VariantStock } : row
  );
}

/**
 * Low stock reads `availableQty`, never `stockOnHand`.
 *
 * Five on the shelf with four of them held for a shopper at checkout is one
 * item from empty, and a screen reading on-hand would call that comfortable.
 * A row whose availability is not known yet is NOT called low — guessing from
 * on-hand is the mistake, in either direction.
 */
export const isRunningOut = (row: InventoryRow): boolean =>
  row.stock !== null && row.stock.availableQty < LOW_STOCK_THRESHOLD;

export const runningOut = (rows: readonly InventoryRow[]): InventoryRow[] =>
  rows
    .filter(isRunningOut)
    .sort(
      (a, b) =>
        (a.stock?.availableQty ?? 0) - (b.stock?.availableQty ?? 0)
    );

/** A delta of zero records nothing, which the API refuses and so does this. */
export const isUsefulDelta = (raw: string): boolean => {
  const trimmed = raw.trim();
  if (!/^[+-]?\d+$/.test(trimmed)) return false;
  return Number(trimmed) !== 0;
};

export const parseDelta = (raw: string): number => Number(raw.trim());

"use client";

/**
 * Everything /inventory reads and writes — and the honest record of a gap.
 *
 * THERE IS NO `GET /v1/dashboard/inventory/low-stock`. The inventory plane
 * answers three routes and all three are per variant:
 *
 *   GET  /v1/dashboard/inventory/variants/:id
 *   GET  /v1/dashboard/inventory/variants/:id/adjustments
 *   POST /v1/dashboard/inventory/variants/:id/adjustments
 *
 * So the variant list is derived from `GET /v1/dashboard/products`, which
 * carries every variant's `stockOnHand` — and ONLY `stockOnHand`. Availability
 * is not in that body and is not guessable from it, so this module fetches it
 * per variant for a bounded set of the emptiest shelves and leaves the rest
 * honestly unknown. `lowStockPageSchema` in the contract describes the endpoint
 * that would replace all of this with one request.
 */
import { useCallback, useState } from "react";
import { z } from "zod";

import {
  adjustStockBodySchema,
  stockAdjustmentSchema,
  type StockAdjustment,
  type VariantStock,
} from "@loqal/contracts/catalog.contract";
import { StockAdjustmentReasonSchema } from "@loqal/contracts/enums";

import { api } from "@/lib/api";

import {
  useProductsWithVariants,
  useResource,
} from "../products/catalog-data";
import {
  inventoryRows,
  scanTargets,
  toVariantStock,
  withAvailability,
  type InventoryRow,
} from "./stock";

// ---------------------------------------------------------------------------
// Per-variant stock
// ---------------------------------------------------------------------------

/** `{ variantId, sku, stockOnHand, availableQty }` — no reserved figure. */
export const stockLevelSchema = z.object({
  variantId: z.string(),
  sku: z.string(),
  stockOnHand: z.number().int(),
  availableQty: z.number().int(),
});

/**
 * A stock adjustment as the API serialises it — the Prisma row.
 *
 * Loose where the contract is exact: `id`, `variantId`, `brandId` and `actorId`
 * are UUIDs and `createdAt` is a datetime, and this schema does not re-assert
 * any of that. It only has to describe the fields well enough to hand them to
 * `stockAdjustmentSchema`, which is where the real check happens.
 */
const wireAdjustmentSchema = z.object({
  id: z.string(),
  variantId: z.string(),
  brandId: z.string(),
  delta: z.number().int(),
  reason: StockAdjustmentReasonSchema,
  balanceAfter: z.number().int(),
  note: z.string().nullish(),
  actorId: z.string().nullish(),
  createdAt: z.string(),
});

export const wireAdjustmentListSchema = z.array(wireAdjustmentSchema);

export const toStockAdjustment = (
  wire: z.infer<typeof wireAdjustmentSchema>
): StockAdjustment =>
  stockAdjustmentSchema.parse({
    id: wire.id,
    variantId: wire.variantId,
    brandId: wire.brandId,
    delta: wire.delta,
    reason: wire.reason,
    balanceAfter: wire.balanceAfter,
    note: wire.note ?? null,
    actorId: wire.actorId ?? null,
    createdAt: wire.createdAt,
  });

export type InventoryFeed = {
  rows: readonly InventoryRow[];
  /** Variants the per-variant endpoint was asked about but has not answered. */
  scanned: number;
  error: unknown;
  isLoading: boolean;
  reload: () => void;
};

export function useInventory(): InventoryFeed {
  const products = useProductsWithVariants();

  const rows = products.data ? inventoryRows(products.data) : [];
  const targets = scanTargets(rows);

  /**
   * One request per variant, bounded, and failures are absorbed rather than
   * raised: a variant whose availability did not come back is drawn as unknown,
   * not as its on-hand count and not as a broken screen.
   */
  const availability = useResource(
    `availability:${targets.join(",")}`,
    targets.length > 0,
    async (signal) => {
      const answers = await Promise.allSettled(
        targets.map((variantId) =>
          api.get(
            stockLevelSchema,
            `/v1/dashboard/inventory/variants/${variantId}`,
            { signal }
          )
        )
      );
      const known: Record<string, VariantStock> = {};
      answers.forEach((answer, index) => {
        if (answer.status !== "fulfilled") return;
        const variantId = targets[index];
        if (variantId) known[variantId] = toVariantStock(answer.value);
      });
      return known;
    }
  );

  return {
    rows: withAvailability(rows, availability.data ?? {}),
    scanned: targets.length,
    error: products.error,
    isLoading: products.isLoading,
    reload: () => {
      products.reload();
      availability.reload();
    },
  };
}

// ---------------------------------------------------------------------------
// One variant's history
// ---------------------------------------------------------------------------

export const ADJUSTMENTS_PER_PAGE = 20;

export function useAdjustments(variantId: string | null) {
  const history = useResource(
    `adjustments:${variantId ?? "none"}`,
    variantId !== null,
    (signal) =>
      api.get(
        wireAdjustmentListSchema,
        `/v1/dashboard/inventory/variants/${variantId}/adjustments`,
        { query: { page: 1, perPage: ADJUSTMENTS_PER_PAGE }, signal }
      )
  );

  return {
    ...history,
    data: history.data ? history.data.map(toStockAdjustment) : null,
  };
}

export type AdjustWrite = {
  adjust: (variantId: string, body: unknown) => Promise<boolean>;
  pending: boolean;
  failed: boolean;
};

/**
 * A reason is required on every movement, so "where did my stock go" always
 * has an answer. `adjustStockBodySchema` enforces that here, before the request
 * leaves, rather than letting the shop owner discover it as a 400.
 */
export function useAdjustStock(): AdjustWrite {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  const adjust = useCallback(async (variantId: string, body: unknown) => {
    const parsed = adjustStockBodySchema.safeParse(body);
    if (!parsed.success) {
      setFailed(true);
      return false;
    }
    setPending(true);
    setFailed(false);
    try {
      await api.post(
        wireAdjustmentSchema,
        `/v1/dashboard/inventory/variants/${variantId}/adjustments`,
        parsed.data
      );
      return true;
    } catch {
      setFailed(true);
      return false;
    } finally {
      setPending(false);
    }
  }, []);

  return { adjust, pending, failed };
}

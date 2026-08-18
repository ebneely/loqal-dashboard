"use client";

/**
 * Everything /today reads, and the one place it says where each figure came
 * from.
 *
 * Three of the five sections have a schema in @loqal/contracts and are wired to
 * it. Two do not, and the local schemas at the bottom of this file are the
 * honest record of that gap rather than an invented shape — see the comments on
 * each. When the contracts package grows the real ones, these delete.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";

import {
  brandOrderPageSchema,
  type BrandOrderListItem,
} from "@loqal/contracts/order.contract";
import {
  brandBalanceSchema,
  type BrandBalance,
} from "@loqal/contracts/ledger.contract";
import { ProductStatusSchema } from "@loqal/contracts/enums";

import { api } from "@/lib/api";

/** A variant at or under this is "low". Matches the catalogue's copy. */
export const LOW_STOCK_THRESHOLD = 5;

/** How many rows of each feed a screen glanced at between customers can carry. */
const FEED_LIMIT = 10;

export type Resource<T> = {
  data: T | null;
  error: unknown;
  isLoading: boolean;
  reload: () => void;
};

/**
 * The smallest fetch hook that covers this screen.
 *
 * `key` is what re-runs it, `enabled` is what suppresses it entirely — the
 * balance call must not be made at all for an employee, not made and discarded.
 * The loader is held in a ref so an inline arrow in a component body does not
 * refetch on every render.
 */
export function useResource<T>(
  key: string,
  enabled: boolean,
  loader: (signal: AbortSignal) => Promise<T>
): Resource<T> {
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [isLoading, setLoading] = useState(enabled);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      setData(null);
      setError(null);
      return;
    }

    const controller = new AbortController();
    let live = true;

    setLoading(true);
    setError(null);

    loaderRef
      .current(controller.signal)
      .then((value) => {
        if (!live) return;
        setData(value);
        setError(null);
      })
      .catch((thrown: unknown) => {
        if (!live || controller.signal.aborted) return;
        setData(null);
        setError(thrown);
      })
      .finally(() => {
        if (live) setLoading(false);
      });

    return () => {
      live = false;
      controller.abort();
    };
  }, [key, enabled, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return { data, error, isLoading, reload };
}

// ---------------------------------------------------------------------------
// a + b. Orders. Contract-backed.
// ---------------------------------------------------------------------------

/**
 * PENDING_BRAND: held, not committed. The platform's stock number is only a
 * copy of what the shop last told us, so nothing is promised to a shopper until
 * a person has looked at the shelf. Every row here is somebody waiting.
 */
export function useShelfCheckOrders(): Resource<readonly BrandOrderListItem[]> {
  const page = useResource("orders:PENDING_BRAND", true, (signal) =>
    api.get(brandOrderPageSchema, "/v1/dashboard/orders", {
      query: { status: "PENDING_BRAND", limit: FEED_LIMIT },
      signal,
    })
  );
  return { ...page, data: page.data?.items ?? null };
}

/** PACKED: done with, and waiting on whoever delivers. */
export function usePackedOrders(): Resource<readonly BrandOrderListItem[]> {
  const page = useResource("orders:PACKED", true, (signal) =>
    api.get(brandOrderPageSchema, "/v1/dashboard/orders", {
      query: { status: "PACKED", limit: FEED_LIMIT },
      signal,
    })
  );
  return { ...page, data: page.data?.items ?? null };
}

// ---------------------------------------------------------------------------
// e. Balance. Contract-backed, owner-only.
// ---------------------------------------------------------------------------

/**
 * Not fetched at all unless the caller is an owner. The endpoint answers 403 to
 * an employee, and a request made only to throw the answer away would still put
 * a refusal in the API's logs for something no one asked for.
 */
export function useBalance(enabled: boolean): Resource<BrandBalance> {
  return useResource("balance", enabled, (signal) =>
    api.get(brandBalanceSchema, "/v1/brands/me/balance", { signal })
  );
}

// ---------------------------------------------------------------------------
// c. Low stock. NOT contract-backed — derived.
// ---------------------------------------------------------------------------

/**
 * There is no low-stock endpoint and no product contract in
 * @loqal/contracts. The backend's inventory plane only answers per variant
 * (`GET /v1/dashboard/inventory/variants/:id`), which would be one request per
 * variant in the catalogue.
 *
 * So this reads the dashboard product list, which already carries every
 * variant's `stockOnHand`, and filters locally. Two consequences worth knowing
 * before trusting the number:
 *
 *  - It is stock ON HAND, not AVAILABLE. Available is on-hand minus active
 *    reservations and only the per-variant endpoint computes it. The column is
 *    labelled "stock on hand" for exactly that reason.
 *  - It covers the first page of products only. This is a glance, not the
 *    Inventory screen.
 *
 * The schema is loose rather than `.strict()`: it is a local read of somebody
 * else's shape, so a field added upstream must not break this screen.
 */
const dashboardVariantSchema = z.object({
  id: z.string(),
  sku: z.string(),
  stockOnHand: z.number().int(),
});

const dashboardProductSchema = z.object({
  id: z.string(),
  name: z.object({ ar: z.string().optional(), en: z.string().optional() }),
  status: ProductStatusSchema,
  variants: z.array(dashboardVariantSchema),
});

export const dashboardProductPageSchema = z.object({
  items: z.array(dashboardProductSchema),
});

export type LowStockVariant = {
  variantId: string;
  productId: string;
  sku: string;
  productName: { ar?: string; en?: string };
  stockOnHand: number;
};

/**
 * Flatten a page of products to the variants that are running out, emptiest
 * first. Pure, and exported so it can be checked without a DOM.
 */
export function lowStockVariants(
  page: z.infer<typeof dashboardProductPageSchema>
): LowStockVariant[] {
  return page.items
    .flatMap((product) =>
      product.variants
        .filter((variant) => variant.stockOnHand < LOW_STOCK_THRESHOLD)
        .map((variant) => ({
          variantId: variant.id,
          productId: product.id,
          sku: variant.sku,
          productName: product.name,
          stockOnHand: variant.stockOnHand,
        }))
    )
    .sort((a, b) => a.stockOnHand - b.stockOnHand);
}

export function useLowStockVariants(): Resource<readonly LowStockVariant[]> {
  const page = useResource("products:low-stock", true, (signal) =>
    api.get(dashboardProductPageSchema, "/v1/dashboard/products", {
      query: { status: "ACTIVE", perPage: 50 },
      signal,
    })
  );

  return { ...page, data: page.data ? lowStockVariants(page.data) : null };
}

// ---------------------------------------------------------------------------
// d. Customer chats. NOT contract-backed — and thinner than the design asked.
// ---------------------------------------------------------------------------

/**
 * `GET /v1/dashboard/chat/threads` returns raw thread rows. A thread carries no
 * unread count and no sender for its last message, so the dashboard genuinely
 * CANNOT tell an unread thread from one the shop answered an hour ago.
 *
 * The design system's copy says "Unread chat". This screen does not, because it
 * would be a claim the data does not support — it counts threads with recent
 * activity and says how long the oldest has sat. Fixing this properly is a
 * backend change (a `lastSenderType` and an unread count on the list row), not
 * a wording change here.
 *
 * Loose, not strict: these are another module's rows.
 */
const chatThreadSchema = z.object({
  id: z.string(),
  lastMessageAt: z.string().nullable(),
});

export const chatThreadListSchema = z.array(chatThreadSchema);

export type ChatThread = z.infer<typeof chatThreadSchema>;

export function useChatThreads(): Resource<readonly ChatThread[]> {
  const threads = useResource("chat:threads", true, (signal) =>
    api.get(chatThreadListSchema, "/v1/dashboard/chat/threads", { signal })
  );

  return {
    ...threads,
    data: threads.data
      ? threads.data.filter((thread) => thread.lastMessageAt !== null)
      : null,
  };
}

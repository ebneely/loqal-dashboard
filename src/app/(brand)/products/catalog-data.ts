"use client";

/**
 * Everything the three catalog screens read and write.
 *
 * Request bodies come from `@loqal/contracts/catalog.contract` and are parsed
 * before they leave — `bulkDraftBodySchema`, `bulkUpdateBodySchema`,
 * `upsertProductBodySchema`, `setProductStatusBodySchema`. Responses are parsed
 * with the wire schemas beside this file, because the API does not yet answer
 * in the contract's shape; `catalog-wire.ts` is where that difference is
 * written down.
 *
 * One response IS the contract exactly and is parsed with it:
 * `bulkPublishResultSchema`. That endpoint already answers
 * `{ published, failed[] }` with a reason list per failure, which is the whole
 * behaviour the bulk screen is built on.
 */
import { useCallback, useEffect, useState } from "react";
import { z } from "zod";

import {
  bulkDraftBodySchema,
  bulkPublishBodySchema,
  bulkPublishResultSchema,
  bulkUpdateBodySchema,
  setProductStatusBodySchema,
  upsertProductBodySchema,
  type BulkPublishResult,
} from "@loqal/contracts/catalog.contract";
import type { ProductStatus } from "@loqal/contracts/enums";

import { api } from "@/lib/api";
import { useResource } from "@/lib/resource";

import {
  toCatalogDetail,
  toCatalogProduct,
  wireBulkUpdateResultSchema,
  wireDraftListSchema,
  wireProductPageSchema,
  wireProductSchema,
  type CatalogProduct,
  type CatalogProductDetail,
} from "./catalog-wire";

export { useResource };
export type { Resource } from "@/lib/resource";

/**
 * `perPage` is capped at 50 by the Nest DTO, and the paging is offset — `page`
 * and `perPage`, not a cursor. See catalog-wire.ts.
 */
export const PRODUCTS_PER_PAGE = 50;

export type ProductFilters = {
  status: ProductStatus | null;
  categoryId: string | null;
};

export type ProductsFeed = {
  rows: readonly CatalogProduct[];
  total: number;
  error: unknown;
  isLoading: boolean;
  reload: () => void;
};

export function useProducts(filters: ProductFilters): ProductsFeed {
  const { status, categoryId } = filters;
  const page = useResource(
    `products:${status ?? "all"}:${categoryId ?? "all"}`,
    true,
    (signal) =>
      api.get(wireProductPageSchema, "/v1/dashboard/products", {
        query: {
          status: status ?? undefined,
          categoryId: categoryId ?? undefined,
          page: 1,
          perPage: PRODUCTS_PER_PAGE,
        },
        signal,
      })
  );

  return {
    rows: page.data ? page.data.items.map(toCatalogProduct) : [],
    total: page.data?.total ?? 0,
    error: page.error,
    isLoading: page.isLoading,
    reload: page.reload,
  };
}

/**
 * The same page, kept whole.
 *
 * `useProducts` drops the variants because the list screen does not draw them.
 * /inventory does — the product list is the only place every variant's
 * `stockOnHand` is served in one request, and there is no inventory listing
 * route to replace it with.
 */
export function useProductsWithVariants() {
  const page = useResource("products:with-variants", true, (signal) =>
    api.get(wireProductPageSchema, "/v1/dashboard/products", {
      query: { page: 1, perPage: PRODUCTS_PER_PAGE },
      signal,
    })
  );

  return {
    ...page,
    data: page.data ? page.data.items.map(toCatalogDetail) : null,
  };
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

/**
 * There is no brand-scoped category route. The taxonomy is global and admin
 * owned, and the only readable list is the public `GET /v1/categories`, which
 * answers a FLAT array despite the service method being called `getTree`.
 */
export const categorySchema = z.object({
  id: z.string(),
  name: z.object({ ar: z.string().optional(), en: z.string().optional() }),
  slug: z.string(),
  parentId: z.string().nullish(),
});

export type Category = z.infer<typeof categorySchema>;

export const categoryListSchema = z.array(categorySchema);

export function useCategories() {
  return useResource("categories", true, (signal) =>
    api.get(categoryListSchema, "/v1/categories", { signal })
  );
}

// ---------------------------------------------------------------------------
// One product
// ---------------------------------------------------------------------------

export type ProductResource = {
  product: CatalogProductDetail | null;
  error: unknown;
  isLoading: boolean;
  reload: () => void;
};

export function useProduct(id: string): ProductResource {
  const [product, setProduct] = useState<CatalogProductDetail | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [isLoading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let live = true;

    setLoading(true);
    setError(null);

    api
      .get(wireProductSchema, `/v1/dashboard/products/${id}`, {
        signal: controller.signal,
      })
      .then((wire) => {
        if (!live) return;
        setProduct(toCatalogDetail(wire));
        setError(null);
      })
      .catch((thrown: unknown) => {
        if (!live || controller.signal.aborted) return;
        setProduct(null);
        setError(thrown);
      })
      .finally(() => {
        if (live) setLoading(false);
      });

    return () => {
      live = false;
      controller.abort();
    };
  }, [id, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return { product, error, isLoading, reload };
}

export type ProductWrite = {
  save: (body: unknown) => Promise<boolean>;
  setStatus: (status: ProductStatus) => Promise<boolean>;
  pending: boolean;
  failed: boolean;
};

/**
 * The editor's two writes.
 *
 * Both parse their body against the contract before sending, so a name with
 * neither language is refused here rather than by a 400 the shop owner has to
 * interpret. Neither returns the response body to the screen: the single-product
 * PATCH and the status PATCH answer with the raw repository row, which still
 * carries the `-1` "no price yet" sentinel the list route hides — so the screen
 * reloads instead of rendering what came back.
 */
export function useProductWrite(id: string): ProductWrite {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  const save = useCallback(
    async (body: unknown) => {
      const parsed = upsertProductBodySchema.safeParse(body);
      if (!parsed.success) {
        setFailed(true);
        return false;
      }
      setPending(true);
      setFailed(false);
      try {
        await api.patch(z.unknown(), `/v1/dashboard/products/${id}`, parsed.data);
        return true;
      } catch {
        setFailed(true);
        return false;
      } finally {
        setPending(false);
      }
    },
    [id]
  );

  const setStatus = useCallback(
    async (status: ProductStatus) => {
      const body = setProductStatusBodySchema.parse({ status });
      setPending(true);
      setFailed(false);
      try {
        await api.patch(
          z.unknown(),
          `/v1/dashboard/products/${id}/status`,
          body
        );
        return true;
      } catch {
        setFailed(true);
        return false;
      } finally {
        setPending(false);
      }
    },
    [id]
  );

  return { save, setStatus, pending, failed };
}

// ---------------------------------------------------------------------------
// Media — straight to R2, never through the API
// ---------------------------------------------------------------------------

/** `POST /v1/dashboard/media/uploads` answers a presigned PUT, good for 15 min. */
export const uploadTicketSchema = z.object({
  key: z.string(),
  uploadUrl: z.string(),
  expiresIn: z.number().int().optional(),
});

/** `POST /v1/dashboard/media/uploads/confirm` answers the Media row it wrote. */
export const confirmedMediaSchema = z.object({
  id: z.string(),
  key: z.string(),
});

export const UPLOAD_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type UploadMimeType = (typeof UPLOAD_MIME_TYPES)[number];

export const isUploadableType = (type: string): type is UploadMimeType =>
  (UPLOAD_MIME_TYPES as readonly string[]).includes(type);

/**
 * Ask for a ticket, PUT the bytes at R2, then tell the API the key landed.
 *
 * The bytes never touch the Nest process. Forty phone photos pushed through an
 * API server on Egyptian mobile data is not a viable upload path, and the
 * presigned PUT exists precisely so it is not attempted — which is also why the
 * PUT below uses `fetch` directly rather than the typed client: the client is
 * same-origin and cookie-bearing by construction, and this request is neither.
 */
export async function uploadOne(
  file: File,
  options: { signal?: AbortSignal; onProgress?: (fraction: number) => void } = {}
): Promise<{ mediaId: string }> {
  if (!isUploadableType(file.type)) {
    throw new Error(`Unsupported image type: ${file.type || "unknown"}`);
  }

  options.onProgress?.(0.05);

  const ticket = await api.post(
    uploadTicketSchema,
    "/v1/dashboard/media/uploads",
    { mimeType: file.type },
    { signal: options.signal }
  );

  options.onProgress?.(0.15);

  const put = await fetch(ticket.uploadUrl, {
    method: "PUT",
    body: file,
    headers: { "content-type": file.type },
    signal: options.signal,
  });
  if (!put.ok) {
    throw new Error(`The photo did not reach storage (${put.status})`);
  }

  options.onProgress?.(0.85);

  const media = await api.post(
    confirmedMediaSchema,
    "/v1/dashboard/media/uploads/confirm",
    { key: ticket.key },
    { signal: options.signal }
  );

  options.onProgress?.(1);

  return { mediaId: media.id };
}

// ---------------------------------------------------------------------------
// Bulk
// ---------------------------------------------------------------------------

/** One DRAFT product per media id, in the order the ids were given. */
export async function createDrafts(
  mediaIds: readonly string[]
): Promise<CatalogProduct[]> {
  const body = bulkDraftBodySchema.parse({ mediaIds: [...mediaIds] });
  const drafts = await api.post(
    wireDraftListSchema,
    "/v1/dashboard/products/bulk-draft",
    body
  );
  return drafts.map(toCatalogProduct);
}

export type BulkRowOutcome =
  | { id: string; ok: true; product: CatalogProduct }
  | { id: string; ok: false; reason: string };

/**
 * The grid's save.
 *
 * One result per input row, in input order. A row that fails is reported next
 * to itself and every other row still lands — thirty-nine saved rows are never
 * thrown away because the fortieth had a bad price.
 */
export async function saveBulkRows(
  rows: readonly unknown[]
): Promise<BulkRowOutcome[]> {
  const body = bulkUpdateBodySchema.parse({ products: [...rows] });
  const answer = await api.patch(
    wireBulkUpdateResultSchema,
    "/v1/dashboard/products/bulk",
    body
  );
  return answer.results.map((result) =>
    result.ok
      ? { id: result.id, ok: true, product: toCatalogProduct(result.product) }
      : { id: result.id, ok: false, reason: result.reason }
  );
}

/**
 * DRAFT to ACTIVE, and the endpoint refuses anything it cannot publish.
 *
 * The response names every failure and every reason for it. This is the one
 * catalog response that already matches `@loqal/contracts` exactly, so it is
 * parsed with the contract's own schema.
 */
export async function publishBulk(
  productIds: readonly string[]
): Promise<BulkPublishResult> {
  const body = bulkPublishBodySchema.parse({ productIds: [...productIds] });
  return api.post(
    bulkPublishResultSchema,
    "/v1/dashboard/products/bulk-publish",
    body
  );
}

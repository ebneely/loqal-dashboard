"use client";

/**
 * Everything /admin/products reads and writes.
 *
 * TWO BACKEND GAPS SHAPE THIS WHOLE FILE, and neither can be fixed here.
 *
 * 1. THIS LIST IS OFFSET-PAGED, ALONE IN THE SYSTEM.
 *
 *    `GET /admin/products` takes `page` and `perPage` and answers
 *    `{ items, total, page, perPage }`. Every other list on this backend is
 *    cursor-paged, for a stated reason: rows move while a list is read, and an
 *    offset silently skips whoever moved up into the gap. Moderation is
 *    precisely the screen where rows move — archiving one is what an admin is
 *    here to do — so the reader is TOLD the list can shift under them rather
 *    than left to discover a product that never appears on any page.
 *
 *    `useCursorFeed` is therefore not used. There is no cursor to feed it, and
 *    a "Load more" button over an offset list would be a lie about how the data
 *    arrived.
 *
 * 2. THE ROWS ARE RAW PRISMA, NOT A PROJECTION.
 *
 *    `CatalogService.adminListProducts` returns `repo.adminList(...)`
 *    UNTOUCHED. Every brand-facing product read goes through `toDashboardShape`
 *    first, which turns two NOT NULL sentinels into null and normalises money
 *    to two decimals. This route skips it, so what actually arrives is:
 *
 *      basePrice  a `Decimal` serialised by its own toJSON — "149.9", not
 *                 "149.90" — and `"-1"` for a photo-only draft that was never
 *                 priced. `-1` is a SENTINEL, not a price. `moneySchema`
 *                 rejects it outright (no leading minus), so parsing this
 *                 endpoint with the catalog contract fails on any brand that
 *                 has ever saved a draft from a photo.
 *      name       a Json blob: `{ en?, ar? }`, or `{}` for the same drafts.
 *
 *    So the schema below is written against the WIRE, both sentinels are named,
 *    and the screen prints "no price set" / "no name set" rather than "-1.00
 *    EGP" beside a currency symbol. `dashboardProductSchema` is deliberately
 *    NOT reused: it describes a shape this endpoint does not send.
 */
import { z } from "zod";

import { ProductStatusSchema, type ProductStatus } from "@loqal/contracts/enums";

import { api } from "@/lib/api";
import { useResource, type Resource } from "@/lib/resource";

const PRODUCTS_PATH = "/v1/admin/products";

/** The unnormalised decimal this route sends. Signed, so the -1 sentinel parses. */
const wireDecimal = z.string().regex(/^-?\d{1,10}(\.\d+)?$/);

export const adminProductRowSchema = z
  .object({
    id: z.string().uuid(),
    brandId: z.string().uuid(),
    categoryId: z.string().uuid().nullable(),
    /** Both sides optional, and `{}` is the never-named sentinel. */
    name: z.object({ ar: z.string().optional(), en: z.string().optional() }),
    slug: z.string(),
    basePrice: wireDecimal,
    status: ProductStatusSchema,
    createdAt: z.string(),
    brand: z
      .object({
        id: z.string().uuid(),
        name: z.string(),
        slug: z.string(),
        logoMediaId: z.string().nullable(),
      })
      .strict(),
  })
  .strict();
export type AdminProductRow = z.infer<typeof adminProductRowSchema>;

/** `{ items, total, page, perPage }` — an offset envelope, not `nextCursor`. */
export const adminProductPageSchema = z
  .object({
    items: z.array(adminProductRowSchema),
    total: z.number().int(),
    page: z.number().int(),
    perPage: z.number().int(),
  })
  .strict();
export type AdminProductPage = z.infer<typeof adminProductPageSchema>;

export const PER_PAGE = 20;

export const isProductStatus = (value: string | null): value is ProductStatus =>
  value !== null &&
  (ProductStatusSchema.options as readonly string[]).includes(value);

export function useAdminProducts(
  page: number,
  status: ProductStatus | null,
  brandId: string
): Resource<AdminProductPage> {
  const trimmed = brandId.trim();
  return useResource(
    `admin-products:${page}:${status ?? "all"}:${trimmed}`,
    true,
    (signal) =>
      api.get(adminProductPageSchema, PRODUCTS_PATH, {
        signal,
        query: {
          page,
          perPage: PER_PAGE,
          status: status ?? undefined,
          brandId: trimmed || undefined,
        },
      })
    );
}

/**
 * The moderation override.
 *
 * `adminForceStatus` deliberately skips `assertValidStatusTransition` — a
 * policy violation must be archivable from any state, including a draft that
 * was never live. The response is the raw Prisma row again, so it is parsed as
 * unknown and discarded; the screen refetches the page it is on.
 */
export const overrideProductStatus = (id: string, status: ProductStatus) =>
  api.patch(z.unknown(), `${PRODUCTS_PATH}/${id}/status`, { status });

// ---------------------------------------------------------------------------
// Reading the two sentinels
// ---------------------------------------------------------------------------

/** `-1` is "never priced", not a negative price. Anything else is real. */
export const isPriced = (basePrice: string): boolean =>
  !basePrice.startsWith("-");

/**
 * Normalise the wire's ragged decimal to the two places the rest of the console
 * prints. `formatMoney` pads a missing fraction, so this only has to refuse the
 * sentinel and hand the rest through.
 */
export const priceOf = (row: AdminProductRow): string | null =>
  isPriced(row.basePrice) ? row.basePrice : null;

/** `{}` is "never named". A locale that is missing falls back to the other. */
export function productName(
  row: AdminProductRow,
  locale: "en" | "ar"
): string | null {
  const preferred = locale === "ar" ? row.name.ar : row.name.en;
  return preferred ?? row.name.en ?? row.name.ar ?? null;
}

// ---------------------------------------------------------------------------
// Offset paging
// ---------------------------------------------------------------------------

/**
 * How many pages there are, given a total and a page size.
 *
 * Zero rows is ONE page, not zero. A screen that says "page 1 of 0" reads as
 * broken, and the empty state is what actually answers the reader.
 */
export const pageCount = (total: number, perPage: number): number =>
  Math.max(1, Math.ceil(total / Math.max(1, perPage)));

/** Clamped, so a hand-typed `?page=900` lands on the last real page. */
export const clampPage = (page: number, total: number, perPage: number): number =>
  Math.min(Math.max(1, page), pageCount(total, perPage));

/** `?page=` is user input: a word, a negative, a float all become page 1. */
export function readPage(raw: string | null): number {
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : 1;
}

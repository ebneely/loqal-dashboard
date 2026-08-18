/**
 * What the catalog API ACTUALLY answers with, and the one place this build
 * admits the difference between that and `@loqal/contracts/catalog.contract`.
 *
 * The contract describes the shape the dashboard needs. The Nest catalog plane
 * does not serve it yet, and the gaps are not cosmetic:
 *
 *  a. `GET /v1/dashboard/products` pages by `page`/`perPage` and answers
 *     `{ items, total, page, perPage }`. `dashboardProductPageSchema` is
 *     `{ items, nextCursor }` and is `.strict()`, so parsing the real body with
 *     it fails outright.
 *  b. There is no `search` query parameter. `listProductsQuerySchema` has one,
 *     and the Nest DTO is `.strict()`, so sending it is a 400.
 *  c. A product row carries `media: [{ id, mediaId, sortOrder }]` — ids, never a
 *     URL or a key. `coverUrl` is not derivable from this API at all, so it is
 *     OMITTED here rather than filled with a guess.
 *  d. A product row carries each variant's `stockOnHand` and nothing about
 *     reservations. `inStock` is defined in the contract as "any variant with
 *     availableQty > 0", which this body cannot answer, so it is omitted too.
 *     Presenting on-hand as availability is the exact mistake that makes a shop
 *     oversell, and it is not made here.
 *
 * Everything the API CAN answer for is mapped onto the contract's own types —
 * `Omit<DashboardProduct, ...>` rather than a second private product shape — so
 * when the API grows the missing fields the omissions delete and nothing else
 * moves.
 */
import { z } from "zod";

import { ProductStatusSchema } from "@loqal/contracts/enums";
import type { Bilingual } from "@loqal/contracts/contracts";
import type {
  DashboardProduct,
  ProductVariant,
} from "@loqal/contracts/catalog.contract";

// ---------------------------------------------------------------------------
// The wire
// ---------------------------------------------------------------------------

/**
 * Loose on purpose. This is a local read of another module's serialisation, so
 * a field added upstream must widen this file's blind spot, not break a screen
 * a shop owner is standing in front of.
 */
const wireVariant = z.object({
  id: z.string(),
  sku: z.string(),
  attributes: z.unknown().optional(),
  price: z.string(),
  compareAtPrice: z.string().nullish(),
  stockOnHand: z.number().int(),
});

const wireMedia = z.object({
  id: z.string(),
  mediaId: z.string(),
  sortOrder: z.number().int(),
});

export const wireProductSchema = z.object({
  id: z.string(),
  categoryId: z.string().nullish(),
  /**
   * `{}` is a real value here, not a bug. `Product.name` is `JSONB NOT NULL`
   * with no default, so bulk-draft writes an empty object as its "no name yet"
   * sentinel (loqal-backend/src/modules/catalog/catalog.util.ts). It maps to
   * `null` below, which is what the contract already makes representable.
   */
  name: z.unknown(),
  description: z.unknown().optional(),
  slug: z.string().nullish(),
  /**
   * Null when unset — but only on the routes that run the response through
   * `CatalogService.toDashboardShape`. The single-product PATCH and the status
   * PATCH do NOT, and leak the raw `-1` sentinel. `basePriceOrNull` below
   * treats any negative amount as unset for exactly that reason.
   */
  basePrice: z.string().nullish(),
  status: ProductStatusSchema,
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  variants: z.array(wireVariant).optional(),
  media: z.array(wireMedia).optional(),
});

export type WireProduct = z.infer<typeof wireProductSchema>;

/** `{ items, total, page, perPage }` — offset paging, not the contract's cursor. */
export const wireProductPageSchema = z.object({
  items: z.array(wireProductSchema),
  total: z.number().int(),
  page: z.number().int(),
  perPage: z.number().int(),
});

export type WireProductPage = z.infer<typeof wireProductPageSchema>;

/** `POST .../bulk-draft` answers with a bare array of freshly drafted products. */
export const wireDraftListSchema = z.array(wireProductSchema);

/**
 * `PATCH .../bulk` — one result per input row, in input order.
 *
 * The `ok: true` arm is deliberately NOT `dashboardProductSchema`: the product
 * it carries is the same wire row as everywhere else in this file, and parsing
 * it with the strict contract shape would fail the whole batch response because
 * one nested object has `createdAt` on it.
 */
export const wireBulkUpdateResultSchema = z.object({
  results: z.array(
    z.union([
      z.object({
        id: z.string(),
        ok: z.literal(true),
        product: wireProductSchema,
      }),
      z.object({ id: z.string(), ok: z.literal(false), reason: z.string() }),
    ])
  ),
});

export type WireBulkUpdateResult = z.infer<typeof wireBulkUpdateResultSchema>;

// ---------------------------------------------------------------------------
// The shapes the screens use — the contract's, minus what the API cannot answer
// ---------------------------------------------------------------------------

/**
 * `DashboardProduct` without `coverUrl` and `inStock`.
 *
 * Omitted, never faked. A `coverUrl` invented from a media id would 404, and an
 * `inStock` computed from `stockOnHand` would report stock another shopper is
 * already holding at checkout as available.
 */
export type CatalogProduct = Omit<DashboardProduct, "coverUrl" | "inStock">;

/**
 * `ProductVariant` with the stock it actually arrives with.
 *
 * The list route serves `stockOnHand` alone. `variantStockSchema`'s three
 * numbers only exist on `GET /v1/dashboard/inventory/variants/:id`, so this
 * type carries the one number it has under its real name rather than a
 * half-filled `VariantStock`.
 */
export type CatalogVariant = Omit<ProductVariant, "stock" | "id"> & {
  id: string;
  compareAtPrice: string | null;
  stockOnHand: number;
};

export type CatalogProductDetail = CatalogProduct & {
  description: Bilingual | null;
  variants: readonly CatalogVariant[];
  /** How many photos are attached. The API serves no URL for any of them. */
  mediaCount: number;
};

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

/**
 * `{}` and `{ ar: "", en: "" }` both mean "nobody has typed a name yet".
 * Returning null for them is what lets every screen draw a needs-attention
 * state instead of an empty cell.
 */
export function bilingualOrNull(value: unknown): Bilingual | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as { ar?: unknown; en?: unknown };
  const ar = typeof raw.ar === "string" && raw.ar.trim() ? raw.ar : undefined;
  const en = typeof raw.en === "string" && raw.en.trim() ? raw.en : undefined;
  if (!ar && !en) return null;
  return { ...(ar ? { ar } : {}), ...(en ? { en } : {}) } as Bilingual;
}

/**
 * Any negative amount is the backend's "no price yet" sentinel.
 *
 * `moneySchema` forbids a leading minus, so a negative amount can never be a
 * price a brand entered — which is what makes this test safe. A zero is NOT
 * treated as unset: a shop may legitimately give something away.
 */
export function basePriceOrNull(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.startsWith("-") ? null : trimmed;
}

/**
 * Compare two money strings without touching a float.
 *
 * `parseFloat` here would reintroduce the precision problem the string
 * representation exists to avoid, and it would do it while picking which price
 * a shopper is shown.
 */
export function compareMoney(a: string, b: string): number {
  const split = (value: string) => {
    const [whole = "0", fraction = ""] = value.split(".");
    return {
      whole: whole.replace(/^0+(?=\d)/, ""),
      cents: `${fraction}00`.slice(0, 2),
    };
  };
  const left = split(a);
  const right = split(b);
  if (left.whole.length !== right.whole.length) {
    return left.whole.length - right.whole.length;
  }
  if (left.whole !== right.whole) return left.whole < right.whole ? -1 : 1;
  if (left.cents === right.cents) return 0;
  return left.cents < right.cents ? -1 : 1;
}

/** The cheapest variant price, or null when nothing is priced yet. */
export function cheapestPrice(
  variants: readonly { price: string }[]
): string | null {
  return variants.reduce<string | null>(
    (lowest, variant) =>
      lowest === null || compareMoney(variant.price, lowest) < 0
        ? variant.price
        : lowest,
    null
  );
}

const toAttributes = (value: unknown): Record<string, string> => {
  if (!value || typeof value !== "object") return {};
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === "string") out[key] = raw;
  }
  return out;
};

export function toCatalogVariant(
  variant: z.infer<typeof wireVariant>
): CatalogVariant {
  return {
    id: variant.id,
    sku: variant.sku,
    attributes: toAttributes(variant.attributes),
    price: variant.price,
    compareAtPrice: variant.compareAtPrice ?? null,
    stockOnHand: variant.stockOnHand,
  };
}

export function toCatalogProduct(product: WireProduct): CatalogProduct {
  const variants = (product.variants ?? []).map(toCatalogVariant);
  return {
    id: product.id,
    // `Product.slug` is NOT NULL and the API always sends one; the empty string
    // is only what a body missing it would map to, never a value it invents.
    slug: product.slug ?? "",
    name: bilingualOrNull(product.name),
    status: product.status,
    basePrice: basePriceOrNull(product.basePrice),
    categoryId: product.categoryId ?? null,
    variantCount: variants.length,
    priceFrom: cheapestPrice(variants),
    updatedAt: product.updatedAt ?? product.createdAt ?? "",
  };
}

export function toCatalogDetail(product: WireProduct): CatalogProductDetail {
  return {
    ...toCatalogProduct(product),
    description: bilingualOrNull(product.description),
    variants: (product.variants ?? []).map(toCatalogVariant),
    mediaCount: (product.media ?? []).length,
  };
}

// ---------------------------------------------------------------------------
// What a row is still missing
// ---------------------------------------------------------------------------

/**
 * A draft has no name and no price, and both are legitimately null.
 *
 * Every screen asks this rather than testing the fields itself, so "needs
 * attention" means the same thing in the list, the editor and the bulk grid.
 */
export type ProductGap = "name" | "price";

export function productGaps(
  product: Pick<CatalogProduct, "name" | "basePrice">
): ProductGap[] {
  const gaps: ProductGap[] = [];
  if (product.name === null) gaps.push("name");
  if (product.basePrice === null) gaps.push("price");
  return gaps;
}

/** Nothing publishes with a gap. Loqal never invents a price to close one. */
export const isPublishable = (
  product: Pick<CatalogProduct, "name" | "basePrice">
): boolean => productGaps(product).length === 0;

/** The name in the reader's language, falling back to the other one. */
export function displayName(
  name: Bilingual | null,
  locale: "en" | "ar"
): string | null {
  if (!name) return null;
  const preferred = locale === "ar" ? name.ar : name.en;
  return preferred ?? name.ar ?? name.en ?? null;
}

/**
 * Search, done here because the API has none.
 *
 * `listProductsQuerySchema` carries a `search` field the Nest DTO does not
 * accept — its schema is `.strict()`, so sending one is a 400. This filters
 * what has already been loaded, which is why the screen says so next to the box
 * rather than implying it searched the whole catalogue.
 */
export function matchesSearch(
  product: Pick<CatalogProduct, "name" | "slug">,
  term: string
): boolean {
  const needle = term.trim().toLowerCase();
  if (!needle) return true;
  const haystacks = [product.name?.en ?? "", product.name?.ar ?? "", product.slug];
  return haystacks.some((value) => value.toLowerCase().includes(needle));
}

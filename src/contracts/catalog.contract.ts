import { z } from 'zod';
import { bilingualSchema, moneySchema } from './contracts';
import { ProductStatusSchema, StockAdjustmentReasonSchema } from './enums';
import { pageSchema } from './pagination';

/**
 * Products, variants and stock, as the brand dashboard sees them.
 *
 * This file exists because three separate screens — Products, Inventory and
 * Today — each need the same shapes, and without a shared definition each one
 * invents its own. That is not hypothetical: the first screen agent had to
 * declare a local product schema to render the low-stock section, and flagged
 * that the next two would diverge from it.
 *
 * ---------------------------------------------------------------------------
 * READ THIS BEFORE PARSING A CATALOG RESPONSE WITH ANYTHING HERE.
 *
 * This is the ONE file in the package that describes a plane the backend has
 * not built yet, rather than one it has built differently. The gap is not a
 * set of renames, and it is not closeable from this side:
 *
 *   1. `GET /v1/dashboard/products` pages by `page`/`perPage` and answers
 *      `{ items, total, page, perPage }`. Every list schema here is
 *      `{ items, nextCursor }`, because cursor paging is a system-wide rule
 *      (see pagination.ts) and offset paging is what makes a brand's own edit
 *      push a row it has not read yet onto a page it already turned past.
 *   2. `GET /v1/dashboard/inventory/variants/:id` answers `stockOnHand` and
 *      `availableQty` and never `reservedQty`, so nothing on the wire can
 *      currently fill `variantStockSchema`.
 *   3. There is NO low-stock endpoint at all. `lowStockRowSchema` below
 *      describes a route that does not exist in loqal-backend.
 *   4. A product row carries `media: [{ id, mediaId, sortOrder }]` — ids, never
 *      a URL. `coverUrl` and `mediaUrls` are not derivable from it.
 *
 * The Products screen already documents the same list in its own local
 * adapter (loqal-dashboard .../products/catalog-wire.ts) and maps onto the
 * types here rather than inventing a second product shape. That adapter is the
 * correct temporary answer and deletes itself when the backend catches up.
 * Nothing below has been relaxed to match the current API, because relaxing it
 * would mean shipping `inStock` computed from on-hand stock — which is exactly
 * how a shop oversells the item somebody is already holding at checkout.
 * ---------------------------------------------------------------------------
 */

// ---------------------------------------------------------------------------
// Stock
// ---------------------------------------------------------------------------

/**
 * Available and reserved are ALWAYS two numbers, never merged.
 *
 * `availableQty` is `stockOnHand` minus active reservations, computed on read
 * and never stored — there is no `available` column and there must not be one.
 * A single merged figure is how a brand oversells: it reads a number that
 * silently includes stock another shopper is already holding at checkout.
 */
export const variantStockSchema = z
  .object({
    stockOnHand: z.number().int(),
    /**
     * BACKEND GAP: computed by InventoryService (`sumActiveHoldQty`) and used
     * to derive availability, then discarded rather than returned. It is the
     * one number that explains the difference between the other two, so
     * without it a brand sees stock "missing" with no account of where.
     */
    reservedQty: z.number().int(),
    /**
     * Signed, not clamped, and deliberately so: `stockOnHand - activeHolds`
     * goes negative when a shelf was adjusted down under live reservations,
     * and that is an oversell in progress. Flooring it at zero would hide the
     * one state somebody needs to act on immediately.
     */
    availableQty: z.number().int(),
  })
  .strict();
export type VariantStock = z.infer<typeof variantStockSchema>;

/**
 * Every variant carries its own SKU, price and stock. Size XL may legitimately
 * cost more than S, so price lives here rather than only on the product.
 */
export const productVariantSchema = z
  .object({
    id: z.string().uuid(),
    sku: z.string(),
    /** Free-form key/value — size, colour. Not a fixed taxonomy. */
    attributes: z.record(z.string(), z.string()),
    price: moneySchema,
    /**
     * The struck-through "was" price. Nullable because most things are not on
     * sale, and the API refuses a value at or below `price` with a 409 — a
     * discount that is not a discount is a lie printed next to a number.
     */
    compareAtPrice: moneySchema.nullable(),
    stock: variantStockSchema,
  })
  .strict();
export type ProductVariant = z.infer<typeof productVariantSchema>;

/**
 * A variant as a write returns it: no stock block, because creating or editing
 * a variant does not read the reservation table, and `productId` present,
 * because the row came back on its own rather than nested under its product.
 */
export const productVariantWriteResultSchema = z
  .object({
    id: z.string().uuid(),
    productId: z.string().uuid(),
    sku: z.string(),
    attributes: z.record(z.string(), z.string()),
    price: moneySchema,
    compareAtPrice: moneySchema.nullable(),
    stockOnHand: z.number().int(),
  })
  .strict();
export type ProductVariantWriteResult = z.infer<typeof productVariantWriteResultSchema>;

export const upsertVariantBodySchema = z
  .object({
    sku: z.string().trim().min(1).max(64),
    attributes: z.record(z.string(), z.string()),
    price: moneySchema,
    compareAtPrice: moneySchema.nullable().optional(),
    stockOnHand: z.number().int().min(0).optional(),
  })
  .strict();
export type UpsertVariantBody = z.infer<typeof upsertVariantBodySchema>;

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

/**
 * `name` and `basePrice` are NULLABLE, and that is the point.
 *
 * A brand drops 40 phone photos and each becomes a DRAFT product with neither.
 * A missing price is a five-second fix; a wrong one on a live storefront is
 * not — so nothing in this system may guess one, and "unset" has to be
 * representable rather than faked with a zero or a sentinel.
 */
export const dashboardProductSchema = z
  .object({
    id: z.string().uuid(),
    slug: z.string(),
    /**
     * Null when the draft has no name yet.
     *
     * BACKEND GAP: `Product.name` is `JSONB NOT NULL`, so bulk-draft writes
     * `{}` as its "not named" sentinel and the API passes that straight out.
     * `{}` fails the at-least-one-language rule, so it must be mapped to null
     * at the response edge — exactly as `CatalogService.toDashboardShape`
     * already maps the `-1` basePrice sentinel.
     */
    name: bilingualSchema.nullable(),
    status: ProductStatusSchema,
    /**
     * Null when unset.
     *
     * BACKEND GAP: the sentinel is `Decimal(-1)` and only the GET and bulk
     * routes run it through `toDashboardShape`. `PATCH /products/:id` and
     * `PATCH /products/:id/status` return the raw `"-1"`, which moneySchema
     * rejects outright — correctly, because "-1" is not a price and a screen
     * that printed it would be worse than one that failed.
     */
    basePrice: moneySchema.nullable(),
    categoryId: z.string().uuid().nullable(),
    /** Cover image. Null while a draft still has only its dropped photo. */
    coverUrl: z.string().url().nullable(),
    variantCount: z.number().int(),
    /** Cheapest live variant, or null when nothing is priced yet. */
    priceFrom: moneySchema.nullable(),
    /**
     * Whether ANY variant has `availableQty > 0`. Never a per-variant level.
     *
     * DECIDED: this stays, and it must be computed from **availability**, not
     * from `stockOnHand`. Catalog cannot answer it alone — availability is
     * on-hand minus live reservations and lives in the inventory module — so
     * this costs `CatalogService` a call into `InventoryService` and one extra
     * grouped aggregate **per page**, not per row.
     *
     * That cost is worth paying and the shortcut is not. Deriving it from
     * `stockOnHand` is exactly the oversell this contract exists to prevent:
     * five on the shelf with four held by shoppers at checkout reads as
     * comfortable, and the brand promises an item it has already sold. A
     * boolean that is wrong in the optimistic direction is worse than no
     * boolean, because a brand acts on it.
     *
     * Dropping the field was the alternative and it loses something real: a
     * brand scanning forty products wants to see at a glance what is actually
     * sellable, and making them open each one to find out is how a stale
     * catalog stays stale.
     */
    inStock: z.boolean(),
    updatedAt: z.string().datetime(),
  })
  .strict();
export type DashboardProduct = z.infer<typeof dashboardProductSchema>;

export const dashboardProductPageSchema = pageSchema(dashboardProductSchema);
export type DashboardProductPage = z.infer<typeof dashboardProductPageSchema>;

export const dashboardProductDetailSchema = dashboardProductSchema
  .extend({
    description: bilingualSchema.nullable(),
    variants: z.array(productVariantSchema),
    mediaUrls: z.array(z.string().url()),
  })
  .strict();
export type DashboardProductDetail = z.infer<typeof dashboardProductDetailSchema>;

/**
 * BACKEND GAP on two counts: the API pages by `page`/`perPage`, and it has no
 * `search` at all — and its DTO is `.strict()`, so sending either extra key
 * here is a 400 rather than an ignored parameter. `search` stays because a
 * catalog screen a brand cannot search is unusable past about forty products.
 */
export const listProductsQuerySchema = z
  .object({
    status: ProductStatusSchema.optional(),
    categoryId: z.string().uuid().optional(),
    search: z.string().max(120).optional(),
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/**
 * At least one language, never both — enforced by bilingualSchema's own refine.
 * A both-required rule makes catalog entry unfinishable, which is the whole
 * reason the bulk flow exists.
 */
export const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Lowercase words joined by single hyphens');

/**
 * Creating one product by hand, which is the path a brand takes for its first
 * listing rather than its fortieth. `name` and `basePrice` are REQUIRED here
 * and nullable everywhere else on purpose: the bulk flow exists to let a brand
 * defer both, and this route exists to let one be finished in a single pass.
 *
 * `slug` is optional — the API derives it from `name.en` and de-duplicates per
 * brand, so nothing has to invent a URL to save a product.
 */
export const createProductBodySchema = z
  .object({
    name: bilingualSchema,
    description: bilingualSchema.optional(),
    slug: slugSchema.optional(),
    basePrice: moneySchema,
    categoryId: z.string().uuid().nullable().optional(),
  })
  .strict();
export type CreateProductBody = z.infer<typeof createProductBodySchema>;

export const upsertProductBodySchema = z
  .object({
    name: bilingualSchema.optional(),
    description: bilingualSchema.optional(),
    slug: slugSchema.optional(),
    basePrice: moneySchema.optional(),
    categoryId: z.string().uuid().nullable().optional(),
  })
  .strict();

/** DRAFT → ACTIVE → ARCHIVED. Archived, never deleted: past orders reference it forever. */
export const setProductStatusBodySchema = z
  .object({ status: ProductStatusSchema })
  .strict();

// ---------------------------------------------------------------------------
// Bulk — the screen that wins brands
// ---------------------------------------------------------------------------

/**
 * Why a row could not be saved or published, as a stable token.
 *
 * A closed enum rather than a free string: the dashboard must translate these,
 * and an open string would let the backend add a reason the Arabic catalogue
 * has no words for — silently falling back to English prose in front of the one
 * person who needs to act on it. Adding a case here is a deliberate act that
 * fails the build until both catalogues carry it.
 */
export const bulkFailureCodeSchema = z.enum([
  'NAME_NOT_SET',
  'PRICE_NOT_SET',
  'PRODUCT_NOT_FOUND',
  'INVALID_STATUS_TRANSITION',
  'NOT_A_DRAFT',
  'UPDATE_FAILED',
]);
export type BulkFailureCode = z.infer<typeof bulkFailureCodeSchema>;

export const bulkDraftBodySchema = z
  .object({ mediaIds: z.array(z.string().uuid()).min(1).max(100) })
  .strict();

export const bulkUpdateRowSchema = z
  .object({
    id: z.string().uuid(),
    name: bilingualSchema.optional(),
    basePrice: moneySchema.nullable().optional(),
    categoryId: z.string().uuid().nullable().optional(),
    status: ProductStatusSchema.optional(),
  })
  .strict();

export const bulkUpdateBodySchema = z
  .object({ products: z.array(bulkUpdateRowSchema).min(1).max(100) })
  .strict();

/**
 * One result per input row, in input order. A grid of forty rows where one is
 * bad must not discard the other thirty-nine, and the brand has to be told
 * which one — "something failed" is useless to someone holding a phone.
 */
export const bulkUpdateResultSchema = z
  .object({
    results: z.array(
      z.discriminatedUnion('ok', [
        z.object({ id: z.string().uuid(), ok: z.literal(true), product: dashboardProductSchema }).strict(),
        z
          .object({
            id: z.string().uuid(),
            ok: z.literal(false),
            /**
             * Machine-readable, so the dashboard can translate. `reason` is
             * English prose from the server and reaches an Arabic-reading shop
             * owner at the exact moment they need to act on it — matching on
             * the prose works until someone rewords it.
             */
            code: bulkFailureCodeSchema,
            reason: z.string(),
          })
          .strict(),
      ]),
    ),
  })
  .strict();
export type BulkUpdateResult = z.infer<typeof bulkUpdateResultSchema>;

export const bulkPublishBodySchema = z
  .object({ productIds: z.array(z.string().uuid()).min(1).max(100) })
  .strict();
export type BulkPublishBody = z.infer<typeof bulkPublishBodySchema>;

/** Publishing names what is missing, per product. It never invents a price. */
export const bulkPublishResultSchema = z
  .object({
    published: z.array(z.string().uuid()),
    failed: z.array(
      z
        .object({
          id: z.string().uuid(),
          codes: z.array(bulkFailureCodeSchema).min(1),
          reasons: z.array(z.string()).min(1),
        })
        .strict(),
    ),
  })
  .strict();
export type BulkPublishResult = z.infer<typeof bulkPublishResultSchema>;

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------

/**
 * Low stock is measured on `availableQty`, not `stockOnHand`. A shelf holding
 * five items with four reserved is one item from empty, and a screen reading
 * on-hand would call that comfortable.
 */
export const lowStockRowSchema = z
  .object({
    variantId: z.string().uuid(),
    productId: z.string().uuid(),
    sku: z.string(),
    productName: bilingualSchema.nullable(),
    variantLabel: z.string(),
    stock: variantStockSchema,
  })
  .strict();
export type LowStockRow = z.infer<typeof lowStockRowSchema>;

export const lowStockPageSchema = pageSchema(lowStockRowSchema);

/** A reason is required on every movement, so "where did my stock go" has an answer. */
export const adjustStockBodySchema = z
  .object({
    delta: z.number().int().refine((n) => n !== 0, 'A zero adjustment records nothing'),
    reason: StockAdjustmentReasonSchema,
    note: z.string().max(500).optional(),
  })
  .strict();
export type AdjustStockBody = z.infer<typeof adjustStockBodySchema>;

export const stockAdjustmentSchema = z
  .object({
    id: z.string().uuid(),
    /** Which shelf moved. The row is meaningless without it. */
    variantId: z.string().uuid(),
    /**
     * The brand's own id, echoed. Harmless here — this route is already scoped
     * to the session's brand — but present only because the repository does a
     * `findMany` with no `select`, so every future column on StockAdjustment
     * lands on the wire the day it is added.
     */
    brandId: z.string().uuid(),
    delta: z.number().int(),
    reason: StockAdjustmentReasonSchema,
    /** Stock after this movement, written under the same lock that moved it. */
    balanceAfter: z.number().int(),
    note: z.string().nullable(),
    actorId: z.string().uuid().nullable(),
    createdAt: z.string().datetime(),
  })
  .strict();
export type StockAdjustment = z.infer<typeof stockAdjustmentSchema>;

export const stockAdjustmentPageSchema = pageSchema(stockAdjustmentSchema);

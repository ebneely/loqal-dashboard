import { z } from 'zod';
import { bilingualSchema, moneySchema } from './contracts';
import { ImportItemStatusSchema, ImportJobStatusSchema, ImportSourceTypeSchema } from './enums';
import { pageSchema } from './pagination';

/**
 * Loading a brand's catalog for them. This is the pitch that closes the first
 * five brands — most of these shops are offline, with no website and no
 * spreadsheet — and it is an admin-side tool, never self-serve.
 *
 * NOTHING PUBLISHES AUTOMATICALLY. Real catalogs are full of "TEST PRODUCT"
 * and prices from two seasons ago, so items land STAGED, a human maps
 * categories and fixes prices, and products arrive as DRAFT even then. There
 * is no PUBLISHED value in ImportItemStatus and there must never be one.
 */

export const importJobSchema = z
  .object({
    id: z.string().uuid(),
    brandId: z.string().uuid(),
    brandName: z.string(),
    sourceType: ImportSourceTypeSchema,
    sourceRef: z.string().nullable(),
    status: ImportJobStatusSchema,
    /**
     * Per-status counts, so a partial import says which rows failed instead of
     * reporting one number that hides them.
     */
    counts: z
      .object({
        staged: z.number().int(),
        mapped: z.number().int(),
        imported: z.number().int(),
        skipped: z.number().int(),
        failed: z.number().int(),
      })
      .strict(),
    failureReason: z.string().nullable(),
    createdAt: z.string().datetime(),
    completedAt: z.string().datetime().nullable(),
  })
  .strict();
export type ImportJob = z.infer<typeof importJobSchema>;

export const importJobPageSchema = pageSchema(importJobSchema);

export const importItemSchema = z
  .object({
    id: z.string().uuid(),
    status: ImportItemStatusSchema,
    sourceTitle: z.string(),
    /**
     * Bilingual, matching Product.name — not a flat string.
     *
     * An earlier version of this contract flattened it, which quietly made an
     * Arabic product name unreachable through the importer: the one tool whose
     * whole purpose is loading the catalogs of Egyptian shops that mostly name
     * their products in Arabic. A feed often carries only one language, hence
     * the usual at-least-one rule rather than both.
     *
     * BACKEND IS WRONG HERE, and the proof is in its own publish step:
     * ImportStagingService stores a flat `mappedName: string`, and
     * ImportPublishService then writes `name: { en: row.mappedName }` — every
     * product imported for an Arabic-speaking shop is filed as English. The
     * column is a Json blob (`ImportItem.mappedPayload`) with no shape of its
     * own, so this is a code change and not a migration.
     */
    mappedName: bilingualSchema.nullable(),
    /**
     * Null is a legitimate, expected state — never a zero. A missing price is a
     * five-second fix; a wrong one on a live storefront is not, so nothing in
     * this pipeline may guess.
     */
    mappedPrice: moneySchema.nullable(),
    mappedCategoryId: z.string().uuid().nullable(),
    missingPrice: z.boolean(),
    /**
     * Symmetric with missingPrice so the review grid can flag both before a
     * publish attempt rather than after. A row that fails at publish time with
     * a message is a worse experience than a row that shows what it needs while
     * the reviewer is already looking at it.
     *
     * BACKEND GAP: `missingPrice` is written into mappedPayload at staging and
     * `missingName` is not, so the grid can pre-flag one blocker and not the
     * other — even though publish refuses on both.
     */
    missingName: z.boolean(),
    failureReason: z.string().nullable(),
  })
  .strict();
export type ImportItem = z.infer<typeof importItemSchema>;

export const importItemPageSchema = pageSchema(importItemSchema);

export const createImportJobBodySchema = z
  .object({
    brandId: z.string().uuid(),
    sourceType: ImportSourceTypeSchema,
    /** A URL for SHOPIFY/WOOCOMMERCE/FEED/JSONLD, an upload id for CSV. */
    sourceRef: z.string().min(1),
  })
  .strict();
export type CreateImportJobBody = z.infer<typeof createImportJobBodySchema>;

/** The review grid's per-row edit: map a category, fix a price, untick junk. */
export const updateImportItemBodySchema = z
  .object({
    mappedName: bilingualSchema.nullable().optional(),
    mappedPrice: moneySchema.nullable().optional(),
    mappedCategoryId: z.string().uuid().nullable().optional(),
    status: z.enum(['STAGED', 'MAPPED', 'SKIPPED']).optional(),
  })
  .strict()
  /**
   * An empty PATCH is a 400 at the API, so it is a 400 here too. A grid that
   * fires a no-op save on every blur would otherwise look like it worked and
   * change nothing.
   */
  .refine(
    (v) => Object.values(v).some((field) => field !== undefined),
    'Provide at least one of mappedName, mappedPrice, mappedCategoryId, or status',
  );
export type UpdateImportItemBody = z.infer<typeof updateImportItemBodySchema>;

export const listImportJobsQuerySchema = z
  .object({
    brandId: z.string().uuid().optional(),
    status: ImportJobStatusSchema.optional(),
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();
export type ListImportJobsQuery = z.infer<typeof listImportJobsQuerySchema>;

export const listImportItemsQuerySchema = z
  .object({
    status: ImportItemStatusSchema.optional(),
    /**
     * Send it only when it is true. `z.coerce.boolean()` on a query string
     * turns the literal text "false" into `true`, so there is no way to spell
     * "no" — omitting the key is the only honest off switch, on this side and
     * on the backend's identical schema.
     */
    needsAttention: z.coerce.boolean().optional(),
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();
export type ListImportItemsQuery = z.infer<typeof listImportItemsQuerySchema>;

/** `POST /admin/imports/uploads` — a CSV body exchanged for an id to import. */
export const uploadCsvBodySchema = z.object({ content: z.string().min(1) }).strict();
export const uploadCsvResultSchema = z.object({ uploadId: z.string() }).strict();

/**
 * `POST /admin/imports/:jobId/publish`. Counts only: the per-row outcome is
 * already on each ImportItem, and repeating it here would be a second copy to
 * keep in step.
 */
export const publishImportResultSchema = z
  .object({ imported: z.number().int(), failed: z.number().int() })
  .strict();
export type PublishImportResult = z.infer<typeof publishImportResultSchema>;

"use client";

/**
 * Everything /admin/imports and /admin/imports/[id] read and write.
 *
 * THE JOB SHAPE IS THE CONTRACT'S. THE ITEM SHAPE IS NOT, AND CANNOT BE.
 *
 * `importJobSchema` matches `ImportService.toWireJob` field for field, so the
 * list and the job header parse against the package. `importItemSchema` does
 * NOT match `toWireItem`, in two ways that are each fatal to a strict client:
 *
 *   1. `missingName` IS NOT SENT AT ALL. The contract requires it — not
 *      optional, not nullable — and `toWireItem` never writes the key. Parsing
 *      a real response with `importItemSchema` fails on EVERY row. The comment
 *      in the contract describes this as "the grid can pre-flag one blocker and
 *      not the other"; the reality is worse than that, because the field is
 *      absent rather than false.
 *
 *   2. `mappedName` IS A FLAT STRING, not the bilingual object the contract
 *      declares. `ImportRow.mappedName` is `string | null`, the PATCH body
 *      takes `string | null`, and `ImportPublishService` writes
 *      `name: { en: row.mappedName }` — so every product imported for an
 *      Arabic-speaking shop is filed as English. That is the shipped behaviour
 *      of the one tool whose entire purpose is loading the catalogs of Egyptian
 *      shops that name their products in Arabic.
 *
 * Neither can be papered over here. The schema below is written against the
 * WIRE, both divergences are named at the field, and the review grid offers ONE
 * name box rather than two — because a second box would write into a field the
 * publish step does not read, and an admin would type an Arabic name that
 * silently never arrives.
 *
 * The missing-name flag is therefore DERIVED on this side rather than trusted:
 * `blockedItems` computes it from `mappedName`, so the grid can still flag both
 * blockers before a publish attempt rather than after one.
 */
import { z } from "zod";

import {
  createImportJobBodySchema,
  importJobPageSchema,
  importJobSchema,
  publishImportResultSchema,
  uploadCsvBodySchema,
  uploadCsvResultSchema,
  type CreateImportJobBody,
  type ImportJob,
} from "@loqal/contracts/import.contract";
import {
  ImportItemStatusSchema,
  ImportJobStatusSchema,
  type ImportItemStatus,
  type ImportJobStatus,
} from "@loqal/contracts/enums";

import { api } from "@/lib/api";
import {
  useCursorFeed,
  useResource,
  type CursorFeed,
  type Resource,
} from "@/lib/resource";

const IMPORTS_PATH = "/v1/admin/imports";

export type { ImportJob };

/** See the header. This is `toWireItem`, not `importItemSchema`. */
export const wireImportItemSchema = z
  .object({
    id: z.string().uuid(),
    status: ImportItemStatusSchema,
    sourceTitle: z.string(),
    /** FLAT. The contract says bilingual; the backend stores and sends a string. */
    mappedName: z.string().nullable(),
    mappedPrice: z.string().nullable(),
    mappedCategoryId: z.string().uuid().nullable(),
    missingPrice: z.boolean(),
    /* `missingName` is absent from this object on purpose — the API does not
       send it. It is derived in `blockedItems` below. */
    failureReason: z.string().nullable(),
  })
  .strict();
export type WireImportItem = z.infer<typeof wireImportItemSchema>;

export const wireImportItemPageSchema = z
  .object({
    items: z.array(wireImportItemSchema),
    nextCursor: z.string().nullable(),
  })
  .strict();

export const isJobStatus = (value: string | null): value is ImportJobStatus =>
  value !== null &&
  (ImportJobStatusSchema.options as readonly string[]).includes(value);

export function useImportJobs(
  status: ImportJobStatus | null,
  brandId: string
): CursorFeed<ImportJob> {
  const trimmed = brandId.trim();
  return useCursorFeed(
    `admin-imports:${status ?? "all"}:${trimmed}`,
    true,
    (cursor, signal) =>
      api.get(importJobPageSchema, IMPORTS_PATH, {
        signal,
        query: {
          status: status ?? undefined,
          brandId: trimmed || undefined,
          cursor: cursor ?? undefined,
        },
      })
  );
}

export function useImportJob(id: string): Resource<ImportJob> {
  return useResource(`admin-import-job:${id}`, true, (signal) =>
    api.get(importJobSchema, `${IMPORTS_PATH}/${id}`, { signal })
  );
}

/**
 * `needsAttention` is sent ONLY when true.
 *
 * `z.coerce.boolean()` on a query string turns the literal text "false" into
 * `true`, so there is no way to spell "no" — omitting the key is the only
 * honest off switch, on this side and on the backend's identical schema.
 */
export function useImportItems(
  jobId: string,
  needsAttention: boolean
): CursorFeed<WireImportItem> {
  return useCursorFeed(
    `admin-import-items:${jobId}:${needsAttention}`,
    true,
    (cursor, signal) =>
      api.get(wireImportItemPageSchema, `${IMPORTS_PATH}/${jobId}/items`, {
        signal,
        query: {
          needsAttention: needsAttention ? true : undefined,
          cursor: cursor ?? undefined,
        },
      })
  );
}

/**
 * The review grid's one mutation.
 *
 * FLAT `mappedName`, matching `UpdateImportItemDto` — not the contract
 * package's bilingual `updateImportItemBodySchema`, which would be a 400 here.
 * An empty PATCH is a 400 at the API, so it is refused before the request:
 * a grid that fires a no-op save on every blur would look like it worked and
 * change nothing.
 */
export const updateImportItemBodySchema = z
  .object({
    mappedName: z.string().max(300).nullable().optional(),
    mappedPrice: z.string().nullable().optional(),
    mappedCategoryId: z.string().uuid().nullable().optional(),
    status: z.enum(["STAGED", "MAPPED", "SKIPPED"]).optional(),
  })
  .strict()
  .refine((value) => Object.values(value).some((field) => field !== undefined));
export type UpdateImportItemBody = z.infer<typeof updateImportItemBodySchema>;

export const updateImportItem = (
  jobId: string,
  itemId: string,
  body: UpdateImportItemBody
) =>
  api.patch(
    wireImportItemSchema,
    `${IMPORTS_PATH}/${jobId}/items/${itemId}`,
    updateImportItemBodySchema.parse(body)
  );

/** Counts only. The per-row outcome is already on each item. */
export const publishImportJob = (jobId: string) =>
  api.post(publishImportResultSchema, `${IMPORTS_PATH}/${jobId}/publish`);

// ---------------------------------------------------------------------------
// Starting a job
// ---------------------------------------------------------------------------

/**
 * The two writes that start an import, in the order the backend wants them.
 *
 * A CSV goes up first: `POST /v1/admin/imports/uploads` takes the file AS
 * TEXT in a JSON body — `{ content }`, there is no multipart route on this
 * plane — and answers `{ uploadId }`, which is the storage key. That id, or a
 * URL for the feed-shaped sources, is the `sourceRef` of the create.
 *
 * `POST /v1/admin/imports` then makes the source and the job and STAGES
 * SYNCHRONOUSLY — the response is the finished first pass, already counted
 * and reviewable (or already failed, with the reason on the job). So the
 * right landing after this resolves is the job's detail, not the list.
 */
export const uploadImportCsv = (content: string) =>
  api.post(
    uploadCsvResultSchema,
    `${IMPORTS_PATH}/uploads`,
    uploadCsvBodySchema.parse({ content })
  );

export const createImportJob = (body: CreateImportJobBody) =>
  api.post(
    importJobSchema,
    IMPORTS_PATH,
    createImportJobBodySchema.parse(body)
  );

// ---------------------------------------------------------------------------
// What blocks a publish
// ---------------------------------------------------------------------------

export type Blocker = "MISSING_NAME" | "MISSING_PRICE";

/**
 * Why a row cannot publish, flagged BEFORE the attempt rather than after it.
 *
 * `ImportPublishService` refuses on both a missing name and a missing price. It
 * throws on the name (`Cannot publish a row with no name`) and the API only
 * pre-flags the price, so the name blocker is computed here from the value
 * itself — which is more reliable than the flag anyway, since the flag is
 * written once at staging and the value changes on every edit.
 *
 * A SKIPPED row blocks nothing. Skipped items are left alone by publish, so
 * flagging one would send a reviewer to fix a row they already decided about.
 */
export function blockersFor(item: WireImportItem): readonly Blocker[] {
  if (item.status === "SKIPPED" || item.status === "IMPORTED") return [];
  const blockers: Blocker[] = [];
  if (!item.mappedName || item.mappedName.trim() === "") {
    blockers.push("MISSING_NAME");
  }
  if (!item.mappedPrice || item.missingPrice) blockers.push("MISSING_PRICE");
  return blockers;
}

/** Every row that would be refused, in the order they appear. */
export const blockedItems = (
  items: readonly WireImportItem[]
): readonly WireImportItem[] =>
  items.filter((item) => blockersFor(item).length > 0);

/**
 * A price the API would accept, checked before the request.
 *
 * `moneySchema` is `^\d{1,8}(\.\d{1,2})?$` — unsigned, at most two decimals.
 * Empty is legal and means "clear it", because a missing price is a real state
 * and NEVER a zero: a five-second fix beats a wrong price on a live storefront.
 */
export const isPriceAcceptable = (raw: string): boolean =>
  raw.trim() === "" || /^\d{1,8}(\.\d{1,2})?$/.test(raw.trim());

export const ITEM_STATUSES: readonly ImportItemStatus[] =
  ImportItemStatusSchema.options;

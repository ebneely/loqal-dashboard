/**
 * The bulk photo drop, as data rather than as a screen.
 *
 * Everything here is pure, because the two facts this feature has to get right
 * are both facts about a batch and neither of them is about the DOM:
 *
 *  a. A save answers one result PER ROW, in input order. One bad row must not
 *     discard the other thirty-nine, and the brand has to be told which one —
 *     "something failed" is useless to a person holding a phone in a shop.
 *  b. Publishing refuses a product with no price and SAYS SO. Nothing here ever
 *     supplies a default price to get a row past the gate.
 */
import type { ProductStatus } from "@loqal/contracts/enums";
import { moneySchema } from "@loqal/contracts/contracts";
import type { BulkPublishResult } from "@loqal/contracts/catalog.contract";

import type { BulkRowOutcome } from "../catalog-data";
import type { CatalogProduct } from "../catalog-wire";

// ---------------------------------------------------------------------------
// Uploading
// ---------------------------------------------------------------------------

export type UploadStatus = "queued" | "uploading" | "done" | "failed";

export type UploadItem = {
  /** Local only. A photo has no server identity until it is confirmed. */
  key: string;
  fileName: string;
  status: UploadStatus;
  /** 0 to 1. Per file, because a single bar over 40 photos says nothing. */
  progress: number;
  mediaId: string | null;
  error: string | null;
  /**
   * A blob URL for the photo the brand just picked.
   *
   * The API answers media as ids and serves no URL for any of them, so this is
   * the only preview that exists — and it is genuinely the right one here: it
   * is the file in the reader's hand, not a round trip to fetch back something
   * they already have.
   */
  previewUrl: string | null;
};

export const uploadedMediaIds = (items: readonly UploadItem[]): string[] =>
  items
    .filter((item) => item.status === "done" && item.mediaId !== null)
    .map((item) => item.mediaId as string);

export const uploadTally = (items: readonly UploadItem[]) => ({
  total: items.length,
  done: items.filter((item) => item.status === "done").length,
  failed: items.filter((item) => item.status === "failed").length,
  busy: items.some(
    (item) => item.status === "queued" || item.status === "uploading"
  ),
});

/**
 * Upload a few at a time, never all forty at once.
 *
 * Forty parallel PUTs over a shop's mobile connection is how every one of them
 * gets slower and the first one still has not finished. Three keeps the link
 * saturated without starving any single file.
 */
export const UPLOAD_CONCURRENCY = 3;

export async function runPool<T>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>
): Promise<void> {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = cursor++;
      if (index >= items.length) return;
      await worker(items[index] as T, index);
    }
  });
  await Promise.all(runners);
}

// ---------------------------------------------------------------------------
// The grid
// ---------------------------------------------------------------------------

export type GridRow = {
  productId: string;
  nameEn: string;
  nameAr: string;
  price: string;
  status: ProductStatus;
  previewUrl: string | null;
  /** The reason THIS row did not save. Never a batch-wide message. */
  saveError: string | null;
  saved: boolean;
  /** Why this row was refused publication, as the API named it. */
  publishReasons: readonly string[];
  published: boolean;
};

export function rowFromProduct(
  product: CatalogProduct,
  previewUrl: string | null = null
): GridRow {
  return {
    productId: product.id,
    nameEn: product.name?.en ?? "",
    nameAr: product.name?.ar ?? "",
    // Empty, never "0.00". A zero here would travel all the way to a storefront
    // as a real price the brand never typed.
    price: product.basePrice ?? "",
    status: product.status,
    previewUrl,
    saveError: null,
    saved: false,
    publishReasons: [],
    published: false,
  };
}

const clean = (value: string) => value.trim();

export const rowHasName = (row: GridRow): boolean =>
  Boolean(clean(row.nameAr) || clean(row.nameEn));

export const rowPriceIsMalformed = (row: GridRow): boolean =>
  clean(row.price).length > 0 && !moneySchema.safeParse(clean(row.price)).success;

export const rowHasPrice = (row: GridRow): boolean =>
  clean(row.price).length > 0 && !rowPriceIsMalformed(row);

/**
 * The body for one row of `PATCH /v1/dashboard/products/bulk`, or null when the
 * row carries nothing worth sending.
 *
 * `name` is omitted entirely rather than sent empty — `bilingualSchema` requires
 * at least one language, so an empty object is a 400 and a row that only has a
 * price typed into it is a legitimate half-finished row.
 */
export function rowBody(
  row: GridRow
): { id: string; name?: { ar?: string; en?: string }; basePrice?: string } | null {
  const body: { id: string; name?: { ar?: string; en?: string }; basePrice?: string } =
    { id: row.productId };

  if (rowHasName(row)) {
    const name: { ar?: string; en?: string } = {};
    if (clean(row.nameAr)) name.ar = clean(row.nameAr);
    if (clean(row.nameEn)) name.en = clean(row.nameEn);
    body.name = name;
  }
  if (rowHasPrice(row)) body.basePrice = clean(row.price);

  return body.name || body.basePrice ? body : null;
}

export type BulkRowBody = NonNullable<ReturnType<typeof rowBody>>;

export type BulkSaveRequest = {
  bodies: BulkRowBody[];
  /** Which product ids were actually sent, in the order they were sent. */
  sentIds: string[];
};

export function bulkSaveRequest(rows: readonly GridRow[]): BulkSaveRequest {
  const bodies: BulkRowBody[] = [];
  const sentIds: string[] = [];
  for (const row of rows) {
    if (rowPriceIsMalformed(row)) continue;
    const body = rowBody(row);
    if (!body) continue;
    bodies.push(body);
    sentIds.push(row.productId);
  }
  return { bodies, sentIds };
}

/**
 * Fold one result per row back onto the grid.
 *
 * Matched by id rather than by position. The API answers in input order and is
 * documented to, but a grid that silently mislabels which row failed is worse
 * than one that reports nothing, so the id is what decides.
 */
export function applySaveOutcomes(
  rows: readonly GridRow[],
  outcomes: readonly BulkRowOutcome[]
): GridRow[] {
  const byId = new Map(outcomes.map((outcome) => [outcome.id, outcome]));
  return rows.map((row) => {
    const outcome = byId.get(row.productId);
    if (!outcome) return row;
    if (outcome.ok) {
      return {
        ...row,
        status: outcome.product.status,
        // Re-seeded from what the server actually stored, so a row that saved
        // stops claiming an edit the API rejected a piece of.
        nameEn: outcome.product.name?.en ?? "",
        nameAr: outcome.product.name?.ar ?? "",
        price: outcome.product.basePrice ?? "",
        saveError: null,
        saved: true,
      };
    }
    return { ...row, saveError: outcome.reason, saved: false };
  });
}

export const saveTally = (outcomes: readonly BulkRowOutcome[]) => ({
  total: outcomes.length,
  ok: outcomes.filter((outcome) => outcome.ok).length,
  failed: outcomes.filter((outcome) => !outcome.ok).length,
});

/** Fold `{ published, failed[] }` back onto the grid, reasons and all. */
export function applyPublishResult(
  rows: readonly GridRow[],
  result: BulkPublishResult
): GridRow[] {
  const published = new Set(result.published);
  const failed = new Map(result.failed.map((row) => [row.id, row.reasons]));
  return rows.map((row): GridRow => {
    if (published.has(row.productId)) {
      return { ...row, status: "ACTIVE", published: true, publishReasons: [] };
    }
    const reasons = failed.get(row.productId);
    if (reasons) return { ...row, published: false, publishReasons: reasons };
    return row;
  });
}

/**
 * The API's publish blockers, translated.
 *
 * `publishBlockers()` in the backend emits exactly two sentences and they are
 * English-only, so a shop reading the Arabic console would otherwise be handed
 * an English string at the one moment it matters most. Anything this map does
 * not recognise is passed through untouched rather than swallowed — an unknown
 * refusal must still reach the reader.
 */
export function publishReasonLabel(
  reason: string,
  copy: { noPrice: string; noName: string }
): string {
  const normalised = reason.toLowerCase();
  if (normalised.includes("price is not set")) return copy.noPrice;
  if (normalised.includes("name is not set")) return copy.noName;
  return reason;
}

/**
 * What a row is still missing, decided locally, before anything is sent.
 *
 * This is a warning, not a gate: the publish call is still made for every row
 * the brand asked to publish, and the API's own refusal is what is reported.
 * Deciding here who is allowed to try would put a second, drifting copy of the
 * publish rule in the browser.
 */
export function localBlockers(row: GridRow): ("name" | "price")[] {
  const blockers: ("name" | "price")[] = [];
  if (!rowHasName(row)) blockers.push("name");
  if (!rowHasPrice(row)) blockers.push("price");
  return blockers;
}

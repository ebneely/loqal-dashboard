// @vitest-environment node
/**
 * The two facts the bulk screen exists to get right, checked without a DOM:
 * one result per row, and a publish that refuses rather than guesses.
 */
import { describe, expect, it } from "vitest";

import type { BulkRowOutcome } from "../catalog-data";
import { toCatalogProduct } from "../catalog-wire";
import {
  applyPublishResult,
  applySaveOutcomes,
  bulkSaveRequest,
  localBlockers,
  publishReasonLabel,
  rowBody,
  rowFromProduct,
  rowPriceIsMalformed,
  runPool,
  saveTally,
  uploadTally,
  uploadedMediaIds,
  type GridRow,
  type UploadItem,
} from "../bulk/bulk-grid";
import { fortyDrafts, productId, wireDraft, wireProduct } from "./fixtures";

const draftRow = (n: number): GridRow =>
  rowFromProduct(toCatalogProduct(wireDraft(n)));

describe("a dropped photo becomes an empty row, never a zero-priced one", () => {
  it("starts a row with no name and an EMPTY price", () => {
    const row = draftRow(1);
    expect(row.nameEn).toBe("");
    expect(row.nameAr).toBe("");
    // Not "0.00". A zero here would travel to a storefront as a real price.
    expect(row.price).toBe("");
    expect(localBlockers(row)).toEqual(["name", "price"]);
  });

  it("sends nothing for a row nobody has touched", () => {
    expect(rowBody(draftRow(1))).toBeNull();
  });

  it("omits `name` entirely for a row that only has a price typed in", () => {
    const row = { ...draftRow(1), price: "149.99" };
    expect(rowBody(row)).toEqual({ id: productId(1), basePrice: "149.99" });
  });

  it("sends one language, never demanding both", () => {
    const row = { ...draftRow(1), nameAr: "قميص" };
    expect(rowBody(row)).toEqual({ id: productId(1), name: { ar: "قميص" } });
  });

  it("holds back a row whose price is not an amount", () => {
    const row = { ...draftRow(1), nameEn: "Shirt", price: "about 150" };
    expect(rowPriceIsMalformed(row)).toBe(true);
    expect(bulkSaveRequest([row]).bodies).toHaveLength(0);
  });
});

describe("a forty-row save reports per row", () => {
  const rows = fortyDrafts.items.map((product, index) => ({
    ...rowFromProduct(toCatalogProduct(product)),
    nameEn: `Shirt ${index + 1}`,
    price: "149.99",
  }));

  it("sends every row that has something to say", () => {
    const request = bulkSaveRequest(rows);
    expect(request.bodies).toHaveLength(40);
    expect(request.sentIds).toHaveLength(40);
  });

  it("keeps thirty-nine successes when the fortieth fails, and names the one", () => {
    const outcomes: BulkRowOutcome[] = rows.map((row, index) =>
      index === 17
        ? { id: row.productId, ok: false, reason: "Could not update this product" }
        : {
            id: row.productId,
            ok: true,
            product: toCatalogProduct(
              wireProduct(index + 1, {
                id: row.productId,
                name: { en: `Shirt ${index + 1}` },
                basePrice: "149.99",
                status: "DRAFT",
              })
            ),
          }
    );

    const next = applySaveOutcomes(rows, outcomes);
    const counted = saveTally(outcomes);

    expect(counted).toEqual({ total: 40, ok: 39, failed: 1 });
    expect(next.filter((row) => row.saved)).toHaveLength(39);

    const failed = next.filter((row) => row.saveError !== null);
    expect(failed).toHaveLength(1);
    // WHICH one, not "something failed".
    expect(failed[0]?.productId).toBe(rows[17]?.productId);
    expect(failed[0]?.saveError).toBe("Could not update this product");
    // And the other thirty-nine are untouched by it.
    expect(next[16]?.saveError).toBeNull();
    expect(next[18]?.saveError).toBeNull();
  });

  it("matches results by id rather than by position", () => {
    const shuffled: BulkRowOutcome[] = [
      { id: rows[2]!.productId, ok: false, reason: "No such product for this brand" },
    ];
    const next = applySaveOutcomes(rows, shuffled);
    expect(next[2]?.saveError).toBe("No such product for this brand");
    expect(next[0]?.saveError).toBeNull();
  });
});

describe("publishing refuses, and says which product and why", () => {
  const rows = [draftRow(1), draftRow(2), draftRow(3)];

  it("folds every named failure back onto its own row", () => {
    const next = applyPublishResult(rows, {
      published: [rows[0]!.productId],
      failed: [
        { id: rows[1]!.productId, codes: ["PRICE_NOT_SET"], reasons: ["price is not set"] },
        {
          id: rows[2]!.productId,
          codes: ["NAME_NOT_SET", "PRICE_NOT_SET"],
          reasons: ["name is not set", "price is not set"],
        },
      ],
    });

    expect(next[0]?.published).toBe(true);
    expect(next[0]?.status).toBe("ACTIVE");
    expect(next[1]?.published).toBe(false);
    expect(next[1]?.publishReasons).toEqual(["price is not set"]);
    expect(next[2]?.publishReasons).toHaveLength(2);
  });

  it("translates the API's two known blockers and passes anything else through", () => {
    const copy = { noPrice: "No price is set.", noName: "No name is set." };
    expect(publishReasonLabel("price is not set", copy)).toBe(copy.noPrice);
    expect(publishReasonLabel("name is not set", copy)).toBe(copy.noName);
    expect(
      publishReasonLabel("Cannot publish a product that is already ARCHIVED", copy)
    ).toBe("Cannot publish a product that is already ARCHIVED");
  });
});

describe("uploads", () => {
  const item = (over: Partial<UploadItem>): UploadItem => ({
    key: "k",
    fileName: "photo.jpg",
    status: "queued",
    progress: 0,
    mediaId: null,
    error: null,
    previewUrl: null,
    ...over,
  });

  it("only offers confirmed media ids for drafting", () => {
    const items = [
      item({ key: "a", status: "done", mediaId: "m-a" }),
      item({ key: "b", status: "failed", error: "no" }),
      item({ key: "c", status: "uploading" }),
    ];
    expect(uploadedMediaIds(items)).toEqual(["m-a"]);
    expect(uploadTally(items)).toEqual({
      total: 3,
      done: 1,
      failed: 1,
      busy: true,
    });
  });

  it("runs a bounded pool rather than forty parallel PUTs", async () => {
    const files = Array.from({ length: 10 }, (_, index) => index);
    let live = 0;
    let peak = 0;
    await runPool(files, 3, async () => {
      live += 1;
      peak = Math.max(peak, live);
      await Promise.resolve();
      live -= 1;
    });
    expect(peak).toBeLessThanOrEqual(3);
  });
});

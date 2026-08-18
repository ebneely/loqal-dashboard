// @vitest-environment node
/**
 * The mapping between what the catalog API sends and what the screens read.
 *
 * Node environment: this file touches no DOM, so it keeps reporting honestly
 * when the React tree is mid-repair.
 */
import { describe, expect, it } from "vitest";

import { bulkPublishResultSchema } from "@loqal/contracts/catalog.contract";

import {
  basePriceOrNull,
  bilingualOrNull,
  cheapestPrice,
  compareMoney,
  displayName,
  isPublishable,
  matchesSearch,
  productGaps,
  toCatalogDetail,
  toCatalogProduct,
  wireProductPageSchema,
} from "../catalog-wire";
import { activeProducts, mixedProducts, wireDraft, wireProduct, wireVariant } from "./fixtures";

describe("the wire the catalog API actually speaks", () => {
  it("parses the real page body, which is offset paged and not the contract's cursor page", () => {
    const parsed = wireProductPageSchema.safeParse(activeProducts);
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.total).toBe(2);
  });
});

describe("a draft has no name and no price, and both are legitimately null", () => {
  it("maps the backend's empty-object name sentinel to null", () => {
    expect(bilingualOrNull({})).toBeNull();
    expect(bilingualOrNull({ ar: "", en: "  " })).toBeNull();
    expect(bilingualOrNull({ en: "Linen shirt" })).toEqual({ en: "Linen shirt" });
  });

  it("maps a null price to null and never to a zero", () => {
    expect(basePriceOrNull(null)).toBeNull();
    expect(basePriceOrNull(undefined)).toBeNull();
    expect(basePriceOrNull("")).toBeNull();
    // A real zero is NOT unset: a shop may legitimately give something away.
    expect(basePriceOrNull("0.00")).toBe("0.00");
  });

  it("treats the -1 sentinel the single-product PATCH leaks as unset, not as a price", () => {
    // GET /products runs its answer through toDashboardShape; PATCH
    // /products/:id does not, and answers with the raw -1.
    expect(basePriceOrNull("-1")).toBeNull();
  });

  it("reports both gaps on a freshly dropped photo", () => {
    const draft = toCatalogProduct(wireDraft(1));
    expect(draft.name).toBeNull();
    expect(draft.basePrice).toBeNull();
    expect(productGaps(draft)).toEqual(["name", "price"]);
    expect(isPublishable(draft)).toBe(false);
  });

  it("calls a fully filled product publishable", () => {
    expect(isPublishable(toCatalogProduct(wireProduct(1)))).toBe(true);
  });
});

describe("money is compared as a string, never as a float", () => {
  it("orders by magnitude, not by lexicographic accident", () => {
    expect(compareMoney("9.00", "10.00")).toBeLessThan(0);
    expect(compareMoney("100.00", "99.99")).toBeGreaterThan(0);
    expect(compareMoney("1.5", "1.50")).toBe(0);
  });

  it("picks the cheapest variant without arithmetic", () => {
    expect(
      cheapestPrice([{ price: "149.99" }, { price: "89.00" }, { price: "1200.00" }])
    ).toBe("89.00");
    expect(cheapestPrice([])).toBeNull();
  });
});

describe("what the API cannot answer is omitted, not invented", () => {
  it("carries no coverUrl and no inStock", () => {
    const product = toCatalogProduct(wireProduct(1));
    expect(product).not.toHaveProperty("coverUrl");
    expect(product).not.toHaveProperty("inStock");
  });

  it("keeps a variant's stock as stockOnHand rather than a half-filled availability", () => {
    const detail = toCatalogDetail(
      wireProduct(1, { variants: [wireVariant(1, { stockOnHand: 4 })] })
    );
    expect(detail.variants[0]?.stockOnHand).toBe(4);
    expect(detail.variants[0]).not.toHaveProperty("stock");
  });

  it("counts variants and photos from the body rather than a field that is not there", () => {
    const detail = toCatalogDetail(wireDraft(3));
    expect(detail.variantCount).toBe(0);
    expect(detail.mediaCount).toBe(1);
    expect(detail.priceFrom).toBeNull();
  });
});

describe("names and search", () => {
  it("falls back to the other language rather than showing nothing", () => {
    expect(displayName({ ar: "قميص" }, "en")).toBe("قميص");
    expect(displayName({ en: "Shirt", ar: "قميص" }, "ar")).toBe("قميص");
    expect(displayName(null, "en")).toBeNull();
  });

  it("filters the loaded rows, because the endpoint has no search parameter", () => {
    const rows = mixedProducts.items.map(toCatalogProduct);
    expect(rows.filter((row) => matchesSearch(row, "linen"))).toHaveLength(1);
    expect(rows.filter((row) => matchesSearch(row, ""))).toHaveLength(2);
  });
});

describe("bulk-publish answers exactly the contract's shape", () => {
  it("parses a refusal that names the product and the reason", () => {
    const parsed = bulkPublishResultSchema.safeParse({
      published: ["0199a000-0000-7000-8000-000000000001"],
      failed: [
        {
          id: "0199a000-0000-7000-8000-000000000009",
          // The code is what the screen switches on; the prose is English from
          // the server and is only ever a fallback.
          codes: ["PRICE_NOT_SET"],
          reasons: ["price is not set"],
        },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it("refuses a failure with no reason at all", () => {
    const parsed = bulkPublishResultSchema.safeParse({
      published: [],
      // Codes present, reasons empty — so this fails for the reason the test is
      // named after, not incidentally because the fixture is short a field.
      failed: [
        {
          id: "0199a000-0000-7000-8000-000000000009",
          codes: ["PRICE_NOT_SET"],
          reasons: [],
        },
      ],
    });
    expect(parsed.success).toBe(false);
  });
});

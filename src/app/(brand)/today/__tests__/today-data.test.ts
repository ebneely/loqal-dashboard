// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  LOW_STOCK_THRESHOLD,
  chatThreadListSchema,
  dashboardProductPageSchema,
  lowStockVariants,
} from "../today-data";
import { chatThreads, productsPage } from "./fixtures";

describe("dashboardProductPageSchema", () => {
  it("accepts the shape the products endpoint actually serves", () => {
    expect(dashboardProductPageSchema.safeParse(productsPage).success).toBe(true);
  });

  it("tolerates fields added upstream", () => {
    // A local read of another module's shape. Strict parsing here would turn
    // somebody else's additive change into this screen going blank.
    const widened = {
      ...productsPage,
      items: [{ ...productsPage.items[0], someNewField: true }],
    };
    expect(dashboardProductPageSchema.safeParse(widened).success).toBe(true);
  });

  it("still refuses a product whose variants lost their stock count", () => {
    const broken = {
      items: [
        {
          id: "p-1",
          name: { en: "x" },
          status: "ACTIVE",
          variants: [{ id: "v-1", sku: "S" }],
        },
      ],
    };
    expect(dashboardProductPageSchema.safeParse(broken).success).toBe(false);
  });
});

describe("lowStockVariants", () => {
  const parsed = dashboardProductPageSchema.parse(productsPage);

  it("returns one row per variant, not per product", () => {
    const rows = lowStockVariants(parsed);
    expect(rows.map((row) => row.sku)).toEqual(["NEF-CS-1", "NEF-LS-S"]);
  });

  it("puts the emptiest shelf first", () => {
    expect(lowStockVariants(parsed)[0].stockOnHand).toBe(0);
  });

  it("drops variants at or above the threshold", () => {
    expect(lowStockVariants(parsed).some((row) => row.sku === "NEF-LS-M")).toBe(false);
  });

  it("treats exactly the threshold as stocked", () => {
    const page = dashboardProductPageSchema.parse({
      items: [
        {
          id: "p-1",
          name: { en: "x" },
          status: "ACTIVE",
          variants: [
            { id: "v-at", sku: "AT", stockOnHand: LOW_STOCK_THRESHOLD },
            { id: "v-under", sku: "UNDER", stockOnHand: LOW_STOCK_THRESHOLD - 1 },
          ],
        },
      ],
    });
    expect(lowStockVariants(page).map((r) => r.sku)).toEqual(["UNDER"]);
  });

  it("carries both languages through, since one may be absent", () => {
    const page = dashboardProductPageSchema.parse({
      items: [
        {
          id: "p-1",
          name: { ar: "قميص" },
          status: "ACTIVE",
          variants: [{ id: "v-1", sku: "S", stockOnHand: 1 }],
        },
      ],
    });
    expect(lowStockVariants(page)[0].productName).toEqual({ ar: "قميص" });
  });
});

describe("chatThreadListSchema", () => {
  it("accepts the raw thread rows the endpoint returns", () => {
    expect(chatThreadListSchema.safeParse(chatThreads).success).toBe(true);
  });

  it("has no unread count to read, which is the point of the comment on it", () => {
    // If this ever fails because `unreadCount` appeared, delete the derived
    // chat section's caveat and count unread properly.
    const parsed = chatThreadListSchema.parse(chatThreads);
    expect(parsed[0]).not.toHaveProperty("unreadCount");
    expect(parsed[0]).not.toHaveProperty("lastSenderType");
  });
});

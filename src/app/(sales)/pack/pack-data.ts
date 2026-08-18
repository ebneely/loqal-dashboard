"use client";

/**
 * Everything /pack reads. It writes nothing — a pitch is a read.
 *
 * TWO ENDPOINTS, ONE OF THEM NOT THE SALES PLANE'S OWN.
 *
 *  `GET /v1/categories`   the anonymous storefront list, flat. There is no
 *                         sales-plane category route and `admin/categories` is
 *                         SUPER_ADMIN-only, so this is the one list a rep can
 *                         read. It is public and takes no session scope, which
 *                         is fine: a category taxonomy is on the storefront
 *                         already.
 *  `GET /v1/sales/pack`   `?category=<slug>`, and the slug must exist or the
 *                         API answers 404 ("No such category").
 *
 * WHY THE CONTRACT SCHEMA IS NOT USED VERBATIM.
 *
 * `salesPackSchema` in `@loqal/contracts/sales.contract` requires
 * `generatedAt`, and the API does not emit it — `SalesService.forCategory`
 * returns `{ category, trafficProof, categoryComparison }` and nothing else.
 * The contract documents that as a gap, which it is: a pack is a set of figures
 * a rep reads out loud, and one with no "as of" cannot be told apart from a
 * screenshot taken a quarter ago.
 *
 * Parsing today's response with the contract schema would fail on every
 * request, so the field is made OPTIONAL here rather than dropped. `.strict()`
 * is kept, so the day the backend starts emitting `generatedAt` this parses
 * unchanged and the screen's own "no timestamp" warning disappears on its own
 * — no second deploy, and no chance of the warning outliving the gap.
 */
import { z } from "zod";

import { isWithheld } from "@loqal/contracts/errors";
import { salesPackSchema, type SalesPack } from "@loqal/contracts/sales.contract";

import { api } from "@/lib/api";
import { useResource, type Resource } from "@/lib/resource";

/**
 * The pack as it actually arrives. Everything else about the shape — including
 * the `withheld` union on `categoryComparison`, which is the one piece of this
 * response the backend and the contract genuinely agree on — comes straight
 * from the contract.
 */
export const salesPackWireSchema = salesPackSchema
  .omit({ generatedAt: true })
  .extend({ generatedAt: z.string().datetime().optional() })
  .strict();

export type SalesPackWire = z.infer<typeof salesPackWireSchema>;

/**
 * `CATEGORY_FIELDS` as the storefront repository selects it, mirrored from
 * `(admin)/admin/categories/categories-data.ts` rather than re-derived: there is
 * still no category schema anywhere in `@loqal/contracts`, so both consoles
 * parse the same JSON `name` column as `unknown` and resolve it for display.
 */
export const salesCategorySchema = z.object({
  id: z.string(),
  name: z.unknown(),
  slug: z.string(),
  parentId: z.string().nullable(),
  sortOrder: z.number().int(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type SalesCategory = z.infer<typeof salesCategorySchema>;

export const salesCategoryListSchema = z.array(salesCategorySchema);

/** The bilingual name, resolved, with every degenerate shape this column has. */
export function categoryName(name: unknown, locale: "en" | "ar"): string {
  if (typeof name === "string") return name;
  if (name && typeof name === "object") {
    const record = name as Record<string, unknown>;
    const preferred = record[locale];
    if (typeof preferred === "string" && preferred) return preferred;
    const other = record[locale === "en" ? "ar" : "en"];
    if (typeof other === "string" && other) return other;
  }
  return "";
}

/**
 * Named, sorted, and with the unnamed rows dropped.
 *
 * A category whose `name` column is `{}` or null renders as an empty option a
 * rep cannot tell from any other empty option, and picking the wrong one puts
 * the wrong market's numbers in front of a shop owner. Dropping it loses
 * nothing a rep could have used.
 */
export function pickableCategories(
  rows: readonly SalesCategory[],
  locale: "en" | "ar"
): { slug: string; label: string }[] {
  return rows
    .map((row) => ({ slug: row.slug, label: categoryName(row.name, locale) }))
    .filter((row) => row.label !== "")
    .sort((a, b) => a.label.localeCompare(b.label, locale));
}

export function useSalesCategories(): Resource<readonly SalesCategory[]> {
  return useResource("sales-categories", true, (signal) =>
    api.get(salesCategoryListSchema, "/v1/categories", { signal })
  );
}

/**
 * `enabled` is false until a category is chosen, so the screen makes no request
 * at all rather than one it discards. The API 404s on an unknown slug and this
 * hook does not special-case that — an unknown slug can only get here by being
 * typed into the URL, and "that category does not exist" is the right answer.
 */
export function useSalesPack(category: string | null): Resource<SalesPackWire> {
  return useResource(`sales-pack:${category ?? ""}`, category !== null, (signal) =>
    api.get(salesPackWireSchema, "/v1/sales/pack", {
      query: { category: category ?? "" },
      signal,
    })
  );
}

// ---------------------------------------------------------------------------
// The three things the comparison can be, and they are three, not two
// ---------------------------------------------------------------------------

/**
 * `withheld` and `null` are DIFFERENT and the screen must never merge them.
 *
 *  withheld     Loqal measured and may not say. Fewer than
 *               `PlatformSetting.analyticsKAnonymityFloor` brands trade in the
 *               category, so the average is one competitor's private revenue.
 *  notMeasured  Enough brands to report, and no `BrandMetric` row exists yet.
 *               An absence of data, not a figure being held back.
 *  reported     A number.
 *
 * Reading the second as the first in front of a prospect is a rep claiming
 * Loqal is protecting a secret it does not have. The contract's own comment on
 * `categoryComparison.medianMonthlyOrders` says exactly this, which is why the
 * distinction gets a function instead of an inline ternary in the JSX.
 */
export type ComparisonState =
  | { kind: "withheld"; reason: string }
  | { kind: "notMeasured"; brandCount: number }
  | { kind: "reported"; brandCount: number; medianMonthlyOrders: number };

export function comparisonState(
  comparison: SalesPack["categoryComparison"]
): ComparisonState {
  if (isWithheld(comparison)) {
    return { kind: "withheld", reason: comparison.reason };
  }
  if (comparison.medianMonthlyOrders === null) {
    return { kind: "notMeasured", brandCount: comparison.brandCount };
  }
  return {
    kind: "reported",
    brandCount: comparison.brandCount,
    medianMonthlyOrders: comparison.medianMonthlyOrders,
  };
}

/**
 * BACKEND BUG, and the screen renders around it rather than hiding it.
 *
 * `trafficProof.totalEvents` is windowed to the last 30 days
 * (`TRAFFIC_PROOF_WINDOW_DAYS` in `SalesService.forCategory`).
 * `trafficProof.totalVisitors` is `AnalyticsVisitorRepository.countAll()`,
 * which is all-time. Two differently-scoped numbers printed side by side read
 * as one proof, and the inflated one is the one a rep quotes out loud in a shop.
 *
 * Nothing on this side can make them a matched pair. What it CAN do is refuse
 * to present them as one: each figure carries its own period, and the screen
 * says in a sentence that they are not comparable. Exported so the fact is
 * asserted by a test rather than living only in a paragraph of JSX.
 */
export const TRAFFIC_SCOPES = {
  totalEvents: "last30",
  totalVisitors: "allTime",
} as const;

"use client";

/**
 * Everything /admin/analytics reads.
 *
 * BACKEND GAP — THIS RESPONSE IS NOT IN THE CONTRACT PACKAGE.
 *
 * There is no analytics file in `packages/contracts` at all. `PlatformOverview`
 * is a TypeScript interface inside the backend's own service and nothing
 * validates it at either end. So the shape is described HERE, beside the fetch,
 * and it will move into the package the day one exists. It is deliberately
 * `.strict()` so a field appearing or disappearing fails loudly at this seam
 * rather than as a blank tile three screens away.
 *
 * WHAT IS NOT ON THIS ENDPOINT, AND MUST NOT BE INVENTED
 *
 * `GET /admin/analytics/overview` answers event counts, a lifetime visitor
 * count and the searches that came back empty. It carries NO money, NO orders
 * and NO brands. GMV, orders-per-brand and true conversion cannot be drawn from
 * it, and deriving something conversion-shaped from CHECKOUT_START over
 * PRODUCT_VIEW would be a ratio between two event counters presented as a
 * business figure. The screen names the ratio for what it is and points at the
 * orders and settlement screens for money.
 *
 * THE WINDOW IS COMPUTED IN AFRICA/CAIRO, NOT UTC.
 *
 * `AnalyticsEvent.eventDay` is baked at ingest under the platform's own
 * timezone setting, which is why that setting is read-only. Nothing in this
 * file does UTC date maths: the range is sent as whatever the API's own default
 * produces (the last 30 days) unless a caller passes explicit bounds, and no
 * day boundary is computed on this side at all.
 */
import { z } from "zod";

import { api } from "@/lib/api";
import { useResource, type Resource } from "@/lib/resource";

const OVERVIEW_PATH = "/v1/admin/analytics/overview";

/**
 * `byType` is keyed by `AnalyticsEventType` and is SPARSE — a type with no
 * events in the window is absent, not zero. Typed as an open record rather than
 * a closed one for exactly that reason, and because a new event type shipping
 * on the backend must not make this screen refuse to render.
 */
export const platformOverviewSchema = z
  .object({
    totalEvents: z.number().int(),
    totalVisitors: z.number().int(),
    byType: z.record(z.string(), z.number().int()),
    topZeroResultSearches: z.array(
      z.object({ term: z.string(), count: z.number().int() }).strict()
    ),
  })
  .strict();
export type PlatformOverview = z.infer<typeof platformOverviewSchema>;

export function usePlatformOverview(): Resource<PlatformOverview> {
  return useResource("admin-analytics-overview", true, (signal) =>
    api.get(platformOverviewSchema, OVERVIEW_PATH, { signal })
  );
}

/** Absent means none happened, so it reads as 0 for display and only there. */
export const eventCount = (
  overview: PlatformOverview,
  type: string
): number => overview.byType[type] ?? 0;

/**
 * Product views that reached a started checkout, in basis points.
 *
 * NOT CALLED CONVERSION anywhere it is rendered, and the arithmetic is kept
 * here so the naming stays with it. Nothing in this response records an order,
 * so this is a ratio between two event counters — useful for spotting a
 * checkout that broke overnight, useless as a business figure, and actively
 * misleading if it is put next to money.
 *
 * Null when there were no product views: 0/0 is not 0%, and printing "0%"
 * over an empty window would report a broken funnel where there was no traffic.
 */
export function viewsToCheckoutBps(overview: PlatformOverview): number | null {
  const views = eventCount(overview, "PRODUCT_VIEW");
  if (views === 0) return null;
  return Math.round((eventCount(overview, "CHECKOUT_START") / views) * 10000);
}

/** "2.75%" from 275 bps, without a float anywhere near the rendering. */
export const formatBps = (bps: number): string =>
  `${Math.floor(bps / 100)}.${String(bps % 100).padStart(2, "0")}%`;

"use client";

/**
 * Everything the commerce dashboard reads, and every rule about what it is
 * allowed to draw.
 *
 * BACKEND GAP — THIS RESPONSE IS NOT IN THE CONTRACT PACKAGE EITHER.
 *
 * `CommerceDashboard` is described in the implementation plan and in the
 * backend's own service, and nothing validates it at either end. So the shape
 * is declared HERE, beside the fetch, `.strict()`, and it moves into
 * `packages/contracts` the day one exists. `analytics-data.ts` made the same
 * call for the same reason; this file is its sibling, not its replacement.
 *
 * MONEY IS A STRING ON THE WIRE AND STAYS ONE.
 *
 * Every amount is `z.string()`, never `z.number()`. A number here reintroduces
 * exactly the precision problem the string representation exists to avoid, and
 * it would be wrong about revenue. The one place an amount becomes a JS number
 * is at the recharts boundary, where a chart plots numbers and nothing else —
 * and comparisons for a delta go through `toPiastres`, which is exact.
 *
 * TWO ROUTES, ONE SHAPE. The admin route is platform-wide; the brand route is
 * scoped to the caller's own shop by the session and is BRAND_OWNER only,
 * because this payload carries revenue and money is the one thing an employee
 * never sees.
 */
import { z } from "zod";

import { api } from "@/lib/api";
import type { Locale } from "@/lib/locale";
import { useResource, type Resource } from "@/lib/resource";

const PLATFORM_PATH = "/v1/admin/analytics/dashboard";
const BRAND_PATH = "/v1/brands/me/analytics/dashboard";

export type CommerceScope = "platform" | "brand";

const money = z.string();
const count = z.number().int();

const windowTotals = z
  .object({
    orders: count,
    revenue: money,
    /** Distinct shoppers AND guests. Guests are most of the traffic. */
    customers: count,
    /** Null, never "0.00", when there were no orders. 0/0 is not 0. */
    averageOrderValue: money.nullable(),
  })
  .strict();

export const commerceDashboardSchema = z
  .object({
    range: z.object({ from: z.string(), to: z.string() }).strict(),
    totals: windowTotals,
    /** The same length window immediately before, so a delta cannot drift. */
    previous: windowTotals,
    trend: z.array(
      z.object({ day: z.string(), orders: count, revenue: money }).strict()
    ),
    byStatus: z.array(z.object({ status: z.string(), count }).strict()),
    byGovernorate: z.array(
      z.object({ code: z.string(), orders: count, revenue: money }).strict()
    ),
    topProducts: z.array(
      z.object({ name: z.string(), qty: count, revenue: money }).strict()
    ),
    /**
     * What shipped to an address no governorate could be read from.
     *
     * The API reports it rather than dropping it, and so does the screen: an
     * order that vanishes between the map and the total is a number nobody can
     * reconcile. Required, because the API always sends it — a build where it
     * stops arriving should fail loudly at this seam rather than quietly stop
     * mentioning the orders it cannot place.
     */
    unmapped: z.object({ orders: count, revenue: money }).strict(),
  })
  .strict();

export type CommerceDashboard = z.infer<typeof commerceDashboardSchema>;
export type CommerceTrendPoint = CommerceDashboard["trend"][number];

/** 7, 30 and 90 days. Three windows, because a fourth answers nothing new. */
export const WINDOW_DAYS = [7, 30, 90] as const;
export type WindowDays = (typeof WINDOW_DAYS)[number];

export const windowDaysFrom = (raw: string): WindowDays => {
  const value = Number(raw);
  return (WINDOW_DAYS as readonly number[]).includes(value)
    ? (value as WindowDays)
    : 30;
};

/**
 * The first day of the window, as a Cairo calendar date.
 *
 * NO UTC DATE MATHS. `analytics-data.ts` avoided this problem by never
 * computing a boundary at all; a range control cannot. So today is asked for
 * in Africa/Cairo — 21:00 UTC is already tomorrow there — and the count back
 * is plain calendar arithmetic on a UTC-midnight anchor, which is immune to
 * the DST changes Egypt reintroduced in 2023.
 *
 * Inclusive of both ends: a 7-day window is today and the six days before it.
 */
export function windowStart(days: number, now: Date = new Date()): string {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  const anchor = Date.parse(`${today}T00:00:00Z`) - (days - 1) * 86_400_000;
  return new Date(anchor).toISOString().slice(0, 10);
}

/**
 * "01 Aug" — the x label, formatted once, never a raw ISO string.
 *
 * `numberingSystem: "latn"` is the load-bearing option: without it Arabic
 * returns ٠١ into the same figures face that has no Arabic glyphs, which is
 * the bug `formatCount` exists for, one layer down.
 */
export function dayLabel(day: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    numberingSystem: "latn",
  }).format(new Date(`${day}T00:00:00Z`));
}

/**
 * A sparkline shows the SHAPE of a series. A shop with four orders has no
 * shape, and a flat line under a number is furniture that looks like
 * information — so the line is drawn only once there is something to see.
 *
 * The same call `viewsToCheckoutBps` already makes by answering null rather
 * than "0%".
 */
export const SPARKLINE_MIN_DAYS = 7;

export const nonZeroDays = (trend: readonly CommerceTrendPoint[]): number =>
  trend.filter((point) => point.orders > 0).length;

export const drawsSparkline = (trend: readonly CommerceTrendPoint[]): boolean =>
  nonZeroDays(trend) >= SPARKLINE_MIN_DAYS;

/**
 * "+300%" on a rise from one order to four is true and useless, and it is the
 * figure that gets quoted. Below this many orders in the PREVIOUS window the
 * screen says "not enough history" once, quietly, and prints no number.
 */
export const DELTA_MIN_ORDERS = 5;

export type Movement = { direction: "up" | "down" | "flat"; percent: number };

/**
 * Movement against the previous window, or nothing.
 *
 * `direction` is reported, not inferred by the tile: `Kpi` colours what it is
 * told, because up is not always good.
 */
export function movement(
  current: number,
  previous: number,
  previousOrders: number
): Movement | null {
  if (previousOrders < DELTA_MIN_ORDERS) return null;
  // Five orders that all cancelled leave a real count and no money; a
  // percentage against zero is not a percentage.
  if (previous === 0) return null;

  const percent = Math.round(((current - previous) / previous) * 100);
  return {
    direction: percent > 0 ? "up" : percent < 0 ? "down" : "flat",
    percent,
  };
}

/**
 * A wire amount as exact piastres, for comparing two windows.
 *
 * `parseFloat("0.29") * 100` is 28.999999999999996. This is integer
 * arithmetic on the decimal string, so a delta is never off by a piastre in
 * the direction that makes a fall look like a rise.
 */
export function toPiastres(amount: string): number {
  const negative = amount.startsWith("-");
  const [whole = "0", fraction = ""] = (negative ? amount.slice(1) : amount)
    .split(".");
  const cents = `${fraction}00`.slice(0, 2);
  const value =
    Number.parseInt(whole || "0", 10) * 100 + Number.parseInt(cents, 10);
  return negative ? -value : value;
}

/**
 * `enabled` suppresses the call entirely rather than making it and discarding
 * the answer — the same rule the balance on /today follows. An employee must
 * not cause a revenue request at all.
 */
export function useCommerceDashboard(
  scope: CommerceScope,
  days: WindowDays,
  enabled = true
): Resource<CommerceDashboard> {
  return useResource(`commerce-${scope}-${days}`, enabled, (signal) =>
    api.get(
      commerceDashboardSchema,
      scope === "platform" ? PLATFORM_PATH : BRAND_PATH,
      {
        // `from` only. The API's own default end is today in Africa/Cairo,
        // and computing an end boundary here would be this screen's second
        // opinion about when a day stops.
        query: { from: windowStart(days) },
        signal,
      }
    )
  );
}

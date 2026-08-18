/**
 * HOW PAID PLACEMENT IS MADE IMPOSSIBLE TO HIDE.
 *
 * Selling placement is fine. Selling the appearance of trust is not — every
 * badge on this site is worth exactly as much as the promise that nobody paid
 * for one, and a list quietly ranked by whoever is paying this month burns that
 * promise for all of them at once.
 *
 * The obvious way to keep that promise is a rule: "remember to show the banner
 * when the placement sort is on". Rules like that survive about two refactors.
 * So it is not a rule here — it is a shape. Every ordering this screen can
 * apply is a row in ONE table, and each row carries BOTH the comparator and the
 * disclosure that comparator obliges. There is no way to reach the comparator
 * without the disclosure beside it: the screen destructures one object, and an
 * ordering with `disclosure: null` that nevertheless reads `isPromoted` is
 * caught by a test that watches which fields the comparator actually touches
 * (see `__tests__/placement-order.test.ts`), not by review.
 *
 * The second half of the promise is per-row: a promoted brand is labelled
 * promoted in the list whatever the sort is, because a reader who arrives from
 * a link never saw the sort control at all.
 *
 * Pure: no React, no fetch, no DOM, no copy. The screen passes the catalogue
 * key back through its own message dictionary.
 */
import type { AdminBrandRow } from "./brands-data";

export type BrandSort = "name" | "balance" | "grossSales" | "placement";

export const BRAND_SORTS: readonly BrandSort[] = [
  "name",
  "balance",
  "grossSales",
  "placement",
];

export const isBrandSort = (value: string | null): value is BrandSort =>
  value !== null && (BRAND_SORTS as readonly string[]).includes(value);

// ---------------------------------------------------------------------------
// Money comparison that never becomes a number
// ---------------------------------------------------------------------------

type Magnitude = { negative: boolean; whole: string; cents: string };

/**
 * `parseFloat` here would reintroduce exactly the precision problem the string
 * representation exists to avoid, and it would be wrong about a ledger. So the
 * comparison is textual: sign first, then digit COUNT (which is what makes
 * "900.00" sort below "1000.00" without arithmetic), then the digits.
 */
const magnitude = (amount: string): Magnitude => {
  const negative = amount.startsWith("-");
  const body = negative ? amount.slice(1) : amount;
  const [rawWhole = "0", rawCents = ""] = body.split(".");
  const whole = rawWhole.replace(/^0+(?=\d)/, "");
  const cents = `${rawCents}00`.slice(0, 2);
  // "-0.00" is not a debt. A zero balance has no side.
  const zero = /^0*$/.test(whole) && /^0*$/.test(cents);
  return { negative: negative && !zero, whole, cents };
};

const compareMagnitude = (a: Magnitude, b: Magnitude): number => {
  if (a.whole.length !== b.whole.length) return a.whole.length - b.whole.length;
  if (a.whole !== b.whole) return a.whole < b.whole ? -1 : 1;
  if (a.cents !== b.cents) return a.cents < b.cents ? -1 : 1;
  return 0;
};

/** Ascending: the largest debt to Loqal first, the largest credit last. */
export function compareSignedMoney(left: string, right: string): number {
  const a = magnitude(left);
  const b = magnitude(right);
  if (a.negative !== b.negative) return a.negative ? -1 : 1;
  const size = compareMagnitude(a, b);
  return a.negative ? -size : size;
}

// ---------------------------------------------------------------------------
// The orderings
// ---------------------------------------------------------------------------

/**
 * `disclosure` is the message key the screen MUST render while this ordering is
 * in force. `null` means the ordering reads nothing anybody paid for.
 */
export type BrandOrdering = {
  compare: (a: AdminBrandRow, b: AdminBrandRow) => number;
  disclosure: "placementOrderBanner" | null;
};

const byName: BrandOrdering = {
  compare: (a, b) => a.name.localeCompare(b.name),
  disclosure: null,
};

/** Who owes Loqal most, first. That is the row somebody has to act on. */
const byBalance: BrandOrdering = {
  compare: (a, b) => compareSignedMoney(a.balance, b.balance),
  disclosure: null,
};

const byGrossSales: BrandOrdering = {
  compare: (a, b) => -compareSignedMoney(a.grossSales, b.grossSales),
  disclosure: null,
};

/**
 * The storefront's own ranking, reproduced: paying brands first, then
 * `sortOrder`, then name. It exists because an admin has to be able to see the
 * list a shopper sees — and it is the one ordering that carries a disclosure,
 * because it is the one that puts money above merit.
 */
const byPlacement: BrandOrdering = {
  compare: (a, b) => {
    const promoted = Number(b.isPromoted ?? false) - Number(a.isPromoted ?? false);
    if (promoted !== 0) return promoted;

    const featured = (b.featuredUntil ?? "").localeCompare(a.featuredUntil ?? "");
    if (featured !== 0) return featured;

    const order = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    if (order !== 0) return order;

    return a.name.localeCompare(b.name);
  },
  disclosure: "placementOrderBanner",
};

export const BRAND_ORDERINGS: Record<BrandSort, BrandOrdering> = {
  name: byName,
  balance: byBalance,
  grossSales: byGrossSales,
  placement: byPlacement,
};

/**
 * The comparator and the sentence that has to appear with it, together, in one
 * return value. A caller cannot take the first without seeing the second.
 */
export function orderBrands(
  rows: readonly AdminBrandRow[],
  sort: BrandSort
): { rows: AdminBrandRow[]; disclosure: BrandOrdering["disclosure"] } {
  const ordering = BRAND_ORDERINGS[sort];
  return {
    rows: [...rows].sort(ordering.compare),
    disclosure: ordering.disclosure,
  };
}

/**
 * Whether this page of rows can be ranked by placement at all.
 *
 * BACKEND GAP: `adminBrandListItemSchema` selects four columns and none of them
 * is `isPromoted`, `featuredUntil` or `sortOrder` — the repository's
 * `ADMIN_LIST_FIELDS` is `{ id, name, slug, status }`. So the list CANNOT
 * currently label paid placement, which is the exact failure this whole file
 * exists to prevent. The screen refuses the placement ordering outright while
 * that is true, rather than silently sorting everything into `false` and
 * presenting the result as the storefront's order.
 */
export const placementIsKnown = (rows: readonly AdminBrandRow[]): boolean =>
  rows.length > 0 && rows.every((row) => row.isPromoted !== undefined);

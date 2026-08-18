/**
 * The reputation wire, and the badge arithmetic worked out from it. No React,
 * no fetch.
 *
 * PARTLY CONTRACT-BACKED. `verifiedBadgeSchema` is the real one from
 * @loqal/contracts/admin.contract and is used unchanged — the brand plane
 * serves the same row the admin plane grants. There is no reputation.contract
 * for reviews or for computed-badge progress, so those two are read off the
 * shipped API (loqal-backend ReputationDashboardController /
 * BrandBadgesDashboardController / lib/badge-scoring.ts) and are the honest
 * record of that gap. When the contracts package grows them, they delete.
 *
 * ONE THING IS DELIBERATELY ABSENT. `reputationScore` — Loqal's own 0–100
 * judgement of a shop, written only by SUPER_ADMIN — is not in any schema here
 * and is not selected anywhere on this screen. The brand-plane controller does
 * not send it, and these schemas are plain `z.object`, which STRIPS unknown
 * keys: if a regression ever puts it back on the response it is dropped at the
 * parse boundary and can never reach a component. Showing a brand the private
 * note Loqal keeps about it turns that note into a negotiation, which is the
 * only reason it exists.
 */
import { z } from "zod";

import {
  ComputedBadgeTypeSchema,
  type ComputedBadgeType,
} from "@loqal/contracts/enums";
import { verifiedBadgeSchema } from "@loqal/contracts/admin.contract";

export { verifiedBadgeSchema };
export type { VerifiedBadge } from "@loqal/contracts/admin.contract";

/**
 * One per DELIVERED brand order. There is nothing to review until something
 * arrived, which is the whole defence against invented reviews.
 *
 * Hidden reviews are INCLUDED on this plane, with the reason — a shop that
 * cannot see what was hidden about it cannot tell moderation from a bug. They
 * are hidden, never deleted, and the brand's public reply stays beside them.
 */
export const reviewSchema = z.object({
  id: z.string(),
  brandOrderId: z.string(),
  brandId: z.string(),
  customerId: z.string().nullable(),
  guestId: z.string().nullable(),
  rating: z.number().int(),
  body: z.string().nullable(),
  createdAt: z.string(),
  editedAt: z.string().nullable(),
  hiddenAt: z.string().nullable(),
  hiddenBy: z.string().nullable(),
  hiddenReason: z.string().nullable(),
  brandReply: z.string().nullable(),
  brandRepliedAt: z.string().nullable(),
});
export type Review = z.infer<typeof reviewSchema>;

/**
 * `GET /v1/brands/me/reputation`.
 *
 * Carries reviews and the paid-placement flags. It also carries `badges` and
 * `verifiedBadges`, which this screen does NOT read: those are the currently
 * ACTIVE rows only, and the badges tab needs every type with its progress,
 * which is what `GET /v1/brands/me/badges` answers. Reading both would put two
 * copies of the same fact on one screen, free to disagree.
 */
export const brandReputationSchema = z.object({
  isPromoted: z.boolean(),
  featuredUntil: z.string().nullable(),
  reviews: z.array(reviewSchema),
});
export type BrandReputation = z.infer<typeof brandReputationSchema>;

/** The shape `badgeProgress()` produces, plus what the nightly job decided. */
export const computedBadgeSchema = z.object({
  type: ComputedBadgeTypeSchema,
  /** Live: would it be earned right now, under today's numbers. */
  qualifies: z.boolean(),
  ordersInWindow: z.number().int(),
  /** 0 once the sample-size gate is cleared. Every badge shares that gate. */
  ordersNeeded: z.number().int(),
  /** Raw — basis points or minutes. Null when nothing has been measured. */
  currentValue: z.number().nullable(),
  targetValue: z.number(),
  direction: z.enum(["AT_LEAST", "AT_MOST"]),
  /** From the nightly recompute, not from today's numbers. */
  earned: z.boolean(),
  earnedAt: z.string().nullable(),
});
export type ComputedBadge = z.infer<typeof computedBadgeSchema>;

export const brandBadgesSchema = z.object({
  computed: z.array(computedBadgeSchema),
  verified: z.array(verifiedBadgeSchema),
});
export type BrandBadges = z.infer<typeof brandBadgesSchema>;

export const replyReviewBodySchema = z.object({
  body: z.string().trim().min(1).max(1000),
});

// ---------------------------------------------------------------------------
// Badge arithmetic
// ---------------------------------------------------------------------------

/** All three, in one order, so the screen never re-sorts itself between reads. */
export const COMPUTED_BADGE_ORDER: readonly ComputedBadgeType[] =
  ComputedBadgeTypeSchema.options;

/**
 * The three types in a fixed order, keeping only what the API sent.
 *
 * The API is specified to answer with every type, earned or not, precisely so
 * progress can render for the ones a shop has not got yet. Nothing is invented
 * here if it does not: a badge with no row has no measured progress, and an
 * empty card claiming zero would be a number nobody computed.
 */
export function orderedComputed(
  badges: readonly ComputedBadge[]
): ComputedBadge[] {
  return COMPUTED_BADGE_ORDER.map((type) =>
    badges.find((badge) => badge.type === type)
  ).filter((badge): badge is ComputedBadge => badge !== undefined);
}

/**
 * `earned` and `qualifies` are two different questions and can legitimately
 * disagree until the next nightly recompute. Neither is hidden to make the card
 * tidier — a shop owner arguing about a badge deserves to know which of the two
 * moved.
 *
 *  `earned`      the badge is on the storefront right now.
 *  `slipping`    on the storefront, and today's numbers no longer clear the bar.
 *  `pending`     not on the storefront, and today's numbers do clear it.
 *  `belowSample` too few delivered orders for anything to be judged.
 *  `notYet`      enough orders, and the metric is short.
 */
export type BadgeStanding =
  | "earned"
  | "slipping"
  | "pending"
  | "belowSample"
  | "notYet";

export function badgeStanding(badge: ComputedBadge): BadgeStanding {
  if (badge.earned) return badge.qualifies ? "earned" : "slipping";
  if (badge.qualifies) return "pending";
  return badge.ordersNeeded > 0 ? "belowSample" : "notYet";
}

/**
 * 0–100 for the bar.
 *
 * The sample-size gate comes first and on purpose: below `badgeMinOrderCount`
 * nothing qualifies however good the ratio looks, so the bar shows progress
 * toward ORDERS rather than toward a metric that cannot count yet. "Two more
 * delivered orders" is the sentence a shop can act on.
 */
export function badgeProgressPercent(badge: ComputedBadge): number {
  if (badge.ordersNeeded > 0) {
    const gate = badge.ordersInWindow + badge.ordersNeeded;
    if (gate <= 0) return 0;
    return clampPercent((badge.ordersInWindow / gate) * 100);
  }

  if (badge.currentValue === null) return 0;

  if (badge.direction === "AT_LEAST") {
    if (badge.targetValue <= 0) return 100;
    return clampPercent((badge.currentValue / badge.targetValue) * 100);
  }

  // AT_MOST: at or under the ceiling is the whole way there.
  if (badge.currentValue <= badge.targetValue) return 100;
  if (badge.currentValue <= 0) return 100;
  return clampPercent((badge.targetValue / badge.currentValue) * 100);
}

const clampPercent = (value: number) =>
  Math.max(0, Math.min(100, Math.round(value)));

/**
 * What each badge's raw number actually is.
 *
 * `badgeProgress` keeps values raw — basis points and minutes — because
 * formatting is a presentation decision. This is that decision, in one place,
 * so a percentage cannot be rendered as minutes on one card and not another.
 */
export type BadgeUnit = "PERCENT" | "MINUTES";

export const BADGE_UNIT: Record<ComputedBadgeType, BadgeUnit> = {
  SAME_DAY_SHIPPER: "PERCENT",
  FAST_CONFIRM: "MINUTES",
  RARELY_CANCELS: "PERCENT",
};

/**
 * Basis points to a percentage, minutes to minutes. Latin digits in both
 * languages, as money and elapsed time already are — a column that mixes ٣ and
 * 3 is how a 7 gets read as a 1.
 */
export function formatBadgeValue(
  type: ComputedBadgeType,
  value: number,
  copy: { unitPercent: string; waitedMinutes: string }
): string {
  if (BADGE_UNIT[type] === "MINUTES") {
    return copy.waitedMinutes.replace("{n}", String(Math.round(value)));
  }
  const percent = value / 100;
  const text = Number.isInteger(percent)
    ? String(percent)
    : String(Math.round(percent * 10) / 10);
  return copy.unitPercent.replace("{n}", text);
}

/**
 * "2026-08-14".
 *
 * An ISO day rather than a localised date: it is unambiguous in both languages,
 * reads the same in both directions, and needs no Intl format nobody has agreed
 * on. Badge dates are facts about when somebody checked something, and an
 * expiry a shop misreads by a month is worse than one it has to parse.
 */
export function isoDay(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

/** Newest first, which is the order the API already uses. Made explicit. */
export function newestFirst(reviews: readonly Review[]): Review[] {
  return [...reviews].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
  );
}

/** The one worth putting under a thumb: the oldest review with no reply yet. */
export function oldestUnanswered(reviews: readonly Review[]): Review | null {
  const open = reviews.filter((review) => review.brandReply === null);
  if (open.length === 0) return null;
  return open.reduce((oldest, review) =>
    Date.parse(review.createdAt) < Date.parse(oldest.createdAt)
      ? review
      : oldest
  );
}

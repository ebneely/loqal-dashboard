/**
 * Reputation fixtures.
 *
 * Shaped against the SHIPPED API: `/v1/brands/me/reputation` is the placement
 * snapshot spread over the reviews, and `/v1/brands/me/badges` is
 * `badgeProgress()` for every computed type plus the active verified badges.
 *
 * `reputationScore` appears in exactly one fixture, on purpose, to prove the
 * parse boundary drops it. Nothing else here invents a field the API does not
 * serve.
 */
import type { BrandBadges, ComputedBadge, Review } from "../reputation-wire";

export const NOW = new Date("2026-08-14T12:00:00.000Z");

const daysAgo = (n: number) =>
  new Date(NOW.getTime() - n * 86_400_000).toISOString();

const daysAhead = (n: number) =>
  new Date(NOW.getTime() + n * 86_400_000).toISOString();

const BRAND_ID = "0199a000-0000-7000-8000-0000000000aa";

export const answeredReview: Review = {
  id: "0199c100-0000-7000-8000-000000000001",
  brandOrderId: "0199c200-0000-7000-8000-000000000001",
  brandId: BRAND_ID,
  customerId: "0199d000-0000-7000-8000-000000000001",
  guestId: null,
  rating: 5,
  body: "Arrived the next morning, exactly as described.",
  createdAt: daysAgo(2),
  editedAt: null,
  hiddenAt: null,
  hiddenBy: null,
  hiddenReason: null,
  brandReply: "Thank you — glad it reached you quickly.",
  brandRepliedAt: daysAgo(1),
};

export const openReview: Review = {
  id: "0199c100-0000-7000-8000-000000000002",
  brandOrderId: "0199c200-0000-7000-8000-000000000002",
  brandId: BRAND_ID,
  customerId: null,
  guestId: "0199e100-0000-7000-8000-000000000002",
  rating: 2,
  body: "The colour was not what I expected.",
  createdAt: daysAgo(9),
  editedAt: null,
  hiddenAt: null,
  hiddenBy: null,
  hiddenReason: null,
  brandReply: null,
  brandRepliedAt: null,
};

export const hiddenReview: Review = {
  id: "0199c100-0000-7000-8000-000000000003",
  brandOrderId: "0199c200-0000-7000-8000-000000000003",
  brandId: BRAND_ID,
  customerId: "0199d000-0000-7000-8000-000000000003",
  guestId: null,
  rating: 1,
  body: null,
  createdAt: daysAgo(5),
  editedAt: daysAgo(4),
  hiddenAt: daysAgo(3),
  hiddenBy: "0199f000-0000-7000-8000-000000000001",
  hiddenReason: "Abusive language, recorded rather than deleted.",
  brandReply: null,
  brandRepliedAt: null,
};

export const reputation = {
  isPromoted: true,
  featuredUntil: daysAhead(20),
  reviews: [answeredReview, hiddenReview, openReview],
};

/** The same body with the SUPER_ADMIN-only score bolted on. */
export const reputationWithLeakedScore = {
  ...reputation,
  reputationScore: 87,
  reputationSetBy: "0199f000-0000-7000-8000-000000000009",
  reputationSetAt: daysAgo(30),
};

export const emptyReputation = {
  isPromoted: false,
  featuredUntil: null,
  reviews: [],
};

/** Earned, and today's numbers still clear the bar. */
export const sameDayShipper: ComputedBadge = {
  type: "SAME_DAY_SHIPPER",
  qualifies: true,
  ordersInWindow: 41,
  ordersNeeded: 0,
  currentValue: 8600,
  targetValue: 8000,
  direction: "AT_LEAST",
  earned: true,
  earnedAt: daysAgo(12),
};

/** Earned by the nightly job, and today's numbers no longer clear it. */
export const fastConfirm: ComputedBadge = {
  type: "FAST_CONFIRM",
  qualifies: false,
  ordersInWindow: 41,
  ordersNeeded: 0,
  currentValue: 95,
  targetValue: 60,
  direction: "AT_MOST",
  earned: true,
  earnedAt: daysAgo(30),
};

/** Not earned, and not judgeable — two more delivered orders to go. */
export const rarelyCancels: ComputedBadge = {
  type: "RARELY_CANCELS",
  qualifies: false,
  ordersInWindow: 18,
  ordersNeeded: 2,
  currentValue: null,
  targetValue: 300,
  direction: "AT_MOST",
  earned: false,
  earnedAt: null,
};

/** Not earned yet, and today's numbers clear the bar. */
export const pendingSameDay: ComputedBadge = {
  ...sameDayShipper,
  earned: false,
  earnedAt: null,
  qualifies: true,
};

export const verifiedBadge = {
  id: "0199c300-0000-7000-8000-000000000001",
  brandId: BRAND_ID,
  type: "PRICE_CHECKED" as const,
  checkedBy: "0199f000-0000-7000-8000-000000000001",
  checkedAgainst: "The shelf price in the shop, on the same day.",
  checkedAt: daysAgo(40),
  expiresAt: daysAhead(140),
};

/** Deliberately out of enum order — the screen is what fixes the order. */
export const badges: BrandBadges = {
  computed: [rarelyCancels, sameDayShipper, fastConfirm],
  verified: [verifiedBadge],
};

export const badgesWithoutVerified: BrandBadges = {
  computed: [sameDayShipper, fastConfirm, rarelyCancels],
  verified: [],
};

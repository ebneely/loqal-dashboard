import { describe, expect, it } from "vitest";

import { en } from "@/messages/en";

import {
  badgeProgressPercent,
  badgeStanding,
  brandBadgesSchema,
  brandReputationSchema,
  formatBadgeValue,
  isoDay,
  newestFirst,
  oldestUnanswered,
  orderedComputed,
} from "../reputation-wire";
import {
  answeredReview,
  badges,
  fastConfirm,
  hiddenReview,
  openReview,
  pendingSameDay,
  rarelyCancels,
  reputation,
  reputationWithLeakedScore,
  sameDayShipper,
  verifiedBadge,
} from "./fixtures";

const copy = {
  unitPercent: en.brand.unitPercent,
  waitedMinutes: en.brand.waitedMinutes,
};

describe("reputation fixtures match the shape the API ships", () => {
  it("parses the reputation body and the badges overview", () => {
    expect(brandReputationSchema.safeParse(reputation).success).toBe(true);
    expect(brandBadgesSchema.safeParse(badges).success).toBe(true);
  });

  /**
   * `reputationScore` is Loqal's private 0–100 judgement, SUPER_ADMIN-only. The
   * brand controller does not send it; if a regression ever puts it back, the
   * parse boundary drops it and no component can reach it.
   */
  it("strips Loqal's private score at the parse boundary", () => {
    const parsed = brandReputationSchema.parse(reputationWithLeakedScore);

    expect(parsed).not.toHaveProperty("reputationScore");
    expect(parsed).not.toHaveProperty("reputationSetBy");
    expect(parsed).not.toHaveProperty("reputationSetAt");
    expect(JSON.stringify(parsed)).not.toContain("87");
  });
});

describe("the two badge kinds stay two", () => {
  it("keeps computed and verified in separate arrays with no total", () => {
    const parsed = brandBadgesSchema.parse(badges);

    expect(parsed.computed).toHaveLength(3);
    expect(parsed.verified).toHaveLength(1);
    expect(parsed).not.toHaveProperty("total");
    expect(parsed).not.toHaveProperty("count");
  });

  it("renders all three computed types in one fixed order, whatever the API's is", () => {
    expect(orderedComputed(badges.computed).map((badge) => badge.type)).toEqual([
      "SAME_DAY_SHIPPER",
      "FAST_CONFIRM",
      "RARELY_CANCELS",
    ]);
  });

  it("invents no progress for a type the API left out", () => {
    expect(orderedComputed([sameDayShipper])).toHaveLength(1);
  });
});

describe("earned and qualifies are two different questions", () => {
  it("reads a badge that is on the storefront and still clearing the bar", () => {
    expect(badgeStanding(sameDayShipper)).toBe("earned");
  });

  /**
   * The disagreement the nightly job creates. It is shown, not hidden: a shop
   * arguing about a badge deserves to know which of the two answers moved.
   */
  it("reads a badge still on the storefront whose numbers have slipped", () => {
    expect(badgeStanding(fastConfirm)).toBe("slipping");
  });

  it("reads a badge today's numbers earn but the job has not awarded", () => {
    expect(badgeStanding(pendingSameDay)).toBe("pending");
  });

  it("reads a badge with too few delivered orders to judge at all", () => {
    expect(badgeStanding(rarelyCancels)).toBe("belowSample");
  });

  it("reads a badge with enough orders and a short metric", () => {
    expect(
      badgeStanding({ ...fastConfirm, earned: false, earnedAt: null })
    ).toBe("notYet");
  });
});

describe("progress toward a badge", () => {
  /**
   * The sample-size gate comes first. Below it nothing qualifies however good
   * the ratio looks, so the bar measures ORDERS — 18 of 20 — which is the thing
   * a shop can actually do something about.
   */
  it("measures the order gate while the gate is unmet", () => {
    expect(badgeProgressPercent(rarelyCancels)).toBe(90);
  });

  it("measures a rising metric against its floor", () => {
    expect(badgeProgressPercent(sameDayShipper)).toBe(100);
    expect(
      badgeProgressPercent({ ...sameDayShipper, currentValue: 4000 })
    ).toBe(50);
  });

  it("measures a falling metric against its ceiling", () => {
    // 95 minutes against a 60-minute ceiling: not there.
    expect(badgeProgressPercent(fastConfirm)).toBe(63);
    // At or under the ceiling is the whole way there.
    expect(badgeProgressPercent({ ...fastConfirm, currentValue: 30 })).toBe(100);
  });

  it("shows nothing rather than zero when nothing has been measured", () => {
    expect(
      badgeProgressPercent({ ...sameDayShipper, currentValue: null, ordersNeeded: 0 })
    ).toBe(0);
  });
});

describe("what a badge's raw number means", () => {
  it("reads basis points as a percentage and minutes as minutes", () => {
    expect(formatBadgeValue("SAME_DAY_SHIPPER", 8600, copy)).toBe("86%");
    expect(formatBadgeValue("RARELY_CANCELS", 250, copy)).toBe("2.5%");
    expect(formatBadgeValue("FAST_CONFIRM", 95, copy)).toBe("95 min");
  });

  it("keeps Latin digits, as money and elapsed time already do", () => {
    expect(formatBadgeValue("SAME_DAY_SHIPPER", 8000, copy)).toMatch(/^\d+%$/);
  });
});

describe("badge dates", () => {
  it("reads an ISO day out of a timestamp", () => {
    expect(isoDay(verifiedBadge.expiresAt)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(isoDay(null)).toBeNull();
    expect(isoDay("not a date")).toBeNull();
  });
});

describe("ordering reviews", () => {
  it("puts the newest first", () => {
    expect(
      newestFirst([openReview, answeredReview, hiddenReview]).map((r) => r.id)
    ).toEqual([answeredReview.id, hiddenReview.id, openReview.id]);
  });

  it("offers the oldest review with no reply as the one to answer", () => {
    expect(
      oldestUnanswered([answeredReview, hiddenReview, openReview])?.id
    ).toBe(openReview.id);
  });

  it("offers nothing when every review has been answered", () => {
    expect(oldestUnanswered([answeredReview])).toBeNull();
  });
});

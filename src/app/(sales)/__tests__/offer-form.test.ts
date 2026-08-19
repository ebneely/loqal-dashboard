/**
 * The band, checked against `lib/commercial-band.ts:bandViolations` — the
 * server function these mirror. A drift here means the screen sends an offer it
 * believes is fine and the API answers 422 in front of a shop owner.
 */
import { describe, expect, it } from "vitest";

import {
  bpsToPercent,
  commissionCheck,
  draftFrom,
  freeMonthOptions,
  freeMonthsCheck,
  freeUntilFrom,
  isSendable,
  offerBodyFrom,
  offerProblems,
  percentToBps,
} from "../sales/terms/offer-form";
import { boundedBand, unboundedBand } from "./fixtures";

describe("the unit the server actually compares in", () => {
  /**
   * `bandViolations` does `new Prisma.Decimal(perOrderChargeValue).times(100)`
   * and compares that to `salesCommissionFloorBps`. 5% is 500 bps. Anything
   * using 0.05 here is a hundred-fold error in the direction of signing away
   * the margin.
   */
  it("reads a percentage as basis points the way the server does", () => {
    expect(percentToBps(5)).toBe(500);
    expect(percentToBps(2.5)).toBe(250);
    expect(bpsToPercent(500)).toBe(5);
  });
});

describe("commissionCheck", () => {
  it("refuses a figure below the floor", () => {
    expect(commissionCheck("4.9", boundedBand)).toBe("outside");
  });

  /** `brandCount === floor` passes; so does a commission exactly at it. */
  it("accepts a figure exactly at the floor", () => {
    expect(commissionCheck("5", boundedBand)).toBe("inside");
  });

  it("accepts a figure above the floor", () => {
    expect(commissionCheck("7.5", boundedBand)).toBe("inside");
  });

  it("reports unbounded rather than inside when no floor is set", () => {
    // Not the same thing to a rep: unbounded means the deal goes to an admin
    // before it binds, and a screen saying "inside the band" would be a lie
    // about a band that does not exist.
    expect(commissionCheck("0.5", unboundedBand)).toBe("unbounded");
  });
});

describe("freeMonthsCheck", () => {
  it("accepts up to and including the maximum", () => {
    expect(freeMonthsCheck(3, boundedBand)).toBe("inside");
    expect(freeMonthsCheck(0, boundedBand)).toBe("inside");
  });

  it("refuses one month past it", () => {
    expect(freeMonthsCheck(4, boundedBand)).toBe("outside");
  });

  it("reports unbounded when no maximum is set", () => {
    expect(freeMonthsCheck(24, unboundedBand)).toBe("unbounded");
  });
});

describe("freeMonthOptions — out-of-band months are shown, not hidden", () => {
  /**
   * A rep asked "can you do six months?" has to be able to say "not without an
   * admin". A list that silently stops at three leaves them shrugging.
   */
  it("offers months past the maximum, marked as not allowed", () => {
    const options = freeMonthOptions(boundedBand);

    expect(options.find((o) => o.months === 3)?.allowed).toBe(true);
    expect(options.find((o) => o.months === 4)?.allowed).toBe(false);
    expect(options.some((o) => o.months === 6)).toBe(true);
  });

  it("marks everything allowed when no maximum is set", () => {
    expect(freeMonthOptions(unboundedBand).every((o) => o.allowed)).toBe(true);
  });

  it("always offers no-free-period at all", () => {
    expect(freeMonthOptions(boundedBand)[0]).toEqual({
      months: 0,
      allowed: true,
    });
  });
});

describe("freeUntilFrom", () => {
  const now = new Date("2026-08-17T12:00:00.000Z");

  it("returns null for no free period rather than today's date", () => {
    // A `freeUntil` of today would read as an offer that expired this morning.
    expect(freeUntilFrom(0, now)).toBeNull();
    expect(freeUntilFrom(-1, now)).toBeNull();
  });

  it("adds whole months", () => {
    expect(freeUntilFrom(3, now)).toBe("2026-11-17T12:00:00.000Z");
  });

  it("does not hand out extra free days when the month is short", () => {
    // 31 Jan + 1 month is 28 Feb, not 3 March.
    const endOfJanuary = new Date("2026-01-31T12:00:00.000Z");

    expect(freeUntilFrom(1, endOfJanuary)).toBe("2026-02-28T12:00:00.000Z");
  });
});

describe("offerProblems and isSendable", () => {
  it("finds nothing wrong with an offer inside the band", () => {
    const draft = { commissionPercent: "6", freeMonths: 2 };

    expect(offerProblems(draft, boundedBand)).toEqual([]);
    expect(isSendable(draft, boundedBand)).toBe(true);
  });

  it("reports both violations at once rather than only the first", () => {
    // The server returns every violation it finds, for the same reason: a rep
    // fixing one and being refused again is a worse conversation.
    expect(
      offerProblems({ commissionPercent: "1", freeMonths: 9 }, boundedBand)
    ).toEqual(["belowFloor", "aboveMax"]);
  });

  it("treats a blank commission as missing rather than as zero", () => {
    expect(
      offerProblems({ commissionPercent: "", freeMonths: 1 }, boundedBand)
    ).toEqual(["commissionMissing"]);
  });

  it("treats something that is not a number as missing", () => {
    expect(
      offerProblems({ commissionPercent: "abc", freeMonths: 1 }, boundedBand)
    ).toEqual(["commissionMissing"]);
  });

  it("lets anything through when the band is unbounded", () => {
    expect(
      isSendable({ commissionPercent: "0.5", freeMonths: 24 }, unboundedBand)
    ).toBe(true);
  });
});

describe("draftFrom — what the form opens on", () => {
  it("pre-fills the floor and the platform's default free period", () => {
    expect(draftFrom(boundedBand)).toEqual({
      commissionPercent: "5",
      freeMonths: 1,
    });
  });

  it("leaves the commission blank when there is no floor to suggest", () => {
    // Suggesting a number Loqal has not chosen would be the screen inventing a
    // commercial position.
    expect(draftFrom(unboundedBand).commissionPercent).toBe("");
  });
});

describe("offerBodyFrom — exactly three keys, and never a fourth", () => {
  const now = new Date("2026-08-17T12:00:00.000Z");

  /**
   * `setSalesTermsSchema` also accepts `monthlyFee`, `settlementCadence`,
   * `settlementAnchor` and `settlementMethod`. None of them is bounded by the
   * band, so a rep setting one would be a commercial decision with no guard
   * rail behind it. And `settlementDetails` — the payout account — is not on
   * the rep's schema at all.
   */
  it("sends only the commission and the free period", () => {
    const body = offerBodyFrom({ commissionPercent: "6", freeMonths: 2 }, now);

    expect(Object.keys(body).sort()).toEqual([
      "freeUntil",
      "perOrderChargeType",
      "perOrderChargeValue",
    ]);
  });

  it("never sends the payout account or the monthly fee", () => {
    const body = offerBodyFrom({ commissionPercent: "6", freeMonths: 2 }, now) as Record<
      string,
      unknown
    >;

    expect(body.settlementDetails).toBeUndefined();
    expect(body.monthlyFee).toBeUndefined();
    expect(body.settlementCadence).toBeUndefined();
    expect(body.settlementMethod).toBeUndefined();
    expect(body.status).toBeUndefined();
  });

  /**
   * PERCENT is hard-coded. `bandViolations` fails a FIXED offer closed the
   * moment a floor exists — "cannot be verified against salesCommissionFloorBps
   * — needs admin approval" — so offering FIXED here would be a control whose
   * every value produces a refusal.
   */
  it("always sends PERCENT, because FIXED cannot be checked against a bps floor", () => {
    expect(
      offerBodyFrom({ commissionPercent: "6", freeMonths: 0 }, now)
        .perOrderChargeType
    ).toBe("PERCENT");
  });

  it("sends money as a two-decimal string, which is what moneySchema accepts", () => {
    expect(
      offerBodyFrom({ commissionPercent: "2.5", freeMonths: 0 }, now)
        .perOrderChargeValue
    ).toBe("2.50");
  });

  it("sends a null free period rather than omitting it", () => {
    // The column's own "no free period" is null; omitting the key would leave
    // whatever was there before.
    expect(
      offerBodyFrom({ commissionPercent: "6", freeMonths: 0 }, now).freeUntil
    ).toBeNull();
  });
});

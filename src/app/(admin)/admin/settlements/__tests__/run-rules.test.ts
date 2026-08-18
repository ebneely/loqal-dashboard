/**
 * The rules that decide whether money moves.
 *
 * No DOM here on purpose: these are the assertions that have to hold whatever
 * the screen looks like, and they are the ones worth reading in a review.
 */
import { describe, expect, it } from "vitest";

import {
  SettlementDirectionSchema,
  SettlementStatusSchema,
} from "@loqal/contracts/enums";

import { allowedMarks, checkSum, isMarkable, sumLines } from "../run-rules";

const line = (amount: string) => ({ amount });

describe("allowedMarks — direction decides the verb", () => {
  it("offers SENT for a run where Loqal is holding the brand's money", () => {
    expect(allowedMarks({ direction: "WE_PAY", status: "PENDING" })).toEqual([
      "SENT",
      "CANCELLED",
    ]);
  });

  it("offers RECEIVED for a run where the brand is holding Loqal's money", () => {
    expect(allowedMarks({ direction: "THEY_PAY", status: "PENDING" })).toEqual([
      "RECEIVED",
      "CANCELLED",
    ]);
  });

  it("never offers the wrong verb, in either direction", () => {
    // Marking a WE_PAY run RECEIVED writes a BRAND_PAYMENT entry for money that
    // went the other way, which double-counts on the very next run.
    expect(
      allowedMarks({ direction: "WE_PAY", status: "PENDING" })
    ).not.toContain("RECEIVED");
    expect(
      allowedMarks({ direction: "THEY_PAY", status: "PENDING" })
    ).not.toContain("SENT");
  });

  it("offers nothing at all once a run has been marked", () => {
    for (const status of ["SENT", "RECEIVED", "CANCELLED"] as const) {
      for (const direction of SettlementDirectionSchema.options) {
        expect(allowedMarks({ direction, status })).toEqual([]);
        expect(isMarkable({ direction, status })).toBe(false);
      }
    }
  });

  it("never offers PENDING back, from any state", () => {
    for (const status of SettlementStatusSchema.options) {
      for (const direction of SettlementDirectionSchema.options) {
        expect(allowedMarks({ direction, status })).not.toContain("PENDING");
      }
    }
  });

  it("allows cancelling in both directions, because it writes no entry", () => {
    for (const direction of SettlementDirectionSchema.options) {
      expect(allowedMarks({ direction, status: "PENDING" })).toContain(
        "CANCELLED"
      );
    }
  });
});

describe("sumLines — piastres, never floats", () => {
  it("adds the figures that a float would get wrong", () => {
    // 0.1 + 0.2 as doubles is 0.30000000000000004. This is a ledger.
    expect(sumLines([line("0.10"), line("0.20")])).toBe("0.30");
  });

  it("adds a mixed-sign ledger to the right signed total", () => {
    expect(
      sumLines([line("1200.00"), line("-180.00"), line("-20.50")])
    ).toBe("999.50");
  });

  it("treats a missing fraction as .00 rather than refusing it", () => {
    expect(sumLines([line("1240"), line("0.5")])).toBe("1240.50");
  });

  it("answers 0.00 for no lines at all, not null", () => {
    expect(sumLines([])).toBe("0.00");
  });

  it("normalises a negative zero to 0.00", () => {
    expect(sumLines([line("1.00"), line("-1.00")])).toBe("0.00");
  });

  it("refuses an amount that is not the shape the contract promised", () => {
    expect(sumLines([line("1,200.00")])).toBeNull();
    expect(sumLines([line("")])).toBeNull();
    expect(sumLines([line("1e3")])).toBeNull();
    // Nine digits: outside signedMoneySchema's own 8-digit bound.
    expect(sumLines([line("123456789.00")])).toBeNull();
  });
});

describe("checkSum — four outcomes and never a guess", () => {
  const run = { netAmount: "999.50" };

  it("agrees when every line is loaded and the total matches", () => {
    const verdict = checkSum(
      run,
      [line("1200.00"), line("-180.00"), line("-20.50")],
      false
    );
    expect(verdict).toEqual({ kind: "agrees", total: "999.50" });
  });

  it("disagrees when every line is loaded and the total does not match", () => {
    const verdict = checkSum(run, [line("1200.00")], false);
    expect(verdict.kind).toBe("disagrees");
  });

  it("refuses a verdict while pages remain, even when the total happens to match", () => {
    // A partial sum that matches is a coincidence, not a confirmation.
    const verdict = checkSum(run, [line("999.50")], true);
    expect(verdict.kind).toBe("incomplete");
  });

  it("refuses a verdict while pages remain, even when it does not match", () => {
    // And this is the one that would otherwise cry wolf on every long run.
    const verdict = checkSum(run, [line("100.00")], true);
    expect(verdict.kind).toBe("incomplete");
  });

  it("says it cannot check rather than guessing when an amount is unreadable", () => {
    expect(checkSum(run, [line("not money")], false)).toEqual({
      kind: "uncheckable",
    });
  });

  it("agrees across the ways the wire spells the same money", () => {
    expect(checkSum({ netAmount: "1240" }, [line("1240.00")], false).kind).toBe(
      "agrees"
    );
    expect(checkSum({ netAmount: "-0.00" }, [], false).kind).toBe("agrees");
    expect(
      checkSum({ netAmount: "0" }, [line("1.00"), line("-1.00")], false).kind
    ).toBe("agrees");
  });
});

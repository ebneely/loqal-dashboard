// @vitest-environment node
import { describe, expect, it } from "vitest";

import { en } from "@/messages/en";
import { ar } from "@/messages/ar";

import { byLongestWait, waitedFor, waitedLabel } from "../waited";

const NOW = Date.parse("2026-08-14T12:00:00.000Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("waitedLabel", () => {
  it("says how long, not when", () => {
    // The whole point: a shop owner with a customer at the counter should not
    // have to subtract 14:20 from now.
    expect(waitedLabel(ago(22 * MINUTE), en, NOW)).toBe("22 min");
    expect(waitedLabel(ago(3 * HOUR + 40 * MINUTE), en, NOW)).toBe("3 h");
    expect(waitedLabel(ago(2 * DAY + 5 * HOUR), en, NOW)).toBe("2 d");
  });

  it("rounds down, so a wait is never overstated", () => {
    expect(waitedLabel(ago(119 * MINUTE), en, NOW)).toBe("1 h");
  });

  it("calls the first minute what it is", () => {
    expect(waitedLabel(ago(10_000), en, NOW)).toBe(en.brand.justNow);
  });

  it("returns null when no clock is running", () => {
    // waitingSince is null once the brand has acted — that is not "0 min".
    expect(waitedLabel(null, en, NOW)).toBeNull();
    expect(waitedLabel(undefined, en, NOW)).toBeNull();
    expect(waitedLabel("not a date", en, NOW)).toBeNull();
  });

  it("never returns a negative wait from a clock skewed into the future", () => {
    expect(waitedLabel(new Date(NOW + HOUR).toISOString(), en, NOW)).toBe(
      en.brand.justNow
    );
  });

  it("keeps Latin digits under Arabic", () => {
    // A column that mixes ٣ and 3 is how a 7 gets read as a 1.
    expect(waitedLabel(ago(22 * MINUTE), ar, NOW)).toBe("22 دقيقة");
  });
});

describe("waitedFor", () => {
  it("scores a missing clock below every real wait", () => {
    expect(waitedFor(null, NOW)).toBeLessThan(waitedFor(ago(0), NOW));
  });
});

describe("byLongestWait", () => {
  const row = (id: string, minutes: number | null) => ({
    id,
    waitingSince: minutes === null ? null : ago(minutes * MINUTE),
  });

  it("puts the shopper who has waited longest first", () => {
    const sorted = byLongestWait(
      [row("a", 5), row("c", 220), row("b", 22)],
      NOW
    );
    expect(sorted.map((r) => r.id)).toEqual(["c", "b", "a"]);
  });

  it("does not mutate the caller's array", () => {
    const rows = [row("a", 5), row("c", 220)];
    byLongestWait(rows, NOW);
    expect(rows.map((r) => r.id)).toEqual(["a", "c"]);
  });

  it("sinks rows with no clock to the bottom", () => {
    const sorted = byLongestWait([row("none", null), row("a", 5)], NOW);
    expect(sorted.map((r) => r.id)).toEqual(["a", "none"]);
  });
});

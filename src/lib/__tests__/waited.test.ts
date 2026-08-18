import { describe, expect, it } from "vitest";

import { byLongestWait, waitedFor, waitedLabel } from "@/lib/waited";
import { en } from "@/messages/en";

/**
 * The same behaviour /today already relied on, now checked where it lives.
 * The route copy of this suite stays until its imports move; this one is what
 * the other six screens will be reading.
 */
const NOW = Date.parse("2026-01-01T12:00:00.000Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe("waitedLabel", () => {
  it("says how long, never when", () => {
    // "Placed 14:20" makes a shop owner do subtraction with a customer at the
    // counter. "3 h" does not.
    expect(waitedLabel(ago(3 * 60 * 60_000), en, NOW)).toBe(
      en.brand.waitedHours.replace("{n}", "3")
    );
    expect(waitedLabel(ago(90_000), en, NOW)).toBe(
      en.brand.waitedMinutes.replace("{n}", "1")
    );
    expect(waitedLabel(ago(2 * 24 * 60 * 60_000), en, NOW)).toBe(
      en.brand.waitedDays.replace("{n}", "2")
    );
    expect(waitedLabel(ago(1_000), en, NOW)).toBe(en.brand.justNow);
  });

  it("returns null when no clock is running", () => {
    // `waitingSince` is null once the brand has acted. That is not "just
    // arrived", it is "nobody is waiting", and the caller draws a dash.
    expect(waitedLabel(null, en, NOW)).toBeNull();
    expect(waitedLabel(undefined, en, NOW)).toBeNull();
    expect(waitedLabel("not a date", en, NOW)).toBeNull();
  });

  it("takes any catalogue with the four phrases, not only the brand console", () => {
    // Widened on promotion: admin and sales have their own catalogues and must
    // not have to import the brand one to render a wait.
    const other = {
      brand: {
        justNow: "now",
        waitedMinutes: "{n}m",
        waitedHours: "{n}h",
        waitedDays: "{n}d",
      },
    };

    expect(waitedLabel(ago(5 * 60 * 60_000), other, NOW)).toBe("5h");
  });
});

describe("waitedFor", () => {
  it("ranks a missing clock last rather than first", () => {
    expect(waitedFor(null, NOW)).toBe(-1);
    expect(waitedFor(ago(1_000), NOW)).toBe(1_000);
  });
});

describe("byLongestWait", () => {
  it("puts the shopper who has waited most at the top", () => {
    const rows = [
      { id: "a", waitingSince: ago(60_000) },
      { id: "b", waitingSince: ago(6 * 60 * 60_000) },
      { id: "c", waitingSince: null },
    ];

    expect(byLongestWait(rows, NOW).map((row) => row.id)).toEqual([
      "b",
      "a",
      "c",
    ]);
  });

  it("does not mutate the array it was given", () => {
    const rows = [
      { id: "a", waitingSince: ago(60_000) },
      { id: "b", waitingSince: ago(6 * 60 * 60_000) },
    ];
    byLongestWait(rows, NOW);

    expect(rows.map((row) => row.id)).toEqual(["a", "b"]);
  });
});

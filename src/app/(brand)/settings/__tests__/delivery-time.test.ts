// @vitest-environment node
import { describe, expect, it } from "vitest";

import { choiceFor, customRange, unitFor } from "../delivery-time-section";

describe("delivery time — presets and a custom range", () => {
  it("recognises a stored preset, and calls anything else custom", () => {
    expect(choiceFor(null)).toBe("none");
    expect(choiceFor({ minMinutes: 60, maxMinutes: 120 })).toBe("oneToTwoHours");
    expect(choiceFor({ minMinutes: 45, maxMinutes: 90 })).toBe("custom");
  });

  it("turns a typed range into minutes in the chosen unit", () => {
    expect(customRange("1", "3", "days")).toEqual({ minMinutes: 1440, maxMinutes: 4320 });
    expect(customRange("20", "40", "minutes")).toEqual({ minMinutes: 20, maxMinutes: 40 });
  });

  it("refuses what the server would: too short, too long, reversed, not a number", () => {
    expect(customRange("10", "40", "minutes")).toBeNull();
    expect(customRange("1", "4", "days")).toBeNull();
    expect(customRange("3", "1", "hours")).toBeNull();
    expect(customRange("1.5", "2", "hours")).toBeNull();
    expect(customRange("", "2", "hours")).toBeNull();
  });

  it("shows a stored range in the largest unit it divides into", () => {
    expect(unitFor({ minMinutes: 1440, maxMinutes: 2880 })).toBe("days");
    expect(unitFor({ minMinutes: 60, maxMinutes: 180 })).toBe("hours");
    expect(unitFor({ minMinutes: 45, maxMinutes: 90 })).toBe("minutes");
  });
});

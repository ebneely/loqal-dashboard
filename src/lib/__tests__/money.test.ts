// @vitest-environment node
import { describe, expect, it } from "vitest";

import { MINUS, formatCount, formatMoney, formatMoneyParts } from "../money";

describe("formatMoneyParts", () => {
  it("groups the whole part and always pads to two decimals", () => {
    expect(formatMoneyParts("1240.5")).toEqual({
      absolute: "1,240.50",
      sign: "+",
      negative: false,
    });
  });

  it("gives a settled balance no sign at all", () => {
    expect(formatMoneyParts("0.00").sign).toBe("");
  });

  it("uses the typographic minus, not the hyphen the wire sends", () => {
    expect(formatMoneyParts("-40.00").sign).toBe(MINUS);
  });
});

describe("formatMoney", () => {
  it("keeps the EGP mark on the figure", () => {
    expect(formatMoney("1240.00")).toBe("1,240.00 EGP");
  });
});

describe("formatCount", () => {
  /**
   * The bug this exists for: `value.toLocaleString("ar")` returns ١٢٬٤٠٠ and
   * `.lq-kpi-val` is Source Code Pro with `subsets: ["latin"]`. The figure
   * falls back to another face mid-number, at a different weight and width,
   * inside a column meant to be read down.
   */
  it("groups in threes", () => {
    expect(formatCount(12400)).toBe("12,400");
    expect(formatCount(1234567)).toBe("1,234,567");
  });

  it("leaves anything under a thousand alone", () => {
    expect(formatCount(0)).toBe("0");
    expect(formatCount(999)).toBe("999");
  });

  it("groups a negative without separating it from its sign", () => {
    expect(formatCount(-12400)).toBe("-12,400");
  });

  it("truncates rather than rounding a count that arrived fractional", () => {
    expect(formatCount(1999.9)).toBe("1,999");
  });

  it("writes Latin digits regardless of the ambient locale", () => {
    // The whole point. Intl is never consulted, so there is no locale to get
    // wrong — the assertion is that no Arabic-Indic digit can appear.
    expect(formatCount(12400)).not.toMatch(/[٠-٩۰-۹]/);
  });
});

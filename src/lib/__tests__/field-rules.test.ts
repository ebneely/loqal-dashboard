// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  checkEgyptMobile,
  checkEmail,
  checkMoney,
  checkSlug,
  checkWholeNumber,
  problemText,
} from "../field-rules";

describe("field rules", () => {
  it("money takes pounds with up to two decimals, nothing else", () => {
    expect(checkMoney("250")).toBeNull();
    expect(checkMoney("99.50")).toBeNull();
    expect(checkMoney("")).toBeNull();
    expect(checkMoney("", true)).toBe("required");
    expect(checkMoney("abc")).toBe("money");
    expect(checkMoney("-5")).toBe("money");
    expect(checkMoney("1.234")).toBe("money");
  });

  it("whole numbers must sit inside their range", () => {
    expect(checkWholeNumber("45", 1, 31)).toBe("wholeNumber");
    expect(checkWholeNumber("-3", 0, 100)).toBe("wholeNumber");
    expect(checkWholeNumber("abc", 0, 100)).toBe("wholeNumber");
    expect(checkWholeNumber("2.5", 0, 100)).toBe("wholeNumber");
    expect(checkWholeNumber("100", 0, 100)).toBeNull();
  });

  it("slug, email and Egyptian mobile", () => {
    expect(checkSlug("qa-probe-shop")).toBeNull();
    expect(checkSlug("Bad Slug!")).toBe("slug");
    expect(checkEmail("owner@shop.eg")).toBeNull();
    expect(checkEmail("owner@")).toBe("email");
    expect(checkEgyptMobile("01012345678")).toBeNull();
    expect(checkEgyptMobile("+20 101 234 5678")).toBeNull();
    expect(checkEgyptMobile("123")).toBe("mobile");
    expect(checkEgyptMobile("")).toBeNull();
  });

  it("fills the range into the sentence", () => {
    const copy = {
      required: "r",
      money: "m",
      wholeNumber: "{min}–{max}",
      slug: "s",
      email: "e",
      mobile: "p",
    };
    expect(problemText(copy, "wholeNumber", { min: 1, max: 31 })).toBe("1–31");
    expect(problemText(copy, null)).toBeNull();
  });
});

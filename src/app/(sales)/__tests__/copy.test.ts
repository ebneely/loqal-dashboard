/**
 * The sales catalogue's own shape and quality checks.
 *
 * `src/messages/__tests__/messages.test.ts` already compares the whole `en`
 * against the whole `ar`. This file is narrower and harder: it asserts things
 * about the SALES namespace that a key-set comparison cannot catch — an English
 * sentence pasted into the Arabic file, an empty string standing in for a
 * translation somebody meant to come back to, and the specific sentences the
 * authorization screens depend on existing at all.
 *
 * It lives here rather than in src/messages/__tests__ because it is this
 * console's contract with its own copy, and because that directory belongs to
 * whoever owns the catalogue as a whole.
 */
import { describe, expect, it } from "vitest";

import { salesAr } from "@/messages/sales.ar";
import { salesEn } from "@/messages/sales.en";

const keys = Object.keys(salesEn) as (keyof typeof salesEn)[];

describe("the two sales catalogues are the same shape", () => {
  it("has identical key sets", () => {
    expect(Object.keys(salesAr).sort()).toEqual(keys.slice().sort());
  });

  it("has no empty string in either language", () => {
    for (const key of keys) {
      expect(salesEn[key], `en.${key}`).not.toBe("");
      expect(salesAr[key], `ar.${key}`).not.toBe("");
    }
  });

  it("has a string, never a nested object, for every key", () => {
    for (const key of keys) {
      expect(typeof salesEn[key], `en.${key}`).toBe("string");
      expect(typeof salesAr[key], `ar.${key}`).toBe("string");
    }
  });
});

describe("nothing was left untranslated", () => {
  /**
   * A copied-across English sentence is the failure a key-set comparison cannot
   * see: the shapes match perfectly and an Arabic-reading rep gets English at
   * the exact moment they need to act.
   *
   * Keys whose value is legitimately identical across languages — a brand name,
   * a code — would be listed here. There are none today, and adding one should
   * be a deliberate act.
   */
  const IDENTICAL_BY_DESIGN: string[] = [];

  it("never repeats the English string verbatim in Arabic", () => {
    for (const key of keys) {
      if (IDENTICAL_BY_DESIGN.includes(key)) continue;
      expect(salesAr[key], `ar.${key} is still the English string`).not.toBe(
        salesEn[key]
      );
    }
  });

  it("writes Arabic in Arabic script", () => {
    const arabic = /[؀-ۿ]/;
    for (const key of keys) {
      if (IDENTICAL_BY_DESIGN.includes(key)) continue;
      expect(arabic.test(salesAr[key]), `ar.${key} has no Arabic in it`).toBe(
        true
      );
    }
  });
});

describe("the sentences the authorization screens cannot work without", () => {
  /**
   * Each of these describes a refusal the backend actually makes. A screen that
   * loses one of them goes back to being a button that answers 404.
   */
  const REQUIRED = [
    "signedHereOnlyTitle",
    "signedHereOnlyBody",
    "cannotPriceChip",
    "notYoursTitle",
    "notYoursBody",
    "leadNotClosedTitle",
    "leadNotClosedBody",
    "fileOnlyRepNote",
    "createdBoundNote",
    "payoutNotHere",
    "fixedChargeNote",
    "violationsHiddenNote",
  ] as const;

  it("are all present in both languages", () => {
    for (const key of REQUIRED) {
      expect(salesEn[key], `en.${key}`).toBeTruthy();
      expect(salesAr[key], `ar.${key}`).toBeTruthy();
    }
  });

  /**
   * The one sentence that has to say the thing nobody wants to hear. If it
   * stops mentioning the admin, a rep files leads all week believing the offer
   * comes back to them.
   */
  it("warn, in the file-a-lead branch, that the approver takes the offer", () => {
    expect(salesEn.fileOnlyRepNote.toLowerCase()).toContain("admin");
  });
});

describe("placeholders survive translation", () => {
  /**
   * `{n}`, `{a}`, `{b}` and `{name}` are substituted at render time. A
   * translation that drops one renders the literal brace to a shop owner; one
   * that adds a new one renders a token that is never replaced.
   */
  const placeholders = (value: string) =>
    (value.match(/\{[a-zA-Z]+\}/g) ?? []).slice().sort();

  it("carry the same tokens in both languages", () => {
    for (const key of keys) {
      expect(placeholders(salesAr[key]), `ar.${key}`).toEqual(
        placeholders(salesEn[key])
      );
    }
  });
});

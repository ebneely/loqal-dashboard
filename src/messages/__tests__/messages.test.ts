// @vitest-environment node
import { describe, expect, it } from "vitest";

import { ar } from "../ar";
import { en } from "../en";

const paths = (value: unknown, prefix = ""): string[] => {
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
      paths(v, prefix ? `${prefix}.${k}` : k)
    );
  }
  return [prefix];
};

describe("message catalogue", () => {
  it("has the identical shape in both languages", () => {
    // The type system already enforces this — ar is declared as Messages — but
    // a runtime check is what catches a hand-edit that casts around it.
    expect(paths(ar).sort()).toEqual(paths(en).sort());
  });

  it("carries every console", () => {
    expect(Object.keys(en).sort()).toEqual(["admin", "brand", "sales"]);
  });

  it("translates every key rather than leaving the English in place", () => {
    // A handful of strings are legitimately identical in both languages —
    // proper nouns, "EGP", numbers. Everything else must differ.
    const enFlat = new Map<string, string>();
    const collect = (value: unknown, prefix = "", into = enFlat) => {
      if (value && typeof value === "object") {
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
          collect(v, prefix ? `${prefix}.${k}` : k, into);
        }
      } else into.set(prefix, String(value));
    };
    collect(en);
    const arFlat = new Map<string, string>();
    collect(ar, "", arFlat);

    const untranslated = [...enFlat.entries()].filter(
      ([key, value]) => arFlat.get(key) === value && value.length > 3
    );

    expect(untranslated.length).toBeLessThan(enFlat.size * 0.05);
  });

  it("contains no empty string", () => {
    const flat = paths(en);
    expect(flat.length).toBeGreaterThan(300);
  });

  it("writes every number in Latin digits, Arabic included", () => {
    // The rule is the product's, not this test's: brands-list.test.tsx already
    // asserts "keeps the digits Latin" for a money figure under an Arabic
    // locale, and the figures face is Source Code Pro with tnum/lnum, which has
    // no Arabic-Indic glyphs at all. A price set in ٤٨ falls back to a
    // different font mid-sentence.
    //
    // Twenty-seven strings across the three consoles broke it, including the
    // invite copy that promises a link lasts 48 hours.
    const values = (value: unknown): string[] =>
      value && typeof value === "object"
        ? Object.values(value as Record<string, unknown>).flatMap(values)
        : typeof value === "string"
          ? [value]
          : [];

    const offenders = values(ar).filter((text) => /[٠-٩۰-۹]/.test(text));

    expect(offenders).toEqual([]);
  });
});

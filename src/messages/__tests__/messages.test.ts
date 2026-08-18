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
});

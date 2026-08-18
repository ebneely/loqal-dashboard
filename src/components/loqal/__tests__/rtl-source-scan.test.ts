// @vitest-environment node
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(process.cwd(), "src", "components", "loqal");

async function tsxFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const found: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await tsxFiles(full)));
    else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts"))
      found.push(full);
  }
  return found;
}

describe("domain components are direction-agnostic", () => {
  /**
   * The whole class of RTL bug, caught by one scan.
   *
   * `pl-4` on a card is invisible in English and wrong in Arabic, and it is
   * wrong in a way nobody notices until a shop owner in Cairo says the screen
   * "looks crooked". Logical properties — ps/pe/ms/me/start/end — flip
   * themselves, so the rule is simply that the physical ones never appear.
   */
  it("uses no physical-direction spacing utility", async () => {
    const files = (await tsxFiles(ROOT)).filter(
      (file) => !file.includes("__tests__")
    );

    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const source = await readFile(file, "utf8");
      expect(source, `${file} uses a physical spacing utility`).not.toMatch(
        /\b(pl|pr|ml|mr)-\d/
      );
    }
  });

  it("uses no space-x, which is directional and looks like it is not", async () => {
    /**
     * The hole this closes. `space-x-2` reads like a neutral horizontal gap and
     * is not: it compiles to `margin-inline-start` on every child but the
     * first, so in Arabic the gap lands on the wrong side of every item in the
     * row and the last one hugs the edge. `gap-x-*` is the direction-agnostic
     * answer and is what flex and grid want anyway.
     *
     * Negative variants count — `-space-x-2` is how shadcn's own AvatarGroup
     * overlaps avatars, and it overlaps them the wrong way round in RTL.
     */
    const files = (await tsxFiles(ROOT)).filter(
      (file) => !file.includes("__tests__")
    );

    for (const file of files) {
      const source = await readFile(file, "utf8");
      expect(source, `${file} uses space-x — use gap-x`).not.toMatch(
        /-?\bspace-x-/
      );
    }
  });

  it("uses no physical border, radius or float", async () => {
    // The same class of bug one level down: a border or a rounded corner pinned
    // to a physical side stays on that side when the layout mirrors.
    const files = (await tsxFiles(ROOT)).filter(
      (file) => !file.includes("__tests__")
    );

    for (const file of files) {
      const source = await readFile(file, "utf8");
      expect(source, `${file} pins a border or radius physically`).not.toMatch(
        /\b-?(border|rounded)-(l|r|tl|tr|bl|br)\b/
      );
      expect(source, `${file} floats physically`).not.toMatch(
        /\bfloat-(left|right)\b/
      );
    }
  });

  it("uses no physical inset or text alignment", async () => {
    const files = (await tsxFiles(ROOT)).filter(
      (file) => !file.includes("__tests__")
    );

    for (const file of files) {
      const source = await readFile(file, "utf8");
      expect(source, `${file} pins to a physical edge`).not.toMatch(
        /className=(?:"|`|{`)[^"`]*\b(left|right)-\d/
      );
      expect(source, `${file} aligns text physically`).not.toMatch(
        /\btext-(left|right)\b/
      );
    }
  });
});

// @vitest-environment node
/**
 * The same direction scan the domain layer runs, extended over the routes.
 *
 * `src/components/loqal/__tests__/rtl-source-scan.test.ts` only walks
 * src/components/loqal, so every screen folder added after it was unguarded.
 * A `pl-4` in a route is invisible in English and crooked in Arabic, and it
 * stays that way until a shop owner in Cairo mentions it.
 *
 * Node environment on purpose: it reads files and renders nothing, so it still
 * reports honestly when the React tree is mid-repair.
 */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(process.cwd(), "src", "app");

async function sourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const found: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await sourceFiles(full)));
    else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts"))
      found.push(full);
  }
  return found;
}

/**
 * Read once, in parallel, and share it across every test in this file.
 *
 * This walked the tree and read every file sequentially, once per test. That
 * was fine at one console and timed out at three — the admin and sales routes
 * pushed it past the 5s default. A guard that fails because the codebase grew
 * teaches everyone to raise the timeout, so it reads concurrently instead.
 */
let cache: Promise<[string, string][]> | null = null;

const shipped = () =>
  (cache ??= sourceFiles(ROOT).then((files) =>
    Promise.all(
      files
        .filter((file) => !file.includes("__tests__"))
        .map(async (file) => [file, await readFile(file, "utf8")] as [string, string])
    )
  ));

describe("route source is direction-agnostic", () => {
  it("uses no physical-direction spacing utility", async () => {
    const files = await shipped();
    expect(files.length).toBeGreaterThan(0);

    for (const [file, source] of files) {
      expect(source, `${file} uses a physical spacing utility`).not.toMatch(
        /\b(pl|pr|ml|mr)-\d/
      );
    }
  });

  it("uses no physical inset or text alignment", async () => {
    for (const [file, source] of await shipped()) {
      expect(source, `${file} pins to a physical edge`).not.toMatch(
        /className=(?:"|`|{`)[^"`]*\b(left|right)-\d/
      );
      expect(source, `${file} aligns text physically`).not.toMatch(
        /\btext-(left|right)\b/
      );
    }
  });
});

describe("route source ships no fixtures", () => {
  /**
   * The design system's copy is full of a real-looking shop — Salma Fouad at
   * nefertari.eg, a phone number, an address. It is fine in a design file and
   * it is not fine in a build, where it looks like data until someone tries to
   * call it.
   */
  it("carries no sample shopper, mailbox or phone number", async () => {
    for (const [file, source] of await shipped()) {
      const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
      expect(code, `${file} ships a sample email address`).not.toMatch(
        /["'`][\w.+-]+@[\w-]+\.[a-z]{2,}["'`]/i
      );
      expect(code, `${file} ships a sample Egyptian phone number`).not.toMatch(
        /01[0-2,5]\s?\d{4}\s?\d{4}/
      );
    }
  });
});

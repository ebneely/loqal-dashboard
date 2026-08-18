import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

/**
 * Testing Library only registers its own afterEach when the test globals are
 * injected, and this project runs without them. Without this line every render
 * piles up in the same document and `getByRole` starts matching a button from
 * two tests ago — which fails in a way that looks like a component bug.
 */
afterEach(cleanup);

/**
 * jsdom implements no media queries at all, and shadcn's Sidebar asks for one
 * on mount to decide whether it is a sidebar or a Sheet. Without this every
 * shell test dies inside a component nobody is testing.
 *
 * The default answer is "not a phone", which matches jsdom's 1024px window;
 * a test that wants the phone rendering sets window.innerWidth and dispatches
 * a change itself.
 */
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

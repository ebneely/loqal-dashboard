"use client";

import { useEffect, useState } from "react";

/**
 * Whether this reader has asked for less motion.
 *
 * PROMOTED from `components/loqal/invite-result.tsx`, which wrote it for the
 * same reason the charts need it: `globals.css` clamps animation *durations*
 * under `prefers-reduced-motion`, and a clamped duration is still an animation.
 * A recharts series animates by interpolating its own path data in JavaScript,
 * which no stylesheet can reach at all.
 *
 * Defaults to `false` — motion on — because that is what the majority setting
 * is and because a chart that never animates for anyone is the safer bug, not
 * the better one. The `matchMedia?.` guard is for jsdom, which implements no
 * media queries; `vitest.setup.ts` stubs it to `matches: false`, so tests see
 * the animated path, which is the one worth testing.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!query) return;

    setReduced(query.matches);

    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener?.("change", onChange);
    return () => query.removeEventListener?.("change", onChange);
  }, []);

  return reduced;
}

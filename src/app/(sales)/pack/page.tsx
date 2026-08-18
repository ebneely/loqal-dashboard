"use client";

/**
 * The route file, and nothing else — a `page.tsx` may export a default plus
 * route config and NOTHING besides, so the screen and its data layer live in
 * sibling files.
 */
import { PackScreen } from "./pack-screen";

export default function PackPage() {
  return <PackScreen />;
}

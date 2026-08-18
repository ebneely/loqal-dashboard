"use client";

/**
 * The route file, and nothing else.
 *
 * Two constraints meet here, the same two the orders route hit. A Next
 * `page.tsx` may export a default and a fixed set of route options and NOTHING
 * else — an extra named export fails `next build` with a type error about an
 * index signature that never mentions exports — so the screen lives in
 * `money-screen.tsx`. And the tab is held in the URL, which means
 * `useSearchParams`, which without a Suspense boundary makes Next refuse to
 * prerender this route at all.
 */
import { Suspense } from "react";

import { ListState } from "@/components/loqal";

import { MoneyScreen } from "./money-screen";

export default function MoneyPage() {
  return (
    <Suspense fallback={<ListState state="loading" rows={3} />}>
      <MoneyScreen />
    </Suspense>
  );
}

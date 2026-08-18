"use client";

/**
 * The route file, and nothing else.
 *
 * Two constraints meet here. A Next `page.tsx` may export a default and a fixed
 * set of route options and NOTHING else — an extra named export fails
 * `next build` with a type error about an index signature that never mentions
 * exports — so the screen itself lives in `orders-screen.tsx`. And the status
 * filter reads `useSearchParams`, which without a Suspense boundary makes Next
 * refuse to prerender this route at all.
 */
import { Suspense } from "react";

import { ListState } from "@/components/loqal";

import { OrdersScreen } from "./orders-screen";

export default function OrdersPage() {
  return (
    <Suspense fallback={<ListState state="loading" rows={4} />}>
      <OrdersScreen />
    </Suspense>
  );
}

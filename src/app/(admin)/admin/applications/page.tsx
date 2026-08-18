"use client";

/**
 * The route file, and nothing else.
 *
 * A Next `page.tsx` may export a default and a fixed set of route options and
 * NOTHING else — an extra named export fails `next build` with a type error
 * about an index signature that never mentions exports — so the screen lives in
 * `applications-screen.tsx`. And the status filter reads `useSearchParams`,
 * which without a Suspense boundary makes Next refuse to prerender this route.
 */
import { Suspense } from "react";

import { ListState } from "@/components/loqal";

import { ApplicationsScreen } from "./applications-screen";

export default function ApplicationsPage() {
  return (
    <Suspense fallback={<ListState state="loading" rows={3} />}>
      <ApplicationsScreen />
    </Suspense>
  );
}

"use client";

/**
 * The route file, and nothing else — the status and brand filters read
 * `useSearchParams`, which without a Suspense boundary makes Next refuse to
 * prerender this route.
 */
import { Suspense } from "react";

import { ListState } from "@/components/loqal";

import { SettlementsScreen } from "./settlements-screen";

export default function AdminSettlementsPage() {
  return (
    <Suspense fallback={<ListState state="loading" rows={4} />}>
      <SettlementsScreen />
    </Suspense>
  );
}

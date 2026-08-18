"use client";

/**
 * The route file, and nothing else — the filters read `useSearchParams`, which
 * without a Suspense boundary makes Next refuse to prerender this route.
 */
import { Suspense } from "react";

import { ListState } from "@/components/loqal";

import { ImportsScreen } from "./imports-screen";

export default function AdminImportsPage() {
  return (
    <Suspense fallback={<ListState state="loading" rows={4} />}>
      <ImportsScreen />
    </Suspense>
  );
}

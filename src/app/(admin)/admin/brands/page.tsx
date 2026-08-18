"use client";

/**
 * The route file, and nothing else — the status, search and sort controls read
 * `useSearchParams`, which without a Suspense boundary makes Next refuse to
 * prerender this route. Helpers live in the sibling files; a `page.tsx` may
 * export only a default plus route config.
 */
import { Suspense } from "react";

import { ListState } from "@/components/loqal";

import { BrandsScreen } from "./brands-screen";

export default function BrandsPage() {
  return (
    <Suspense fallback={<ListState state="loading" rows={4} />}>
      <BrandsScreen />
    </Suspense>
  );
}

"use client";

/**
 * The route file, and nothing else — a Next `page.tsx` may export a default and
 * route options and NOTHING besides. The status filter reads
 * `useSearchParams`, which without a Suspense boundary makes Next refuse to
 * prerender this route at all.
 */
import { Suspense } from "react";

import { ListState } from "@/components/loqal";

import { ReturnsScreen } from "./returns-screen";

export default function ReturnsPage() {
  return (
    <Suspense fallback={<ListState state="loading" rows={3} />}>
      <ReturnsScreen />
    </Suspense>
  );
}

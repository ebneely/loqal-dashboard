"use client";

/**
 * The route file, and nothing else.
 *
 * `useSearchParams` suspends during prerender, so the screen sits inside a
 * Suspense boundary — without one `next build` fails this route outright.
 */
import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";

import { TermsScreen } from "./terms-screen";

export default function TermsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <TermsScreen />
    </Suspense>
  );
}

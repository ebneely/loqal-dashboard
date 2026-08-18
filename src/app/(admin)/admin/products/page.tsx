"use client";

/**
 * The route file, and nothing else — the filters and the page number read
 * `useSearchParams`, which without a Suspense boundary makes Next refuse to
 * prerender this route.
 */
import { Suspense } from "react";

import { ListState } from "@/components/loqal";

import { ProductsScreen } from "./products-screen";

export default function AdminProductsPage() {
  return (
    <Suspense fallback={<ListState state="loading" rows={4} />}>
      <ProductsScreen />
    </Suspense>
  );
}

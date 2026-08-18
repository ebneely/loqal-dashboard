/**
 * The route file, and nothing else.
 *
 * A Next `page.tsx` may export a default and a fixed set of route options and
 * NOTHING besides — an extra named export fails `next build` with a type error
 * about an index signature that never mentions exports — so the screen lives in
 * `products-screen.tsx`. And the status and category filters read
 * `useSearchParams`, which without a Suspense boundary makes Next refuse to
 * prerender this route at all.
 */
import { Suspense } from "react";

import { ListState } from "@/components/loqal";

import { ProductsScreen } from "./products-screen";

export default function ProductsPage() {
  return (
    <Suspense fallback={<ListState state="loading" rows={4} />}>
      <ProductsScreen />
    </Suspense>
  );
}

/**
 * The route file, and nothing else.
 *
 * A Next `page.tsx` may export a default and route options and NOTHING besides,
 * so the screen lives in `inventory-screen.tsx`. The selected variant is read
 * from `useSearchParams` — which without a Suspense boundary makes Next refuse
 * to prerender this route at all.
 */
import { Suspense } from "react";

import { ListState } from "@/components/loqal";

import { InventoryScreen } from "./inventory-screen";

export default function InventoryPage() {
  return (
    <Suspense fallback={<ListState state="loading" rows={4} />}>
      <InventoryScreen />
    </Suspense>
  );
}

"use client";

/**
 * The route file, and nothing else. The status filter reads `useSearchParams`,
 * which without a Suspense boundary makes Next refuse to prerender this route.
 */
import { Suspense } from "react";

import { ListState } from "@/components/loqal";

import { OrdersScreen } from "./orders-screen";

export default function AdminOrdersPage() {
  return (
    <Suspense fallback={<ListState state="loading" rows={4} />}>
      <OrdersScreen />
    </Suspense>
  );
}

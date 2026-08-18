/**
 * The route file, and nothing else. A server component purely to unwrap
 * `params`, which is a promise in Next 15 — doing it here keeps the screen a
 * plain client component taking a string, which is also what makes it testable
 * without a router.
 */
import { AdminOrderDetailScreen } from "./order-detail";

export default async function AdminOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AdminOrderDetailScreen id={id} />;
}

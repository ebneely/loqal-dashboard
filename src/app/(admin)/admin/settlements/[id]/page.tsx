/**
 * The route file, and nothing else. A server component purely to unwrap
 * `params`, which is a promise in Next 15.
 */
import { SettlementRunDetailScreen } from "./run-detail";

export default async function AdminSettlementRunPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SettlementRunDetailScreen id={id} />;
}

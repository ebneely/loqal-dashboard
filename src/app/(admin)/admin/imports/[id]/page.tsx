/**
 * The route file, and nothing else. A server component purely to unwrap
 * `params`, which is a promise in Next 15.
 */
import { ImportJobReview } from "./job-review";

export default async function AdminImportJobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ImportJobReview id={id} />;
}

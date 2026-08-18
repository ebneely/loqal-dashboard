/**
 * The route file, and nothing else — a Next `page.tsx` may export a default and
 * route options and NOTHING besides, so the screen lives beside it.
 *
 * A server component purely to unwrap `params`, which is a promise in Next 15.
 * Doing it here keeps `ThreadView` a plain client component taking a string,
 * which is also what makes it testable without a router.
 */
import { ThreadView } from "./thread-view";

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = await params;
  return <ThreadView threadId={threadId} />;
}

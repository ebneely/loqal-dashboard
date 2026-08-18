/**
 * The route file, and nothing else.
 *
 * A Next `page.tsx` may export a default and a fixed set of route options and
 * NOTHING besides — an extra named export fails `next build` with a type error
 * about an index signature that never mentions exports — so the screen itself
 * lives in `threads-screen.tsx`.
 */
import { ThreadsScreen } from "./threads-screen";

export default function ChatPage() {
  return <ThreadsScreen />;
}

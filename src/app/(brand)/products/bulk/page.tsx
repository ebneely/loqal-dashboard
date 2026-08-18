/**
 * The route file, and nothing else — a Next `page.tsx` may export a default and
 * route options and NOTHING besides, so the screen lives in `bulk-screen.tsx`.
 */
import { BulkScreen } from "./bulk-screen";

export default function BulkPage() {
  return <BulkScreen />;
}

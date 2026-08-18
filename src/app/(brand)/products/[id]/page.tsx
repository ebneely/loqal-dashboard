/**
 * The route file, and nothing else — a Next `page.tsx` may export a default and
 * route options and NOTHING besides.
 *
 * A server component purely to unwrap `params`, which is a promise in Next 15.
 * Doing it here keeps `ProductEditor` a plain client component taking a string,
 * which is also what makes it testable without a router.
 */
import { ProductEditor } from "./product-editor";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProductEditor id={id} />;
}

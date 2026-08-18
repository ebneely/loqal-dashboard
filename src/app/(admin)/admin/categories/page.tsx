"use client";

/**
 * The route file, and nothing else — a `page.tsx` may export a default plus
 * route config and NOTHING besides, so the screen and the tree builder live in
 * sibling files.
 */
import { CategoriesScreen } from "./categories-screen";

export default function CategoriesPage() {
  return <CategoriesScreen />;
}

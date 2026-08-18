"use client";

/**
 * The route file, and nothing else.
 *
 * A Next `page.tsx` may export a default and a fixed set of route options and
 * NOTHING else — an extra named export fails `next build` with a type error
 * about an index signature that never mentions exports — so the screen lives in
 * `settings-screen.tsx` and the rules beside it.
 */
import { SettingsScreen } from "./settings-screen";

export default function SettingsPage() {
  return <SettingsScreen />;
}

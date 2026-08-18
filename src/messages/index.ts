/**
 * The message catalogue.
 *
 * en.ts and ar.ts are lifted verbatim from ClaudeDesignSystem/*.dc.html, which
 * is read-only. ar is typed as `Messages` — the exact shape of `en` — so the
 * two cannot drift: a key added to one and not the other is a type error rather
 * than an English word appearing mid-sentence on an Arabic screen.
 */
import type { Locale } from "@/lib/locale";

import { ar } from "./ar";
import { en, type Messages } from "./en";

export type { Messages } from "./en";
export { en } from "./en";
export { ar } from "./ar";

export const messages: Record<Locale, Messages> = { en, ar };

export const getMessages = (locale: Locale): Messages => messages[locale];

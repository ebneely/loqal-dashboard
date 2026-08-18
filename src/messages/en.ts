/**
 * The message catalogue — composition root.
 *
 * The actual copy lives in three per-console files (`brand.en.ts`,
 * `admin.en.ts`, `sales.en.ts`), split out of what used to be one 1400-line
 * monolith so that concurrent agents working on different consoles don't
 * collide on the same file. This module only assembles them.
 *
 * The shape of `en` is the contract: `Messages` is `typeof en`, and ar.ts's
 * three per-console files are each declared against their English
 * counterpart, so a key added to one language without the other fails
 * typecheck instead of rendering an English word inside an Arabic screen.
 */
import { adminEn } from "./admin.en";
import { brandEn } from "./brand.en";
import { salesEn } from "./sales.en";

export const en = {
  brand: brandEn,
  admin: adminEn,
  sales: salesEn,
};

export type Messages = typeof en;
export type MessageNamespace = keyof Messages;

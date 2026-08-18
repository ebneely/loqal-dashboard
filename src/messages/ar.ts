/**
 * Arabic copy — composition root.
 *
 * The actual copy lives in three per-console files (`brand.ar.ts`,
 * `admin.ar.ts`, `sales.ar.ts`), split out of what used to be one monolith
 * for the same reason en.ts is split — see en.ts. This module only
 * assembles them.
 *
 * Typed as `Messages` — the exact shape of `en` — so the two catalogues
 * cannot drift apart. A missing key is a type error, and so is an extra one.
 */
import type { Messages } from "./en";

import { adminAr } from "./admin.ar";
import { brandAr } from "./brand.ar";
import { salesAr } from "./sales.ar";

export const ar: Messages = {
  brand: brandAr,
  admin: adminAr,
  sales: salesAr,
};

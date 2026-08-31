"use client";

/**
 * What /admin/brands reads.
 *
 * THE ROW IS THE CONTRACT'S, WIDENED BY EXACTLY THREE OPTIONAL FIELDS.
 *
 * `adminBrandListItemSchema` is `.strict()` and carries id, name, slug, status,
 * grossSales, balance and badgeCounts. The brief says the row also carries
 * `isPromoted`, `featuredUntil` and `sortOrder` — and it does not, today:
 * `BrandsRepository.ADMIN_LIST_FIELDS` selects four columns, and the contract
 * package says so out loud in `brandPlacementSchema`'s header ("BACKEND GAP:
 * isPromoted and featuredUntil are on the brand row but on neither admin
 * projection, so nothing can currently render the label that makes paid
 * placement honest").
 *
 * Three ways out, and only one of them is honest:
 *
 *  1. Edit the contract. Not mine to edit, and it would describe a response
 *     that does not exist.
 *  2. Parse with the strict schema as it stands. The screen then cannot label a
 *     promoted brand at all — and worse, the day the backend DOES add the
 *     fields, `.strict()` makes every row fail to parse and the list goes
 *     blank. A contract that breaks on the fix is not protection.
 *  3. Extend it here, optionally. Unknown keys are still refused, so drift is
 *     still caught; the three placement fields are accepted the moment they
 *     appear and are `undefined` until then. `undefined` is a THIRD state the
 *     screen renders in words — "not returned by this list" — rather than
 *     collapsing into "not promoted", which would be a claim nobody made.
 *
 * This file takes the third. The extension deletes itself the day
 * `adminBrandListItemSchema` grows the fields for real.
 */
import { z } from "zod";

import { adminBrandListItemSchema } from "@loqal/contracts/brand.contract";
import type { BrandStatus } from "@loqal/contracts/enums";
import { pageSchema } from "@loqal/contracts/pagination";

import { api } from "@/lib/api";
import { useCursorFeed, type CursorFeed } from "@/lib/resource";

export const adminBrandRowSchema = adminBrandListItemSchema.extend({
  isPromoted: z.boolean().optional(),
  featuredUntil: z.string().datetime().nullable().optional(),
  sortOrder: z.number().int().optional(),
});

export type AdminBrandRow = z.infer<typeof adminBrandRowSchema>;

export const adminBrandRowPageSchema = pageSchema(adminBrandRowSchema);

export const BRANDS_PAGE_SIZE = 20;

/**
 * `status` and `search` are the endpoint's own query parameters
 * (`listAdminBrandsQuerySchema`), so they are sent rather than applied here —
 * unlike /admin/applications, where there is no query string to send them to.
 * They are also the feed KEY, so changing either starts a new list rather than
 * appending a filtered page onto an unfiltered one.
 *
 * `enabled` exists for the Start-an-import dialog, which mounts closed on
 * /admin/imports and must not fetch every brand for a dialog nobody opened.
 */
export function useAdminBrands(
  status: BrandStatus | null,
  search: string,
  enabled = true
): CursorFeed<AdminBrandRow> {
  return useCursorFeed(
    `admin-brands:${status ?? ""}:${search}`,
    enabled,
    (cursor, signal) =>
      api.get(adminBrandRowPageSchema, "/v1/admin/brands", {
        query: {
          status: status ?? undefined,
          search: search || undefined,
          cursor: cursor ?? undefined,
          limit: BRANDS_PAGE_SIZE,
        },
        signal,
      })
  );
}

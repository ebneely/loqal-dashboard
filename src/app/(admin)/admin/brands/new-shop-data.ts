"use client";

/**
 * What Add-a-shop writes, and what it reads back.
 *
 * `checkSlug` is deliberately absent. The file-structure table in the plan
 * lists one, but no endpoint answers "is this address free?" — nothing in the
 * API surface offers it, so a client-side check could only be a guess dressed
 * as an answer. The real check is the 409 the create returns, which the sheet
 * shows under the slug field. `slugChecking` and `slugFree` are shipped copy
 * waiting for that endpoint to exist.
 */
import { z } from "zod";

import { api } from "@/lib/api";
import { bodyFrom, type NewShopDraft } from "./new-shop-form";

export const deliveryOutcomeSchema = z.enum([
  "sent",
  "skipped",
  "failed",
  "not-configured",
]);
export type DeliveryOutcome = z.infer<typeof deliveryOutcomeSchema>;

export const inviteResultSchema = z.object({
  userId: z.string(),
  inviteUrl: z.string(),
  delivery: z.object({
    whatsapp: deliveryOutcomeSchema,
    email: deliveryOutcomeSchema,
  }),
});
export type InviteResultPayload = z.infer<typeof inviteResultSchema>;

/**
 * Not `.strict()`. This reads a WRITE's response, and a field added to the
 * brand payload later must not turn a shop that WAS created into an error
 * screen — the write already happened by the time this parses, and an admin
 * shown a failure would create the shop a second time.
 */
export const createShopResultSchema = z.object({
  brand: z.object({ id: z.string(), name: z.string(), slug: z.string() }),
  invite: inviteResultSchema.nullable(),
});
export type CreateShopResult = z.infer<typeof createShopResultSchema>;

export const createShop = (draft: NewShopDraft): Promise<CreateShopResult> =>
  api.post(createShopResultSchema, "/v1/brands", bodyFrom(draft));

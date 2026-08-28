"use client";

/**
 * What Add-a-shop writes, and what it reads back.
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

export const slugAvailableSchema = z.object({ available: z.boolean() });

/**
 * Whether an address is free — a courtesy, not the guard.
 *
 * It reads a replica, so a slug taken microseconds ago still reads as free.
 * `Brand.slug` is unique and the create still answers 409, which is what makes
 * the sheet correct; this only saves the admin a submit that would have thrown
 * away a form holding the owner's name, email and phone too.
 */
export const checkSlug = (slug: string, signal?: AbortSignal) =>
  api.get(slugAvailableSchema, "/v1/admin/brands/slug-available", {
    query: { slug },
    signal,
  });

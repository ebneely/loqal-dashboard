"use client";

/**
 * Everything /admin/reviews reads and writes.
 *
 * `GET /v1/admin/reviews?cursor=&hidden=&brandId=` lists reviews, newest first,
 * cursor-paged like every other admin list. It is new: an API that predates it
 * answers 404, and the screen then falls back to hiding one review by id — the
 * only thing the older API can do. Every field past the core ones defaults, so
 * a row missing one still renders.
 *
 * Hiding answers the updated Review row, which nothing reads — the list is
 * reloaded instead, so it is parsed as unknown.
 */
import { z } from "zod";

import { pageSchema } from "@loqal/contracts/pagination";

import { api } from "@/lib/api";
import { useCursorFeed, type CursorFeed } from "@/lib/resource";

const REVIEWS_PATH = "/v1/admin/reviews";

export const adminReviewSchema = z.object({
  id: z.string(),
  brandId: z.string(),
  brandName: z.string().default(""),
  rating: z.number(),
  body: z.string().nullable().default(null),
  createdAt: z.string(),
  hiddenAt: z.string().nullable().default(null),
  hiddenReason: z.string().nullable().default(null),
  // A plain string, or a `{ body }` object — whichever the API settles on.
  brandReply: z
    .union([z.string(), z.looseObject({ body: z.string() })])
    .nullable()
    .default(null),
});

export type AdminReview = z.infer<typeof adminReviewSchema>;

export const adminReviewPageSchema = pageSchema(adminReviewSchema);

export type HiddenFilter = "all" | "visible" | "hidden";

export const isHiddenFilter = (value: string | null): value is HiddenFilter =>
  value === "all" || value === "visible" || value === "hidden";

/** 1–5 stars, or null for every rating. */
export const readRating = (raw: string | null): number | null =>
  raw !== null && /^[1-5]$/.test(raw) ? Number(raw) : null;

export function useAdminReviews(
  hidden: HiddenFilter,
  brandId: string,
  rating: number | null
): CursorFeed<AdminReview> {
  return useCursorFeed(
    `admin-reviews:${hidden}:${brandId}:${rating ?? ""}`,
    true,
    (cursor, signal) =>
      api.get(adminReviewPageSchema, REVIEWS_PATH, {
        signal,
        query: {
          cursor: cursor ?? undefined,
          // Omitted for "all" rather than sent as anything a boolean parser could misread.
          hidden: hidden === "all" ? undefined : hidden === "hidden" ? "true" : "false",
          brandId: brandId || undefined,
          rating: rating ?? undefined,
        },
      })
  );
}

export const replyText = (reply: AdminReview["brandReply"]): string | null =>
  reply === null ? null : typeof reply === "string" ? reply : reply.body;

/**
 * The reason, validated against the API's own rule BEFORE the request.
 *
 * `HideReviewDto` is `{ reason: string.trim().min(1).max(500) }` and `.strict()`.
 * The reason is mandatory rather than optional on purpose: a review is never
 * deleted and there is no lesser tier it could have been moved to, so an
 * accusation of censorship has to be answerable with the log.
 */
export const hideReviewBodySchema = z
  .object({ reason: z.string().trim().min(1).max(500) })
  .strict();

/** True when the reason as typed would be accepted. */
export const isHideable = (reason: string): boolean =>
  hideReviewBodySchema.safeParse({ reason }).success;

/**
 * A UUID, checked here so a mistyped id is refused with a sentence instead of
 * with a 404 that reads as "the review does not exist". Used by the by-id
 * fallback only.
 */
export const isReviewId = (id: string): boolean =>
  z.string().uuid().safeParse(id.trim()).success;

export const hideReview = (id: string, reason: string) =>
  api.post(
    z.unknown(),
    `${REVIEWS_PATH}/${id.trim()}/hide`,
    hideReviewBodySchema.parse({ reason })
  );

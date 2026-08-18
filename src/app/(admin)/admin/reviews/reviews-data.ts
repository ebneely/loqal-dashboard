"use client";

/**
 * Everything /admin/reviews can do, which is one thing.
 *
 * BACKEND GAP — THERE IS NO ADMIN ROUTE THAT LISTS REVIEWS.
 *
 * `ReviewsAdminController` has exactly one route: `POST
 * /admin/reviews/:id/hide`. There is no GET on this plane at all — not a list,
 * not a search, not a fetch-by-id. Reviews are readable per brand on the
 * storefront and inside a shop's own console, and neither of those is reachable
 * from an admin session.
 *
 * That is not a shape this file can work around, and it will not pretend to.
 * There is no schema here for a review, because nothing here ever receives one:
 * the screen takes an id somebody was sent, and hides it. Inventing a list by
 * walking every brand's public reviews would be a different product with
 * different permissions, built on the storefront's cache, and it would quietly
 * become the thing everybody relied on.
 *
 * The hide itself answers the updated Review row, which is not in the contract
 * package either — so it is parsed as unknown and discarded. The screen reports
 * that the row was hidden, which is the only fact the request establishes.
 */
import { z } from "zod";

import { api } from "@/lib/api";

const REVIEWS_PATH = "/v1/admin/reviews";

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
 * with a 404 that reads as "the review does not exist".
 */
export const isReviewId = (id: string): boolean =>
  z.string().uuid().safeParse(id.trim()).success;

export const hideReview = (id: string, reason: string) =>
  api.post(
    z.unknown(),
    `${REVIEWS_PATH}/${id.trim()}/hide`,
    hideReviewBodySchema.parse({ reason })
  );

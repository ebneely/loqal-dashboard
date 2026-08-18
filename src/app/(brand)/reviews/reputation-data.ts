"use client";

/**
 * What /reviews reads and writes.
 *
 * Two reads, deliberately, and never one merged figure:
 *
 *  `/v1/brands/me/reputation`  the reviews, and the paid-placement flags.
 *  `/v1/brands/me/badges`      every computed badge type with its progress,
 *                              plus the active verified badges.
 *
 * Both are bare objects rather than page envelopes — neither reviews nor badges
 * paginate — so `useResource` is the right hook and `useCursorFeed` would have
 * nothing to page. The reviews array in particular is unbounded: a shop with a
 * thousand delivered orders receives all of them in one response.
 *
 * The single write is the brand's public reply. It answers with the review as
 * it now stands, which is what the screen re-renders from — refetching the
 * whole list would race the write it just made, exactly as the order transition
 * endpoint is handled.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { api } from "@/lib/api";
import { useResource, type Resource } from "@/lib/resource";

import {
  brandBadgesSchema,
  brandReputationSchema,
  reviewSchema,
  type BrandBadges,
  type BrandReputation,
  type Review,
} from "./reputation-wire";

export type ReputationResource = Resource<BrandReputation> & {
  /** Reviews with any local reply already applied. */
  reviews: readonly Review[];
  /** Replace one review with what the reply endpoint answered. */
  applyReview: (review: Review) => void;
};

export function useBrandReputation(): ReputationResource {
  const resource = useResource("reputation", true, (signal) =>
    api.get(brandReputationSchema, "/v1/brands/me/reputation", { signal })
  );

  const [patched, setPatched] = useState<Record<string, Review>>({});

  const applyReview = useCallback((review: Review) => {
    setPatched((current) => ({ ...current, [review.id]: review }));
  }, []);

  const reviews = (resource.data?.reviews ?? []).map(
    (review) => patched[review.id] ?? review
  );

  return { ...resource, reviews, applyReview };
}

export function useBrandBadges(): Resource<BrandBadges> {
  return useResource("badges", true, (signal) =>
    api.get(brandBadgesSchema, "/v1/brands/me/badges", { signal })
  );
}

/**
 * The brand's one public reply.
 *
 * It never edits or removes the review — that is not an endpoint on any plane
 * for a brand, and the reply beside the review is a better answer than removal
 * because everybody sees both sides.
 */
export function useReviewReply() {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [failedId, setFailedId] = useState<string | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const reply = useCallback(
    async (reviewId: string, body: string): Promise<Review | null> => {
      const trimmed = body.trim();
      if (!trimmed) return null;

      setPendingId(reviewId);
      setFailedId(null);
      try {
        return await api.patch(
          reviewSchema,
          `/v1/brands/me/reputation/reviews/${reviewId}/reply`,
          { body: trimmed }
        );
      } catch {
        if (alive.current) setFailedId(reviewId);
        return null;
      } finally {
        if (alive.current) setPendingId(null);
      }
    },
    []
  );

  return { reply, pendingId, failedId };
}

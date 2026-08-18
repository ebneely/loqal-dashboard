"use client";

/**
 * Everything /admin/applications reads and writes.
 *
 * BACKEND GAP — THE ONE LIST WITH NO ENVELOPE.
 *
 * `GET /v1/admin/brand-applications` answers a BARE ARRAY. Not `{ items,
 * nextCursor }` like every other list in the system, not `{ items, total }` —
 * an array. It takes no cursor, no limit, no status and no search, and the
 * service behind it is `pending()`, so what arrives is every pending row there
 * has ever been, in one response, in whatever order the repository felt like.
 *
 * That is exactly backwards for the queue it serves. Applications are the list
 * that grows fastest the moment the sales push works, and they are the list
 * nobody deletes from — an approved or rejected row stays on the table forever.
 * A single unbounded response is fine at forty rows and is a five-second blank
 * screen at four thousand.
 *
 * Nothing on this side can fix that. What this file DOES do is refuse to
 * pretend otherwise:
 *
 *  - `useCursorFeed` is not used, because there is no cursor to feed it. The
 *    screen says so in words rather than drawing a "Load more" button that
 *    would be a lie about how the data arrived.
 *  - filtering and searching happen HERE, in the browser, over rows that are
 *    already in memory. They are deliberately written as pure functions so the
 *    day the endpoint grows a query string they move to it and delete
 *    themselves, and so the behaviour is testable without a DOM.
 */
import { z } from "zod";

import {
  brandApplicationSchema,
  rejectApplicationBodySchema,
  type BrandApplication,
} from "@loqal/contracts/admin.contract";
import type { BrandApplicationStatus } from "@loqal/contracts/enums";

import { api } from "@/lib/api";
import { useResource, type Resource } from "@/lib/resource";

/**
 * The bare array, named so the shape of the gap is visible at the call site.
 * `brandApplicationPageSchema` exists in the contract package and describes the
 * envelope this endpoint SHOULD have; parsing today's response with it would
 * fail on every request.
 */
export const brandApplicationListSchema = z.array(brandApplicationSchema);

const APPLICATIONS_PATH = "/v1/admin/brand-applications";

export function useBrandApplications(): Resource<readonly BrandApplication[]> {
  return useResource("admin-brand-applications", true, (signal) =>
    api.get(brandApplicationListSchema, APPLICATIONS_PATH, { signal })
  );
}

/**
 * Approve and reject both answer with the reviewed application, but the shapes
 * differ between the two services and neither is in the contract package. The
 * screen refetches rather than reading the body, so `unknown` is honest: it
 * parses anything, and nothing downstream is allowed to depend on it.
 */
const anyBody = z.unknown();

export const approveApplication = (id: string) =>
  api.post(anyBody, `${APPLICATIONS_PATH}/${id}/approve`);

/**
 * The reason is validated against the contract BEFORE the request, so an empty
 * one is refused by the screen with a sentence rather than by the API with a
 * 400 the reviewer has to interpret.
 */
export const rejectApplication = (id: string, reason: string) =>
  api.post(
    anyBody,
    `${APPLICATIONS_PATH}/${id}/reject`,
    rejectApplicationBodySchema.parse({ reason })
  );

/** True when the reason as typed would be accepted by the contract. */
export const isRejectable = (reason: string): boolean =>
  rejectApplicationBodySchema.safeParse({ reason }).success;

// ---------------------------------------------------------------------------
// The filtering the endpoint does not do
// ---------------------------------------------------------------------------

export type ApplicationFilter = {
  status: BrandApplicationStatus | null;
  search: string;
};

/**
 * Everything a reviewer might type into the search box, matched against
 * everything that identifies a shop — including the Instagram handle, because
 * for most of these shops that IS the storefront and it is often the only name
 * anybody at Loqal knows the shop by.
 */
const haystack = (row: BrandApplication) =>
  [
    row.businessName,
    row.ownerName,
    row.email,
    row.phone,
    row.instagramUrl ?? "",
    row.websiteUrl ?? "",
  ]
    .join(" ")
    .toLowerCase();

/** Oldest first: the queue is worked from the bottom, like every other queue. */
const byOldestFirst = (a: BrandApplication, b: BrandApplication) =>
  Date.parse(a.createdAt) - Date.parse(b.createdAt);

export function filterApplications(
  rows: readonly BrandApplication[],
  filter: ApplicationFilter
): BrandApplication[] {
  const needle = filter.search.trim().toLowerCase();
  return rows
    .filter((row) => (filter.status ? row.status === filter.status : true))
    .filter((row) => (needle ? haystack(row).includes(needle) : true))
    .sort(byOldestFirst);
}

/** How many rows sit in each status, for the filter's own labels. */
export function countByStatus(
  rows: readonly BrandApplication[]
): Record<BrandApplicationStatus, number> {
  const counts: Record<BrandApplicationStatus, number> = {
    PENDING: 0,
    APPROVED: 0,
    REJECTED: 0,
  };
  for (const row of rows) counts[row.status] += 1;
  return counts;
}

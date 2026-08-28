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
} from "@loqal/contracts/admin.contract";
import { moneySchema } from "@loqal/contracts/contracts";
import {
  PerOrderChargeTypeSchema,
  SettlementCadenceSchema,
  SettlementMethodSchema,
  type BrandApplicationStatus,
} from "@loqal/contracts/enums";

import { api } from "@/lib/api";
import { useResource, type Resource } from "@/lib/resource";

import { inviteResultSchema } from "../brands/new-shop-data";

/**
 * CONTRACT GAP: `brandApplicationSchema` predates the eleven columns
 * `BrandApplication` gained when the public door and the rep proposal landed.
 * It is not extended in the contract package because that package mirrors a
 * backend mid-migration, and this screen has to read a row from either side of
 * it.
 *
 * Every added field is OPTIONAL, and that is not caution — it is the shape of
 * the data. Three ways into Loqal write this one table: a public application
 * has no proposal at all, a rep filed one has all of it, and a row written
 * before the migration has neither. A required field here would be a claim
 * that one of those three does not exist.
 *
 * `email` becomes NULLABLE, which is the change that matters most. The join
 * form has no email field and most Egyptian small shops have only a phone, so
 * requiring one at the door would shut them out of the only self-service way
 * in. Approval still needs one — Better Auth cannot create a user without it —
 * and the approve sheet is where that requirement lands.
 *
 * Rebuilt from `.shape` rather than extended so the result STRIPS unknown keys
 * instead of refusing them. The contract package version is `.strict()`, which
 * was right while the table was stable; it just gained eleven columns in one
 * migration and will gain more, and a strict read turns the twelfth into an
 * empty review queue.
 */
export const adminBrandApplicationSchema = z.object({
  ...brandApplicationSchema.shape,

  email: z.string().email().nullable(),

  /** What the join form collects and the model had nowhere to put. */
  category: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  branchCount: z.number().int().nullable().optional(),

  /**
   * The rep who signed the shop. Distinct from `reviewedBy`, which is the
   * admin who decided it — they used to be one column, and binding a rep to
   * the reviewer would name the admin instead.
   */
  signedBy: z.string().nullable().optional(),

  /**
   * A PROPOSAL, NOT A FACT. Nothing here has reached a Brand; approval is what
   * applies it, and the admin may overrule any of it first.
   */
  proposedSlug: z.string().nullable().optional(),
  proposedFreeUntil: z.string().nullable().optional(),
  proposedMonthlyFee: moneySchema.nullable().optional(),
  proposedPerOrderChargeType: PerOrderChargeTypeSchema.nullable().optional(),
  proposedPerOrderChargeValue: moneySchema.nullable().optional(),
  proposedSettlementCadence: SettlementCadenceSchema.nullable().optional(),
  proposedSettlementAnchor: z.number().int().nullable().optional(),
  proposedSettlementMethod: SettlementMethodSchema.nullable().optional(),
});

export type AdminBrandApplication = z.infer<typeof adminBrandApplicationSchema>;

/**
 * The bare array, named so the shape of the gap is visible at the call site.
 * `brandApplicationPageSchema` exists in the contract package and describes the
 * envelope this endpoint SHOULD have; parsing today's response with it would
 * fail on every request.
 */
export const brandApplicationListSchema = z.array(
  adminBrandApplicationSchema
);

const APPLICATIONS_PATH = "/v1/admin/brand-applications";

export function useBrandApplications(): Resource<
  readonly AdminBrandApplication[]
> {
  return useResource("admin-brand-applications", true, (signal) =>
    api.get(brandApplicationListSchema, APPLICATIONS_PATH, { signal })
  );
}

/**
 * Reject answers with the reviewed application, whose shape is in no contract
 * and which nothing reads — the screen refetches instead. `unknown` is honest
 * there: it parses anything, and nothing downstream may depend on it.
 */
const anyBody = z.unknown();

/**
 * Approve is the exception, and it has to be.
 *
 * It now creates the shop, creates the owner and mints a one-time link, and
 * THE LINK IS IN THE RESPONSE AND NOWHERE ELSE. Refetching the queue and
 * throwing the body away would show the row as approved and would have
 * discarded the only copy of the credential the shop needs to be opened at all.
 *
 * Not strict, for the same reason `createShopResultSchema` is not: this reads a
 * WRITE response, and a field added to the brand payload later must not turn a
 * shop that WAS created into an error screen.
 */
export const approveResultSchema = z.object({
  brand: z.object({ id: z.string(), name: z.string(), slug: z.string() }),
  /**
   * Nullable, though today the API always sends one. An approval that created
   * the brand and could not mint the invite is exactly the case the result
   * panel exists to describe, and it must not arrive as a parse failure.
   */
  invite: inviteResultSchema.nullable(),
});

export type ApproveResult = z.infer<typeof approveResultSchema>;

/**
 * What the admin may fix at the moment of approval.
 *
 * `slug` because the rep suggestion may collide with a live brand or may simply
 * be worse. `ownerEmail` because a public application has none, and Better Auth
 * cannot create a user without one.
 */
export type ApproveDraft = {
  slug: string;
  ownerEmail: string;
};

const slugRule = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);

const emailRule = z.string().trim().toLowerCase().email();

/**
 * True when the API would accept this approval. Drives the confirm button.
 *
 * The email is conditional on the application, which is the asymmetry this
 * whole feature rests on: optional at the door, required here.
 *
 * An EMPTY slug is allowed and simply not sent. An Arabic shop name derives to
 * nothing, and refusing to approve a shop because its name has no Latin letters
 * would be a worse rule than letting the API name it.
 */
export function isApprovable(
  application: AdminBrandApplication,
  draft: ApproveDraft
): boolean {
  if (draft.slug.trim() && !slugRule.safeParse(draft.slug).success) {
    return false;
  }
  if (application.email) return true;
  return emailRule.safeParse(draft.ownerEmail).success;
}

/** Only what the admin supplied or changed. Absent, never empty. */
export function approveBodyFrom(
  application: AdminBrandApplication,
  draft: ApproveDraft
) {
  return {
    ...(draft.slug.trim() ? { slug: draft.slug.trim() } : {}),
    ...(application.email
      ? {}
      : { ownerEmail: draft.ownerEmail.trim().toLowerCase() }),
  };
}

export const approveApplication = (
  application: AdminBrandApplication,
  draft: ApproveDraft
): Promise<ApproveResult> =>
  api.post(
    approveResultSchema,
    `${APPLICATIONS_PATH}/${application.id}/approve`,
    approveBodyFrom(application, draft)
  );

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
const haystack = (row: AdminBrandApplication) =>
  [
    row.businessName,
    row.ownerName,
    row.email ?? "",
    row.phone,
    row.instagramUrl ?? "",
    row.websiteUrl ?? "",
  ]
    .join(" ")
    .toLowerCase();

/** Oldest first: the queue is worked from the bottom, like every other queue. */
const byOldestFirst = (
  a: AdminBrandApplication,
  b: AdminBrandApplication
) =>
  Date.parse(a.createdAt) - Date.parse(b.createdAt);

export function filterApplications(
  rows: readonly AdminBrandApplication[],
  filter: ApplicationFilter
): AdminBrandApplication[] {
  const needle = filter.search.trim().toLowerCase();
  return rows
    .filter((row) => (filter.status ? row.status === filter.status : true))
    .filter((row) => (needle ? haystack(row).includes(needle) : true))
    .sort(byOldestFirst);
}

/** How many rows sit in each status, for the filter's own labels. */
export function countByStatus(
  rows: readonly AdminBrandApplication[]
): Record<BrandApplicationStatus, number> {
  const counts: Record<BrandApplicationStatus, number> = {
    PENDING: 0,
    APPROVED: 0,
    REJECTED: 0,
  };
  for (const row of rows) counts[row.status] += 1;
  return counts;
}

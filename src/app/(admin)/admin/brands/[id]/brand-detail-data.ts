"use client";

/**
 * Everything /admin/brands/[id] reads and writes.
 *
 * CONTRACT GAP — THERE IS NO ADMIN BRAND DETAIL SCHEMA.
 *
 * `@loqal/contracts/brand.contract` describes three brand shapes and none of
 * them is this one:
 *
 *   `brandProfileSchema`       what a brand sees about ITSELF, GROUPED into
 *                              trading / invoiceIdentity / payout / loqalTerms.
 *   `adminBrandListItemSchema` one LINE of the admin table. Four columns plus
 *                              three computed figures.
 *   `brandPlacementSchema`     three placement fields, described and returned
 *                              by nothing.
 *
 * `GET /v1/admin/brands/:id` answers something else again: the whole row, FLAT
 * — `serialiseMoney(brand)` spread with `grossSales`, `balance` and `badges`
 * added — carrying three columns the brand's own projection deliberately
 * withholds (`settlementDetails`, `applicationId`, `updatedAt`) plus the
 * reputation and placement columns. Nothing in the contract package describes
 * it, so it is described here.
 *
 * It is described LOOSELY on purpose, and this is the one schema in the folder
 * that is not `.strict()`:
 *
 *  - Unknown keys are STRIPPED rather than refused. The response is a `select`
 *    over a table with forty columns and no DTO in front of it, so the next
 *    column somebody adds to `ADMIN_DETAIL_FIELDS` lands on this wire the day
 *    it is added. A strict schema would blank the only screen that can suspend
 *    a brand, over a column nothing renders.
 *  - Timestamps are `z.string()` rather than `.datetime()`. Same reason: this
 *    is a reverse-engineered shape, and a screen that refuses to draw because a
 *    date had no milliseconds is worse than one that prints it.
 *
 * Everything that is WRITTEN still goes through the real contract schema. Being
 * generous about what is read and exact about what is sent is the only
 * combination that is both robust and safe.
 */
import { z } from "zod";

import {
  setReputationScoreBodySchema,
  suspendBrandBodySchema,
  updateBrandTermsBodySchema,
} from "@loqal/contracts/brand.contract";
import {
  BrandStatusSchema,
  ComputedBadgeTypeSchema,
  DeliveryMethodSchema,
  PerOrderChargeTypeSchema,
  SettlementCadenceSchema,
  SettlementMethodSchema,
  StockSetupSchema,
  VerifiedBadgeTypeSchema,
} from "@loqal/contracts/enums";
import { moneySchema } from "@loqal/contracts/contracts";
import { signedMoneySchema } from "@loqal/contracts/money";

import { api } from "@/lib/api";
import { useResource, type Resource } from "@/lib/resource";

import { inviteResultSchema, type InviteResultPayload } from "../new-shop-data";
import { ownerBodyFrom, type OwnerDraft } from "../new-shop-form";

const timestamp = z.string();

/** A `BrandBadge` row, unselected by the repository, so the whole model. */
const computedBadgeSchema = z.object({
  id: z.string(),
  type: ComputedBadgeTypeSchema,
  earnedAt: timestamp,
  lostAt: timestamp.nullable(),
  /** The figures behind the badge when it was granted. Rendered as-is. */
  evidence: z.unknown().optional(),
});

const verifiedBadgeRowSchema = z.object({
  id: z.string(),
  type: VerifiedBadgeTypeSchema,
  checkedBy: z.string(),
  checkedAgainst: z.string(),
  checkedAt: timestamp,
  expiresAt: timestamp,
});

/**
 * Who can sign in to this shop, and whether they ever have.
 *
 * `mustChangePassword` IS the invite state. There is no invite table and there
 * deliberately is not going to be one: the redemption endpoint is Better
 * Auth's, so the token would be a reset token underneath and the table would be
 * a second record of a fact Better Auth already owns. Two records of one fact
 * drift.
 */
const brandOwnerSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  mustChangePassword: z.boolean(),
});

export type BrandOwner = z.infer<typeof brandOwnerSchema>;

export const adminBrandDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  status: BrandStatusSchema,

  // Profile
  description: z.unknown().nullable().optional(),
  logoMediaId: z.string().nullable().optional(),
  coverMediaId: z.string().nullable().optional(),
  notificationPhone: z.string().nullable().optional(),
  createdAt: timestamp.optional(),
  updatedAt: timestamp.optional(),
  applicationId: z.string().nullable().optional(),

  // Trading terms — the brand's own promises.
  deliveryFee: moneySchema.nullable().optional(),
  returnWindowDays: z.number().int().optional(),
  minimumOrderValue: moneySchema.nullable().optional(),
  supportedDelivery: z.array(DeliveryMethodSchema).optional(),
  stockSetup: StockSetupSchema.optional(),

  // Invoice identity.
  legalName: z.string().nullable().optional(),
  taxNumber: z.string().nullable().optional(),
  invoiceAddress: z.string().nullable().optional(),
  invoiceTerms: z.string().nullable().optional(),

  // Commercial terms — the deal Loqal set.
  freeUntil: timestamp.nullable().optional(),
  monthlyFee: moneySchema.nullable().optional(),
  perOrderChargeType: PerOrderChargeTypeSchema.nullable().optional(),
  perOrderChargeValue: moneySchema.nullable().optional(),
  settlementCadence: SettlementCadenceSchema.optional(),
  settlementAnchor: z.number().int().nullable().optional(),

  // The payout account itself. Admin projection only.
  settlementMethod: SettlementMethodSchema.nullable().optional(),
  settlementDetails: z.string().nullable().optional(),

  // Loqal's private judgement.
  reputationScore: z.number().int().nullable().optional(),
  reputationSetBy: z.string().nullable().optional(),
  reputationSetAt: timestamp.nullable().optional(),

  // Placement we sold.
  isPromoted: z.boolean().optional(),
  featuredUntil: timestamp.nullable().optional(),
  sortOrder: z.number().int().optional(),

  /**
   * OPTIONAL AND NULLABLE, AND THE DIFFERENCE MATTERS.
   *
   * `GET /v1/admin/brands/:id` does not return this field yet — it is being
   * added in the backend repo, separately, on somebody else's schedule. Absent
   * therefore means "this deployment has not caught up" and null means "the
   * backend looked and there is nobody", and the screen must be correct on both
   * sides of that deploy.
   *
   * It shows the same thing for both, and that is the honest choice rather than
   * a shortcut: while the field is missing there is no owner this console can
   * see, so offering the invite is exactly right — inviting an owner who
   * already exists is refused by the API with a 409, which is a sentence the
   * admin can read, whereas hiding the block would leave a shop nobody can sign
   * in to with nothing on screen about it.
   */
  owner: brandOwnerSchema.nullable().optional(),

  // Computed on read, never stored.
  grossSales: moneySchema.optional(),
  balance: signedMoneySchema.optional(),
  badges: z
    .object({
      computed: z.array(computedBadgeSchema),
      verified: z.array(verifiedBadgeRowSchema),
    })
    .optional(),
});

export type AdminBrandDetail = z.infer<typeof adminBrandDetailSchema>;

const detailPath = (id: string) => `/v1/admin/brands/${id}`;

export function useAdminBrand(id: string): Resource<AdminBrandDetail> {
  return useResource(`admin-brand:${id}`, Boolean(id), (signal) =>
    api.get(adminBrandDetailSchema, detailPath(id), { signal })
  );
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/**
 * The commercial-terms body.
 *
 * CONTRACT GAP: `updateBrandTermsBodySchema` is
 * `brandLoqalTermsSchema.partial()`, which names six fields. The endpoint's own
 * DTO (`update-brand-terms.contract.ts` in the backend) accepts ten — the same
 * six plus `settlementMethod`, `settlementDetails`, `status` and
 * `supportedDelivery`. The brief's list of commercial terms includes
 * `settlementMethod` and `settlementDetails`, and those are the two that matter
 * most here, so they are added by extension rather than by rewriting the six
 * the package already gets right.
 *
 * `status` and `supportedDelivery` are deliberately NOT added. A brand's
 * status moves through suspend/reactivate, which are their own routes with
 * their own preconditions and their own consequence sheet; letting a terms form
 * PATCH it would be a second, silent way to take a shop off the storefront.
 */
export const adminUpdateTermsBodySchema = updateBrandTermsBodySchema.extend({
  settlementMethod: SettlementMethodSchema.nullable().optional(),
  settlementDetails: z.string().trim().max(200).nullable().optional(),
});

export type AdminUpdateTermsBody = z.infer<typeof adminUpdateTermsBodySchema>;

/**
 * `PATCH /v1/brands/:id/terms` — note the path: `brands`, not `admin/brands`.
 * The commercial-terms write lives on `BrandsAdminController`, which is a
 * different controller from the one the rest of this screen reads from.
 */
export const updateBrandTerms = (id: string, body: AdminUpdateTermsBody) =>
  api.patch(
    adminBrandDetailSchema,
    `/v1/brands/${id}/terms`,
    adminUpdateTermsBodySchema.parse(body)
  );

/**
 * Placement.
 *
 * BACKEND GAP: `updatePlacementBodySchema` in the contract package carries
 * `isPromoted`, `featuredUntil` AND `sortOrder`, but the only route that writes
 * any of them is `PATCH /v1/admin/brands/:id/promotion`, whose DTO is
 * `.strict()` and names two — `sortOrder` is not writable by anything in the
 * repo, and sending it is a 400 rather than an ignored key. So the form shows
 * it as a fact and says why it cannot be edited.
 *
 * Note also who may call it: this is the ONE admin route open to SALES as well
 * as SUPER_ADMIN, because a sales rep closes the placement deal in the field.
 */
const setPromotionBodySchema = z
  .object({
    isPromoted: z.boolean(),
    featuredUntil: z.string().nullable().optional(),
  })
  .strict();

export const setBrandPromotion = (
  id: string,
  body: z.infer<typeof setPromotionBodySchema>
) =>
  api.patch(
    z.unknown(),
    `/v1/admin/brands/${id}/promotion`,
    setPromotionBodySchema.parse(body)
  );

/** Loqal's own 0–100 judgement. SUPER_ADMIN only, by the column's own rule. */
export const setReputationScore = (
  id: string,
  score: number,
  note?: string
) =>
  api.patch(
    z.unknown(),
    `/v1/admin/brands/${id}/reputation-score`,
    setReputationScoreBodySchema.parse(note ? { score, note } : { score })
  );

export const suspendBrand = (id: string, reason: string) =>
  api.post(
    adminBrandDetailSchema,
    `/v1/admin/brands/${id}/suspend`,
    suspendBrandBodySchema.parse({ reason })
  );

export const reactivateBrand = (id: string) =>
  api.post(adminBrandDetailSchema, `/v1/admin/brands/${id}/reactivate`);

/** True when the reason as typed would be accepted by the contract. */
export const isSuspendable = (reason: string): boolean =>
  suspendBrandBodySchema.safeParse({ reason }).success;

// ---------------------------------------------------------------------------
// The owner
// ---------------------------------------------------------------------------

/**
 * BACKEND GAP, and the loudest one in this file.
 *
 * Neither of these two routes exists yet. The implementation plan gives the
 * owner block an "Invite the owner" button and a "Send a new link" button and
 * never says what either of them calls — `POST /v1/brands` creates a brand and
 * cannot be reused for one that already exists, and nothing else in the API
 * surface mints an invite for a brand by id.
 *
 * They are named here rather than left out because a button wired to nothing is
 * worse than a button wired to a route that has to be built: this is the shape
 * the backend needs, written down once, in the place the request is made from.
 *
 * Both answer `InviteOwnerResult` — `{ userId, inviteUrl, delivery }` — which
 * is what `BrandOwnerOnboardingService.inviteOwner` already returns, so neither
 * needs a response type of its own.
 */
export const inviteBrandOwner = (
  id: string,
  draft: OwnerDraft
): Promise<InviteResultPayload> =>
  api.post(
    inviteResultSchema,
    `/v1/admin/brands/${id}/invite-owner`,
    ownerBodyFrom(draft)
  );

/**
 * A fresh link for an owner who already exists. No body: the account is already
 * attached to the brand, so the only thing this call carries is which brand.
 */
export const resendBrandOwnerInvite = (
  id: string
): Promise<InviteResultPayload> =>
  api.post(inviteResultSchema, `/v1/admin/brands/${id}/resend-invite`);

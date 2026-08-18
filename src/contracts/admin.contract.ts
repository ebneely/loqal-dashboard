import { z } from 'zod';
import { BrandApplicationStatusSchema, VerifiedBadgeTypeSchema } from './enums';
import { pageSchema } from './pagination';

/**
 * Platform-wide admin shapes: brand applications, verified badges, and the
 * single PlatformSetting row.
 */

/**
 * A public form with no password on it, and NO account created. A rejected
 * application must leave no orphan user behind, which is why there is no
 * userId or password anywhere in this shape.
 */
export const brandApplicationSchema = z
  .object({
    id: z.string().uuid(),
    /** BrandApplication's own column. Was `brandName`, which never existed. */
    businessName: z.string(),
    ownerName: z.string(),
    email: z.string().email(),
    phone: z.string(),
    /** For most of these shops the Instagram account IS the storefront. */
    instagramUrl: z.string().nullable(),
    websiteUrl: z.string().nullable(),
    description: z.string().nullable(),
    status: BrandApplicationStatusSchema,
    /** Who decided, and when. Was `decidedAt`; the column is `reviewedAt`. */
    reviewedBy: z.string().uuid().nullable(),
    reviewedAt: z.string().datetime().nullable(),
    rejectionReason: z.string().nullable(),
    createdAt: z.string().datetime(),
  })
  .strict();
export type BrandApplication = z.infer<typeof brandApplicationSchema>;

/**
 * BACKEND GAP: `GET /admin/brand-applications` answers a BARE ARRAY of pending
 * rows, unpaginated and unfilterable. It is the one list in the system with no
 * envelope, and the queue it serves is the one that grows fastest when the
 * sales push works.
 */
export const brandApplicationPageSchema = pageSchema(brandApplicationSchema);

export const rejectApplicationBodySchema = z
  .object({
    reason: z.string().trim().min(1).max(500),
  })
  .strict();

/**
 * Issued by a human at Loqal, dated, and expiring — never earned by a metric.
 *
 * The field names are the model's: `checkedBy` / `checkedAt` /
 * `checkedAgainst`, not `issuedBy` / `issuedAt` / `note`. That is not
 * pedantry — this badge says a person compared this brand's prices against
 * something specific, and `checkedAgainst` records WHAT, which a free-text
 * `note` would have made optional. `expiresAt` is non-nullable: a price check
 * that never lapses is a claim about a shop's prices forever.
 */
export const verifiedBadgeSchema = z
  .object({
    id: z.string().uuid(),
    brandId: z.string().uuid(),
    type: VerifiedBadgeTypeSchema,
    checkedBy: z.string().uuid(),
    checkedAgainst: z.string(),
    checkedAt: z.string().datetime(),
    expiresAt: z.string().datetime(),
  })
  .strict();
export type VerifiedBadge = z.infer<typeof verifiedBadgeSchema>;

/** The list flattens the brand relation onto the row; a write does not. */
export const verifiedBadgeListItemSchema = verifiedBadgeSchema
  .extend({ brandName: z.string() })
  .strict();
export type VerifiedBadgeListItem = z.infer<typeof verifiedBadgeListItemSchema>;

export const verifiedBadgePageSchema = pageSchema(verifiedBadgeListItemSchema);

export const grantVerifiedBadgeBodySchema = z
  .object({
    brandId: z.string().uuid(),
    type: VerifiedBadgeTypeSchema,
    /** What the prices were compared with. Required, so a badge is auditable. */
    checkedAgainst: z.string().trim().min(1).max(500),
    checkedAt: z.string().datetime(),
    expiresAt: z.string().datetime(),
  })
  .strict();
export type GrantVerifiedBadgeBody = z.infer<typeof grantVerifiedBadgeBodySchema>;

export const listVerifiedBadgesQuerySchema = z
  .object({
    brandId: z.string().uuid().optional(),
    type: VerifiedBadgeTypeSchema.optional(),
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

/**
 * The whole PlatformSetting row, grouped by what each setting governs rather
 * than by column order — a flat list of twenty unrelated numbers is unreadable
 * and invites changing the wrong one.
 *
 * Every rate, window and threshold in this system is data rather than code: a
 * badge that becomes unearnable because the market moved should be a settings
 * change, not a release.
 */
export const platformSettingsSchema = z
  .object({
    /** Always 1 — PlatformSetting is a single row by construction. */
    id: z.number().int(),
    updatedAt: z.string().datetime(),
    analytics: z
      .object({
        /**
         * Read-only in practice. Day boundaries are baked into
         * AnalyticsEvent.eventDay at ingest, so every day already written was
         * computed under the old value — the rollup jobs compare against it and
         * refuse to run on a mismatch. Loudly stale beats silently wrong.
         */
        analyticsTimezone: z.string(),
        analyticsKAnonymityFloor: z.number().int().min(1),
        ingestRejectRetentionDays: z.number().int().min(1),
      })
      .strict(),
    sales: z
      .object({
        defaultFreeMonths: z.number().int().min(0),
        salesCommissionFloorBps: z.number().int().nullable(),
        salesMaxFreeMonths: z.number().int().nullable(),
      })
      .strict(),
    tryOn: z
      .object({
        /** Changing this switches provider with NO deploy. */
        tryOnModelId: z.string(),
        /** What the budget governor drops to at 85% of the ceiling. */
        tryOnFallbackModelId: z.string(),
        /** Hard monthly ceiling. At 100% the feature serves cache only. */
        tryOnMonthlyBudgetCents: z.number().int().min(0),
        tryOnAccountLifetimeCap: z.number().int().min(0),
      })
      .strict(),
    chat: z
      .object({
        chatAttachmentMaxBytes: z.number().int().min(1),
        /** Images and PDFs only. Every other type is attack surface for no benefit. */
        chatAttachmentAllowedMimeTypes: z.array(z.string()),
        guestThreadLifetimeDays: z.number().int().min(1),
        chatUnansweredThresholdMinutes: z.number().int().min(1),
      })
      .strict(),
    badges: z
      .object({
        /** Below this many delivered orders the sample is noise. */
        badgeMinOrderCount: z.number().int().min(1),
        badgeWindowDays: z.number().int().min(1),
        badgeSameDayShareBpsThreshold: z.number().int(),
        badgeFastConfirmMinutesThreshold: z.number().int(),
        badgeCancellationRateBpsMax: z.number().int(),
      })
      .strict(),
  })
  .strict();
export type PlatformSettings = z.infer<typeof platformSettingsSchema>;

/**
 * FLAT, while the response is grouped — the asymmetry is the API's, not a
 * slip here. The read groups twenty unrelated numbers by what they govern so
 * nobody changes the wrong one; the write is a single bag of optional keys, so
 * a PATCH names exactly what it touches and nothing else.
 *
 * `analyticsTimezone` is a legal KEY but not a legal CHANGE. Day boundaries
 * are baked into AnalyticsEvent.eventDay at ingest, so every day already
 * written was computed under the old value; sending a different one is a 422.
 * It stays accepted so that reading the settings and posting them back
 * unchanged — which is what a settings form does — does not 400.
 */
export const updatePlatformSettingsBodySchema = z
  .object({
    analyticsTimezone: z.string().trim().min(1).max(64).optional(),
    ingestRejectRetentionDays: z.number().int().min(1).optional(),
    analyticsKAnonymityFloor: z.number().int().min(1).optional(),
    defaultFreeMonths: z.number().int().min(0).optional(),
    salesCommissionFloorBps: z.number().int().min(0).max(10000).nullable().optional(),
    salesMaxFreeMonths: z.number().int().min(0).nullable().optional(),
    tryOnModelId: z.string().trim().min(1).max(200).optional(),
    tryOnFallbackModelId: z.string().trim().min(1).max(200).optional(),
    tryOnMonthlyBudgetCents: z.number().int().min(0).optional(),
    tryOnAccountLifetimeCap: z.number().int().min(0).optional(),
    chatAttachmentMaxBytes: z.number().int().min(1).optional(),
    chatAttachmentAllowedMimeTypes: z.array(z.string().trim().min(1)).min(1).optional(),
    guestThreadLifetimeDays: z.number().int().min(1).optional(),
    chatUnansweredThresholdMinutes: z.number().int().min(1).optional(),
    badgeMinOrderCount: z.number().int().min(1).optional(),
    badgeWindowDays: z.number().int().min(1).optional(),
    badgeSameDayShareBpsThreshold: z.number().int().min(0).max(10000).optional(),
    badgeFastConfirmMinutesThreshold: z.number().int().min(1).optional(),
    badgeCancellationRateBpsMax: z.number().int().min(0).max(10000).optional(),
  })
  .strict();
export type UpdatePlatformSettingsBody = z.infer<typeof updatePlatformSettingsBodySchema>;

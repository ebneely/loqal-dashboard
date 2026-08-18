import { z } from 'zod';
import { bilingualSchema, moneySchema } from './contracts';
import {
  BrandStatusSchema,
  DeliveryMethodSchema,
  PerOrderChargeTypeSchema,
  SettlementCadenceSchema,
  SettlementMethodSchema,
  StockSetupSchema,
} from './enums';
import { signedMoneySchema } from './money';
import { pageSchema } from './pagination';

/**
 * A brand, grouped by WHO decides each thing.
 *
 * `trading` and `invoiceIdentity` are the brand's own promises. `payout` is the
 * brand's, but owner-only. `loqalTerms` is the deal Loqal set, and is read-only
 * to the brand — shown as facts, never as a disabled form, because a greyed
 * field still invites an argument about editing it.
 */

/**
 * The delivery routes that are actually live.
 *
 * SHIPPING_SERVICE is excluded on purpose. It is modelled end to end but has no
 * courier contract behind it, so no brand may carry it and no UI may render it.
 * Signing the contract widens this list; until then it must be unrepresentable.
 *
 * Exported because the backend needs the same list at its brand-write
 * boundaries, and was otherwise forced to mirror it and guard the mirror with a
 * drift test. Two lists that agree by test are two lists; this is one.
 */
export const LIVE_DELIVERY_METHODS = ['RIDER_PER_BRAND', 'BRAND_OWN_DELIVERY'] as const;

export const liveDeliveryMethodSchema = DeliveryMethodSchema.exclude(['SHIPPING_SERVICE']);
export type LiveDeliveryMethod = z.infer<typeof liveDeliveryMethodSchema>;

/** At least one route, or a brand can be saved with no way to deliver anything. */
export const supportedDeliveryListSchema = z.array(liveDeliveryMethodSchema).min(1);

export const brandTradingTermsSchema = z
  .object({
    /** Charged to the shopper, collected by whoever delivers. Never Loqal's. */
    deliveryFee: moneySchema.nullable(),
    returnWindowDays: z.number().int().min(0).max(365),
    /** What stands between a brand and orders that lose it money. */
    minimumOrderValue: moneySchema.nullable(),
    supportedDelivery: supportedDeliveryListSchema,
    stockSetup: StockSetupSchema,
  })
  .strict();
export type BrandTradingTerms = z.infer<typeof brandTradingTermsSchema>;

export const brandInvoiceIdentitySchema = z
  .object({
    legalName: z.string().nullable(),
    taxNumber: z.string().nullable(),
    invoiceAddress: z.string().nullable(),
    invoiceTerms: z.string().nullable(),
  })
  .strict();

/**
 * Owner-only. Absent from an employee's payload, never blanked — a nulled field
 * still tells an assistant that a payout account exists and roughly its shape.
 *
 * DECIDED: the owner reads their own payout account. It was tempting to keep
 * `settlementDetails` admin-only on the grounds that fewer eyes on a bank
 * account is safer, and that is the wrong way round here.
 *
 * A SALES rep could recently rewrite any brand's `settlementDetails` through an
 * unbound path parameter, and the reason that was so dangerous is precisely
 * that the brand could not see the field and so could not notice it had
 * changed. Showing an owner the account their own money is sent to is the
 * control that catches that class of attack, not an exposure that enables it.
 * It is also incoherent to let an owner WRITE a field they may not READ, and
 * updateBrandProfileBodySchema already permits the write.
 *
 * The employee boundary is where the real line sits, and it stays: an assistant
 * has no business knowing which rail the shop's money travels on, let alone the
 * account number.
 *
 * SAME AUDIENCE AS `settlementRunSchema`. That schema carries these two fields
 * too and reaches a brand through `GET /v1/brands/me/settlements`, which is
 * BRAND_OWNER-only. The two disagreed while this block was withheld — the
 * account an owner was "protected" from reading here was already on their own
 * settlements page — and a withholding one surface honours and another does not
 * protects nobody. If either audience changes, both change together.
 *
 * NOT YET HERE: when the account last moved, and who moved it. The write is
 * validated and acted on and recorded nowhere, so an owner can see a wrong IBAN
 * and cannot tell a typo from an intrusion. Two `Brand` columns close it —
 * see the `BrandsService.updateTerms` docblock in the backend for the exact
 * spec. They belong on this schema when they land, and on no employee branch.
 */
export const brandPayoutSchema = z
  .object({
    settlementMethod: SettlementMethodSchema.nullable(),
    /**
     * Free text on purpose: an IBAN for a bank transfer, a phone number for
     * InstaPay or a wallet. The shape differs per method and Egyptian IBANs
     * are not validated here.
     */
    settlementDetails: z.string().nullable(),
  })
  .strict();

/** Set by Loqal. The brand may read these and may not change them. */
export const brandLoqalTermsSchema = z
  .object({
    freeUntil: z.string().datetime().nullable(),
    monthlyFee: moneySchema.nullable(),
    perOrderChargeType: PerOrderChargeTypeSchema.nullable(),
    /** A percentage when the type is PERCENT, an EGP amount when FIXED. */
    perOrderChargeValue: moneySchema.nullable(),
    settlementCadence: SettlementCadenceSchema,
    settlementAnchor: z.number().int().nullable(),
  })
  .strict();

export const brandProfileSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    slug: z.string(),
    description: bilingualSchema.nullable(),
    /**
     * Media IDS, not URLs. The API stores and returns `logoMediaId` /
     * `coverMediaId` and resolves a URL nowhere on this plane, so a schema
     * saying `.url()` here would describe a field that has never existed.
     * Renamed to what ships; resolving them to URLs is a separate ask.
     */
    logoMediaId: z.string().uuid().nullable(),
    coverMediaId: z.string().uuid().nullable(),
    status: BrandStatusSchema,
    /**
     * Where the WhatsApp fall-through reaches the shop. Staff change; the line
     * does not.
     *
     * BACKEND GAP: not in the brand's own projection and not writable by any
     * endpoint in the repo, so the number an unanswered-chat alert is sent to
     * cannot currently be seen or corrected by the shop it is sent to.
     */
    notificationPhone: z.string().nullable(),
    trading: brandTradingTermsSchema,
    invoiceIdentity: brandInvoiceIdentitySchema,
    payout: brandPayoutSchema,
    loqalTerms: brandLoqalTermsSchema,
  })
  .strict();
export type BrandProfile = z.infer<typeof brandProfileSchema>;

/** What a brand may change about itself. loqalTerms is absent by construction. */
export const updateBrandProfileBodySchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: bilingualSchema.optional(),
    notificationPhone: z.string().max(40).nullable().optional(),
    trading: brandTradingTermsSchema.partial().optional(),
    invoiceIdentity: brandInvoiceIdentitySchema.partial().optional(),
    payout: brandPayoutSchema.partial().optional(),
  })
  .strict();
export type UpdateBrandProfileBody = z.infer<typeof updateBrandProfileBodySchema>;

// ---------------------------------------------------------------------------
// Admin views
// ---------------------------------------------------------------------------

/**
 * How many of each kind of badge a brand carries. Two counts and never one
 * total: computed badges are earned from delivered orders and verified badges
 * are issued by a human at Loqal, and a single number would let the second
 * kind hide inside the first.
 */
export const brandBadgeCountsSchema = z
  .object({ computed: z.number().int(), verified: z.number().int() })
  .strict();

export const adminBrandListItemSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    slug: z.string(),
    status: BrandStatusSchema,
    grossSales: moneySchema,
    balance: signedMoneySchema,
    badgeCounts: brandBadgeCountsSchema,
  })
  .strict();
export type AdminBrandListItem = z.infer<typeof adminBrandListItemSchema>;

/**
 * Placement lives on the admin DETAIL, not the list — the list selects four
 * columns and never reads these.
 *
 * `isPromoted` is selected, not merely ordered by. Paid placement must be
 * labelled wherever it appears: selling placement is fine, selling the
 * appearance of trust burns every badge on the site.
 *
 * BACKEND GAP: `isPromoted` and `featuredUntil` are on the brand row but on
 * neither admin projection, so nothing can currently render the label that
 * makes paid placement honest.
 */
export const brandPlacementSchema = z
  .object({
    isPromoted: z.boolean(),
    featuredUntil: z.string().datetime().nullable(),
    sortOrder: z.number().int(),
  })
  .strict();
export type BrandPlacement = z.infer<typeof brandPlacementSchema>;

export const adminBrandPageSchema = pageSchema(adminBrandListItemSchema);

export const listAdminBrandsQuerySchema = z
  .object({
    status: BrandStatusSchema.optional(),
    search: z.string().max(120).optional(),
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

/**
 * A suspension is an accusation with consequences — counterfeit goods,
 * non-fulfilment, non-payment — so it carries a reason. In-flight orders still
 * complete; only the storefront listing goes.
 */
export const suspendBrandBodySchema = z
  .object({
    reason: z.string().trim().min(1).max(500),
  })
  .strict();
export type SuspendBrandBody = z.infer<typeof suspendBrandBodySchema>;

export const updateBrandTermsBodySchema = brandLoqalTermsSchema.partial().strict();
export type UpdateBrandTermsBody = z.infer<typeof updateBrandTermsBodySchema>;

export const updatePlacementBodySchema = z
  .object({
    featuredUntil: z.string().datetime().nullable().optional(),
    sortOrder: z.number().int().optional(),
    isPromoted: z.boolean().optional(),
  })
  .strict();

/**
 * Loqal's own judgement of a brand, 0–100, written only by SUPER_ADMIN. Kept
 * beside the computed badges and never merged into one figure: a brand can
 * ship on time and still argue with every customer, and no metric catches that.
 */
export const setReputationScoreBodySchema = z
  .object({
    score: z.number().int().min(0).max(100),
    note: z.string().max(500).optional(),
  })
  .strict();

import { z } from 'zod';
import { withholdable } from './errors';
import { brandLoqalTermsSchema } from './brand.contract';

/**
 * The sales console. Three screens, a phone, and a rep standing inside a
 * prospect's shop.
 *
 * A SALES user carries no brandId and sees no customer data at all — the
 * customer belongs to Loqal, and a field device in a shop is the easiest thing
 * in this system to lose. Nothing in this file may carry a shopper's name,
 * phone, email or address.
 */

export const categoryComparisonSchema = z
  .object({
    brandCount: z.number().int().min(1),
    /**
     * Null when no BrandMetric rows exist for the category yet. Distinct from
     * withheld above it, and the distinction is the point: withheld means we
     * measured and may not say, null means there is nothing to measure. A rep
     * must not read the second as the first in front of a prospect.
     */
    medianMonthlyOrders: z.number().int().nullable(),
  })
  .strict();

/**
 * Platform reach, stated as evidence rather than as a claim about this
 * category. Not k-anonymity gated, and correctly so — it is one aggregate over
 * the whole platform and reveals no individual brand.
 *
 * BOTH FIGURES COVER THE SAME WINDOW: the last 30 analytics days, ending with
 * the day the pack was generated, inclusive, on the Africa/Cairo business
 * calendar the rest of analytics uses. A rep reads these two out loud as one
 * matched proof, so they are computed as one — `totalVisitors` used to be a
 * lifetime count sitting next to a 30-day `totalEvents`, and the inflated half
 * is always the half that gets quoted. `AnalyticsService.trafficProof` is now
 * the single source of the pair; `.platformOverview` is not used here.
 *
 * Pair these with `salesPackSchema.generatedAt` when rendering: the window is
 * relative to that stamp and means nothing without it.
 */
export const trafficProofSchema = z
  .object({
    totalEvents: z.number().int(),
    totalVisitors: z.number().int(),
  })
  .strict();

/**
 * Every aggregate here is `withholdable`.
 *
 * No figure shown to a brand Loqal has not signed may be derived from fewer
 * than PlatformSetting.analyticsKAnonymityFloor brands. Below that floor,
 * "brands in your category average X" stops being a market fact and becomes one
 * competitor's private revenue. Returning null or zero would read as "we
 * measured nothing", which is a different and untrue claim — so the field
 * carries its own reason and the screen draws a deliberate blocked state.
 */
export const salesPackSchema = z
  .object({
    category: z.string(),
    trafficProof: trafficProofSchema,
    categoryComparison: withholdable(categoryComparisonSchema),
    /**
     * REQUIRED, and emitted — `SalesService.forCategory` stamps it with the
     * same `now` it measures `trafficProof`'s window back from, so the stamp
     * and the figures can never disagree.
     *
     * A pack is a set of figures a rep reads to a prospect, and one with no
     * "as of" on it cannot be told apart from a stale screenshot taken a
     * quarter ago. The dashboard's local `salesPackWireSchema` — which relaxed
     * this to `.optional()` while the backend did not send it — can be retired.
     */
    generatedAt: z.string().datetime(),
  })
  .strict();
export type SalesPack = z.infer<typeof salesPackSchema>;

/**
 * The band a rep may close inside without admin approval. Both bounds null
 * means unbounded, which is correct while Loqal is signing its first brands
 * itself — the point of having a band at all is that the worst deal a rep can
 * sign is a number chosen in advance rather than one discovered in a
 * settlement run.
 *
 * defaultFreeMonths is the offer pre-filled for the rep; the value that
 * actually applies stays per brand in Brand.freeUntil.
 */
export const salesTermsBandSchema = z
  .object({
    commissionFloorBps: z.number().int().nullable(),
    maxFreeMonths: z.number().int().nullable(),
    defaultFreeMonths: z.number().int(),
  })
  .strict();
export type SalesTermsBand = z.infer<typeof salesTermsBandSchema>;

/**
 * Registering a shop in the room. No password, and no user account is created.
 *
 * Every field name here follows BrandApplication's own columns. An earlier
 * draft asked for `name`, `categorySlug`, `city`, `address` and `notes`; none
 * of those exist on the model, and the API is `.strict()`, so the whole form
 * was a 400. What a rep can actually capture standing in a shop is the two
 * names, a way to reach them, and the Instagram account that in practice IS
 * the shop's storefront.
 *
 * `slug` is the close-the-deal-now discriminator: send it and the application
 * is approved and a Brand created in the same call; omit it and only the
 * application is filed.
 */
export const registerBrandBodySchema = z
  .object({
    businessName: z.string().trim().min(1).max(120),
    ownerName: z.string().trim().min(1).max(120),
    email: z.string().email(),
    phone: z.string().trim().min(8).max(20),
    instagramUrl: z.string().trim().url().max(300).optional(),
    websiteUrl: z.string().trim().url().max(300).optional(),
    description: z.string().trim().max(2000).optional(),
    slug: z
      .string()
      .trim()
      .min(2)
      .max(80)
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
      .optional(),
  })
  .strict();
export type RegisterBrandBody = z.infer<typeof registerBrandBodySchema>;

/**
 * An out-of-band figure is a 422, never a warning and never a silent clamp.
 * The bound is enforced server-side; this schema only shapes the request.
 */
export const setSalesTermsBodySchema = brandLoqalTermsSchema.partial().strict();
export type SetSalesTermsBody = z.infer<typeof setSalesTermsBodySchema>;

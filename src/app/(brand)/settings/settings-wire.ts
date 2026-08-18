/**
 * Where the shipped API and `@loqal/contracts/brand.contract` do not yet agree,
 * written down instead of worked around.
 *
 * The same job `products/catalog-wire.ts` does for the catalog. The contract is
 * the specification and it is right about what SHOULD be on the wire; these
 * schemas are what IS, so a screen parses the body the API actually sends and
 * the difference is one file rather than nine `?? null`s spread through a form.
 *
 * THE FOUR DIFFERENCES, all verified against loqal-backend:
 *
 *  a. `payout` and `loqalTerms` are OPTIONAL on the wire and required in
 *     `brandProfileSchema`. This is the backend being right: `toBrandProfile`
 *     omits both keys entirely for a BRAND_EMPLOYEE — absent, never blanked,
 *     because `"monthlyFee": null` still tells an assistant that a monthly fee
 *     exists. Parsing an employee's body with the contract's shape would fail
 *     outright and turn a correct refusal into a broken screen.
 *  b. `payout` carries `settlementMethod` ONLY. `settlementDetails` — the
 *     account itself — has never been on the brand's own projection, and
 *     `brand-profile.ts` says so in its own comment. Optional here so the field
 *     renders the day it lands and nothing breaks until then.
 *  c. `supportedDelivery` is read as the FULL DeliveryMethod enum rather than
 *     the live-only list. A legacy row carrying SHIPPING_SERVICE must not fail
 *     the whole settings screen; it is dropped when the routes are offered
 *     instead. See `settings-rules.ts`.
 *  d. The UPDATE body is FLAT. `updateBrandProfileBodySchema` groups its fields
 *     the way the read does; `UpdateBrandProfileDto` on the server is one flat
 *     `.strict()` object, so a grouped body is a 400 on an unknown key.
 *
 * Loose, not `.strict()`, on the read: this is a local reading of somebody
 * else's shape, and a field added upstream must not take the settings screen
 * down. The WRITE is strict, because there the risk runs the other way — an
 * extra key is a 400 and `.strict()` catches it here rather than at the API.
 */
import { z } from "zod";

import {
  BrandStatusSchema,
  DeliveryMethodSchema,
  PerOrderChargeTypeSchema,
  SettlementCadenceSchema,
  SettlementMethodSchema,
  StockSetupSchema,
} from "@loqal/contracts/enums";
import { moneySchema } from "@loqal/contracts/contracts";
import { LIVE_DELIVERY_METHODS } from "@loqal/contracts/brand.contract";

export { LIVE_DELIVERY_METHODS };

/**
 * `{ ar, en }`, read leniently.
 *
 * The contract's `bilingualSchema` requires at least one language, which is the
 * right rule for a WRITE and the wrong one for a read: a row saved before that
 * rule existed still has to be openable so it can be fixed.
 */
const descriptionWireSchema = z
  .object({ ar: z.string().optional(), en: z.string().optional() })
  .nullable();

/** Owner only, and one field behind the contract. See (b) above. */
const payoutWireSchema = z.object({
  settlementMethod: SettlementMethodSchema.nullable(),
  settlementDetails: z.string().nullable().optional(),
});

const loqalTermsWireSchema = z.object({
  freeUntil: z.string().nullable(),
  monthlyFee: z.string().nullable(),
  perOrderChargeType: PerOrderChargeTypeSchema.nullable(),
  perOrderChargeValue: z.string().nullable(),
  settlementCadence: SettlementCadenceSchema,
  settlementAnchor: z.number().int().nullable(),
});

export const brandProfileWireSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: descriptionWireSchema,
  /** IDS, not URLs. Nothing on this plane resolves one to a picture. */
  logoMediaId: z.string().nullable(),
  coverMediaId: z.string().nullable(),
  status: BrandStatusSchema,
  notificationPhone: z.string().nullable(),
  trading: z.object({
    deliveryFee: z.string().nullable(),
    returnWindowDays: z.number().int(),
    minimumOrderValue: z.string().nullable(),
    supportedDelivery: z.array(DeliveryMethodSchema),
    stockSetup: StockSetupSchema,
  }),
  invoiceIdentity: z.object({
    legalName: z.string().nullable(),
    taxNumber: z.string().nullable(),
    invoiceAddress: z.string().nullable(),
    invoiceTerms: z.string().nullable(),
  }),
  payout: payoutWireSchema.optional(),
  loqalTerms: loqalTermsWireSchema.optional(),
});

export type BrandProfileWire = z.infer<typeof brandProfileWireSchema>;

/**
 * Exactly what `PATCH /v1/brands/me` accepts, and nothing else.
 *
 * `invoiceTerms`, `settlementMethod` and `settlementDetails` are readable and
 * are NOT here, because the server's DTO does not take them. Offering an input
 * for a field the API rejects is worse than showing the value as a fact: one is
 * a screen that says who decides, the other is a save button that fails after
 * the shop has typed.
 */
export const updateBrandProfileWireSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z
      .object({
        ar: z.string().trim().min(1).max(2000).optional(),
        en: z.string().trim().min(1).max(2000).optional(),
      })
      .optional(),
    notificationPhone: z.string().trim().max(40).nullable().optional(),
    deliveryFee: moneySchema.nullable().optional(),
    returnWindowDays: z.number().int().min(0).max(365).optional(),
    minimumOrderValue: moneySchema.nullable().optional(),
    stockSetup: StockSetupSchema.optional(),
    supportedDelivery: z.array(z.enum(LIVE_DELIVERY_METHODS)).min(1).optional(),
    legalName: z.string().trim().max(200).nullable().optional(),
    taxNumber: z.string().trim().max(50).nullable().optional(),
    invoiceAddress: z.string().trim().max(500).nullable().optional(),
  })
  .strict();

export type UpdateBrandProfileWire = z.infer<typeof updateBrandProfileWireSchema>;

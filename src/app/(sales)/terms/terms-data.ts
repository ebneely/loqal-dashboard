"use client";

/**
 * What /terms reads and writes.
 *
 * `GET /v1/sales/terms/band`      the band, from PlatformSetting. Unscoped —
 *                                 it is the same for every rep.
 * `POST /v1/sales/brands/:id/terms` the offer.
 *
 * THE LIST ENDPOINT THAT DOES NOT EXIST.
 *
 * There is no `GET /v1/sales/brands`. There is no route anywhere on the sales
 * plane that names a brand, and no route that answers "is this brand bound to
 * me?" without also writing to it. `GET /v1/admin/brands` is SUPER_ADMIN-only
 * and `GET /v1/brands/me` is BRAND_OWNER/BRAND_EMPLOYEE-only — a SALES session
 * carries no brandId at all, so even the second is meaningless for a rep.
 *
 * That is the single largest gap in this console and it is not closeable from
 * here. See `../signed-brands.ts` for what the screen does instead and why.
 *
 * THE WRITE'S RESPONSE IS A CONFIRMATION, NOT A RECORD.
 *
 * `confirmTermsWritten` in `SalesService` rebuilds the response from the keys
 * the rep actually sent, reading the values back off the updated row. It used
 * to answer with `OWN_FIELDS` — the brand's whole dashboard shape — which made
 * the write endpoint a read endpoint: an empty body returned a competitor's
 * entire commercial deal. So the shape below is `{ brandId }` plus, at most,
 * the three keys this console sends, and every one of them is optional because
 * a caller that sent two keys gets two keys back.
 */
import { z } from "zod";

import { moneySchema } from "@loqal/contracts/contracts";
import { PerOrderChargeTypeSchema } from "@loqal/contracts/enums";
import {
  salesTermsBandSchema,
  type SalesTermsBand,
} from "@loqal/contracts/sales.contract";

import { api } from "@/lib/api";
import { useResource, type Resource } from "@/lib/resource";

import type { OfferDraft } from "./offer-form";
import { offerBodyFrom } from "./offer-form";

export function useSalesBand(): Resource<SalesTermsBand> {
  return useResource("sales-terms-band", true, (signal) =>
    api.get(salesTermsBandSchema, "/v1/sales/terms/band", { signal })
  );
}

/**
 * The echo, keyed exactly as `SALES_TERMS_FIELDS` allows. `.strict()` is
 * load-bearing: if this route ever starts echoing `settlementDetails`,
 * `legalName` or `status` again, this parse fails loudly on a rep's phone
 * instead of quietly putting another brand's payout account in a React state.
 */
export const termsConfirmationSchema = z
  .object({
    brandId: z.string(),
    freeUntil: z.string().nullable().optional(),
    monthlyFee: moneySchema.nullable().optional(),
    perOrderChargeType: PerOrderChargeTypeSchema.nullable().optional(),
    perOrderChargeValue: moneySchema.nullable().optional(),
    settlementCadence: z.string().optional(),
    settlementAnchor: z.number().int().nullable().optional(),
    settlementMethod: z.string().nullable().optional(),
  })
  .strict();

export type TermsConfirmation = z.infer<typeof termsConfirmationSchema>;

/**
 * `brandId` goes in the path and authorises nothing on its own — the caller
 * comes from the session cookie. The screen has already refused to call this
 * for a brand it has no record of the rep signing; this function is the second
 * half of that, and `SalesService.setTerms` is the half that actually holds.
 */
export const setSalesTerms = (
  brandId: string,
  draft: OfferDraft,
  now: Date = new Date()
): Promise<TermsConfirmation> =>
  api.post(
    termsConfirmationSchema,
    `/v1/sales/brands/${encodeURIComponent(brandId)}/terms`,
    offerBodyFrom(draft, now)
  );

/**
 * A 422's own violation list, which the API sends as
 * `{ message, violations: string[] }` under the standard error envelope.
 *
 * BACKEND GAP, and it is the reason this returns `null` so often:
 * `all-exceptions.filter.ts` flattens every error to
 * `{ statusCode, message, error }` — the `.strict()` shape `apiErrorSchema`
 * describes — so the `violations` array `SalesService` carefully builds is
 * dropped before it reaches the wire. A rep is told the offer is outside the
 * band and NOT which half of it was. The screen re-derives what it can from the
 * band it holds and says the rest plainly rather than inventing a reason.
 */
export function violationsFrom(error: unknown): readonly string[] | null {
  if (!error || typeof error !== "object") return null;
  const violations = (error as { violations?: unknown }).violations;
  if (!Array.isArray(violations)) return null;
  return violations.filter((v): v is string => typeof v === "string");
}

/** The API's own status for "outside the band a rep may close without an admin". */
export const OUT_OF_BAND_STATUS = 422;

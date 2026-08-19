"use client";

/**
 * The one write a rep may make that creates something: `POST /v1/sales/brands`.
 *
 * TWO OUTCOMES FROM ONE ROUTE, DISCRIMINATED BY `slug`.
 *
 *   no slug   a BrandApplication is filed, PENDING. `brand` is null.
 *   slug      the application is filed AND approved with the rep's id in
 *             `reviewedBy`, and a Brand is created and linked. `brand` is a row.
 *
 * That second path is the ONLY thing in the system that binds a brand to a rep
 * (`Brand.applicationId -> BrandApplication.reviewedBy`), so it is also the only
 * way a shop ever becomes priceable from the /terms screen. See
 * `../signed-brands.ts`.
 *
 * THE TWO WRITES ARE NOT TRANSACTIONAL, and the screen has to survive that.
 * `SalesService.registerShop` calls `BrandsService.create` without a transaction
 * client. A slug collision throws a 409 AFTER the application row is already
 * committed, leaving a PENDING application and no brand. Pressing again with a
 * different slug files a SECOND application for the same shop. So the screen
 * keeps the request identity and says what happened rather than offering a bare
 * retry — an admin cleaning up two duplicate applications is a better failure
 * than a rep who does not know one was created.
 *
 * WHAT IS DELIBERATELY NOT PARSED.
 * The response's `brand` is `BrandsRepository.create`'s `OWN_FIELDS`
 * projection — the brand's whole own-dashboard shape, carrying `status`,
 * `legalName`, `taxNumber`, `invoiceAddress` and every commercial column. A
 * freshly created brand has none of them set, so nothing leaks today, but a
 * field device has no business holding that shape at all. This schema picks the
 * three fields the console needs to name a shop and drops the rest at the parse
 * boundary; `.strict()` is deliberately NOT used, because failing the whole
 * registration over an unexpected extra column would lose a shop the API
 * already created.
 */
import { z } from "zod";

import { api } from "@/lib/api";

import type { OnboardDraft } from "./onboard-form";
import { parseBody } from "./onboard-form";

const SALES_BRANDS_PATH = "/v1/sales/brands";

/**
 * `BrandApplication` as the intake repository returns it. Only the two fields
 * the console uses are required; `status` is read to confirm the API recorded
 * APPROVED on the closing path rather than assuming it did.
 */
export const registeredApplicationSchema = z.object({
  id: z.string(),
  businessName: z.string(),
  status: z.string().optional(),
});

export const registeredBrandSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
});

export const registerShopResultSchema = z.object({
  application: registeredApplicationSchema,
  brand: registeredBrandSchema.nullable(),
});

export type RegisterShopResult = z.infer<typeof registerShopResultSchema>;

export const registerShop = (draft: OnboardDraft): Promise<RegisterShopResult> =>
  api.post(registerShopResultSchema, SALES_BRANDS_PATH, parseBody(draft));

/**
 * Which of the two things actually happened, read off the RESPONSE rather than
 * off the draft.
 *
 * The draft says what the rep asked for; only the response says what Loqal did.
 * They can differ — the create can fail after the application lands — and the
 * one that goes in the device ledger and on the confirmation panel has to be
 * the second.
 */
export function outcomeOfResult(result: RegisterShopResult): "filed" | "created" {
  return result.brand === null ? "filed" : "created";
}

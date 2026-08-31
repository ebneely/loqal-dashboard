import { z } from "zod";

import type { ImportSourceType } from "@loqal/contracts/enums";

/**
 * The pure half of the Start-an-import sheet: no React, no fetch, no copy.
 * Same split as ../brands/new-shop-form.ts, same reason — "would the API
 * accept this?" is the question the submit button asks on every keystroke,
 * and answering it inside a component makes it untestable without a DOM.
 */

/**
 * The sources offered, which is deliberately NOT every `ImportSourceType`.
 *
 * SHOPIFY, WOOCOMMERCE and MANUAL parse at the contract level, but
 * `ImportStagingService` has no parser for them — the job is created and then
 * immediately failed with a reason. Offering a source whose only possible
 * outcome is a failed job would be a button that manufactures support tickets;
 * they join this list the day the backend can read them.
 */
export const OFFERED_SOURCES = [
  "CSV",
  "FEED",
  "JSONLD",
] as const satisfies readonly ImportSourceType[];
export type OfferedSource = (typeof OFFERED_SOURCES)[number];

export const isOfferedSource = (value: string): value is OfferedSource =>
  (OFFERED_SOURCES as readonly string[]).includes(value);

export type NewImportDraft = {
  brandId: string;
  sourceType: OfferedSource;
  /** The price list as text — pasted, or read out of an attached file. CSV only. */
  csv: string;
  /** The feed or page address. FEED and JSONLD only. */
  url: string;
};

export const emptyImportDraft: NewImportDraft = {
  brandId: "",
  sourceType: "CSV",
  csv: "",
  url: "",
};

/** Which of the two source inputs this draft is actually about. */
export const needsCsv = (source: OfferedSource): boolean => source === "CSV";

const brandIdField = z.string().uuid();

/**
 * A URL, not merely a non-empty string, even though the API would take the
 * latter (`sourceRef: z.string().min(1)`). Staging fetches the address
 * synchronously and fails the whole job on garbage, so the five seconds this
 * check costs here buys back the round trip that ends in a failed job.
 */
const urlField = z.string().trim().url();

/** True when the API could actually start this import. Drives the submit button. */
export function isSubmittable(draft: NewImportDraft): boolean {
  if (!brandIdField.safeParse(draft.brandId).success) return false;
  return needsCsv(draft.sourceType)
    ? draft.csv.trim().length > 0
    : urlField.safeParse(draft.url).success;
}

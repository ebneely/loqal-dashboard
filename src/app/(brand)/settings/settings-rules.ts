/**
 * The parts of /settings that are decisions rather than markup.
 *
 * Pure: no React, no fetch, no DOM. What lives here is the set of things this
 * screen would otherwise get wrong quietly — which delivery routes may be
 * offered, whether a description has a language in it, and which fields are
 * even allowed into the body — so each one can be checked without a browser.
 */
import type { LiveDeliveryMethod } from "@loqal/contracts/brand.contract";
import type { StockSetup } from "@loqal/contracts/enums";
import { moneySchema } from "@loqal/contracts/contracts";

import {
  LIVE_DELIVERY_METHODS,
  updateBrandProfileWireSchema,
  type BrandProfileWire,
  type UpdateBrandProfileWire,
} from "./settings-wire";

// ---------------------------------------------------------------------------
// Delivery routes
// ---------------------------------------------------------------------------

/**
 * The two routes that are actually live, and the refusal of the third.
 *
 * SHIPPING_SERVICE is modelled end to end and has no courier contract behind
 * it. It is unwritable server-side, `StatusPill` renders nothing for it, and it
 * must not be offered here — an unchecked checkbox is still an offer, and a
 * shop that ticks it is promising a delivery nobody can make.
 *
 * It is also DROPPED on the way in rather than merely left out of the options:
 * a legacy row that carries it would otherwise be silently re-sent on the next
 * save, and the write would 400 on a value the brand never chose.
 */
export function liveRoutes(
  supported: readonly string[]
): LiveDeliveryMethod[] {
  return LIVE_DELIVERY_METHODS.filter((route) => supported.includes(route));
}

export const isLiveRoute = (value: string): value is LiveDeliveryMethod =>
  (LIVE_DELIVERY_METHODS as readonly string[]).includes(value);

// ---------------------------------------------------------------------------
// The draft
// ---------------------------------------------------------------------------

/**
 * Every editable value as a STRING, including the numeric ones.
 *
 * A number input whose state is a number cannot hold "the field is empty" and
 * cannot hold "the shop is halfway through typing 4". Both of those are real
 * states of a settings form, and both become 0 the moment the draft is typed as
 * a number — and a 0 delivery fee is a promise to deliver free.
 */
export type SettingsDraft = {
  name: string;
  descriptionAr: string;
  descriptionEn: string;
  notificationPhone: string;
  deliveryFee: string;
  returnWindowDays: string;
  minimumOrderValue: string;
  supportedDelivery: LiveDeliveryMethod[];
  stockSetup: StockSetup;
  legalName: string;
  taxNumber: string;
  invoiceAddress: string;
};

export const EMPTY_DRAFT: SettingsDraft = {
  name: "",
  descriptionAr: "",
  descriptionEn: "",
  notificationPhone: "",
  deliveryFee: "",
  returnWindowDays: "",
  minimumOrderValue: "",
  supportedDelivery: [],
  stockSetup: "ONLINE_ONLY",
  legalName: "",
  taxNumber: "",
  invoiceAddress: "",
};

export function draftFrom(profile: BrandProfileWire): SettingsDraft {
  return {
    name: profile.name,
    descriptionAr: profile.description?.ar ?? "",
    descriptionEn: profile.description?.en ?? "",
    notificationPhone: profile.notificationPhone ?? "",
    deliveryFee: profile.trading.deliveryFee ?? "",
    returnWindowDays: String(profile.trading.returnWindowDays),
    minimumOrderValue: profile.trading.minimumOrderValue ?? "",
    supportedDelivery: liveRoutes(profile.trading.supportedDelivery),
    stockSetup: profile.trading.stockSetup,
    legalName: profile.invoiceIdentity.legalName ?? "",
    taxNumber: profile.invoiceIdentity.taxNumber ?? "",
    invoiceAddress: profile.invoiceIdentity.invoiceAddress ?? "",
  };
}

// ---------------------------------------------------------------------------
// What is wrong with it
// ---------------------------------------------------------------------------

export type SettingsIssue =
  | "noName"
  | "noLanguage"
  | "feeMalformed"
  | "minOrderMalformed"
  | "windowMalformed"
  | "noRoute";

const trimmed = (value: string) => value.trim();

/** Empty means "not set", which is a legitimate value for both money fields. */
const moneyIsMalformed = (value: string) =>
  trimmed(value).length > 0 && !moneySchema.safeParse(trimmed(value)).success;

/**
 * Every reason this draft would be refused, checked here so the shop is told
 * before it presses rather than after the API answers.
 *
 * AT LEAST ONE LANGUAGE, never both. A both-required rule makes a shop
 * unfinishable, which is the same rule the catalog runs on and for the same
 * reason. Neither is not allowed: a storefront with no description in any
 * language is a page with a hole in it.
 */
export function draftIssues(draft: SettingsDraft): SettingsIssue[] {
  const issues: SettingsIssue[] = [];

  if (!trimmed(draft.name)) issues.push("noName");
  if (!trimmed(draft.descriptionAr) && !trimmed(draft.descriptionEn)) {
    issues.push("noLanguage");
  }
  if (moneyIsMalformed(draft.deliveryFee)) issues.push("feeMalformed");
  if (moneyIsMalformed(draft.minimumOrderValue)) issues.push("minOrderMalformed");

  const days = trimmed(draft.returnWindowDays);
  const parsedDays = Number(days);
  if (
    days.length === 0 ||
    !/^\d+$/.test(days) ||
    !Number.isInteger(parsedDays) ||
    parsedDays < 0 ||
    parsedDays > 365
  ) {
    issues.push("windowMalformed");
  }

  // A shop with no route cannot be ordered from at all.
  if (liveRoutes(draft.supportedDelivery).length === 0) issues.push("noRoute");

  return issues;
}

// ---------------------------------------------------------------------------
// The body
// ---------------------------------------------------------------------------

/**
 * The flat body `PATCH /v1/brands/me` accepts, built from the draft.
 *
 * Every field the server does not take is absent by construction rather than by
 * a guard: `settlementMethod`, `settlementDetails`, `invoiceTerms`,
 * `monthlyFee`, `perOrderCharge*`, `freeUntil`, `settlementCadence` and
 * `status` are not in the schema and cannot be added by mistake, because the
 * schema is `.strict()` and the parse happens before the request leaves.
 *
 * An empty text box becomes `null` — "clear this" — for the nullable fields,
 * and an empty language is simply absent from the description rather than sent
 * as "".
 */
export function updateBodyFrom(
  draft: SettingsDraft
): UpdateBrandProfileWire | null {
  const description: { ar?: string; en?: string } = {};
  if (trimmed(draft.descriptionAr)) description.ar = trimmed(draft.descriptionAr);
  if (trimmed(draft.descriptionEn)) description.en = trimmed(draft.descriptionEn);

  const body = {
    name: trimmed(draft.name),
    description,
    notificationPhone: trimmed(draft.notificationPhone) || null,
    deliveryFee: trimmed(draft.deliveryFee) || null,
    returnWindowDays: Number(trimmed(draft.returnWindowDays)),
    minimumOrderValue: trimmed(draft.minimumOrderValue) || null,
    stockSetup: draft.stockSetup,
    supportedDelivery: liveRoutes(draft.supportedDelivery),
    legalName: trimmed(draft.legalName) || null,
    taxNumber: trimmed(draft.taxNumber) || null,
    invoiceAddress: trimmed(draft.invoiceAddress) || null,
  };

  const parsed = updateBrandProfileWireSchema.safeParse(body);
  return parsed.success ? parsed.data : null;
}

// ---------------------------------------------------------------------------
// Who may see what
// ---------------------------------------------------------------------------

/**
 * The owner-only blocks are decided by the PRESENCE of their key, not by the
 * session's role.
 *
 * The server omits `payout` and `loqalTerms` for anyone who is not the owner,
 * so asking the payload is asking the boundary that actually enforces this
 * rather than the cosmetic copy of it in the browser. A session that claims
 * BRAND_OWNER against an API that disagrees renders nothing, which is the safe
 * direction to be wrong in.
 */
export const showsPayout = (profile: BrandProfileWire | null): boolean =>
  Boolean(profile?.payout);

export const showsLoqalTerms = (profile: BrandProfileWire | null): boolean =>
  Boolean(profile?.loqalTerms);

/**
 * The per-order charge as one phrase: "12%" or "45.00 EGP".
 *
 * `perOrderChargeValue` is a percentage when the type is PERCENT and an EGP
 * amount when it is FIXED, and the two read identically as bare numbers — which
 * is a two-hundred-fold difference on a 500 EGP order.
 */
export function perOrderCharge(
  type: "PERCENT" | "FIXED" | null,
  value: string | null,
  format: {
    amount: (amount: string) => string;
    percent: (value: string) => string;
  }
): string | null {
  if (!type || value === null) return null;
  return type === "PERCENT" ? format.percent(value) : format.amount(value);
}

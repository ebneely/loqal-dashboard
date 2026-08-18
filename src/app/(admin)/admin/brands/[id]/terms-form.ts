/**
 * The commercial terms, as a form and as a diff.
 *
 * WHY EVERY BRAND'S DEAL IS DIFFERENT, AND WHY THAT IS DATA
 *
 * `freeUntil`, `monthlyFee`, `perOrderChargeType`, `perOrderChargeValue`,
 * `settlementCadence`, `settlementAnchor`, `settlementMethod` and
 * `settlementDetails` are columns on the brand row rather than a rule in the
 * product because every brand negotiates its own deal in a room, and a sales
 * rep closing at 12% for one shop and 8% for the next is the business working
 * as intended. A pricing rule in code would mean a release per negotiation.
 *
 * The cost of that is that nothing on the screen tells you what the deal IS
 * until you read eight fields and reconstruct it. So this file produces two
 * things a form cannot produce for itself:
 *
 *   `dealSummary`   the deal as one sentence, for the top of the tab.
 *   `termsChanges`  what is about to change, field by field, before saving —
 *                   because "Save" on a form holding somebody's commission is
 *                   not a moment to be vague, and a diff is the only way to
 *                   catch a stray keystroke in the per-order charge.
 *
 * Pure: no React, no fetch, no DOM, and no copy — labels are message KEYS the
 * screen resolves against its own catalogue, so the diff is bilingual for free
 * and testable without one.
 */
import type {
  PerOrderChargeType,
  SettlementCadence,
  SettlementMethod,
} from "@loqal/contracts/enums";

import type {
  AdminBrandDetail,
  AdminUpdateTermsBody,
} from "./brand-detail-data";

/**
 * Every value is a STRING, because every value came out of an input. Empty
 * string means "unset", which is a real state for most of these — a brand with
 * no monthly fee is not a brand with a fee of zero.
 */
export type TermsForm = {
  freeUntil: string;
  monthlyFee: string;
  perOrderChargeType: "" | PerOrderChargeType;
  perOrderChargeValue: string;
  settlementCadence: SettlementCadence;
  settlementAnchor: string;
  settlementMethod: "" | SettlementMethod;
  settlementDetails: string;
};

/** `2026-12-31T00:00:00.000Z` → `2026-12-31`, which is what a date input wants. */
export const asDateInput = (iso: string | null | undefined): string => {
  if (!iso) return "";
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return "";
  return new Date(parsed).toISOString().slice(0, 10);
};

/**
 * `2026-12-31` → an ISO datetime, because the contract's `freeUntil` is
 * `z.string().datetime()` and a bare date fails it. Midnight UTC, deliberately:
 * a free period that ends "on the 31st" ends at the start of the 31st in every
 * timezone this is read in, which is the reading that never gives a brand a day
 * it was not sold.
 */
export const asInstant = (date: string): string | null => {
  if (!date) return null;
  const parsed = Date.parse(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString();
};

export function termsFormFrom(detail: AdminBrandDetail): TermsForm {
  return {
    freeUntil: asDateInput(detail.freeUntil),
    monthlyFee: detail.monthlyFee ?? "",
    perOrderChargeType: detail.perOrderChargeType ?? "",
    perOrderChargeValue: detail.perOrderChargeValue ?? "",
    settlementCadence: detail.settlementCadence ?? "WEEKLY",
    settlementAnchor:
      detail.settlementAnchor === null || detail.settlementAnchor === undefined
        ? ""
        : String(detail.settlementAnchor),
    settlementMethod: detail.settlementMethod ?? "",
    settlementDetails: detail.settlementDetails ?? "",
  };
}

/**
 * Only what CHANGED is sent.
 *
 * A PATCH that echoes back every field it read is how two admins editing two
 * different tabs overwrite each other, and how a field nobody touched acquires
 * a value because a form defaulted it. The body is built from the diff, so an
 * untouched field is absent rather than resent.
 */
export function termsBodyFrom(
  before: TermsForm,
  after: TermsForm
): AdminUpdateTermsBody {
  const body: AdminUpdateTermsBody = {};

  if (after.freeUntil !== before.freeUntil) {
    body.freeUntil = asInstant(after.freeUntil);
  }
  if (after.monthlyFee !== before.monthlyFee) {
    body.monthlyFee = after.monthlyFee === "" ? null : after.monthlyFee;
  }
  if (after.perOrderChargeType !== before.perOrderChargeType) {
    body.perOrderChargeType =
      after.perOrderChargeType === "" ? null : after.perOrderChargeType;
  }
  if (after.perOrderChargeValue !== before.perOrderChargeValue) {
    body.perOrderChargeValue =
      after.perOrderChargeValue === "" ? null : after.perOrderChargeValue;
  }
  if (after.settlementCadence !== before.settlementCadence) {
    body.settlementCadence = after.settlementCadence;
  }
  if (after.settlementAnchor !== before.settlementAnchor) {
    body.settlementAnchor =
      after.settlementAnchor === "" ? null : Number(after.settlementAnchor);
  }
  if (after.settlementMethod !== before.settlementMethod) {
    body.settlementMethod =
      after.settlementMethod === "" ? null : after.settlementMethod;
  }
  if (after.settlementDetails !== before.settlementDetails) {
    body.settlementDetails =
      after.settlementDetails === "" ? null : after.settlementDetails;
  }

  return body;
}

/** Which catalogue key names each field. The screen resolves them. */
export const TERMS_LABEL_KEY = {
  freeUntil: "freeUntil",
  monthlyFee: "monthlyFee",
  perOrderChargeType: "perOrder",
  perOrderChargeValue: "perOrderValue",
  settlementCadence: "cadence",
  settlementAnchor: "anchorDay",
  settlementMethod: "settlementMethod",
  settlementDetails: "account",
} as const satisfies Record<keyof TermsForm, string>;

export type TermsChange = {
  field: keyof TermsForm;
  labelKey: (typeof TERMS_LABEL_KEY)[keyof TermsForm];
  from: string;
  to: string;
};

/** Field by field, in the order the form draws them. */
export function termsChanges(
  before: TermsForm,
  after: TermsForm
): TermsChange[] {
  const fields = Object.keys(TERMS_LABEL_KEY) as (keyof TermsForm)[];
  return fields
    .filter((field) => before[field] !== after[field])
    .map((field) => ({
      field,
      labelKey: TERMS_LABEL_KEY[field],
      from: before[field],
      to: after[field],
    }));
}

/**
 * The deal in one sentence, built from template fragments the caller supplies.
 *
 * Returns the PIECES rather than a joined string so the screen can lay them out
 * and so nothing here has to know which direction the text runs.
 */
export type DealPart = { labelKey: string; value: string };

export function dealSummary(form: TermsForm): DealPart[] {
  return [
    { labelKey: "freeUntil", value: form.freeUntil },
    { labelKey: "monthlyFee", value: form.monthlyFee },
    {
      labelKey: "perOrder",
      value:
        form.perOrderChargeType === "" || form.perOrderChargeValue === ""
          ? ""
          : form.perOrderChargeType === "PERCENT"
            ? `${form.perOrderChargeValue}%`
            : `${form.perOrderChargeValue} EGP`,
    },
    { labelKey: "cadence", value: form.settlementCadence },
    { labelKey: "settlementMethod", value: form.settlementMethod },
  ];
}

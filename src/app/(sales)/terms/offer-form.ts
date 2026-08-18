/**
 * The band a rep may close inside, as pure arithmetic over the band the API
 * returned. No React, no DOM — this is the one calculation on the sales console
 * that decides whether a request is even worth sending, and it is tested
 * without rendering anything.
 *
 * THE BAND IS THE SERVER'S, ALWAYS. Nothing here clamps, rounds or corrects a
 * figure to fit: `SalesService.setTerms` answers 422 with the list of
 * violations, never a warning and never a silent clamp, and a screen that
 * quietly nudged 4.5% up to the 5% floor would be a rep telling a shop one
 * number and Loqal recording another. What these functions do is let the screen
 * REFUSE TO SEND an offer the server would reject, and say why in the same
 * words the server would have used.
 */
import type { SalesTermsBand } from "@loqal/contracts/sales.contract";

/**
 * `bps` is the unit `PlatformSetting.salesCommissionFloorBps` is stored in and
 * `perOrderChargeValue` is a percentage as a money string, so the comparison
 * the server makes is `value * 100 >= floorBps`
 * (`lib/commercial-band.ts:bandViolations`). Mirrored exactly rather than
 * approximated: 5% is 500 bps, and a screen using 0.05 anywhere in this file is
 * a hundred-fold error in the direction of signing away the margin.
 */
export const percentToBps = (percent: number): number =>
  Math.round(percent * 100);

export const bpsToPercent = (bps: number): number => bps / 100;

export type BandCheck = "unbounded" | "inside" | "outside";

/**
 * `commissionFloorBps === null` means unbounded, which is the state Loqal is
 * actually in while it signs its first brands. Unbounded is NOT "anything
 * goes": the screen still labels it, because a rep who thinks a floor exists
 * behaves differently from one who knows the number is going to an admin.
 */
export function commissionCheck(
  percentText: string,
  band: SalesTermsBand
): BandCheck {
  if (band.commissionFloorBps === null) return "unbounded";
  const percent = Number(percentText);
  if (percentText.trim() === "" || Number.isNaN(percent)) return "inside";
  return percentToBps(percent) < band.commissionFloorBps ? "outside" : "inside";
}

export function freeMonthsCheck(
  months: number,
  band: SalesTermsBand
): BandCheck {
  if (band.maxFreeMonths === null) return "unbounded";
  return months > band.maxFreeMonths ? "outside" : "inside";
}

/**
 * The free-period options a rep may actually pick, plus the ones they may not,
 * labelled as such rather than hidden.
 *
 * Hiding an out-of-band option would leave a rep unable to answer "can you do
 * six months?" with anything but a shrug. Showing it disabled, with the reason,
 * is what lets them say "not without an admin" — which is the true sentence and
 * the one that keeps the conversation going.
 */
export function freeMonthOptions(band: SalesTermsBand): {
  months: number;
  allowed: boolean;
}[] {
  const ceiling = Math.max(
    band.maxFreeMonths ?? 0,
    band.defaultFreeMonths,
    6
  );
  const options: { months: number; allowed: boolean }[] = [];
  for (let months = 0; months <= ceiling; months += 1) {
    options.push({
      months,
      allowed: freeMonthsCheck(months, band) !== "outside",
    });
  }
  return options;
}

/**
 * `freeUntil` as an instant, derived from a whole number of months.
 *
 * The server compares against `addMonths(now, maxFreeMonths)` at the moment the
 * request lands, so a screen that sat open for an hour can send a date the
 * server now considers out of band. That is a 422 and the screen treats it as
 * one — it reloads the band and asks again rather than shifting the date to fit.
 *
 * Zero months is `null`, not "today": `null` is the column's own "no free
 * period", and a `freeUntil` in the past would read as an expired offer.
 */
export function freeUntilFrom(months: number, now: Date): string | null {
  if (months <= 0) return null;
  const end = new Date(now.getTime());
  const day = end.getUTCDate();
  end.setUTCMonth(end.getUTCMonth() + months);
  // A 31st rolling into a short month lands in the next one; pull it back to
  // the last day of the intended month rather than silently adding free days.
  if (end.getUTCDate() < day) end.setUTCDate(0);
  return end.toISOString();
}

export type OfferDraft = {
  /** A percentage, as typed. "2.5" means 2.5% of each order. */
  commissionPercent: string;
  freeMonths: number;
};

export function draftFrom(band: SalesTermsBand): OfferDraft {
  return {
    commissionPercent:
      band.commissionFloorBps === null
        ? ""
        : String(bpsToPercent(band.commissionFloorBps)),
    freeMonths: band.defaultFreeMonths,
  };
}

/** Everything wrong with this offer, in the screen's own vocabulary. */
export type OfferProblem = "commissionMissing" | "belowFloor" | "aboveMax";

export function offerProblems(
  draft: OfferDraft,
  band: SalesTermsBand
): OfferProblem[] {
  const problems: OfferProblem[] = [];
  const percent = Number(draft.commissionPercent);

  if (
    draft.commissionPercent.trim() === "" ||
    Number.isNaN(percent) ||
    percent < 0
  ) {
    problems.push("commissionMissing");
  } else if (commissionCheck(draft.commissionPercent, band) === "outside") {
    problems.push("belowFloor");
  }

  if (freeMonthsCheck(draft.freeMonths, band) === "outside") {
    problems.push("aboveMax");
  }

  return problems;
}

export const isSendable = (draft: OfferDraft, band: SalesTermsBand): boolean =>
  offerProblems(draft, band).length === 0;

/**
 * The request body — and it is deliberately THREE keys, not seven.
 *
 * `setSalesTermsSchema` also accepts `monthlyFee`, `settlementCadence`,
 * `settlementAnchor` and `settlementMethod`. None of them is bounded by the
 * band (`bandViolations` checks `freeUntil`, `perOrderChargeType` and
 * `perOrderChargeValue` and nothing else), so a rep setting them would be a
 * commercial decision with no guard rail behind it. They stay on the admin
 * path, where the write is attributable, and this console does not send them.
 *
 * `settlementDetails` is not on the rep's schema at all — the payout account is
 * admin-only and `.strict()` is what enforces that. Nothing in this file could
 * send it if it tried.
 *
 * `PERCENT` is hard-coded because `FIXED` cannot be verified against a bps
 * floor at all: `bandViolations` fails a FIXED offer closed the moment a floor
 * exists. Offering a rep a charge type whose every value needs admin approval
 * would be a control that only ever produces a refusal.
 */
export function offerBodyFrom(
  draft: OfferDraft,
  now: Date
): {
  perOrderChargeType: "PERCENT";
  perOrderChargeValue: string;
  freeUntil: string | null;
} {
  return {
    perOrderChargeType: "PERCENT",
    // Money crosses the wire as a string with at most two decimals — see
    // `moneySchema`. `Number.toFixed(2)` is the shape the API's `money`
    // primitive accepts, and `"2.5"` typed by a rep is `"2.50"` on the wire.
    perOrderChargeValue: Number(draft.commissionPercent).toFixed(2),
    freeUntil: freeUntilFrom(draft.freeMonths, now),
  };
}

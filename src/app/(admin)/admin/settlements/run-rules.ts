/**
 * The rules that decide what may be pressed on a settlement run, and whether
 * the figure it would act on can be trusted.
 *
 * Pure functions with no React and no fetch, because this is the one place in
 * the console where being wrong costs money rather than a re-render. The
 * backend enforces every rule below as well — `SettlementService` refuses a
 * direction mismatch with a 400 and a re-close with a 409 — and that is exactly
 * why these are here too: a button that answers 409 is a worse screen than a
 * button that was never drawn.
 */
import type {
  SettlementDirection,
  SettlementStatus,
} from "@loqal/contracts/enums";
import type {
  SettlementLine,
  SettlementRun,
} from "@loqal/contracts/settlement.contract";

/**
 * The three marks, and never a fourth.
 *
 * PENDING is deliberately absent. A run can be marked sent, received or
 * cancelled, and never back to pending — marking one back would erase the
 * record that a person checked the figure, which is the only control standing
 * between a mistake and a payment.
 */
export type RunMark = "SENT" | "RECEIVED" | "CANCELLED";

/**
 * Which mark this run may take.
 *
 * DIRECTION DECIDES THE VERB, and it is not a preference. `WE_PAY` means Loqal
 * is holding card money for the brand, so the only honest mark is SENT and it
 * writes the closing PAYOUT entry. `THEY_PAY` means the brand is holding cash
 * Loqal is owed, so the only honest mark is RECEIVED and it writes the closing
 * BRAND_PAYMENT entry. Offering both would let an admin write a payout entry
 * for money that came the other way, which double-counts on the very next run.
 *
 * CANCELLED is available in both directions: it writes no closing entry at all,
 * so the amounts stay on the balance and roll into the next period.
 */
export function allowedMarks(run: {
  direction: SettlementDirection;
  status: SettlementStatus;
}): readonly RunMark[] {
  if (run.status !== "PENDING") return [];
  return run.direction === "WE_PAY"
    ? (["SENT", "CANCELLED"] as const)
    : (["RECEIVED", "CANCELLED"] as const);
}

export const isMarkable = (run: {
  direction: SettlementDirection;
  status: SettlementStatus;
}): boolean => allowedMarks(run).length > 0;

// ---------------------------------------------------------------------------
// Does the figure actually add up?
// ---------------------------------------------------------------------------

/**
 * Sum a page of ledger lines, as a signed money STRING.
 *
 * NEVER `parseFloat`. `netAmount` is `Decimal(10,2)` on the wire and the whole
 * point of this screen is letting a human confirm a figure before money moves;
 * summing forty lines as IEEE doubles is how 1,204.00 becomes 1,203.9999999998
 * and an admin decides the ledger is broken.
 *
 * So the arithmetic is in integer PIASTRES and returns null the moment anything
 * would leave the exactly-representable range, or the moment a line's amount
 * does not match the shape the contract promised. Null means "this check could
 * not be run", which the screen prints as a sentence — it never means zero.
 */
export function sumLines(lines: readonly { amount: string }[]): string | null {
  let piastres = 0;

  for (const line of lines) {
    const match = /^(-?)(\d{1,8})(?:\.(\d{1,2}))?$/.exec(line.amount);
    if (!match) return null;
    const [, sign, whole, fraction = ""] = match;
    const value = Number(whole) * 100 + Number(`${fraction}00`.slice(0, 2));
    piastres += sign === "-" ? -value : value;
    if (!Number.isSafeInteger(piastres)) return null;
  }

  const negative = piastres < 0;
  const abs = Math.abs(piastres);
  return `${negative ? "-" : ""}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

export type SumCheck =
  /** Every line is loaded and the total matches the run's own figure. */
  | { kind: "agrees"; total: string }
  /** Every line is loaded and the total does NOT match. Do not mark this run. */
  | { kind: "disagrees"; total: string }
  /** More pages remain, so no verdict is possible yet. */
  | { kind: "incomplete"; total: string | null }
  /** An amount was outside the range this check can hold exactly. */
  | { kind: "uncheckable" };

/**
 * The verdict, and the reason there is no fourth outcome.
 *
 * "The lines I have so far add up to less than the figure" is not a
 * disagreement — it is an unfinished sum, and rendering it as a mismatch would
 * cry wolf on every run with more than one page. So a remaining cursor forces
 * `incomplete` regardless of what the loaded lines total, and the screen
 * refuses the check rather than guessing at it.
 */
export function checkSum(
  run: Pick<SettlementRun, "netAmount">,
  lines: readonly Pick<SettlementLine, "amount">[],
  hasMore: boolean
): SumCheck {
  const total = sumLines(lines);
  if (total === null) return { kind: "uncheckable" };
  if (hasMore) return { kind: "incomplete", total };
  return normalise(total) === normalise(run.netAmount)
    ? { kind: "agrees", total }
    : { kind: "disagrees", total };
}

/**
 * "-0.00" and "0.00" are the same money; "1240" and "1240.00" are the same
 * money. The wire is not consistent about either, so both are flattened before
 * the comparison rather than after somebody files a bug about a run that will
 * not mark.
 */
function normalise(amount: string): string {
  const negative = amount.startsWith("-");
  const [whole = "0", fraction = ""] = (negative ? amount.slice(1) : amount).split(".");
  const cents = `${fraction}00`.slice(0, 2);
  const digits = `${String(Number(whole))}.${cents}`;
  return digits === "0.00" ? "0.00" : `${negative ? "-" : ""}${digits}`;
}

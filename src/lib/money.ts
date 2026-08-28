/**
 * Money formatting that never touches a float.
 *
 * The amount arrives as a string and leaves as a string. parseFloat here would
 * reintroduce exactly the precision problem the string representation exists to
 * avoid — and it is the ledger it would be wrong about, so it would be wrong
 * about what a shop is owed.
 */
import { balanceDirection, type SignedMoney } from "@loqal/contracts/money";

export { balanceDirection };
export type { SignedMoney, BalanceDirection } from "@loqal/contracts/money";

const group = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/** The typographic minus, not the hyphen the wire uses. */
export const MINUS = "−";

export type FormattedMoney = {
  /** "1,240.00" — always two decimals, always grouped, never signed. */
  absolute: string;
  /** "+", "−" or "" for a settled balance. */
  sign: "" | "+" | typeof MINUS;
  negative: boolean;
};

/**
 * Split a signed money string into the parts a UI shows separately, so the sign
 * can be given its own treatment and never silently disappear into a column of
 * right-aligned numbers.
 */
export function formatMoneyParts(amount: SignedMoney | string): FormattedMoney {
  const negative = amount.startsWith("-");
  const unsigned = negative ? amount.slice(1) : amount;
  const [whole = "0", fraction = ""] = unsigned.split(".");
  const cents = `${fraction}00`.slice(0, 2);
  const settled = /^0*$/.test(whole) && /^0*$/.test(cents);

  return {
    absolute: `${group(whole || "0")}.${cents}`,
    sign: settled ? "" : negative ? MINUS : "+",
    negative,
  };
}

/**
 * A grouped integer — "12,400" — with Latin digits in every language.
 *
 * `value.toLocaleString("ar")` returns ١٢٬٤٠٠, which is then rendered into
 * `.lq-kpi-val` — Source Code Pro, `subsets: ["latin"]`, no Arabic glyphs at
 * all. The figure falls back to another face mid-number, at a different weight
 * and width, inside a column meant to be compared down. Three live screens did
 * exactly that.
 *
 * Grouped textually for the same reason `formatMoney` is: no Intl, so there is
 * no locale to get wrong, and no float.
 */
export const formatCount = (value: number): string =>
  group(String(Math.trunc(value)));

/**
 * "1,240.00 EGP".
 *
 * The figure keeps Latin digits and the EGP mark in both languages, as the
 * design system's MoneyRow does: an Arabic screen still shows a number a shop
 * owner can read against a bank statement, and mixed numeral systems in one
 * column are how a 7 gets read as a 1.
 */
export function formatMoney(
  amount: SignedMoney | string,
  options: { withSign?: boolean } = {}
): string {
  const { absolute, sign } = formatMoneyParts(amount);
  const signed = options.withSign && sign ? `${sign}${absolute}` : absolute;
  return `${signed} EGP`;
}

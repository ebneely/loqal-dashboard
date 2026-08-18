import { z } from 'zod';
import { moneySchema } from './contracts';

export { moneySchema };
export type { Money } from './contracts';

/**
 * A signed EGP amount, which the unsigned moneySchema deliberately refuses.
 *
 * A brand's balance is SUM(LedgerEntry.amount) and it genuinely goes both ways.
 * Card orders settle to Loqal and cash orders settle to the brand, so the same
 * brand is owed money one week and owes it the next. One signed figure keeps
 * that in a single place instead of two half-ledgers that never quite agree —
 * which is why this is a separate schema rather than a relaxation of the other
 * one. A price must never be negative; a balance must be allowed to be.
 */
export const signedMoneySchema = z
  .string()
  .regex(/^-?\d{1,8}(\.\d{1,2})?$/, 'Expected a signed amount like -1240.00');

export type SignedMoney = z.infer<typeof signedMoneySchema>;

/** Which side of a signed balance an amount falls on. */
export type BalanceDirection = 'LOQAL_OWES_BRAND' | 'BRAND_OWES_LOQAL' | 'SETTLED';

/**
 * Read the sign without doing float arithmetic on money. The string is the
 * source of truth all the way to the screen; parseFloat here would reintroduce
 * exactly the precision problem the string representation exists to avoid.
 */
export const balanceDirection = (amount: SignedMoney): BalanceDirection => {
  if (/^-0*(\.0{1,2})?$/.test(amount) || /^0*(\.0{1,2})?$/.test(amount)) return 'SETTLED';
  return amount.startsWith('-') ? 'BRAND_OWES_LOQAL' : 'LOQAL_OWES_BRAND';
};

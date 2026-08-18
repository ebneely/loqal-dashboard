import { z } from 'zod';
import { LedgerEntryTypeSchema } from './enums';
import { signedMoneySchema } from './money';
import { pageSchema } from './pagination';

/**
 * The money record. Two rules shape every schema here.
 *
 * APPEND-ONLY: a correction is a reversing entry, never an edit. There is no
 * update or delete body in this file, and there must never be one.
 *
 * SIGNED: balance is SUM(amount). Positive means Loqal owes the brand,
 * negative means the brand owes Loqal. Card orders settle to Loqal and cash
 * orders settle to the brand, so the same brand flips between the two in
 * consecutive weeks. One signed figure keeps that in a single place instead of
 * two half-ledgers that never quite agree.
 *
 * Shipping NEVER appears here. Loqal runs no fulfilment and pays no courier,
 * so a delivery fee in a balance means we owe money we never collected.
 */

export const ledgerEntrySchema = z
  .object({
    id: z.string().uuid(),
    type: LedgerEntryTypeSchema,
    amount: signedMoneySchema,
    note: z.string().nullable(),
    brandOrderId: z.string().uuid().nullable(),
    orderNumber: z.string().nullable(),
    createdAt: z.string().datetime(),
  })
  .strict();
export type LedgerEntry = z.infer<typeof ledgerEntrySchema>;

export const ledgerPageSchema = pageSchema(ledgerEntrySchema);
export type LedgerPage = z.infer<typeof ledgerPageSchema>;

export const listLedgerQuerySchema = z
  .object({
    type: LedgerEntryTypeSchema.optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
export type ListLedgerQuery = z.infer<typeof listLedgerQuerySchema>;

/**
 * `direction` names the party rather than describing the sign. "Negative" is a
 * fact about a number; "you owe Loqal" is the thing the shop owner actually
 * needs to read off a phone in a busy shop, and it is the single most
 * misreadable figure in the product.
 */
export const brandBalanceSchema = z
  .object({
    amount: signedMoneySchema,
    direction: z.enum(['LOQAL_OWES_BRAND', 'BRAND_OWES_LOQAL', 'SETTLED']),
    asOf: z.string().datetime(),
  })
  .strict();
export type BrandBalance = z.infer<typeof brandBalanceSchema>;

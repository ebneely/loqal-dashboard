import { z } from 'zod';
import {
  SettlementDirectionSchema,
  SettlementMethodSchema,
  SettlementStatusSchema,
} from './enums';
import { LedgerEntryTypeSchema } from './enums';
import { signedMoneySchema } from './money';
import { pageSchema } from './pagination';

/**
 * Settlement is the only part of this system that has to run whether anyone is
 * watching or not, and our entire income arrives through it.
 *
 * NOTHING MOVES MONEY ON ITS OWN. A daily job raises a run; a human marks it
 * sent or received. That is deliberate at this size: a wrong payout sent
 * automatically is money gone, while a wrong figure on a screen is a
 * conversation. There is no field in this file that could describe an
 * automatic transfer, and there must never be one.
 */

export const settlementRunSchema = z
  .object({
    id: z.string().uuid(),
    brandId: z.string().uuid(),
    brandName: z.string(),
    periodStart: z.string().datetime(),
    periodEnd: z.string().datetime(),
    /** Computed from the ledger lines in the period. Never a stored total. */
    netAmount: signedMoneySchema,
    direction: SettlementDirectionSchema,
    status: SettlementStatusSchema,
    /**
     * Where the money goes, shown next to the figure so both are checked
     * together.
     *
     * THE SAME TWO FIELDS AS `brandPayoutSchema`, AND THE SAME AUDIENCE. This
     * run reaches a brand through `GET /v1/brands/me/settlements`, which is
     * `BRAND_OWNER`-only — money is the one thing an employee never sees — so
     * the payout account on a brand-plane run is an owner's read, exactly as it
     * is on `/v1/brands/me`.
     *
     * The two projections disagreed until recently: this schema carried the
     * account while the brand's own page withheld it, which meant the field an
     * owner was "protected" from reading was already on their settlements page.
     * A withholding that one surface honours and another does not protects
     * nobody and hides the disclosure from whoever audits it. If either
     * surface's audience changes, both change together.
     */
    settlementMethod: SettlementMethodSchema.nullable(),
    settlementDetails: z.string().nullable(),
    markedBy: z.string().uuid().nullable(),
    markedAt: z.string().datetime().nullable(),
    note: z.string().nullable(),
    createdAt: z.string().datetime(),
  })
  .strict();
export type SettlementRun = z.infer<typeof settlementRunSchema>;

export const settlementRunPageSchema = pageSchema(settlementRunSchema);
export type SettlementRunPage = z.infer<typeof settlementRunPageSchema>;

/**
 * A ledger line as the ADMIN settlement detail serves it.
 *
 * Wider than the brand-plane ledgerEntrySchema by exactly `brandId`: this
 * response is built by spreading the LedgerEntry row, and it has no
 * `orderNumber` because it never joins the order. Not interchangeable with the
 * brand shape, and deliberately a separate schema rather than a loosened one.
 */
export const settlementLineSchema = z
  .object({
    id: z.string().uuid(),
    brandId: z.string().uuid(),
    brandOrderId: z.string().uuid().nullable(),
    type: LedgerEntryTypeSchema,
    amount: signedMoneySchema,
    note: z.string().nullable(),
    createdAt: z.string().datetime(),
  })
  .strict();
export type SettlementLine = z.infer<typeof settlementLineSchema>;

export const settlementLinePageSchema = pageSchema(settlementLineSchema);

/**
 * The detail view exists so a wrong figure is obvious BEFORE the button is
 * pressed — the run, and every ledger line that produced its number.
 */
export const settlementRunDetailSchema = z
  .object({
    run: settlementRunSchema,
    /**
     * Paginated, not a bare array. A monthly run on a busy brand covers
     * hundreds of lines, and the screen whose entire job is letting a human
     * check a figure before pressing a button must not be the one screen that
     * ships an unbounded response.
     */
    entries: settlementLinePageSchema,
  })
  .strict();
export type SettlementRunDetail = z.infer<typeof settlementRunDetailSchema>;

/**
 * Two schemas, not one with an optional field.
 *
 * The admin plane filters across brands; the brand plane is scoped by session
 * and must never accept a brandId at all. Sharing one schema means the only
 * thing standing between a brand and another brand's settlement figures is the
 * controller remembering to ignore a parameter — and `.strict()` on the narrow
 * shape turns that from a convention into a 400.
 */
export const listSettlementRunsQuerySchema = z
  .object({
    status: SettlementStatusSchema.optional(),
    brandId: z.string().uuid().optional(),
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
export type ListSettlementRunsQuery = z.infer<typeof listSettlementRunsQuerySchema>;

export const listMySettlementRunsQuerySchema = listSettlementRunsQuerySchema
  .omit({ brandId: true })
  .strict();
export type ListMySettlementRunsQuery = z.infer<typeof listMySettlementRunsQuerySchema>;

/**
 * PENDING is missing on purpose. It is the state a run is raised in, and
 * marking one back to it would erase the record that a human looked at the
 * figure — which is the only control standing between a mistake and a payment.
 */
export const markSettlementBodySchema = z
  .object({
    status: z.enum(['SENT', 'RECEIVED', 'CANCELLED']),
    /** 300, not 500 — the length the API actually accepts. */
    note: z.string().max(300).optional(),
  })
  .strict();
export type MarkSettlementBody = z.infer<typeof markSettlementBodySchema>;

import { z } from 'zod';
import { moneySchema } from './contracts';
import { ReturnRouteSchema, ReturnStatusSchema } from './enums';
import { pageSchema } from './pagination';

/**
 * Returns are per BRAND ORDER, never per parent order — one brand's items may
 * come back while another's stay.
 *
 * A refused cash-on-delivery order is NOT a return. Nothing was paid, so there
 * is nothing to give back and nothing to bill; that is a DELIVERY_FAILED on the
 * brand order and it writes no ledger entry. This is why `status` here is typed
 * against ReturnStatus and cannot express it.
 */

export const listReturnsQuerySchema = z
  .object({
    status: ReturnStatusSchema.optional(),
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
export type ListReturnsQuery = z.infer<typeof listReturnsQuerySchema>;

export const returnListItemSchema = z
  .object({
    id: z.string().uuid(),
    /**
     * The brand order this came out of, so a row in the returns queue can open
     * the order it belongs to. Without it the screen can print an order number
     * and link to nothing, which is what it does today.
     */
    brandOrderId: z.string().uuid(),
    orderNumber: z.string(),
    status: ReturnStatusSchema,
    /**
     * NULLABLE, and that is the whole point of the approve body below. The
     * route is not known when a shopper files a return — the brand decides
     * whether the item comes back by courier or over the counter at the moment
     * it approves. A non-nullable route here forced the screen to claim a
     * decision nobody had made yet.
     */
    route: ReturnRouteSchema.nullable(),
    itemCount: z.number().int().min(1),
    reason: z.string(),
    /** Recorded when the brand accepts. Null until then, and on a rejection. */
    refundAmount: moneySchema.nullable(),
    requestedAt: z.string().datetime(),
    approvedAt: z.string().datetime().nullable(),
    restockedAt: z.string().datetime().nullable(),
  })
  .strict();
export type ReturnListItem = z.infer<typeof returnListItemSchema>;

export const returnPageSchema = pageSchema(returnListItemSchema);
export type ReturnPage = z.infer<typeof returnPageSchema>;

/**
 * Approval restocks the item and writes an audit row.
 *
 * `route` is REQUIRED and carries no default. Approving is the moment the
 * brand decides how the goods physically come back, and the two answers are
 * not interchangeable: WALK_IN proves the handover the instant it happens and
 * settles in minutes, while COURIER proves it later with a tracking reference
 * and drags on for a week. Defaulting one would have the system book a courier
 * for a customer who lives round the corner.
 *
 * There is deliberately no `note`. The earlier shape had one and nothing else,
 * which is how the screen came to send `{}` to a route that requires a route —
 * a guaranteed 400 on the one button in this file that matters.
 */
export const approveReturnBodySchema = z
  .object({
    route: ReturnRouteSchema,
    /**
     * Recorded, not moved. The money side of a refund belongs to settlement;
     * this writes Return.refundAmount and no ledger entry. Optional because a
     * brand may accept goods back before the figure is agreed.
     */
    refundAmount: moneySchema.optional(),
    /** Only meaningful on COURIER, which proves the handover with one. */
    trackingRef: z.string().trim().max(120).optional(),
  })
  .strict();
export type ApproveReturnBody = z.infer<typeof approveReturnBodySchema>;

/** A rejection is a decision a shopper will ask about, so it carries a reason. */
export const rejectReturnBodySchema = z
  .object({
    reason: z.string().trim().min(1).max(500),
  })
  .strict();
export type RejectReturnBody = z.infer<typeof rejectReturnBodySchema>;

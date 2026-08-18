import { z } from 'zod';
import { moneySchema } from './contracts';
import { pageSchema } from './pagination';

/**
 * An invoice is issued per BRAND ORDER, never per parent order.
 *
 * Each brand files its own tax, and the issuer block is read from that brand's
 * own record rather than hard-coded to Loqal — so a two-brand basket produces
 * two invoices in two different companies' names. There is deliberately no
 * `orderId` on this shape: a parent order spans brands and cannot belong to
 * any one brand's tax position.
 */

/**
 * `raisedAt` and `issuedAt` are two different moments and the wire shape has to
 * say so. The row is raised when the brand order completes; the PDF is rendered
 * asynchronously by a worker, and until it succeeds there is nothing to issue.
 * Collapsing them into one required timestamp forces every client to show a
 * render that has not happened yet as though it had — and leaves no way to say
 * a render failed.
 */
export const invoiceListItemSchema = z
  .object({
    id: z.string().uuid(),
    reference: z.string(),
    brandOrderId: z.string().uuid(),
    orderNumber: z.string(),
    netAmount: moneySchema,
    /**
     * BACKEND GAP: InvoiceService.listForBrand emits neither `status` nor
     * `raisedAt`, and fills `issuedAt` with `row.issuedAt ?? row.createdAt`
     * "so the list still has a date". That fallback is the bug this shape
     * exists to prevent — it prints an issue date for a document that does
     * not exist and leaves a FAILED render indistinguishable from a finished
     * one. Both fields are already on InvoiceRecord; only the view drops them.
     */
    status: z.enum(['PENDING', 'GENERATED', 'FAILED']),
    raisedAt: z.string().datetime(),
    /** Null until the PDF exists. Never falls back to raisedAt. */
    issuedAt: z.string().datetime().nullable(),
  })
  .strict();
export type InvoiceListItem = z.infer<typeof invoiceListItemSchema>;

export const invoicePageSchema = pageSchema(invoiceListItemSchema);
export type InvoicePage = z.infer<typeof invoicePageSchema>;

/** The issuer block, read from the brand — never from Loqal. */
export const invoiceIssuerSchema = z
  .object({
    /** The trading name. Always set, because every brand has one. */
    name: z.string(),
    /**
     * The registered entity, which is often not the trading name and is what
     * a tax authority reads. Nullable: a brand that has not filled it in yet
     * still trades, and the template falls back to `name`.
     */
    legalName: z.string().nullable(),
    taxNumber: z.string().nullable(),
    address: z.string().nullable(),
    terms: z.string().nullable(),
  })
  .strict();

export const invoiceDetailSchema = invoiceListItemSchema
  .extend({
    issuer: invoiceIssuerSchema,
    /** Absent until the worker has rendered the PDF. */
    pdfUrl: z.string().url().nullable(),
  })
  .strict();
export type InvoiceDetail = z.infer<typeof invoiceDetailSchema>;

export const listInvoicesQuerySchema = z
  .object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
export type ListInvoicesQuery = z.infer<typeof listInvoicesQuerySchema>;

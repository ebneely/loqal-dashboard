import { z } from 'zod';
import { moneySchema } from './contracts';
import {
  BrandOrderStatusSchema,
  DeliveryMethodSchema,
  OrderStatusSchema,
  PaymentMethodSchema,
  PaymentProviderSchema,
  PaymentStatusSchema,
  SettlementTargetSchema,
} from './enums';
import { pageSchema } from './pagination';

/**
 * Orders as a brand sees them.
 *
 * The whole file is shaped by one rule: a brand sees ITS slice and nothing
 * else. A shopper can buy from two brands in one basket and one checkout, and
 * each brand fulfils independently — so there is deliberately no parent total,
 * no sibling brand, and no combined status anywhere below. Adding one is a
 * security change rather than a feature (US-BRAND-011).
 */

export const listBrandOrdersQuerySchema = z
  .object({
    status: BrandOrderStatusSchema.optional(),
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
export type ListBrandOrdersQuery = z.infer<typeof listBrandOrdersQuerySchema>;

export const brandOrderListItemSchema = z
  .object({
    id: z.string().uuid(),
    orderNumber: z.string(),
    status: BrandOrderStatusSchema,
    deliveryMethod: DeliveryMethodSchema,
    /**
     * Nullable because it genuinely can be unknown: the Payment row is written
     * per order and a brand order can be read before one exists for it. Cash
     * versus card decides whether the shop collects at the door, so it belongs
     * on the row and not only in the detail.
     *
     * BACKEND GAP: OrderQueryService.listForBrand does not project this yet.
     * Until it does, /orders and /today fail to parse against the real API.
     */
    paymentMethod: PaymentMethodSchema.nullable(),
    itemCount: z.number().int(),
    /** This brand's items only. Never the basket. */
    itemsTotal: moneySchema,
    placedAt: z.string().datetime(),
    /**
     * When this brand order entered its CURRENT status — what an SLA counts.
     * The Today screen ranks by how long a shopper has been waiting on the
     * step the order is actually stuck on, so it moves with every transition
     * rather than freezing at the shelf check.
     *
     * Nullable is DEFENSIVE, not expected. An earlier version of this comment
     * claimed the first read could race the row recording the opening status —
     * it cannot: `createOrderGraph` writes the BrandOrder and that history row
     * in one transaction, and the backend falls back to `BrandOrder.createdAt`
     * regardless, so it never actually returns null today.
     *
     * Kept nullable anyway because the alternative is a strict client that
     * rejects a whole page of orders if the fallback is ever removed, and a
     * missing timestamp is a cosmetic loss on one row. The null branch should
     * be unreachable; treat reaching it as a signal, not as a normal state.
     */
    waitingSince: z.string().datetime().nullable(),
  })
  .strict();
export type BrandOrderListItem = z.infer<typeof brandOrderListItemSchema>;

export const brandOrderPageSchema = pageSchema(brandOrderListItemSchema);
export type BrandOrderPage = z.infer<typeof brandOrderPageSchema>;

/**
 * The frozen copy of what was bought, written once by
 * OrderRepository.toPricedRows and never touched again. Editing a product must
 * never alter a past order, which is also why `variantId` above it is nullable:
 * an archived variant must not break history.
 *
 * Typed here rather than left as the `unknown` the backend declares. A blob
 * with no shape cannot be parsed by a strict client at all, and the fields a
 * row actually renders — the name and the SKU — live inside it.
 */
export const orderItemSnapshotSchema = z
  .object({
    /** Product.name at purchase. `{}` when the draft was never named. */
    name: z.object({ ar: z.string().optional(), en: z.string().optional() }).strict(),
    sku: z.string(),
    /**
     * The variant's own key/value attributes — size, colour. A row label is
     * composed from these on the screen; there is no stored label to read,
     * because the attribute set differs per product.
     *
     * VALUES ARE `unknown`, NOT `string`, and this is the one place in the
     * package where being strict would be actively dangerous.
     *
     * The backend copies `ProductVariant.attributes` — a JSON column nothing
     * constrains — verbatim into a snapshot that is then frozen forever. The
     * day catalog writes `{ size: 42 }`, a value-typed schema rejects that
     * order permanently, for every reader, and **no backfill can repair it**:
     * rewriting a snapshot is the single thing snapshots exist to prevent.
     *
     * So the shape is loose here and the screen coerces at the point of
     * display. A wrong label on one row is recoverable; an unparseable order is
     * not. Constrain the column in catalog if you want the guarantee — that is
     * where it can be enforced without making history unreadable.
     */
    attributes: z.record(z.string(), z.unknown()),
    imageUrl: z.string().nullable(),
  })
  .strict();
export type OrderItemSnapshot = z.infer<typeof orderItemSnapshotSchema>;

export const orderItemSchema = z
  .object({
    id: z.string().uuid(),
    /** Null once the variant is archived. History outlives the catalog row. */
    variantId: z.string().uuid().nullable(),
    qty: z.number().int().min(1),
    unitPrice: moneySchema,
    lineTotal: moneySchema,
    /** Snapshot taken at purchase. Editing the product never changes this. */
    productSnapshot: orderItemSnapshotSchema,
  })
  .strict();
export type OrderItem = z.infer<typeof orderItemSchema>;

/**
 * The shopper, visible only inside an order this brand is fulfilling. There is
 * no customer list and no export anywhere in the brand console — per-order
 * visibility is the entire grant.
 */
/**
 * A snapshot, not a foreign key — the shopper may edit or delete the address
 * afterwards and the order must not change. Structured rather than a single
 * line because a rider needs the parts separately, and because this is exactly
 * what checkout validated on the way in (ShippingAddressContract).
 */
export const shippingAddressSchema = z
  .object({
    label: z.string().optional(),
    governorate: z.string(),
    city: z.string(),
    street: z.string(),
    building: z.string().optional(),
    phone: z.string(),
  })
  .strict();
export type ShippingAddress = z.infer<typeof shippingAddressSchema>;

export const orderShopperSchema = z
  .object({
    /**
     * Nullable: a guest checkout carries only a phone, and a shopper row with
     * no name on it is a real state rather than a defect. A screen showing
     * "—" is honest; one showing an empty string looks broken.
     */
    name: z.string().nullable(),
    phone: z.string().nullable(),
    address: shippingAddressSchema,
    /**
     * Whether this order has an account behind it. It changes what the brand
     * can promise — a guest has no order history to point at and no saved
     * address to correct against.
     *
     * BACKEND GAP: OrderQueryService.detailForBrand resolves the contact from
     * `order.shopper ?? order.guest` and then discards which one it was.
     */
    isGuest: z.boolean(),
  })
  .strict();
export type OrderShopper = z.infer<typeof orderShopperSchema>;

export const orderStatusHistoryEntrySchema = z
  .object({
    from: BrandOrderStatusSchema.nullable(),
    to: BrandOrderStatusSchema,
    at: z.string().datetime(),
    byUserId: z.string().uuid().nullable(),
    /**
     * Why the move was made. OrderStatusHistory.note is written on every
     * cancellation, every rejected return and every transition the brand
     * annotates — it is the half of an audit row that a payout dispute
     * actually turns on.
     *
     * BACKEND GAP: the column is written but detailForBrand does not project
     * it, so today the timeline shows what changed and never why.
     */
    note: z.string().nullable(),
  })
  .strict();

export const brandOrderDetailSchema = z
  .object({
    id: z.string().uuid(),
    orderNumber: z.string(),
    status: BrandOrderStatusSchema,
    deliveryMethod: DeliveryMethodSchema,
    paymentMethod: PaymentMethodSchema.nullable(),
    itemCount: z.number().int(),
    itemsTotal: moneySchema,
    /**
     * Charged to the shopper and collected by whoever delivers. Never ours,
     * never in the ledger, never in a payout — BrandOrder.shippingCost.
     *
     * Named for the column the API has shipped rather than for the label the
     * screen prints. It defaults to 0 rather than null: a brand with no
     * delivery fee configured charges nothing, which is a number and not an
     * absence.
     */
    shippingCost: moneySchema,
    /**
     * What Loqal charged on this order, and what is left for the brand. Both
     * are frozen on the BrandOrder at checkout, so a later terms change never
     * rewrites what a past order cost.
     *
     * Present deliberately. This is the brand's OWN money on the brand's OWN
     * order, it is already visible line by line in the ledger, and a
     * commission a shop can only discover by subtracting two numbers is the
     * kind of opacity that loses the brand. Note the distinction from the
     * rules above it: what a brand may not see is a SIBLING brand's slice or
     * the basket total, not its own margin.
     */
    commissionAmount: moneySchema,
    payoutAmount: moneySchema,
    placedAt: z.string().datetime(),
    waitingSince: z.string().datetime().nullable(),
    items: z.array(orderItemSchema),
    shopper: orderShopperSchema,
    statusHistory: z.array(orderStatusHistoryEntrySchema),
    /**
     * The single source of truth for which buttons the screen may draw,
     * computed by OrderTransitionService.allowedNextStatuses from the same
     * TRANSITIONS table that refuses an illegal move with a 409.
     *
     * The server owns this because the server enforces it. A client-side copy
     * of the table can only ever be right by coincidence: it cannot see the
     * actor rules, and the moment the two disagree the dashboard offers a
     * button that answers 409 — or hides one that was legal all along.
     */
    allowedTransitions: z.array(BrandOrderStatusSchema),
    /**
     * The current delivery attempt, read back from Shipment. Null until the
     * order is handed over, and null forever on a route that has no tracking
     * to give — an app rider booked in Uber has no number to print.
     *
     * BACKEND GAP: the transition body already ACCEPTS both of these, and
     * Shipment already stores them (`provider`, `trackingNumber`), but
     * detailForBrand never reads them back. A brand can type a tracking
     * number in and never see it again.
     */
    courierName: z.string().nullable(),
    trackingNumber: z.string().nullable(),
  })
  .strict();
export type BrandOrderDetail = z.infer<typeof brandOrderDetailSchema>;

/**
 * The transitions a brand may drive.
 *
 * Narrower than BrandOrderStatus, matching the backend's own
 * TransitionBrandOrderContract exactly. PROCESSING and SHIPPED exist only on
 * the parent Order and are derived rather than set; PENDING_BRAND, REFUNDED and
 * the two pending-payment states are reachable only by SYSTEM or ADMIN.
 *
 * RETURNED is the interesting exclusion, and an earlier version of this comment
 * got it wrong in a way that hid a real bug. The transition table DOES grant
 * RETURNED to BRAND — a brand genuinely makes that move. It is absent here
 * because it belongs to a DIFFERENT ROUTE: approving a return restocks the item
 * and closes the Return row in one transaction, which this endpoint cannot do.
 *
 * That distinction matters to a client. `allowedTransitions` is computed per
 * actor, so it legitimately contains RETURNED — and a dashboard that trusted it
 * without intersecting against this list drew a button that answered 400, not
 * the 409 anyone was watching for. The backend now derives the intersection
 * from this very schema's options rather than restating it.
 */
export const brandDrivableStatusSchema = BrandOrderStatusSchema.extract([
  'CONFIRMED',
  'PACKED',
  'HANDED_OVER',
  'DELIVERED',
  'DELIVERY_FAILED',
  'CANCELLED',
]);
export type BrandDrivableStatus = z.infer<typeof brandDrivableStatusSchema>;

export const transitionBrandOrderBodySchema = z
  .object({
    to: brandDrivableStatusSchema,
    /** Only meaningful on BRAND_OWN_DELIVERY, where the brand ships itself. */
    trackingNumber: z.string().max(120).optional(),
    /** 80, not 120 — the length the API actually accepts. */
    courierName: z.string().max(80).optional(),
    note: z.string().max(500).optional(),
  })
  .strict();
export type TransitionBrandOrderBody = z.infer<typeof transitionBrandOrderBodySchema>;

/**
 * The parent order, whole. Only SUPER_ADMIN ever receives this shape — it is
 * the single place in the system where a multi-brand order is visible entire.
 */
export const adminOrderChildSchema = z
  .object({
    /** The BrandOrder's own id. Named `id` by the API, not `brandOrderId`. */
    id: z.string().uuid(),
    brandId: z.string().uuid(),
    status: BrandOrderStatusSchema,
    subtotal: moneySchema,
    shippingCost: moneySchema,
    discountAmount: moneySchema,
    commissionAmount: moneySchema,
    payoutAmount: moneySchema,
    items: z.array(orderItemSchema),
  })
  .strict();
export type AdminOrderChild = z.infer<typeof adminOrderChildSchema>;

/**
 * The list row. Carries `brandCount` rather than the brands themselves — the
 * whole multi-brand breakdown is the detail view's job, and a list that
 * inlined every child would ship the entire order table on one page.
 */
export const adminOrderListItemSchema = z
  .object({
    id: z.string().uuid(),
    orderNumber: z.string(),
    status: OrderStatusSchema,
    deliveryMethod: DeliveryMethodSchema,
    itemsSubtotal: moneySchema,
    shippingTotal: moneySchema,
    discountTotal: moneySchema,
    grandTotal: moneySchema,
    brandCount: z.number().int(),
    placedAt: z.string().datetime(),
  })
  .strict();
export type AdminOrderListItem = z.infer<typeof adminOrderListItemSchema>;

export const adminOrderPageSchema = pageSchema(adminOrderListItemSchema);
export type AdminOrderPage = z.infer<typeof adminOrderPageSchema>;

/**
 * The one view in the system where a multi-brand order appears entire, plus
 * the payments behind it. `paymentMethod` is per PAYMENT here rather than per
 * order: a basket can be split across rows, and flattening it to one value on
 * the order would misreport exactly the case an admin opens this screen for.
 */
export const adminOrderPaymentSchema = z
  .object({
    id: z.string().uuid(),
    /** Null for a payment covering the whole basket rather than one brand. */
    brandOrderId: z.string().uuid().nullable(),
    provider: PaymentProviderSchema,
    method: PaymentMethodSchema,
    settlesTo: SettlementTargetSchema,
    amount: moneySchema,
    /** COD arrives per courier per brand, so what was collected can be less. */
    amountCollected: moneySchema,
    status: PaymentStatusSchema,
    paidAt: z.string().datetime().nullable(),
  })
  .strict();

export const adminOrderDetailSchema = adminOrderListItemSchema
  .extend({
    shopperId: z.string().uuid().nullable(),
    guestId: z.string().uuid().nullable(),
    guestEmail: z.string().nullable(),
    guestPhone: z.string().nullable(),
    phoneVerifiedAt: z.string().datetime().nullable(),
    shippingAddress: shippingAddressSchema,
    brandOrders: z.array(adminOrderChildSchema),
    payments: z.array(adminOrderPaymentSchema),
  })
  .strict();
export type AdminOrderDetail = z.infer<typeof adminOrderDetailSchema>;

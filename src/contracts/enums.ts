import { z } from 'zod';

/**
 * Every enum the dashboard needs, mirroring loqal-backend/prisma/schema.prisma.
 *
 * These are declared here rather than imported from @prisma/client on purpose.
 * The dashboard is a browser bundle and must not carry the Prisma runtime, and
 * a wire contract that changes silently the moment a migration runs is worse
 * than one that fails a test. When the schema changes, this file changes with
 * it and enums.spec.ts is what catches the drift.
 */

export const UserRoleSchema = z.enum([
  'SHOPPER',
  'BRAND_OWNER',
  'BRAND_EMPLOYEE',
  'SALES',
  'SUPER_ADMIN',
]);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const BrandApplicationStatusSchema = z.enum(['PENDING', 'APPROVED', 'REJECTED']);
export type BrandApplicationStatus = z.infer<typeof BrandApplicationStatusSchema>;

/**
 * Three values, not four. A rejected application creates no brand at all —
 * there is no orphan row in a REJECTED state to clean up later.
 */
export const BrandStatusSchema = z.enum(['PENDING', 'ACTIVE', 'SUSPENDED']);
export type BrandStatus = z.infer<typeof BrandStatusSchema>;

/**
 * Does a human have to check a shelf before an order is promised? Every value
 * tracks real stock; this only decides whether our number can be trusted
 * without someone looking.
 */
export const StockSetupSchema = z.enum(['ONLINE_ONLY', 'SHOP_SHARED_STOCK', 'SHOP_LOQAL_SHELF']);
export type StockSetup = z.infer<typeof StockSetupSchema>;

export const PerOrderChargeTypeSchema = z.enum(['PERCENT', 'FIXED']);
export type PerOrderChargeType = z.infer<typeof PerOrderChargeTypeSchema>;

export const SettlementCadenceSchema = z.enum(['WEEKLY', 'TWICE_WEEKLY', 'MONTHLY']);
export type SettlementCadence = z.infer<typeof SettlementCadenceSchema>;

export const SettlementMethodSchema = z.enum(['INSTAPAY', 'MOBILE_WALLET', 'BANK_TRANSFER']);
export type SettlementMethod = z.infer<typeof SettlementMethodSchema>;

/** Archived, never deleted — past orders reference a product forever. */
export const ProductStatusSchema = z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']);
export type ProductStatus = z.infer<typeof ProductStatusSchema>;

export const StockAdjustmentReasonSchema = z.enum([
  'OPENING',
  'RESTOCK',
  'SALE',
  'IN_STORE',
  'RETURN',
  'CORRECTION',
  'DAMAGE',
]);
export type StockAdjustmentReason = z.infer<typeof StockAdjustmentReasonSchema>;

/**
 * The parent order's status, DERIVED from its child BrandOrder rows and never
 * set by hand. Only the admin console ever sees this.
 */
export const OrderStatusSchema = z.enum([
  'PENDING_VERIFICATION',
  'PENDING_PAYMENT',
  'PENDING_BRAND',
  'CONFIRMED',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'REFUNDED',
]);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

/**
 * The authoritative status a brand actually drives. Brands fulfil
 * independently, so one brand can be DELIVERED while its basket-mate is still
 * PENDING_BRAND.
 *
 * DELIVERY_FAILED is not a return: a refused cash order was never paid, so
 * there is nothing to refund and it writes no ledger entry.
 */
export const BrandOrderStatusSchema = z.enum([
  'PENDING_VERIFICATION',
  'PENDING_PAYMENT',
  'PENDING_BRAND',
  'CONFIRMED',
  'PACKED',
  'HANDED_OVER',
  'DELIVERED',
  'DELIVERY_FAILED',
  'RETURN_REQUESTED',
  'RETURNED',
  'CANCELLED',
  'REFUNDED',
]);
export type BrandOrderStatus = z.infer<typeof BrandOrderStatusSchema>;

export const DiscountFundedBySchema = z.enum(['BRAND', 'PLATFORM']);
export type DiscountFundedBy = z.infer<typeof DiscountFundedBySchema>;

/**
 * SHIPPING_SERVICE is modelled but NOT LIVE — there is no courier contract, so
 * no brand carries it in supportedDelivery and no UI may ever render it. It
 * stays in the enum because switching it on must be a data change rather than
 * a migration.
 */
export const DeliveryMethodSchema = z.enum([
  'RIDER_PER_BRAND',
  'SHIPPING_SERVICE',
  'BRAND_OWN_DELIVERY',
]);
export type DeliveryMethod = z.infer<typeof DeliveryMethodSchema>;

export const ReturnStatusSchema = z.enum(['REQUESTED', 'APPROVED', 'REJECTED', 'RESTOCKED']);
export type ReturnStatus = z.infer<typeof ReturnStatusSchema>;

/**
 * WALK_IN matters more here than anywhere else: most of these brands have a
 * shop, the customer often lives nearby, and handing it back in person settles
 * in minutes what a courier drags out for a week.
 */
export const ReturnRouteSchema = z.enum(['COURIER', 'WALK_IN']);
export type ReturnRoute = z.infer<typeof ReturnRouteSchema>;

export const PaymentProviderSchema = z.enum(['PAYMOB', 'NONE']);
export type PaymentProvider = z.infer<typeof PaymentProviderSchema>;

export const PaymentMethodSchema = z.enum(['CARD', 'WALLET', 'VALU', 'CASH', 'INSTAPAY']);
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;

export const SettlementTargetSchema = z.enum(['PLATFORM', 'BRAND']);
export type SettlementTarget = z.infer<typeof SettlementTargetSchema>;

export const PaymentStatusSchema = z.enum([
  'PENDING',
  'PARTIALLY_PAID',
  'PAID',
  'FAILED',
  'REFUNDED',
]);
export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;

/**
 * The ledger is append-only and its amounts are signed. A correction is a
 * reversing entry, never an edit. Shipping never appears here at all — Loqal
 * runs no fulfilment and pays no courier.
 */
export const LedgerEntryTypeSchema = z.enum([
  'SALE',
  'COMMISSION',
  'DISCOUNT',
  'PAYOUT',
  'REFUND',
  'BRAND_PAYMENT',
]);
export type LedgerEntryType = z.infer<typeof LedgerEntryTypeSchema>;

/** WE_PAY: Loqal holds card money for the brand. THEY_PAY: the brand holds cash. */
export const SettlementDirectionSchema = z.enum(['WE_PAY', 'THEY_PAY']);
export type SettlementDirection = z.infer<typeof SettlementDirectionSchema>;

export const SettlementStatusSchema = z.enum(['PENDING', 'SENT', 'RECEIVED', 'CANCELLED']);
export type SettlementStatus = z.infer<typeof SettlementStatusSchema>;

export const ShipmentMethodSchema = z.enum(['COURIER', 'APP_RIDER']);
export type ShipmentMethod = z.infer<typeof ShipmentMethodSchema>;

export const ShipmentStatusSchema = z.enum([
  'PENDING',
  'PICKED_UP',
  'IN_TRANSIT',
  'DELIVERED',
  'FAILED',
  'RETURNED',
]);
export type ShipmentStatus = z.infer<typeof ShipmentStatusSchema>;

export const ImportSourceTypeSchema = z.enum([
  'SHOPIFY',
  'WOOCOMMERCE',
  'FEED',
  'JSONLD',
  'CSV',
  'MANUAL',
]);
export type ImportSourceType = z.infer<typeof ImportSourceTypeSchema>;

export const ImportJobStatusSchema = z.enum([
  'DETECTING',
  'FETCHING',
  'AWAITING_REVIEW',
  'COMMITTING',
  'COMPLETED',
  'FAILED',
]);
export type ImportJobStatus = z.infer<typeof ImportJobStatusSchema>;

export const ImportItemStatusSchema = z.enum([
  'STAGED',
  'MAPPED',
  'IMPORTED',
  'SKIPPED',
  'FAILED',
]);
export type ImportItemStatus = z.infer<typeof ImportItemStatusSchema>;

/** Who is speaking in a support thread. Nothing to do with UserRole. */
export const ThreadPartySchema = z.enum(['SHOPPER', 'GUEST', 'BRAND', 'ADMIN']);
export type ThreadParty = z.infer<typeof ThreadPartySchema>;

/**
 * Earned from delivered orders over a rolling window. A brand can never switch
 * one on — the day it can, every badge on the site is advertising.
 */
export const ComputedBadgeTypeSchema = z.enum([
  'SAME_DAY_SHIPPER',
  'FAST_CONFIRM',
  'RARELY_CANCELS',
]);
export type ComputedBadgeType = z.infer<typeof ComputedBadgeTypeSchema>;

/** Issued by a human at Loqal, dated, and expiring. */
export const VerifiedBadgeTypeSchema = z.enum(['PRICE_CHECKED']);
export type VerifiedBadgeType = z.infer<typeof VerifiedBadgeTypeSchema>;

export const TryOnRenderStatusSchema = z.enum([
  'QUEUED',
  'RUNNING',
  'READY',
  'FAILED',
  'REJECTED',
]);
export type TryOnRenderStatus = z.infer<typeof TryOnRenderStatusSchema>;

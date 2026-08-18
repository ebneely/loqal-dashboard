import {
  approveReturnBodySchema,
  returnListItemSchema,
} from './return.contract';
import {
  adminOrderDetailSchema,
  brandOrderDetailSchema,
  brandOrderListItemSchema,
  orderItemSchema,
  transitionBrandOrderBodySchema,
} from './order.contract';
import { invoiceListItemSchema } from './invoice.contract';
import { settlementRunDetailSchema, markSettlementBodySchema } from './settlement.contract';
import { ledgerEntrySchema } from './ledger.contract';
import {
  dashboardProductSchema,
  stockAdjustmentSchema,
  productVariantSchema,
} from './catalog.contract';
import { importItemSchema, updateImportItemBodySchema } from './import.contract';
import { salesPackSchema, registerBrandBodySchema } from './sales.contract';
import { platformSettingsSchema, updatePlatformSettingsBodySchema } from './admin.contract';
import { brandProfileSchema } from './brand.contract';

/**
 * The seam between the dashboard and the API, asserted rather than assumed.
 *
 * Every case below is a real body the Nest backend does or must produce, not an
 * illustrative one. The package was written from the product spec and the
 * backend from the same spec, in parallel, and neither read the other — so a
 * schema that has never been shown an actual payload is a guess with a type
 * annotation on it. These are the payloads.
 *
 * Cases marked BACKEND GAP encode a shape the API does NOT serve yet. They are
 * failing tests deliberately inverted into passing ones: they pin what the
 * backend owes, so the day it lands nothing here has to be renegotiated.
 */

const UUID = '018f4c1a-0000-7000-8000-000000000001';
const UUID2 = '018f4c1a-0000-7000-8000-000000000002';
const AT = '2026-08-13T14:20:00.000Z';

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

describe('brandOrderListItem against OrderQueryService.listForBrand', () => {
  const row = {
    id: UUID,
    orderNumber: 'LQ-1042',
    status: 'PENDING_BRAND' as const,
    deliveryMethod: 'RIDER_PER_BRAND' as const,
    paymentMethod: 'CASH' as const,
    itemCount: 3,
    itemsTotal: '1240.00',
    placedAt: AT,
    waitingSince: AT,
  };

  it('accepts a null payment method rather than inventing one', () => {
    // A brand order can be read before a Payment row exists for it. Null is the
    // honest answer; 'CASH' guessed as a default would tell a shop to collect
    // money at the door on an order that was already paid by card.
    expect(brandOrderListItemSchema.parse({ ...row, paymentMethod: null }).paymentMethod).toBeNull();
  });

  it('still refuses to carry the basket total or a sibling brand', () => {
    expect(() => brandOrderListItemSchema.parse({ ...row, parentTotal: '2480.00' })).toThrow();
    expect(() =>
      brandOrderListItemSchema.parse({ ...row, otherBrandOrders: [{ brandId: UUID2 }] }),
    ).toThrow();
  });
});

describe('orderItem against the OrderItem row the API actually serialises', () => {
  it('parses the frozen snapshot instead of a flattened name and sku', () => {
    const parsed = orderItemSchema.parse({
      id: UUID,
      variantId: UUID2,
      qty: 2,
      unitPrice: '620.00',
      lineTotal: '1240.00',
      productSnapshot: {
        name: { ar: 'عباية كتان', en: 'Linen Abaya' },
        sku: 'NEF-LIN-M',
        attributes: { size: 'M', colour: 'black' },
        imageUrl: null,
      },
    });

    expect(parsed.productSnapshot.sku).toBe('NEF-LIN-M');
    expect(parsed.qty).toBe(2);
  });

  it('keeps history readable after the variant is archived', () => {
    // variantId is nullable precisely so archiving a variant cannot orphan a
    // past order line. The snapshot is what the row renders from regardless.
    const parsed = orderItemSchema.parse({
      id: UUID,
      variantId: null,
      qty: 1,
      unitPrice: '620.00',
      lineTotal: '620.00',
      productSnapshot: { name: { en: 'Linen Abaya' }, sku: 'NEF-LIN-M', attributes: {}, imageUrl: null },
    });

    expect(parsed.variantId).toBeNull();
  });

  it('rejects the flat shape the contract used to describe', () => {
    expect(() =>
      orderItemSchema.parse({
        id: UUID,
        sku: 'NEF-LIN-M',
        productName: { en: 'Linen Abaya' },
        variantLabel: { en: 'M' },
        quantity: 2,
        unitPrice: '620.00',
        lineTotal: '1240.00',
      }),
    ).toThrow();
  });
});

describe('brandOrderDetail against DashboardOrderDetail', () => {
  const detail = {
    id: UUID,
    orderNumber: 'LQ-1042',
    status: 'CONFIRMED' as const,
    deliveryMethod: 'BRAND_OWN_DELIVERY' as const,
    paymentMethod: 'CARD' as const,
    itemCount: 1,
    itemsTotal: '1240.00',
    shippingCost: '45.00',
    commissionAmount: '148.80',
    payoutAmount: '1091.20',
    placedAt: AT,
    waitingSince: AT,
    items: [
      {
        id: UUID2,
        variantId: UUID2,
        qty: 1,
        unitPrice: '1240.00',
        lineTotal: '1240.00',
        productSnapshot: {
          name: { en: 'Linen Abaya' },
          sku: 'NEF-LIN-M',
          attributes: { size: 'M' },
          imageUrl: null,
        },
      },
    ],
    shopper: {
      name: 'Mona Adel',
      phone: '01022884471',
      address: {
        governorate: 'Cairo',
        city: 'Maadi',
        street: '14 Road 9',
        phone: '01022884471',
      },
      isGuest: false,
    },
    statusHistory: [{ from: 'PENDING_BRAND' as const, to: 'CONFIRMED' as const, at: AT, byUserId: UUID2, note: null }],
    allowedTransitions: ['PACKED' as const, 'CANCELLED' as const],
    courierName: null,
    trackingNumber: null,
  };

  it('parses the full detail the API assembles', () => {
    expect(() => brandOrderDetailSchema.parse(detail)).not.toThrow();
  });

  it('reads the shipping fee under the name the API ships it under', () => {
    // BrandOrder.shippingCost. The screen calls it a delivery fee; the wire
    // does not, and renaming ten call sites is cheaper than renaming a column.
    expect(brandOrderDetailSchema.parse(detail).shippingCost).toBe('45.00');
    expect(() => brandOrderDetailSchema.parse({ ...detail, deliveryFee: '45.00' })).toThrow();
  });

  it('shows the brand its own commission and payout, and still no sibling brand', () => {
    // The brand's own margin on the brand's own order — already visible line by
    // line in its ledger. The rule is about ANOTHER brand's slice, not this one.
    const parsed = brandOrderDetailSchema.parse(detail);
    expect(parsed.commissionAmount).toBe('148.80');
    expect(parsed.payoutAmount).toBe('1091.20');
    expect(() =>
      brandOrderDetailSchema.parse({ ...detail, grandTotal: '2480.00' }),
    ).toThrow();
  });

  it('carries the server-computed transitions rather than a client-side copy', () => {
    expect(brandOrderDetailSchema.parse(detail).allowedTransitions).toEqual([
      'PACKED',
      'CANCELLED',
    ]);
  });

  it('refuses a transition the brand may never drive, even from the server', () => {
    expect(() =>
      brandOrderDetailSchema.parse({ ...detail, allowedTransitions: ['SHIPPED'] }),
    ).toThrow();
  });

  it('takes the address as the structured snapshot checkout validated', () => {
    // Order.shippingAddress is a JSON snapshot, not a line of text. A rider
    // needs the governorate and the street separately.
    expect(() =>
      brandOrderDetailSchema.parse({
        ...detail,
        shopper: { ...detail.shopper, address: '14 Road 9, Maadi, Cairo' },
      }),
    ).toThrow();
  });

  it('lets a guest order arrive with no name on it', () => {
    const parsed = brandOrderDetailSchema.parse({
      ...detail,
      shopper: { ...detail.shopper, name: null, isGuest: true },
    });
    expect(parsed.shopper.isGuest).toBe(true);
  });

  it('keeps the reason a status changed, not only that it did', () => {
    const parsed = brandOrderDetailSchema.parse({
      ...detail,
      statusHistory: [
        { from: 'PENDING_BRAND' as const, to: 'CANCELLED' as const, at: AT, byUserId: UUID2, note: 'Out of stock on the shelf' },
      ],
    });
    expect(parsed.statusHistory[0].note).toBe('Out of stock on the shelf');
  });
});

describe('transitionBrandOrderBody against TransitionBrandOrderContract', () => {
  it.each(['CONFIRMED', 'PACKED', 'HANDED_OVER', 'DELIVERED', 'DELIVERY_FAILED', 'CANCELLED'])(
    'accepts %s, which the API accepts',
    (to) => {
      expect(transitionBrandOrderBodySchema.parse({ to }).to).toBe(to);
    },
  );

  it.each(['PENDING_BRAND', 'RETURNED', 'REFUNDED', 'PENDING_PAYMENT'])(
    'refuses %s, which the API answers 400 for',
    (to) => {
      expect(() => transitionBrandOrderBodySchema.parse({ to })).toThrow();
    },
  );

  it('caps courierName at the 80 the API accepts, not the 120 it used to claim', () => {
    expect(() =>
      transitionBrandOrderBodySchema.parse({ to: 'HANDED_OVER', courierName: 'x'.repeat(81) }),
    ).toThrow();
    expect(() =>
      transitionBrandOrderBodySchema.parse({ to: 'HANDED_OVER', courierName: 'x'.repeat(80) }),
    ).not.toThrow();
  });
});

describe('adminOrderDetail', () => {
  it('is the one shape where a whole multi-brand order appears together', () => {
    const parsed = adminOrderDetailSchema.parse({
      id: UUID,
      orderNumber: 'LQ-1042',
      status: 'PROCESSING',
      deliveryMethod: 'RIDER_PER_BRAND',
      itemsSubtotal: '2480.00',
      shippingTotal: '90.00',
      discountTotal: '0.00',
      grandTotal: '2570.00',
      brandCount: 2,
      placedAt: AT,
      shopperId: UUID2,
      guestId: null,
      guestEmail: null,
      guestPhone: null,
      phoneVerifiedAt: null,
      shippingAddress: { governorate: 'Cairo', city: 'Maadi', street: '14 Road 9', phone: '01022884471' },
      brandOrders: [
        {
          id: UUID,
          brandId: UUID2,
          status: 'CONFIRMED',
          subtotal: '1240.00',
          shippingCost: '45.00',
          discountAmount: '0.00',
          commissionAmount: '148.80',
          payoutAmount: '1091.20',
          items: [],
        },
      ],
      payments: [
        {
          id: UUID2,
          brandOrderId: null,
          provider: 'PAYMOB',
          method: 'CARD',
          settlesTo: 'PLATFORM',
          amount: '2570.00',
          amountCollected: '2570.00',
          status: 'PAID',
          paidAt: AT,
        },
      ],
    });

    expect(parsed.brandCount).toBe(2);
    expect(parsed.payments[0].brandOrderId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Returns
// ---------------------------------------------------------------------------

describe('returnListItem against ReturnResponse', () => {
  const row = {
    id: UUID,
    brandOrderId: UUID2,
    orderNumber: 'LQ-1036',
    status: 'REQUESTED' as const,
    route: null,
    itemCount: 2,
    reason: 'Wrong size.',
    refundAmount: null,
    requestedAt: AT,
    approvedAt: null,
    restockedAt: null,
  };

  it('links a return to the order it came out of', () => {
    // Without this the returns queue prints an order number and links nowhere.
    expect(returnListItemSchema.parse(row).brandOrderId).toBe(UUID2);
  });

  it('leaves the route undecided until the brand approves', () => {
    expect(returnListItemSchema.parse(row).route).toBeNull();
  });

  it('carries the refund figure once one is agreed', () => {
    const decided = returnListItemSchema.parse({
      ...row,
      status: 'RESTOCKED' as const,
      route: 'WALK_IN' as const,
      refundAmount: '1240.00',
      approvedAt: AT,
      restockedAt: AT,
    });
    expect(decided.refundAmount).toBe('1240.00');
  });

  it('has no windowClosesAt, which was a rule that had already been applied', () => {
    // The return window is enforced at REQUEST time against Brand.returnWindowDays.
    // A row in this list is already through that gate, so a closing time on it
    // describes a deadline nobody can miss and nothing can act on.
    expect(Object.keys(returnListItemSchema.shape)).not.toContain('windowClosesAt');
    expect(() => returnListItemSchema.parse({ ...row, windowClosesAt: AT })).toThrow();
  });

  it('still cannot model a refused cash delivery as a return', () => {
    expect(() => returnListItemSchema.parse({ ...row, status: 'DELIVERY_FAILED' })).toThrow();
  });
});

describe('approveReturnBody against ApproveReturnContract', () => {
  it('requires the route, which is the decision being made', () => {
    // The screen sent `{}` here. The API requires a route, so every approve
    // button in the dashboard was a 400 waiting to happen.
    expect(() => approveReturnBodySchema.parse({})).toThrow();
    expect(approveReturnBodySchema.parse({ route: 'WALK_IN' }).route).toBe('WALK_IN');
  });

  it('takes a refund figure and a tracking reference, and no free-text note', () => {
    const parsed = approveReturnBodySchema.parse({
      route: 'COURIER',
      refundAmount: '1240.00',
      trackingRef: 'BOSTA-99120',
    });
    expect(parsed.trackingRef).toBe('BOSTA-99120');
    expect(() => approveReturnBodySchema.parse({ route: 'COURIER', note: 'ok' })).toThrow();
  });

  it('will not take a negative refund — a reversal is a ledger entry, not a sign', () => {
    expect(() => approveReturnBodySchema.parse({ route: 'WALK_IN', refundAmount: '-1240.00' })).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

describe('invoiceListItem against InvoiceRecord', () => {
  it('tells a raised invoice apart from an issued one', () => {
    const pending = invoiceListItemSchema.parse({
      id: UUID,
      reference: 'INV-1036-NFL',
      brandOrderId: UUID2,
      orderNumber: 'LQ-1036',
      netAmount: '2105.00',
      status: 'PENDING',
      raisedAt: AT,
      issuedAt: null,
    });

    expect(pending.issuedAt).toBeNull();
    expect(pending.status).toBe('PENDING');
  });

  it('has no shape in which a FAILED render can claim an issue date', () => {
    // InvoiceService currently emits `issuedAt: row.issuedAt ?? row.createdAt`.
    // Dropping `status` and `raisedAt` is what makes that fallback invisible;
    // requiring both is what makes it impossible.
    const keys = Object.keys(invoiceListItemSchema.shape);
    expect(keys).toEqual(expect.arrayContaining(['status', 'raisedAt', 'issuedAt']));
  });
});

describe('settlementRunDetail against SettlementAdminService.detail', () => {
  const run = {
    id: UUID,
    brandId: UUID2,
    brandName: 'Nefertari Leather',
    periodStart: '2026-08-11T00:00:00.000Z',
    periodEnd: '2026-08-17T00:00:00.000Z',
    netAmount: '720.50',
    direction: 'WE_PAY' as const,
    status: 'PENDING' as const,
    settlementMethod: 'INSTAPAY' as const,
    settlementDetails: '01022884471',
    markedBy: null,
    markedAt: null,
    note: null,
    createdAt: '2026-08-18T00:00:00.000Z',
  };

  it('pages the ledger lines behind the figure instead of shipping them all', () => {
    const parsed = settlementRunDetailSchema.parse({
      run,
      entries: {
        items: [
          {
            id: UUID2,
            brandId: UUID,
            brandOrderId: null,
            type: 'COMMISSION',
            amount: '-252.60',
            note: 'Order LQ-1036 — commission 12%',
            createdAt: AT,
          },
        ],
        nextCursor: UUID2,
      },
    });

    expect(parsed.entries.nextCursor).toBe(UUID2);
    expect(parsed.run.netAmount).toBe('720.50');
  });

  it('keeps the admin line shape distinct from the brand-plane one', () => {
    // The admin response spreads the LedgerEntry row, so it has brandId and no
    // orderNumber. Sharing one schema would mean widening the brand's.
    expect(Object.keys(ledgerEntrySchema.shape)).toContain('orderNumber');
    expect(Object.keys(ledgerEntrySchema.shape)).not.toContain('brandId');
  });

  it('still refuses to mark a run back to PENDING', () => {
    expect(() => markSettlementBodySchema.parse({ status: 'PENDING' })).toThrow();
  });

  it('caps the mark note at the 300 the API accepts', () => {
    expect(() =>
      markSettlementBodySchema.parse({ status: 'SENT', note: 'x'.repeat(301) }),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

describe('catalog shapes against the Nest catalog plane', () => {
  it('refuses the raw -1 basePrice sentinel the PATCH routes leak', () => {
    // CatalogService.toDashboardShape masks Decimal(-1) to null on GET and bulk
    // but not on PATCH /:id or PATCH /:id/status. "-1" is not a price.
    expect(() =>
      dashboardProductSchema.parse({
        id: UUID,
        slug: 'linen-abaya',
        name: { en: 'Linen Abaya' },
        status: 'DRAFT',
        basePrice: '-1',
        categoryId: null,
        coverUrl: null,
        variantCount: 0,
        priceFrom: null,
        inStock: false,
        updatedAt: AT,
      }),
    ).toThrow();
  });

  it('refuses the {} name sentinel, which claims a language it does not have', () => {
    expect(() =>
      dashboardProductSchema.parse({
        id: UUID,
        slug: 'product-4c1a0000',
        name: {},
        status: 'DRAFT',
        basePrice: null,
        categoryId: null,
        coverUrl: null,
        variantCount: 0,
        priceFrom: null,
        inStock: false,
        updatedAt: AT,
      }),
    ).toThrow();
  });

  it('carries a variant strike-through price, nullable because most are not on sale', () => {
    const parsed = productVariantSchema.parse({
      id: UUID,
      sku: 'NEF-LIN-M',
      attributes: { size: 'M' },
      price: '1240.00',
      compareAtPrice: '1490.00',
      stock: { stockOnHand: 5, reservedQty: 4, availableQty: 1 },
    });
    expect(parsed.compareAtPrice).toBe('1490.00');
  });

  it('lets availableQty go negative, because an oversell is a state to show', () => {
    const parsed = productVariantSchema.parse({
      id: UUID,
      sku: 'NEF-LIN-M',
      attributes: { size: 'M' },
      price: '1240.00',
      compareAtPrice: null,
      stock: { stockOnHand: 2, reservedQty: 5, availableQty: -3 },
    });
    expect(parsed.stock.availableQty).toBe(-3);
  });

  it('names which shelf a stock movement belongs to', () => {
    const parsed = stockAdjustmentSchema.parse({
      id: UUID,
      variantId: UUID2,
      brandId: UUID,
      delta: -2,
      reason: 'IN_STORE',
      balanceAfter: 3,
      note: null,
      actorId: UUID2,
      createdAt: AT,
    });
    expect(parsed.variantId).toBe(UUID2);
  });
});

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

describe('importItem — the bilingual rule the backend flattened', () => {
  const base = {
    id: UUID,
    status: 'MAPPED' as const,
    sourceTitle: 'عباية كتان',
    mappedPrice: '1240.00',
    mappedCategoryId: null,
    missingPrice: false,
    missingName: false,
    failureReason: null,
  };

  it('keeps an Arabic-only mapped name reachable', () => {
    // ImportPublishService writes `name: { en: row.mappedName }` off a flat
    // string today, so every product imported for an Arabic-naming shop is
    // filed as English. A flat string here is what allows that.
    const parsed = importItemSchema.parse({ ...base, mappedName: { ar: 'عباية كتان' } });
    expect(parsed.mappedName).toEqual({ ar: 'عباية كتان' });
  });

  it('rejects the flat string the API currently sends', () => {
    expect(() => importItemSchema.parse({ ...base, mappedName: 'Linen Abaya' })).toThrow();
  });

  it('refuses a name that names nothing', () => {
    expect(() => importItemSchema.parse({ ...base, mappedName: {} })).toThrow();
  });

  it('still has no PUBLISHED status — nothing publishes automatically', () => {
    expect(() => importItemSchema.parse({ ...base, mappedName: null, status: 'PUBLISHED' })).toThrow();
  });

  it('refuses an empty PATCH, matching the API refine', () => {
    expect(() => updateImportItemBodySchema.parse({})).toThrow();
    expect(updateImportItemBodySchema.parse({ status: 'SKIPPED' }).status).toBe('SKIPPED');
  });
});

// ---------------------------------------------------------------------------
// Sales and admin
// ---------------------------------------------------------------------------

describe('salesPack against SalesService', () => {
  it('reads the traffic proof the API actually assembles', () => {
    const parsed = salesPackSchema.parse({
      category: 'abayas',
      trafficProof: { totalEvents: 18400, totalVisitors: 6100 },
      categoryComparison: { brandCount: 4, medianMonthlyOrders: 38 },
      generatedAt: AT,
    });
    expect(parsed.trafficProof.totalEvents).toBe(18400);
  });

  it('tells "no data yet" apart from "measured and withheld"', () => {
    // null medianMonthlyOrders means no BrandMetric rows exist. Withheld means
    // we measured and may not say. A rep must not read one as the other.
    const empty = salesPackSchema.parse({
      category: 'abayas',
      trafficProof: { totalEvents: 18400, totalVisitors: 6100 },
      categoryComparison: { brandCount: 4, medianMonthlyOrders: null },
      generatedAt: AT,
    });
    expect(empty.categoryComparison).toEqual({ brandCount: 4, medianMonthlyOrders: null });

    const withheld = salesPackSchema.parse({
      category: 'abayas',
      trafficProof: { totalEvents: 18400, totalVisitors: 6100 },
      categoryComparison: { withheld: true, reason: 'K_ANONYMITY' },
      generatedAt: AT,
    });
    expect(withheld.categoryComparison).toEqual({ withheld: true, reason: 'K_ANONYMITY' });
  });

  it('never nulls or zeroes a below-floor aggregate', () => {
    for (const bad of [null, 0, { brandCount: 0, medianMonthlyOrders: 0 }]) {
      expect(() =>
        salesPackSchema.parse({
          category: 'abayas',
          trafficProof: { totalEvents: 18400, totalVisitors: 6100 },
          categoryComparison: bad,
          generatedAt: AT,
        }),
      ).toThrow();
    }
  });

  it('carries no shopper data at all — the field device is the easiest thing to lose', () => {
    const keys = Object.keys(salesPackSchema.shape);
    for (const forbidden of ['shopperName', 'phone', 'email', 'address', 'shoppers']) {
      expect(keys).not.toContain(forbidden);
    }
  });
});

describe('registerBrandBody against registerShopSchema', () => {
  it('captures what a rep can actually get standing in a shop', () => {
    const parsed = registerBrandBodySchema.parse({
      businessName: 'Nefertari Leather',
      ownerName: 'Mona Adel',
      email: 'mona@nefertari.example',
      phone: '01022884471',
      instagramUrl: 'https://instagram.com/nefertari',
    });
    expect(parsed.businessName).toBe('Nefertari Leather');
  });

  it('rejects the fields that were never on BrandApplication', () => {
    expect(() =>
      registerBrandBodySchema.parse({
        businessName: 'Nefertari Leather',
        ownerName: 'Mona Adel',
        email: 'mona@nefertari.example',
        phone: '01022884471',
        categorySlug: 'abayas',
        city: 'Cairo',
      }),
    ).toThrow();
  });

  it('creates no account — there is no password anywhere in the shape', () => {
    expect(Object.keys(registerBrandBodySchema.shape)).not.toContain('password');
  });
});

describe('platformSettings against toSettingsView', () => {
  const settings = {
    id: 1,
    updatedAt: AT,
    analytics: {
      analyticsTimezone: 'Africa/Cairo',
      analyticsKAnonymityFloor: 3,
      ingestRejectRetentionDays: 30,
    },
    sales: { defaultFreeMonths: 2, salesCommissionFloorBps: null, salesMaxFreeMonths: null },
    tryOn: {
      tryOnModelId: 'fal-ai/fashn/tryon/v1.6',
      tryOnFallbackModelId: 'fal-ai/image-apps-v2/virtual-try-on',
      tryOnMonthlyBudgetCents: 10000,
      tryOnAccountLifetimeCap: 10,
    },
    chat: {
      chatAttachmentMaxBytes: 5242880,
      chatAttachmentAllowedMimeTypes: ['image/jpeg', 'application/pdf'],
      guestThreadLifetimeDays: 90,
      chatUnansweredThresholdMinutes: 30,
    },
    badges: {
      badgeMinOrderCount: 20,
      badgeWindowDays: 60,
      badgeSameDayShareBpsThreshold: 8000,
      badgeFastConfirmMinutesThreshold: 60,
      badgeCancellationRateBpsMax: 300,
    },
  };

  it('reads grouped and writes flat, which is what the API does', () => {
    expect(() => platformSettingsSchema.parse(settings)).not.toThrow();
    expect(
      updatePlatformSettingsBodySchema.parse({ analyticsKAnonymityFloor: 5 })
        .analyticsKAnonymityFloor,
    ).toBe(5);
    // The grouped body is the read shape, and the API would 400 on it.
    expect(() =>
      updatePlatformSettingsBodySchema.parse({ analytics: { analyticsKAnonymityFloor: 5 } }),
    ).toThrow();
  });

  it('accepts the timezone key so a settings round-trip does not 400', () => {
    // Legal key, illegal CHANGE — a different value is a 422 from the service,
    // because every analytics day already written was bucketed under the old one.
    expect(
      updatePlatformSettingsBodySchema.parse({ analyticsTimezone: 'Africa/Cairo' })
        .analyticsTimezone,
    ).toBe('Africa/Cairo');
  });

  it('keeps the k-anonymity floor at one or more — a floor of zero gates nothing', () => {
    expect(() => updatePlatformSettingsBodySchema.parse({ analyticsKAnonymityFloor: 0 })).toThrow();
  });
});

describe('brandProfile', () => {
  it('reads media as ids, because the API resolves no URL on this plane', () => {
    const keys = Object.keys(brandProfileSchema.shape);
    expect(keys).toEqual(expect.arrayContaining(['logoMediaId', 'coverMediaId']));
    expect(keys).not.toEqual(expect.arrayContaining(['logoUrl', 'coverUrl']));
  });

  it('still cannot be written back with the terms Loqal set', () => {
    // loqalTerms is absent from the update body by construction, not by a guard.
    expect(Object.keys(brandProfileSchema.shape)).toContain('loqalTerms');
  });
});

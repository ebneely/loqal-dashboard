import type { z } from 'zod';

import { brandOrderListItemSchema, brandOrderDetailSchema, transitionBrandOrderBodySchema, listBrandOrdersQuerySchema } from './order.contract';
import { returnListItemSchema, rejectReturnBodySchema } from './return.contract';
import { ledgerEntrySchema, brandBalanceSchema } from './ledger.contract';
import { settlementRunSchema, markSettlementBodySchema } from './settlement.contract';
import { invoiceListItemSchema } from './invoice.contract';
import { brandProfileSchema, adminBrandListItemSchema, suspendBrandBodySchema } from './brand.contract';
import { salesPackSchema, setSalesTermsBodySchema, salesTermsBandSchema } from './sales.contract';
import { platformSettingsSchema, brandApplicationSchema } from './admin.contract';
import { importJobSchema, importItemSchema } from './import.contract';

/**
 * One table over every contract instead of nine near-identical spec files.
 * Each row states a payload that must parse and a payload that must not; the
 * three shared invariants — strict objects, string money, enum-typed status —
 * are asserted the same way for all of them.
 */
const cases: Array<{
  name: string;
  schema: z.ZodTypeAny;
  valid: unknown;
  invalid: unknown;
  why: string;
}> = [
  {
    name: 'brandOrderListItem',
    schema: brandOrderListItemSchema,
    valid: {
      id: '018f4c1a-0000-7000-8000-000000000001',
      orderNumber: 'LQ-1042',
      status: 'PENDING_BRAND',
      deliveryMethod: 'RIDER_PER_BRAND',
      paymentMethod: 'CASH',
      itemCount: 3,
      itemsTotal: '1240.00',
      placedAt: '2026-08-13T14:20:00.000Z',
      waitingSince: '2026-08-13T14:20:00.000Z',
    },
    invalid: {
      id: '018f4c1a-0000-7000-8000-000000000001',
      orderNumber: 'LQ-1042',
      status: 'PENDING_BRAND',
      deliveryMethod: 'RIDER_PER_BRAND',
      paymentMethod: 'CASH',
      itemCount: 3,
      itemsTotal: '1240.00',
      placedAt: '2026-08-13T14:20:00.000Z',
      waitingSince: null,
      // A brand must never learn the parent order's total — it includes another
      // brand's goods. Adding this field is a security change, not a feature.
      parentTotal: '2480.00',
    },
    why: 'rejects a parent-order total leaking into a brand row',
  },
  {
    name: 'transitionBrandOrderBody',
    schema: transitionBrandOrderBodySchema,
    valid: { to: 'PACKED' },
    invalid: { to: 'SHIPPED' },
    why: 'rejects a parent-only status as a brand transition target',
  },
  {
    name: 'returnListItem',
    schema: returnListItemSchema,
    valid: {
      id: '018f4c1a-0000-7000-8000-000000000002',
      brandOrderId: '018f4c1a-0000-7000-8000-000000000001',
      orderNumber: 'LQ-1036',
      status: 'REQUESTED',
      // Not decided yet — the brand chooses the route when it approves.
      route: null,
      itemCount: 1,
      reason: 'Wrong size.',
      refundAmount: null,
      requestedAt: '2026-08-13T09:00:00.000Z',
      approvedAt: null,
      restockedAt: null,
    },
    invalid: {
      id: '018f4c1a-0000-7000-8000-000000000002',
      brandOrderId: '018f4c1a-0000-7000-8000-000000000001',
      orderNumber: 'LQ-1036',
      status: 'DELIVERY_FAILED',
      route: 'WALK_IN',
      itemCount: 1,
      reason: 'Refused at the door.',
      refundAmount: null,
      requestedAt: '2026-08-13T09:00:00.000Z',
      approvedAt: null,
      restockedAt: null,
    },
    why: 'refuses to model a refused cash delivery as a return',
  },
  {
    name: 'ledgerEntry',
    schema: ledgerEntrySchema,
    valid: {
      id: '018f4c1a-0000-7000-8000-000000000003',
      type: 'COMMISSION',
      amount: '-252.60',
      note: 'Order LQ-1036 — commission 12%',
      brandOrderId: '018f4c1a-0000-7000-8000-000000000001',
      orderNumber: 'LQ-1036',
      createdAt: '2026-08-15T00:00:00.000Z',
    },
    invalid: {
      id: '018f4c1a-0000-7000-8000-000000000003',
      type: 'COMMISSION',
      amount: -252.6,
      note: null,
      brandOrderId: null,
      orderNumber: null,
      createdAt: '2026-08-15T00:00:00.000Z',
    },
    why: 'rejects a float amount — money crosses the wire as a string',
  },
  {
    name: 'brandBalance',
    schema: brandBalanceSchema,
    valid: { amount: '-410.00', direction: 'BRAND_OWES_LOQAL', asOf: '2026-08-13T00:00:00.000Z' },
    invalid: { amount: '410.00', direction: 'NEGATIVE', asOf: '2026-08-13T00:00:00.000Z' },
    why: 'names which party owes rather than describing the sign',
  },
  {
    name: 'settlementRun',
    schema: settlementRunSchema,
    valid: {
      id: '018f4c1a-0000-7000-8000-000000000004',
      brandId: '018f4c1a-0000-7000-8000-000000000009',
      brandName: 'Nefertari Leather',
      periodStart: '2026-08-11T00:00:00.000Z',
      periodEnd: '2026-08-17T00:00:00.000Z',
      netAmount: '720.50',
      direction: 'WE_PAY',
      status: 'PENDING',
      settlementMethod: 'INSTAPAY',
      settlementDetails: '01022884471',
      markedBy: null,
      markedAt: null,
      note: null,
      createdAt: '2026-08-18T00:00:00.000Z',
    },
    invalid: {
      id: '018f4c1a-0000-7000-8000-000000000004',
      brandId: '018f4c1a-0000-7000-8000-000000000009',
      brandName: 'Nefertari Leather',
      periodStart: '2026-08-11T00:00:00.000Z',
      periodEnd: '2026-08-17T00:00:00.000Z',
      netAmount: '720.50',
      direction: 'WE_PAY',
      status: 'SENT',
      settlementMethod: 'INSTAPAY',
      settlementDetails: '01022884471',
      markedBy: null,
      markedAt: null,
      note: null,
      createdAt: '2026-08-18T00:00:00.000Z',
      autoPaid: true,
    },
    why: 'has no field that could describe money moving without a human',
  },
  {
    name: 'invoiceListItem',
    schema: invoiceListItemSchema,
    valid: {
      id: '018f4c1a-0000-7000-8000-000000000005',
      reference: 'INV-1036-NFL',
      brandOrderId: '018f4c1a-0000-7000-8000-000000000001',
      orderNumber: 'LQ-1036',
      netAmount: '2105.00',
      status: 'PENDING',
      raisedAt: '2026-08-15T00:00:00.000Z',
      // Still rendering. A required issuedAt here would force the UI to claim
      // a document exists that nobody can download yet.
      issuedAt: null,
    },
    invalid: {
      id: '018f4c1a-0000-7000-8000-000000000005',
      reference: 'INV-1036-NFL',
      orderId: '018f4c1a-0000-7000-8000-00000000000a',
      orderNumber: 'LQ-1036',
      netAmount: '2105.00',
      status: 'PENDING',
      raisedAt: '2026-08-15T00:00:00.000Z',
      issuedAt: null,
    },
    why: 'is issued per brand order, never per parent order',
  },
  {
    name: 'adminBrandListItem',
    schema: adminBrandListItemSchema,
    valid: {
      id: '018f4c1a-0000-7000-8000-000000000009',
      name: 'Nefertari Leather',
      slug: 'nefertari-leather',
      status: 'ACTIVE',
      grossSales: '18400.00',
      balance: '-410.00',
      badgeCounts: { computed: 2, verified: 1 },
    },
    invalid: {
      id: '018f4c1a-0000-7000-8000-000000000009',
      name: 'Nefertari Leather',
      slug: 'nefertari-leather',
      status: 'REJECTED',
      grossSales: '18400.00',
      balance: '-410.00',
      badgeCounts: { computed: 2, verified: 1 },
    },
    why: 'has no REJECTED brand status — a rejected application creates no brand',
  },
  {
    name: 'suspendBrandBody',
    schema: suspendBrandBodySchema,
    valid: { reason: 'Counterfeit goods' },
    invalid: { reason: '' },
    why: 'requires a reason on a suspension',
  },
  {
    name: 'salesPack',
    schema: salesPackSchema,
    valid: {
      category: 'abayas',
      trafficProof: { totalEvents: 1840, totalVisitors: 610 },
      categoryComparison: { withheld: true, reason: 'K_ANONYMITY' },
      generatedAt: '2026-08-13T00:00:00.000Z',
    },
    invalid: {
      category: 'abayas',
      trafficProof: { totalEvents: 1840, totalVisitors: 610 },
      categoryComparison: null,
      generatedAt: '2026-08-13T00:00:00.000Z',
    },
    why: 'withholds a below-floor aggregate explicitly instead of nulling it',
  },
  {
    name: 'salesTermsBand',
    schema: salesTermsBandSchema,
    valid: { commissionFloorBps: null, maxFreeMonths: null, defaultFreeMonths: 2 },
    invalid: { commissionFloorBps: null, maxFreeMonths: null },
    why: 'always states the pre-filled default alongside the band',
  },
  {
    name: 'platformSettings',
    schema: platformSettingsSchema,
    valid: {
      id: 1,
      updatedAt: '2026-08-13T00:00:00.000Z',
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
        chatAttachmentAllowedMimeTypes: [
          'image/jpeg',
          'image/png',
          'image/webp',
          'application/pdf',
        ],
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
    },
    // Flat, which is the shape of the UPDATE body and never of the read.
    invalid: { analyticsTimezone: 'Africa/Cairo', analyticsKAnonymityFloor: 3 },
    why: 'groups settings by what they govern rather than by column order',
  },
  {
    name: 'importItem',
    schema: importItemSchema,
    valid: {
      id: '018f4c1a-0000-7000-8000-000000000006',
      status: 'STAGED',
      sourceTitle: 'TEST PRODUCT',
      mappedName: null,
      mappedPrice: null,
      mappedCategoryId: null,
      missingPrice: true,
      missingName: true,
      failureReason: null,
    },
    invalid: {
      id: '018f4c1a-0000-7000-8000-000000000006',
      status: 'PUBLISHED',
      sourceTitle: 'TEST PRODUCT',
      mappedName: null,
      mappedPrice: null,
      mappedCategoryId: null,
      missingPrice: true,
      missingName: true,
      failureReason: null,
    },
    why: 'has no PUBLISHED item status — nothing publishes automatically',
  },
];

describe.each(cases)('$name', ({ schema, valid, invalid, why }) => {
  it('parses a well-formed payload', () => {
    expect(() => schema.parse(valid)).not.toThrow();
  });

  it(`${why}`, () => {
    expect(() => schema.parse(invalid)).toThrow();
  });

  it('is a strict object that rejects an unknown key', () => {
    expect(() => schema.parse({ ...(valid as object), somethingNobodyAgreedTo: 1 })).toThrow();
  });
});

describe('query schemas', () => {
  it('defaults the order list to 20 rows and coerces the limit from a query string', () => {
    expect(listBrandOrdersQuerySchema.parse({})).toEqual({ limit: 20 });
    expect(listBrandOrdersQuerySchema.parse({ limit: '50' }).limit).toBe(50);
  });

  it('caps the page size so one caller cannot ask for the whole table', () => {
    expect(() => listBrandOrdersQuerySchema.parse({ limit: '5000' })).toThrow();
  });
});

describe('write bodies that must carry a human reason', () => {
  it('requires a reason to reject a return', () => {
    expect(() => rejectReturnBodySchema.parse({})).toThrow();
    expect(rejectReturnBodySchema.parse({ reason: 'Worn, not faulty' }).reason).toBe('Worn, not faulty');
  });

  it('only lets a settlement be marked SENT, RECEIVED or CANCELLED by a person', () => {
    expect(markSettlementBodySchema.parse({ status: 'SENT' }).status).toBe('SENT');
    // PENDING is the state a run is raised in. Marking something back to it
    // would erase the record that a human looked at the figure.
    expect(() => markSettlementBodySchema.parse({ status: 'PENDING' })).toThrow();
  });
});

describe('brandProfile', () => {
  it('carries commercial terms as read-only facts beside the terms a brand sets itself', () => {
    const parsed = brandProfileSchema.parse({
      id: '018f4c1a-0000-7000-8000-000000000009',
      name: 'Nefertari Leather',
      slug: 'nefertari-leather',
      description: { ar: 'جلود مصرية', en: 'Egyptian leather' },
      logoMediaId: null,
      coverMediaId: null,
      status: 'ACTIVE',
      notificationPhone: '01022884471',
      trading: {
        deliveryFee: '45.00',
        returnWindowDays: 14,
        minimumOrderValue: null,
        supportedDelivery: ['RIDER_PER_BRAND'],
        stockSetup: 'SHOP_SHARED_STOCK',
      },
      invoiceIdentity: {
        legalName: 'Nefertari Leather Works',
        taxNumber: '123-456-789',
        invoiceAddress: '14 Shar Qasr El Aini, Cairo',
        invoiceTerms: null,
      },
      payout: { settlementMethod: 'INSTAPAY', settlementDetails: '01022884471' },
      loqalTerms: {
        freeUntil: '2026-10-01T00:00:00.000Z',
        monthlyFee: null,
        perOrderChargeType: 'PERCENT',
        perOrderChargeValue: '12.00',
        settlementCadence: 'WEEKLY',
        settlementAnchor: 1,
      },
    });

    expect(parsed.trading.supportedDelivery).toEqual(['RIDER_PER_BRAND']);
    expect(parsed.loqalTerms.perOrderChargeType).toBe('PERCENT');
  });

  it('never accepts SHIPPING_SERVICE as a supported route — it has no courier contract', () => {
    expect(() =>
      brandProfileSchema.shape.trading.parse({
        deliveryFee: null,
        returnWindowDays: 14,
        minimumOrderValue: null,
        supportedDelivery: ['SHIPPING_SERVICE'],
        stockSetup: 'SHOP_SHARED_STOCK',
      }),
    ).toThrow();
  });
});

describe('detail schemas', () => {
  it('gives an order detail a status history and a shopper, and nothing about another brand', () => {
    const keys = Object.keys(brandOrderDetailSchema.shape);
    expect(keys).toEqual(expect.arrayContaining(['items', 'shopper', 'statusHistory']));
    expect(keys).not.toEqual(expect.arrayContaining(['parentTotal', 'siblingBrands', 'otherBrandOrders']));
  });

  it('gives an import job a per-row breakdown so a partial import names its failures', () => {
    expect(Object.keys(importJobSchema.shape)).toEqual(
      expect.arrayContaining(['status', 'counts']),
    );
  });

  it('models a brand application without creating a user', () => {
    expect(Object.keys(brandApplicationSchema.shape)).not.toEqual(
      expect.arrayContaining(['password', 'userId']),
    );
  });
});

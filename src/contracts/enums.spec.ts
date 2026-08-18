import { z } from 'zod';
import {
  BrandOrderStatusSchema,
  BrandStatusSchema,
  DeliveryMethodSchema,
  LedgerEntryTypeSchema,
  OrderStatusSchema,
  PaymentMethodSchema,
  ReturnRouteSchema,
  ReturnStatusSchema,
  SettlementDirectionSchema,
  SettlementStatusSchema,
  UserRoleSchema,
} from './enums';
import { pageSchema } from './pagination';
import { apiErrorSchema } from './errors';
import { signedMoneySchema } from './money';

describe('enums', () => {
  it('accepts every BrandOrderStatus the Prisma schema declares', () => {
    for (const v of [
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
    ]) {
      expect(BrandOrderStatusSchema.parse(v)).toBe(v);
    }
  });

  it('rejects a parent OrderStatus value on a BrandOrderStatus', () => {
    // SHIPPED and PROCESSING exist on the parent Order only. A brand order
    // that accepted them would be claiming a state it cannot be in.
    expect(() => BrandOrderStatusSchema.parse('SHIPPED')).toThrow();
    expect(() => BrandOrderStatusSchema.parse('PROCESSING')).toThrow();
    expect(OrderStatusSchema.parse('SHIPPED')).toBe('SHIPPED');
  });

  it('has exactly three brand statuses — a rejected application creates no brand', () => {
    expect(BrandStatusSchema.options).toEqual(['PENDING', 'ACTIVE', 'SUSPENDED']);
    expect(() => BrandStatusSchema.parse('REJECTED')).toThrow();
  });

  it('carries SHIPPING_SERVICE, which is modelled but never offered', () => {
    // It has no courier contract behind it, so no brand enables it. It stays
    // in the enum because turning it on must be a data change, not a migration.
    expect(DeliveryMethodSchema.parse('SHIPPING_SERVICE')).toBe('SHIPPING_SERVICE');
  });

  it('covers the five roles and the ledger, return, settlement and payment enums', () => {
    expect(UserRoleSchema.options).toHaveLength(5);
    expect(LedgerEntryTypeSchema.options).toHaveLength(6);
    expect(ReturnStatusSchema.options).toHaveLength(4);
    expect(ReturnRouteSchema.options).toEqual(['COURIER', 'WALK_IN']);
    expect(SettlementDirectionSchema.options).toEqual(['WE_PAY', 'THEY_PAY']);
    expect(SettlementStatusSchema.options).toHaveLength(4);
    expect(PaymentMethodSchema.options).toHaveLength(5);
  });
});

describe('pageSchema', () => {
  const page = pageSchema(z.object({ id: z.string() }).strict());

  it('wraps items with a cursor', () => {
    expect(page.parse({ items: [{ id: 'a' }], nextCursor: null })).toEqual({
      items: [{ id: 'a' }],
      nextCursor: null,
    });
  });

  it('rejects an offset-paged envelope', () => {
    // Offset paging drifts while a brand is confirming orders — a row moves
    // out of PENDING_BRAND between page one and page two and is never seen.
    expect(() => page.parse({ items: [], total: 0, page: 1 })).toThrow();
  });
});

describe('apiErrorSchema', () => {
  it('parses the single body shape the Nest exception filter emits', () => {
    expect(
      apiErrorSchema.parse({
        statusCode: 403,
        message: 'Your role cannot perform this action',
        error: 'Forbidden',
      }).statusCode,
    ).toBe(403);
  });

  it('rejects a body with an extra field', () => {
    expect(() =>
      apiErrorSchema.parse({ statusCode: 500, message: 'x', error: 'y', stack: 'leaked' }),
    ).toThrow();
  });

  /**
   * `violations` widened this schema, so the property that matters is that
   * NOTHING about an error without one changed: same keys, same values, no
   * `violations: undefined` appearing in the parsed object for a client to
   * branch on.
   */
  it('parses a body with no violations to exactly what it parsed to before the field existed', () => {
    const body = { statusCode: 404, message: 'No such brand', error: 'Not Found' };
    const parsed = apiErrorSchema.parse(body);

    expect(parsed).toEqual(body);
    expect(Object.keys(parsed)).toEqual(['statusCode', 'message', 'error']);
    expect('violations' in parsed).toBe(false);
    expect(JSON.stringify(parsed)).toBe(JSON.stringify(body));
  });

  it('carries the 422 band violations a rep needs to know which half of the band broke', () => {
    const parsed = apiErrorSchema.parse({
      statusCode: 422,
      message: 'Outside the band a rep may close without admin approval',
      error: 'Unprocessable Entity',
      violations: ['perOrderChargeValue (3.00%) is below the floor of 500 bps'],
    });

    expect(parsed.violations).toEqual([
      'perOrderChargeValue (3.00%) is below the floor of 500 bps',
    ]);
  });

  it('refuses a violations value that is not a list of plain strings', () => {
    expect(() =>
      apiErrorSchema.parse({
        statusCode: 422,
        message: 'x',
        error: 'y',
        violations: [{ field: 'freeUntil' }],
      }),
    ).toThrow();
  });
});

describe('signedMoneySchema', () => {
  it('accepts a negative balance, because a brand can owe Loqal money', () => {
    expect(signedMoneySchema.parse('-1240.00')).toBe('-1240.00');
    expect(signedMoneySchema.parse('1240.00')).toBe('1240.00');
  });

  it('rejects a float, a bare number and a currency symbol', () => {
    expect(() => signedMoneySchema.parse(1240)).toThrow();
    expect(() => signedMoneySchema.parse('1240.000')).toThrow();
    expect(() => signedMoneySchema.parse('EGP 1240.00')).toThrow();
  });
});

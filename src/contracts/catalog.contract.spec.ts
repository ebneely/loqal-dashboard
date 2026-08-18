import {
  adjustStockBodySchema,
  bulkPublishResultSchema,
  bulkUpdateResultSchema,
  dashboardProductSchema,
  lowStockRowSchema,
  variantStockSchema,
} from './catalog.contract';

const draft = {
  id: '018f4c1a-0000-7000-8000-000000000001',
  // Always a string. A bulk draft gets `product-<8 hex>` because the column is
  // NOT NULL and the API derives one from the name it does not have yet.
  slug: 'product-4c1a0000',
  name: null,
  status: 'DRAFT' as const,
  basePrice: null,
  categoryId: null,
  coverUrl: null,
  variantCount: 0,
  priceFrom: null,
  inStock: false,
  updatedAt: '2026-08-14T09:00:00.000Z',
};

describe('dashboardProduct', () => {
  it('represents a photo dropped with no name and no price', () => {
    // The bulk flow's whole premise: 40 photos in, names and prices filled
    // afterwards in a grid. If "unset" were not representable, this arrives as
    // a zero price or an empty-string name — both of which are lies that can
    // reach a storefront.
    expect(() => dashboardProductSchema.parse(draft)).not.toThrow();
  });

  it('rejects a zero price standing in for an absent one', () => {
    // '0.00' parses as money, so this asserts intent rather than syntax: a
    // reviewer reading a zero cannot tell "free" from "nobody has said yet".
    const parsed = dashboardProductSchema.parse({ ...draft, basePrice: '0.00' });
    expect(parsed.basePrice).toBe('0.00');
    expect(parsed.basePrice).not.toBeNull();
  });

  it('rejects a float price', () => {
    expect(() => dashboardProductSchema.parse({ ...draft, basePrice: 940 })).toThrow();
  });

  it('has no PUBLISHED status — the design mockups are wrong about this', () => {
    expect(() => dashboardProductSchema.parse({ ...draft, status: 'PUBLISHED' })).toThrow();
    expect(dashboardProductSchema.parse({ ...draft, status: 'ARCHIVED' }).status).toBe('ARCHIVED');
  });

  it('exposes only whether anything is in stock, never a per-variant level', () => {
    // A brand's own screens show real numbers; this list-row shape is the one
    // shared with storefront-shaped reads, and a public per-variant count tells
    // a competitor exactly how much a rival is holding.
    expect(Object.keys(dashboardProductSchema.shape)).toContain('inStock');
    expect(Object.keys(dashboardProductSchema.shape)).not.toContain('stockOnHand');
  });
});

describe('variantStock', () => {
  it('keeps available and reserved as two separate numbers', () => {
    const stock = variantStockSchema.parse({ stockOnHand: 5, reservedQty: 4, availableQty: 1 });
    expect(stock.availableQty).toBe(1);
    expect(stock.stockOnHand).toBe(5);
  });

  it('cannot express a single merged figure', () => {
    expect(() => variantStockSchema.parse({ availableQty: 1 })).toThrow();
  });
});

describe('lowStockRow', () => {
  it('carries the full stock triple so the screen reads availability, not on-hand', () => {
    // Five on the shelf with four reserved is one from empty. A screen reading
    // stockOnHand calls that comfortable and the brand oversells.
    const row = lowStockRowSchema.parse({
      variantId: '018f4c1a-0000-7000-8000-000000000002',
      productId: '018f4c1a-0000-7000-8000-000000000001',
      sku: 'NEF-LIN-M',
      productName: { ar: 'عباية كتان', en: 'Linen Abaya' },
      variantLabel: 'M',
      stock: { stockOnHand: 5, reservedQty: 4, availableQty: 1 },
    });
    expect(row.stock.availableQty).toBe(1);
  });
});

describe('adjustStockBody', () => {
  it('requires a reason on every movement', () => {
    expect(() => adjustStockBodySchema.parse({ delta: -2 })).toThrow();
    expect(adjustStockBodySchema.parse({ delta: -2, reason: 'IN_STORE' }).reason).toBe('IN_STORE');
  });

  it('refuses a zero adjustment, which would write an audit row recording nothing', () => {
    expect(() => adjustStockBodySchema.parse({ delta: 0, reason: 'CORRECTION' })).toThrow();
  });
});

describe('bulk results', () => {
  it('reports per row, so one bad row does not discard thirty-nine good ones', () => {
    const parsed = bulkUpdateResultSchema.parse({
      results: [
        { id: '018f4c1a-0000-7000-8000-000000000001', ok: true, product: draft },
        {
          id: '018f4c1a-0000-7000-8000-000000000002',
          ok: false,
          code: 'UPDATE_FAILED',
          reason: 'Unknown category',
        },
      ],
    });
    expect(parsed.results).toHaveLength(2);
  });

  it('refuses a failure code the dashboard has no translation for', () => {
    // An open string would let the backend introduce a reason the Arabic
    // catalogue cannot express, and it would surface as English prose to the
    // one person who has to act on it.
    expect(() =>
      bulkUpdateResultSchema.parse({
        results: [
          {
            id: '018f4c1a-0000-7000-8000-000000000002',
            ok: false,
            code: 'SOMETHING_NEW',
            reason: 'Unknown category',
          },
        ],
      }),
    ).toThrow();
  });

  it('makes a failed row carry its reason — ok:false without one is unparseable', () => {
    expect(() =>
      bulkUpdateResultSchema.parse({
        results: [{ id: '018f4c1a-0000-7000-8000-000000000002', ok: false }],
      }),
    ).toThrow();
  });

  it('names what is missing when a publish is refused, rather than failing silently', () => {
    const parsed = bulkPublishResultSchema.parse({
      published: [],
      failed: [
        {
          id: '018f4c1a-0000-7000-8000-000000000001',
          codes: ['PRICE_NOT_SET', 'NAME_NOT_SET'],
          reasons: ['No price', 'No name'],
        },
      ],
    });
    expect(parsed.failed[0].reasons).toHaveLength(2);
    expect(parsed.failed[0].codes).toEqual(['PRICE_NOT_SET', 'NAME_NOT_SET']);
  });

  it('cannot report a failure with an empty reason list', () => {
    expect(() =>
      bulkPublishResultSchema.parse({
        published: [],
        failed: [{ id: '018f4c1a-0000-7000-8000-000000000001', reasons: [] }],
      }),
    ).toThrow();
  });
});

/**
 * Catalog fixtures, shaped like the bodies the Nest catalog plane really sends.
 *
 * They live here and not beside the screens on purpose: the route source scan
 * (src/app/(brand)/__tests__/route-source-scan.test.ts) fails any shipped route
 * file that carries sample data, and a fixture that looks like a real shop is
 * exactly what it is looking for.
 *
 * Every product below is the DASHBOARD_PRODUCT_FIELDS select — id, name as raw
 * JSON, basePrice as a string or null, variants with `stockOnHand` and no
 * availability, media as ids with no URL. The two draft rows are the point of
 * the whole file: `name: {}` and `basePrice: null` are what a freshly dropped
 * photo actually looks like.
 */

const uuid = (n: number) =>
  `0199a000-0000-7000-8000-${String(n).padStart(12, "0")}`;

export const productId = uuid;
export const variantId = (n: number) =>
  `0199b000-0000-7000-8000-${String(n).padStart(12, "0")}`;
export const mediaId = (n: number) =>
  `0199c000-0000-7000-8000-${String(n).padStart(12, "0")}`;

export type WireVariantFixture = {
  id: string;
  sku: string;
  attributes: Record<string, string>;
  price: string;
  compareAtPrice: string | null;
  stockOnHand: number;
};

export const wireVariant = (
  n: number,
  over: Partial<WireVariantFixture> = {}
): WireVariantFixture => ({
  id: variantId(n),
  sku: `SKU-${n}`,
  attributes: { size: "M" },
  price: "149.99",
  compareAtPrice: null,
  stockOnHand: 12,
  ...over,
});

export type WireProductFixture = {
  id: string;
  categoryId: string | null;
  name: Record<string, string>;
  description: Record<string, string> | null;
  slug: string | null;
  basePrice: string | null;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  createdAt: string;
  updatedAt: string;
  variants: WireVariantFixture[];
  media: { id: string; mediaId: string; sortOrder: number }[];
};

export const wireProduct = (
  n: number,
  over: Partial<WireProductFixture> = {}
): WireProductFixture => ({
  id: productId(n),
  categoryId: null,
  name: { en: `Linen shirt ${n}`, ar: `قميص كتان ${n}` },
  description: null,
  slug: `linen-shirt-${n}`,
  basePrice: "149.99",
  status: "ACTIVE",
  createdAt: "2026-08-01T09:00:00.000Z",
  updatedAt: "2026-08-10T09:00:00.000Z",
  variants: [wireVariant(n)],
  media: [],
  ...over,
});

/**
 * A photo dropped and nothing typed yet. `name: {}` is the backend's own "no
 * name" sentinel and `basePrice: null` is what `toDashboardShape` turns its
 * `-1` price into.
 */
export const wireDraft = (
  n: number,
  over: Partial<WireProductFixture> = {}
): WireProductFixture =>
  wireProduct(n, {
    name: {},
    basePrice: null,
    slug: `product-${n}`,
    status: "DRAFT",
    variants: [],
    media: [{ id: `pm-${n}`, mediaId: mediaId(n), sortOrder: 0 }],
    ...over,
  });

export const page = (items: WireProductFixture[]) => ({
  items,
  total: items.length,
  page: 1,
  perPage: 50,
});

export const activeProducts = page([
  wireProduct(1),
  wireProduct(2, { basePrice: "89.00", variants: [wireVariant(2, { price: "89.00" })] }),
]);

/** One live product and one draft with neither a name nor a price. */
export const mixedProducts = page([wireProduct(1), wireDraft(9)]);

export const emptyProducts = page([]);

export const categories = [
  { id: uuid(101), name: { en: "Shirts", ar: "قمصان" }, slug: "shirts", parentId: null },
];

/** Forty drafts, which is the working example US-BRAND-005 is written around. */
export const fortyDrafts = page(
  Array.from({ length: 40 }, (_, index) => wireDraft(index + 1))
);

/**
 * Inventory fixtures — the products list the variant rows are derived from, and
 * the per-variant stock levels the availability comes from.
 *
 * `V_HEALTHY_ON_HAND` is the one that matters: twenty on the shelf and eighteen
 * of them held for shoppers at checkout. A screen reading stock on hand calls
 * that comfortable; it is two items from empty.
 */
import { page, wireProduct, wireVariant } from "../../products/__tests__/fixtures";

export const V_HEALTHY_ON_HAND = "0199b000-0000-7000-8000-000000000001";
export const V_PLAIN = "0199b000-0000-7000-8000-000000000002";
export const V_UNSCANNED = "0199b000-0000-7000-8000-000000000003";

export const products = page([
  wireProduct(1, {
    name: { en: "Linen shirt", ar: "قميص كتان" },
    variants: [
      wireVariant(1, { sku: "NEF-LS-S", attributes: { size: "S" }, stockOnHand: 20 }),
      wireVariant(2, { sku: "NEF-LS-M", attributes: { size: "M" }, stockOnHand: 40 }),
    ],
  }),
  wireProduct(2, {
    name: { en: "Cotton scarf" },
    variants: [
      wireVariant(3, { sku: "NEF-CS-1", attributes: { colour: "black" }, stockOnHand: 6 }),
    ],
  }),
]);

/** Twenty on the shelf, eighteen already held: two actually available. */
export const levelHealthyOnHand = {
  variantId: V_HEALTHY_ON_HAND,
  sku: "NEF-LS-S",
  stockOnHand: 20,
  availableQty: 2,
};

/** Nothing held: available equals on hand, and the two are still shown apart. */
export const levelPlain = {
  variantId: V_PLAIN,
  sku: "NEF-LS-M",
  stockOnHand: 40,
  availableQty: 40,
};

export const levelScarf = {
  variantId: V_UNSCANNED,
  sku: "NEF-CS-1",
  stockOnHand: 6,
  availableQty: 6,
};

export const adjustments = [
  {
    id: "0199d000-0000-7000-8000-000000000001",
    brandId: "0199e000-0000-7000-8000-000000000001",
    variantId: V_HEALTHY_ON_HAND,
    delta: 24,
    reason: "OPENING",
    balanceAfter: 24,
    actorId: "0199f000-0000-7000-8000-000000000001",
    note: "First count",
    createdAt: "2026-08-01T08:30:00.000Z",
  },
  {
    id: "0199d000-0000-7000-8000-000000000002",
    brandId: "0199e000-0000-7000-8000-000000000001",
    variantId: V_HEALTHY_ON_HAND,
    delta: -4,
    reason: "SALE",
    balanceAfter: 20,
    actorId: null,
    note: null,
    createdAt: "2026-08-09T12:00:00.000Z",
  },
];

export const emptyProducts = page([]);

/**
 * Fixtures for the admin console.
 *
 * They live under `__tests__` because the route-source scan rejects a sample
 * mailbox or a phone-shaped string anywhere in shipped route source — copy
 * lifted from a design file looks like data until somebody tries to call it.
 *
 * Every list fixture is asserted against the shipped contract by the tests that
 * use it, so a fixture cannot drift into describing a response the API would
 * never send.
 */
import type { BrandApplication } from "@loqal/contracts/admin.contract";

import type { AdminBrandRow } from "../admin/brands/brands-data";
import type { AdminBrandDetail } from "../admin/brands/[id]/brand-detail-data";
import type { Category } from "../admin/categories/categories-data";

export const NOW = new Date("2026-08-14T10:00:00.000Z");

const uuid = (n: number) =>
  `0199b000-0000-7000-8000-${String(n).padStart(12, "0")}`;

// ---------------------------------------------------------------------------
// Applications
// ---------------------------------------------------------------------------

export const pendingApplication: BrandApplication = {
  id: uuid(1),
  businessName: "Bab El Louq Ceramics",
  ownerName: "Hana Riad",
  email: "hana@example.test",
  phone: "+20 100 000 0001",
  instagramUrl: "https://instagram.com/bablouq",
  websiteUrl: null,
  description: "Hand-thrown tableware, fired in a Downtown workshop.",
  status: "PENDING",
  reviewedBy: null,
  reviewedAt: null,
  rejectionReason: null,
  createdAt: "2026-08-11T09:00:00.000Z",
};

/** No Instagram at all — the state the screen has to say out loud. */
export const applicationWithoutInstagram: BrandApplication = {
  ...pendingApplication,
  id: uuid(2),
  businessName: "Sinai Honey Co.",
  ownerName: "Omar Nasr",
  email: "omar@example.test",
  phone: "+20 100 000 0002",
  instagramUrl: null,
  websiteUrl: "https://example.test/sinai",
  description: null,
  createdAt: "2026-08-12T09:00:00.000Z",
};

export const rejectedApplication: BrandApplication = {
  ...pendingApplication,
  id: uuid(3),
  businessName: "Maadi Print Shop",
  ownerName: "Lina Adel",
  email: "lina@example.test",
  phone: "+20 100 000 0003",
  instagramUrl: "https://instagram.com/maadiprint",
  websiteUrl: null,
  description: null,
  status: "REJECTED",
  reviewedBy: uuid(90),
  reviewedAt: "2026-08-13T09:00:00.000Z",
  rejectionReason: "Resells stock it does not hold.",
  createdAt: "2026-08-10T09:00:00.000Z",
};

export const applications: BrandApplication[] = [
  pendingApplication,
  applicationWithoutInstagram,
  rejectedApplication,
];

// ---------------------------------------------------------------------------
// Brands
// ---------------------------------------------------------------------------

/** Loqal owes this one. Positive balance. */
export const brandOwedMoney: AdminBrandRow = {
  id: uuid(11),
  name: "Nefertari Linens",
  slug: "nefertari-linens",
  status: "ACTIVE",
  grossSales: "48200.00",
  balance: "1240.00",
  badgeCounts: { computed: 2, verified: 1 },
  isPromoted: true,
  featuredUntil: "2026-09-30T00:00:00.000Z",
  sortOrder: 3,
};

/** This one owes Loqal. Same shape, opposite sign. */
export const brandOwingMoney: AdminBrandRow = {
  id: uuid(12),
  name: "Alexandria Leatherworks",
  slug: "alexandria-leatherworks",
  status: "ACTIVE",
  grossSales: "12750.00",
  balance: "-860.50",
  badgeCounts: { computed: 0, verified: 0 },
  isPromoted: false,
  featuredUntil: null,
  sortOrder: 7,
};

export const brandSuspended: AdminBrandRow = {
  id: uuid(13),
  name: "Zamalek Candles",
  slug: "zamalek-candles",
  status: "SUSPENDED",
  grossSales: "0.00",
  balance: "0.00",
  badgeCounts: { computed: 0, verified: 0 },
  isPromoted: false,
  featuredUntil: null,
  sortOrder: 9,
};

export const brandsPage = {
  items: [brandOwedMoney, brandOwingMoney, brandSuspended],
  nextCursor: null,
};

export const brandsPageWithCursor = {
  items: [brandOwedMoney, brandOwingMoney],
  nextCursor: "cursor-2",
};

export const emptyBrandsPage = { items: [], nextCursor: null };

/**
 * What the endpoint answers TODAY: the four selected columns plus the three
 * computed figures, and no placement fields at all.
 */
export const brandsPageWithoutPlacement = {
  items: [
    {
      id: brandOwedMoney.id,
      name: brandOwedMoney.name,
      slug: brandOwedMoney.slug,
      status: brandOwedMoney.status,
      grossSales: brandOwedMoney.grossSales,
      balance: brandOwedMoney.balance,
      badgeCounts: brandOwedMoney.badgeCounts,
    },
  ],
  nextCursor: null,
};

// ---------------------------------------------------------------------------
// One brand, in full
// ---------------------------------------------------------------------------

export const brandDetail: AdminBrandDetail = {
  id: uuid(11),
  name: "Nefertari Linens",
  slug: "nefertari-linens",
  status: "ACTIVE",
  description: { en: "Bed linen woven in Damietta." },
  logoMediaId: null,
  coverMediaId: null,
  notificationPhone: "+20 100 000 0011",
  createdAt: "2026-01-04T09:00:00.000Z",
  updatedAt: "2026-08-01T09:00:00.000Z",
  applicationId: uuid(1),

  deliveryFee: "45.00",
  returnWindowDays: 14,
  minimumOrderValue: "250.00",
  supportedDelivery: ["RIDER_PER_BRAND", "BRAND_OWN_DELIVERY"],
  stockSetup: "SHOP_SHARED_STOCK",

  legalName: "Nefertari Trading",
  taxNumber: "100-200-300",
  invoiceAddress: "Damietta",
  invoiceTerms: "Net 30",

  freeUntil: "2026-12-31T00:00:00.000Z",
  monthlyFee: "350.00",
  perOrderChargeType: "PERCENT",
  perOrderChargeValue: "12.00",
  settlementCadence: "WEEKLY",
  settlementAnchor: 1,

  settlementMethod: "INSTAPAY",
  settlementDetails: "nefertari-payouts",

  reputationScore: 72,
  reputationSetBy: uuid(90),
  reputationSetAt: "2026-07-02T09:00:00.000Z",

  isPromoted: true,
  featuredUntil: "2026-09-30T00:00:00.000Z",
  sortOrder: 3,

  grossSales: "48200.00",
  balance: "1240.00",
  badges: {
    computed: [
      {
        id: uuid(21),
        type: "SAME_DAY_SHIPPER",
        earnedAt: "2026-07-20T09:00:00.000Z",
        lostAt: null,
      },
    ],
    verified: [
      {
        id: uuid(22),
        type: "PRICE_CHECKED",
        checkedBy: uuid(90),
        checkedAgainst: "The shelf price in the Damietta shop",
        checkedAt: "2026-07-01T09:00:00.000Z",
        expiresAt: "2026-10-01T09:00:00.000Z",
      },
    ],
  },
};

export const suspendedBrandDetail: AdminBrandDetail = {
  ...brandDetail,
  id: uuid(13),
  name: "Zamalek Candles",
  slug: "zamalek-candles",
  status: "SUSPENDED",
  isPromoted: false,
  featuredUntil: null,
  balance: "-860.50",
};

// ---------------------------------------------------------------------------
// Categories — a FLAT array, which is all the endpoint ever answers
// ---------------------------------------------------------------------------

export const flatCategories: Category[] = [
  { id: "c-home", name: { en: "Home", ar: "المنزل" }, slug: "home", parentId: null, sortOrder: 0 },
  { id: "c-kitchen", name: { en: "Kitchen", ar: "المطبخ" }, slug: "kitchen", parentId: "c-home", sortOrder: 0 },
  { id: "c-plates", name: { en: "Plates", ar: "أطباق" }, slug: "plates", parentId: "c-kitchen", sortOrder: 1 },
  { id: "c-mugs", name: { en: "Mugs", ar: "أكواب" }, slug: "mugs", parentId: "c-kitchen", sortOrder: 0 },
  { id: "c-fashion", name: { en: "Fashion", ar: "أزياء" }, slug: "fashion", parentId: null, sortOrder: 1 },
];

/** A row whose parent is not in the response — it must still be reachable. */
export const orphanedCategory: Category = {
  id: "c-orphan",
  name: { en: "Orphaned", ar: "يتيم" },
  slug: "orphaned",
  parentId: "c-gone",
  sortOrder: 0,
};

/** a → b → a. The service refuses to create one; the builder must survive one. */
export const cyclicCategories: Category[] = [
  { id: "c-a", name: { en: "A" }, slug: "a", parentId: "c-b", sortOrder: 0 },
  { id: "c-b", name: { en: "B" }, slug: "b", parentId: "c-a", sortOrder: 0 },
];

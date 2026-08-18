/**
 * Fixtures for the sales console.
 *
 * The brand ids are the SEEDED ones, deliberately. Those five rows have no
 * `BrandApplication` at all, so `SalesBrandApplicationRepository.isSignedBy`
 * answers false for every rep and the API answers 404 for every one of them —
 * which makes them the honest stand-in for "a brand this rep is not bound to"
 * rather than an id invented for a test.
 */
import type { SalesLedger } from "../signed-brands";

export const REP_ID = "0199c000-0000-7000-8000-00000000rep1";
export const OTHER_REP_ID = "0199c000-0000-7000-8000-00000000rep2";

/** Seeded, admin-priced, bound to nobody. */
export const SEEDED_BRAND_ID = "0199b000-0000-7000-8000-000000000011";

/** A brand this rep closed in this session. */
export const SIGNED_BRAND_ID = "0199b000-0000-7000-8000-0000000000aa";
export const SIGNED_APPLICATION_ID = "0199a000-0000-7000-8000-0000000000aa";

/** An application filed without a slug. No Brand exists for it. */
export const LEAD_APPLICATION_ID = "0199a000-0000-7000-8000-0000000000bb";

export const signedBrandLedger: SalesLedger = {
  signed: [
    {
      brandId: SIGNED_BRAND_ID,
      name: "Nour Ceramics",
      slug: "nour-ceramics",
      applicationId: SIGNED_APPLICATION_ID,
      signedAt: "2026-08-17T09:00:00.000Z",
    },
  ],
  leads: [],
};

export const leadOnlyLedger: SalesLedger = {
  signed: [],
  leads: [
    {
      applicationId: LEAD_APPLICATION_ID,
      businessName: "Zamalek Flowers",
      filedAt: "2026-08-17T10:00:00.000Z",
    },
  ],
};

export const mixedLedger: SalesLedger = {
  signed: signedBrandLedger.signed,
  leads: leadOnlyLedger.leads,
};

/** `PlatformSetting`'s band, as `GET /v1/sales/terms/band` answers it. */
export const boundedBand = {
  commissionFloorBps: 500,
  maxFreeMonths: 3,
  defaultFreeMonths: 1,
};

/** Both bounds null — the state Loqal is actually in today. */
export const unboundedBand = {
  commissionFloorBps: null,
  maxFreeMonths: null,
  defaultFreeMonths: 1,
};

export const flatCategories = [
  {
    id: "c-home",
    name: { en: "Home", ar: "المنزل" },
    slug: "home",
    parentId: null,
    sortOrder: 0,
  },
  {
    id: "c-fashion",
    name: { en: "Fashion", ar: "أزياء" },
    slug: "fashion",
    parentId: null,
    sortOrder: 1,
  },
  // A legacy row whose JSON name column is the "not named" sentinel. It must
  // not become an option a rep can pick by accident.
  {
    id: "c-unnamed",
    name: {},
    slug: "unnamed",
    parentId: null,
    sortOrder: 2,
  },
];

/** The pack as the API actually answers it — no `generatedAt`. */
export const reportedPack = {
  category: "home",
  trafficProof: { totalEvents: 12_400, totalVisitors: 380_000 },
  categoryComparison: { brandCount: 9, medianMonthlyOrders: 42 },
};

export const withheldPack = {
  category: "home",
  trafficProof: { totalEvents: 12_400, totalVisitors: 380_000 },
  categoryComparison: { withheld: true as const, reason: "K_ANONYMITY" as const },
};

/** Enough brands to report, and none of them has a metric row yet. */
export const notMeasuredPack = {
  category: "home",
  trafficProof: { totalEvents: 12_400, totalVisitors: 380_000 },
  categoryComparison: { brandCount: 9, medianMonthlyOrders: null },
};

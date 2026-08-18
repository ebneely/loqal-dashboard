/**
 * Fixtures for /settings. They live here and only here — shipped route source
 * carries no sample shop, no sample tax number and no sample account.
 *
 * The two profiles below are the SAME shop read by two different people, which
 * is the whole point of this screen: an employee's payload has no `payout` key
 * and no `loqalTerms` key at all. Not nulled — absent, exactly as
 * `toBrandProfile` builds it.
 */
import type { BrandProfileWire } from "../settings-wire";

export const BRAND_ID = "0199e000-0000-7000-8000-000000000001";

export const ownerProfile: BrandProfileWire = {
  id: BRAND_ID,
  name: "A shop",
  slug: "a-shop",
  description: { en: "Hand-made things.", ar: "أشياء مصنوعة يدويًا." },
  logoMediaId: "0199e000-0000-7000-8000-0000000000aa",
  coverMediaId: null,
  status: "ACTIVE",
  notificationPhone: "+20 100 000 0000",
  trading: {
    deliveryFee: "45.00",
    returnWindowDays: 7,
    minimumOrderValue: "200.00",
    supportedDelivery: ["RIDER_PER_BRAND", "BRAND_OWN_DELIVERY"],
    stockSetup: "SHOP_SHARED_STOCK",
  },
  invoiceIdentity: {
    legalName: "A Shop LLC",
    taxNumber: "000-000-000",
    invoiceAddress: "A street, a city",
    invoiceTerms: "Payable on receipt",
  },
  payout: {
    settlementMethod: "INSTAPAY",
    settlementDetails: null,
  },
  loqalTerms: {
    freeUntil: "2026-12-31T00:00:00.000Z",
    monthlyFee: "350.00",
    perOrderChargeType: "PERCENT",
    perOrderChargeValue: "12",
    settlementCadence: "WEEKLY",
    settlementAnchor: 1,
  },
};

/**
 * The same shop, read by a counter assistant. Two keys simply are not there.
 *
 * Built by DELETING them rather than by writing a second literal without them,
 * so the fixture cannot drift into "the employee shape happens to be missing a
 * field the owner shape gained".
 */
export const employeeProfile: BrandProfileWire = (() => {
  const rest: BrandProfileWire = { ...ownerProfile };
  delete rest.payout;
  delete rest.loqalTerms;
  return rest;
})();

/**
 * A legacy row carrying the route that is modelled and not live. It must not
 * fail the screen, must not be offered, and must not be sent back on the next
 * save.
 */
export const profileWithShippingService: BrandProfileWire = {
  ...ownerProfile,
  trading: {
    ...ownerProfile.trading,
    supportedDelivery: [
      "RIDER_PER_BRAND",
      "SHIPPING_SERVICE",
      "BRAND_OWN_DELIVERY",
    ],
  },
};

/** A shop that has filled in nothing optional yet, and still trades. */
export const bareProfile: BrandProfileWire = {
  ...ownerProfile,
  description: null,
  logoMediaId: null,
  coverMediaId: null,
  notificationPhone: null,
  trading: {
    deliveryFee: null,
    returnWindowDays: 0,
    minimumOrderValue: null,
    supportedDelivery: ["BRAND_OWN_DELIVERY"],
    stockSetup: "ONLINE_ONLY",
  },
  invoiceIdentity: {
    legalName: null,
    taxNumber: null,
    invoiceAddress: null,
    invoiceTerms: null,
  },
  payout: { settlementMethod: null, settlementDetails: null },
  loqalTerms: {
    freeUntil: null,
    monthlyFee: null,
    perOrderChargeType: "FIXED",
    perOrderChargeValue: "8.00",
    settlementCadence: "MONTHLY",
    settlementAnchor: null,
  },
};

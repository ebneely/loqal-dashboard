// @vitest-environment node
/**
 * The decisions /settings makes, checked without a DOM.
 */
import { describe, expect, it } from "vitest";

import {
  draftFrom,
  draftIssues,
  isLiveRoute,
  liveRoutes,
  perOrderCharge,
  showsLoqalTerms,
  showsPayout,
  updateBodyFrom,
} from "../settings-rules";
import {
  brandProfileWireSchema,
  updateBrandProfileWireSchema,
} from "../settings-wire";
import {
  bareProfile,
  employeeProfile,
  ownerProfile,
  profileWithShippingService,
} from "./fixtures";

describe("the fixtures are the shape the API actually answers with", () => {
  it("parses every one, including the employee payload with two keys missing", () => {
    for (const profile of [
      ownerProfile,
      employeeProfile,
      profileWithShippingService,
      bareProfile,
    ]) {
      expect(brandProfileWireSchema.safeParse(profile).success).toBe(true);
    }
  });

  /**
   * The contract requires `payout` and `loqalTerms`; the API omits them for an
   * employee. This is the divergence `settings-wire.ts` exists to record, and
   * the assertion that keeps it honest.
   */
  it("has no payout key at all on the employee payload, not a null one", () => {
    expect("payout" in employeeProfile).toBe(false);
    expect("loqalTerms" in employeeProfile).toBe(false);
  });
});

describe("SHIPPING_SERVICE is unrepresentable", () => {
  it("is not a live route", () => {
    expect(isLiveRoute("SHIPPING_SERVICE")).toBe(false);
    expect(isLiveRoute("RIDER_PER_BRAND")).toBe(true);
    expect(isLiveRoute("BRAND_OWN_DELIVERY")).toBe(true);
  });

  it("is dropped on the way in, so a legacy row cannot be re-sent", () => {
    expect(liveRoutes(profileWithShippingService.trading.supportedDelivery)).toEqual([
      "RIDER_PER_BRAND",
      "BRAND_OWN_DELIVERY",
    ]);
  });

  it("never reaches the body", () => {
    const draft = draftFrom(profileWithShippingService);
    const body = updateBodyFrom(draft);
    expect(body?.supportedDelivery).toEqual([
      "RIDER_PER_BRAND",
      "BRAND_OWN_DELIVERY",
    ]);
  });
});

describe("the draft", () => {
  it("holds every number as a string, so an empty box is not a zero", () => {
    const draft = draftFrom(bareProfile);
    expect(draft.deliveryFee).toBe("");
    expect(draft.minimumOrderValue).toBe("");
    // A 0 delivery fee is a promise to deliver free; "not set" is not that.
    expect(draft.returnWindowDays).toBe("0");
  });

  it("reads both languages out of the description", () => {
    const draft = draftFrom(ownerProfile);
    expect(draft.descriptionEn).toBe("Hand-made things.");
    expect(draft.descriptionAr).toBe("أشياء مصنوعة يدويًا.");
  });
});

describe("what would be refused", () => {
  const draft = draftFrom(ownerProfile);

  it("accepts a complete draft", () => {
    expect(draftIssues(draft)).toEqual([]);
  });

  it("requires at least one language and never both", () => {
    expect(
      draftIssues({ ...draft, descriptionAr: "", descriptionEn: "" })
    ).toContain("noLanguage");
    expect(draftIssues({ ...draft, descriptionAr: "" })).not.toContain(
      "noLanguage"
    );
    expect(draftIssues({ ...draft, descriptionEn: "" })).not.toContain(
      "noLanguage"
    );
  });

  it("requires a name", () => {
    expect(draftIssues({ ...draft, name: "   " })).toContain("noName");
  });

  it("refuses a malformed amount and allows an empty one", () => {
    expect(draftIssues({ ...draft, deliveryFee: "45,00" })).toContain(
      "feeMalformed"
    );
    expect(draftIssues({ ...draft, deliveryFee: "" })).not.toContain(
      "feeMalformed"
    );
    expect(draftIssues({ ...draft, minimumOrderValue: "abc" })).toContain(
      "minOrderMalformed"
    );
  });

  it("refuses a return window that is not a whole number of days in range", () => {
    for (const bad of ["", "7.5", "-1", "400", "seven"]) {
      expect(draftIssues({ ...draft, returnWindowDays: bad })).toContain(
        "windowMalformed"
      );
    }
    expect(draftIssues({ ...draft, returnWindowDays: "0" })).not.toContain(
      "windowMalformed"
    );
  });

  it("refuses a shop with no delivery route, which could not be ordered from", () => {
    expect(draftIssues({ ...draft, supportedDelivery: [] })).toContain("noRoute");
  });
});

describe("the body is flat, and carries only what the API takes", () => {
  it("matches the shipped update DTO exactly", () => {
    const body = updateBodyFrom(draftFrom(ownerProfile));
    expect(body).not.toBeNull();
    expect(updateBrandProfileWireSchema.safeParse(body).success).toBe(true);
  });

  it("carries no settlement field, no terms and no status", () => {
    const body = updateBodyFrom(draftFrom(ownerProfile)) ?? {};
    for (const forbidden of [
      "settlementMethod",
      "settlementDetails",
      "invoiceTerms",
      "monthlyFee",
      "perOrderChargeType",
      "perOrderChargeValue",
      "freeUntil",
      "settlementCadence",
      "status",
      "trading",
      "payout",
      "loqalTerms",
    ]) {
      expect(Object.keys(body)).not.toContain(forbidden);
    }
  });

  it("clears an emptied optional field rather than sending an empty string", () => {
    const body = updateBodyFrom({
      ...draftFrom(ownerProfile),
      deliveryFee: "",
      taxNumber: "",
      notificationPhone: "",
    });
    expect(body?.deliveryFee).toBeNull();
    expect(body?.taxNumber).toBeNull();
    expect(body?.notificationPhone).toBeNull();
  });

  it("leaves an absent language absent instead of sending it as empty", () => {
    const body = updateBodyFrom({
      ...draftFrom(ownerProfile),
      descriptionAr: "",
    });
    expect(body?.description).toEqual({ en: "Hand-made things." });
  });

  it("refuses to build a body the API would reject", () => {
    expect(
      updateBodyFrom({ ...draftFrom(ownerProfile), supportedDelivery: [] })
    ).toBeNull();
  });
});

describe("who may see the two owner blocks", () => {
  /** Decided by the payload, which is the boundary that actually enforces it. */
  it("reads the presence of the key, not the session's claim about a role", () => {
    expect(showsPayout(ownerProfile)).toBe(true);
    expect(showsLoqalTerms(ownerProfile)).toBe(true);
    expect(showsPayout(employeeProfile)).toBe(false);
    expect(showsLoqalTerms(employeeProfile)).toBe(false);
    expect(showsPayout(null)).toBe(false);
  });
});

describe("the per-order charge says which kind of number it is", () => {
  const format = {
    amount: (value: string) => `${value} EGP`,
    percent: (value: string) => `${value}%`,
  };

  it("reads a percentage as a percentage and a fixed fee as money", () => {
    expect(perOrderCharge("PERCENT", "12", format)).toBe("12%");
    expect(perOrderCharge("FIXED", "8.00", format)).toBe("8.00 EGP");
  });

  it("answers null rather than a bare number when the type is unknown", () => {
    expect(perOrderCharge(null, "12", format)).toBeNull();
    expect(perOrderCharge("PERCENT", null, format)).toBeNull();
  });
});

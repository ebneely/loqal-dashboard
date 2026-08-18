// @vitest-environment node
import { describe, expect, it } from "vitest";

import { adminUpdateTermsBodySchema } from "../admin/brands/[id]/brand-detail-data";
import {
  asDateInput,
  asInstant,
  dealSummary,
  termsBodyFrom,
  termsChanges,
  termsFormFrom,
} from "../admin/brands/[id]/terms-form";
import { brandDetail } from "./fixtures";

const baseline = termsFormFrom(brandDetail);

describe("the current deal, read off the row", () => {
  it("turns eight columns into a form without inventing a value", () => {
    expect(baseline).toEqual({
      freeUntil: "2026-12-31",
      monthlyFee: "350.00",
      perOrderChargeType: "PERCENT",
      perOrderChargeValue: "12.00",
      settlementCadence: "WEEKLY",
      settlementAnchor: "1",
      settlementMethod: "INSTAPAY",
      settlementDetails: "nefertari-payouts",
    });
  });

  it("keeps unset distinct from zero", () => {
    // A brand with no monthly fee is not a brand with a fee of zero, and the
    // difference is what somebody is invoiced.
    const form = termsFormFrom({
      ...brandDetail,
      monthlyFee: null,
      settlementAnchor: null,
      perOrderChargeType: null,
    });

    expect(form.monthlyFee).toBe("");
    expect(form.settlementAnchor).toBe("");
    expect(form.perOrderChargeType).toBe("");
  });

  it("summarises the deal without joining it into a sentence", () => {
    expect(dealSummary(baseline)).toContainEqual({
      labelKey: "perOrder",
      value: "12.00%",
    });
    expect(
      dealSummary({ ...baseline, perOrderChargeType: "FIXED" })
    ).toContainEqual({ labelKey: "perOrder", value: "12.00 EGP" });
    expect(
      dealSummary({ ...baseline, perOrderChargeType: "" })
    ).toContainEqual({ labelKey: "perOrder", value: "" });
  });
});

describe("what changes, before it changes", () => {
  it("names nothing when nothing was touched", () => {
    expect(termsChanges(baseline, baseline)).toEqual([]);
    expect(termsBodyFrom(baseline, baseline)).toEqual({});
  });

  it("names each field that moved, with both values", () => {
    const changes = termsChanges(baseline, {
      ...baseline,
      monthlyFee: "400.00",
      settlementCadence: "MONTHLY",
    });

    expect(changes).toHaveLength(2);
    expect(changes[0]).toMatchObject({
      field: "monthlyFee",
      labelKey: "monthlyFee",
      from: "350.00",
      to: "400.00",
    });
    expect(changes[1]).toMatchObject({ field: "settlementCadence" });
  });

  it("sends ONLY what moved, so an untouched field is never resent", () => {
    // A PATCH that echoes back everything it read is how two admins editing two
    // tabs overwrite each other.
    const body = termsBodyFrom(baseline, { ...baseline, monthlyFee: "400.00" });

    expect(body).toEqual({ monthlyFee: "400.00" });
    expect("settlementDetails" in body).toBe(false);
  });

  it("clears a field to null rather than to an empty string", () => {
    const body = termsBodyFrom(baseline, {
      ...baseline,
      monthlyFee: "",
      settlementMethod: "",
      settlementAnchor: "",
      freeUntil: "",
    });

    expect(body.monthlyFee).toBeNull();
    expect(body.settlementMethod).toBeNull();
    expect(body.settlementAnchor).toBeNull();
    expect(body.freeUntil).toBeNull();
  });

  it("builds a body the write contract accepts", () => {
    const body = termsBodyFrom(baseline, {
      ...baseline,
      freeUntil: "2027-01-31",
      monthlyFee: "400.00",
      settlementDetails: "a-new-account",
    });

    expect(adminUpdateTermsBodySchema.safeParse(body).success).toBe(true);
  });
});

describe("dates cross the wire as instants", () => {
  it("turns a date input into a datetime the contract accepts", () => {
    // `freeUntil` is `z.string().datetime()`; a bare "2027-01-31" fails it, and
    // the failure would land as a 400 the admin has to interpret.
    expect(asInstant("2027-01-31")).toBe("2027-01-31T00:00:00.000Z");
    expect(
      adminUpdateTermsBodySchema.safeParse({
        freeUntil: asInstant("2027-01-31"),
      }).success
    ).toBe(true);
  });

  it("round-trips an instant back into a date input", () => {
    expect(asDateInput("2026-12-31T00:00:00.000Z")).toBe("2026-12-31");
    expect(asDateInput(null)).toBe("");
    expect(asDateInput("not a date")).toBe("");
    expect(asInstant("")).toBeNull();
  });
});

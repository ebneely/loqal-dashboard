/**
 * The authorization reality, tested without a DOM.
 *
 * Every case here mirrors a refusal `SalesService.setTerms` /
 * `SalesBrandApplicationRepository.isSignedBy` actually makes. If one of these
 * ever starts passing in the other direction, a rep gets a button whose only
 * outcome is a 404 that reads as "no such shop".
 */
import { beforeEach, describe, expect, it } from "vitest";

import {
  EMPTY_LEDGER,
  bindingFor,
  ledgerKey,
  parseLedger,
  readLedger,
  termsCandidates,
  withFiledLead,
  withSignedBrand,
  writeLedger,
} from "../signed-brands";
import {
  LEAD_APPLICATION_ID,
  OTHER_REP_ID,
  REP_ID,
  SEEDED_BRAND_ID,
  SIGNED_APPLICATION_ID,
  SIGNED_BRAND_ID,
  leadOnlyLedger,
  mixedLedger,
  signedBrandLedger,
} from "./fixtures";

describe("bindingFor — which shops a rep may act on", () => {
  it("allows a brand this rep closed in this session", () => {
    expect(bindingFor(SIGNED_BRAND_ID, signedBrandLedger)).toEqual({
      actionable: true,
      brand: signedBrandLedger.signed[0],
    });
  });

  /**
   * THE CASE THE WHOLE SCREEN EXISTS FOR. The five seeded brands carry no
   * BrandApplication, so `isSignedBy` is false for every rep and the API
   * answers 404. Nothing in this console may render one as actionable.
   */
  it("refuses a seeded brand — no application, so no rep is bound to it", () => {
    expect(bindingFor(SEEDED_BRAND_ID, signedBrandLedger)).toEqual({
      actionable: false,
      reason: "NOT_YOURS",
    });
  });

  it("refuses any brand on an empty ledger, including a well-formed id", () => {
    expect(bindingFor(SIGNED_BRAND_ID, EMPTY_LEDGER)).toEqual({
      actionable: false,
      reason: "NOT_YOURS",
    });
  });

  /**
   * A lead is an application, not a brand. There is no Brand row to price, and
   * if an admin approves it later `reviewedBy` carries the ADMIN's id — so this
   * never becomes actionable for the rep who captured it.
   */
  it("refuses a shop that was filed as a lead — it has no brand id at all", () => {
    expect(bindingFor(LEAD_APPLICATION_ID, leadOnlyLedger)).toEqual({
      actionable: false,
      reason: "NOT_YOURS",
    });
  });

  it("does not match a lead's application id against a brand id", () => {
    // Same ledger, both kinds present. The lead must not leak into the signed
    // lookup by sharing a shape.
    expect(bindingFor(LEAD_APPLICATION_ID, mixedLedger).actionable).toBe(false);
    expect(bindingFor(SIGNED_BRAND_ID, mixedLedger).actionable).toBe(true);
  });
});

describe("termsCandidates — everything the screen draws", () => {
  it("puts actionable brands ahead of leads", () => {
    const rows = termsCandidates(mixedLedger);

    expect(rows.map((row) => row.kind)).toEqual(["brand", "lead"]);
  });

  it("draws a lead rather than dropping it, so the rep can see why it is stuck", () => {
    const rows = termsCandidates(leadOnlyLedger);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ kind: "lead", lead: leadOnlyLedger.leads[0] });
  });

  it("is empty for a rep who has registered nothing", () => {
    expect(termsCandidates(EMPTY_LEDGER)).toEqual([]);
  });
});

describe("the ledger's own bookkeeping", () => {
  it("promotes a lead out of the lead list when its brand is created", () => {
    const promoted = withSignedBrand(leadOnlyLedger, {
      brandId: SIGNED_BRAND_ID,
      name: "Zamalek Flowers",
      slug: "zamalek-flowers",
      applicationId: LEAD_APPLICATION_ID,
      signedAt: "2026-08-17T11:00:00.000Z",
    });

    expect(promoted.leads).toEqual([]);
    expect(promoted.signed).toHaveLength(1);
  });

  it("de-duplicates on brand id rather than stacking the same shop twice", () => {
    const twice = withSignedBrand(signedBrandLedger, {
      ...signedBrandLedger.signed[0],
      name: "Nour Ceramics (corrected)",
    });

    expect(twice.signed).toHaveLength(1);
    expect(twice.signed[0].name).toBe("Nour Ceramics (corrected)");
  });

  it("de-duplicates a lead on its application id", () => {
    const twice = withFiledLead(leadOnlyLedger, {
      applicationId: LEAD_APPLICATION_ID,
      businessName: "Zamalek Flowers",
      filedAt: "2026-08-17T12:00:00.000Z",
    });

    expect(twice.leads).toHaveLength(1);
  });
});

describe("parseLedger — a browser-owned string, never trusted", () => {
  it("returns an empty ledger for nothing, for junk and for the wrong shape", () => {
    expect(parseLedger(null)).toEqual(EMPTY_LEDGER);
    expect(parseLedger("not json")).toEqual(EMPTY_LEDGER);
    expect(parseLedger('"a string"')).toEqual(EMPTY_LEDGER);
    expect(parseLedger("[]")).toEqual(EMPTY_LEDGER);
  });

  it("drops a row missing anything needed to name a shop, keeping the rest", () => {
    const parsed = parseLedger(
      JSON.stringify({
        signed: [
          { brandId: SIGNED_BRAND_ID, name: "Nour", slug: "nour" },
          { brandId: "b-2", name: "" },
          { name: "No id", slug: "no-id" },
        ],
        leads: [{ applicationId: LEAD_APPLICATION_ID, businessName: "Zamalek" }],
      })
    );

    expect(parsed.signed.map((row) => row.brandId)).toEqual([SIGNED_BRAND_ID]);
    expect(parsed.leads).toHaveLength(1);
  });

  /**
   * A forged entry only ever adds a brand id the API will refuse anyway, which
   * is why nothing here is a security boundary — but it must not be able to
   * make the screen throw either.
   */
  it("survives a hand-edited entry rather than taking the screen down", () => {
    expect(() =>
      parseLedger(JSON.stringify({ signed: [null, 7, "x"], leads: "nope" }))
    ).not.toThrow();
  });
});

describe("storage is keyed by rep, so a second rep starts empty", () => {
  beforeEach(() => window.sessionStorage.clear());

  it("does not hand one rep's signed shops to the next one on the same phone", () => {
    writeLedger(REP_ID, signedBrandLedger);

    expect(readLedger(REP_ID).signed).toHaveLength(1);
    expect(readLedger(OTHER_REP_ID)).toEqual(EMPTY_LEDGER);
  });

  it("keys on the rep id and nothing else", () => {
    expect(ledgerKey(REP_ID)).toBe(`loqal.sales.ledger.${REP_ID}`);
  });

  it("reads nothing for a session that has not resolved a rep id yet", () => {
    writeLedger(REP_ID, signedBrandLedger);

    expect(readLedger("")).toEqual(EMPTY_LEDGER);
  });

  /**
   * sessionStorage, never localStorage. `UserRole.SALES` is described in
   * prisma/schema.prisma as the easiest credential in the system to lose, and a
   * phone left on a counter must not carry a durable list of signed shops.
   */
  it("writes to sessionStorage and leaves localStorage untouched", () => {
    window.localStorage.clear();

    writeLedger(REP_ID, signedBrandLedger);

    expect(window.sessionStorage.getItem(ledgerKey(REP_ID))).not.toBeNull();
    expect(window.localStorage.getItem(ledgerKey(REP_ID))).toBeNull();
  });

  it("round-trips a written ledger", () => {
    writeLedger(REP_ID, mixedLedger);

    expect(readLedger(REP_ID)).toEqual(mixedLedger);
  });

  it("keeps the application id that is the actual binding", () => {
    writeLedger(REP_ID, signedBrandLedger);

    expect(readLedger(REP_ID).signed[0].applicationId).toBe(
      SIGNED_APPLICATION_ID
    );
  });
});

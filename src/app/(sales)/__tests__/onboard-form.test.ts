/**
 * The register form's rules, run against the real contract schema.
 *
 * `registerBrandBodySchema` is `.strict()` and mirrors `RegisterShopDto` field
 * for field, so a key this file lets through that the contract does not is a
 * 400 in a shop with a customer waiting.
 */
import { describe, expect, it } from "vitest";

import { registerBrandBodySchema } from "@loqal/contracts/sales.contract";

import {
  bodyFrom,
  emptyDraft,
  fieldErrors,
  isStepComplete,
  isSubmittable,
  outcomeOf,
  suggestSlug,
  type OnboardDraft,
} from "../sales/onboard/onboard-form";

const filled: OnboardDraft = {
  ...emptyDraft,
  businessName: "Nour Ceramics",
  ownerName: "Nour Hassan",
  email: "nour@example.test",
  phone: "01001234567",
};

describe("bodyFrom — what actually goes on the wire", () => {
  it("sends the four fields a rep can capture standing in a shop", () => {
    expect(bodyFrom(filled)).toEqual({
      businessName: "Nour Ceramics",
      ownerName: "Nour Hassan",
      email: "nour@example.test",
      phone: "01001234567",
    });
  });

  /**
   * `instagramUrl` is `z.string().url()`. An empty string fails it, so a rep
   * with no Instagram to give would be blocked by a validator meant for a
   * malformed one.
   */
  it("omits a blank optional URL rather than sending an empty string", () => {
    const body = bodyFrom({ ...filled, instagramUrl: "", websiteUrl: "" });

    expect("instagramUrl" in body).toBe(false);
    expect("websiteUrl" in body).toBe(false);
    expect(registerBrandBodySchema.safeParse(body).success).toBe(true);
  });

  it("sends an optional URL once it is filled in", () => {
    expect(
      bodyFrom({ ...filled, instagramUrl: "https://instagram.com/nour" })
        .instagramUrl
    ).toBe("https://instagram.com/nour");
  });

  it("trims, because a pasted phone number carries a trailing space", () => {
    expect(bodyFrom({ ...filled, phone: "  01001234567 " }).phone).toBe(
      "01001234567"
    );
  });

  /**
   * The slug is the discriminator between filing a lead and creating a shop.
   * Typing one, then choosing "file the application", must not quietly create
   * a brand.
   */
  it("withholds the slug unless the rep chose to close", () => {
    const typedThenUnticked = {
      ...filled,
      slug: "nour-ceramics",
      closeNow: false,
    };

    expect("slug" in bodyFrom(typedThenUnticked)).toBe(false);
    expect(outcomeOf(typedThenUnticked)).toBe("filed");
  });

  it("sends the slug when the rep chose to close", () => {
    const closing = { ...filled, slug: "nour-ceramics", closeNow: true };

    expect(bodyFrom(closing).slug).toBe("nour-ceramics");
    expect(outcomeOf(closing)).toBe("created");
  });

  it("produces a body the contract accepts on both paths", () => {
    expect(registerBrandBodySchema.safeParse(bodyFrom(filled)).success).toBe(true);
    expect(
      registerBrandBodySchema.safeParse(
        bodyFrom({ ...filled, slug: "nour-ceramics", closeNow: true })
      ).success
    ).toBe(true);
  });
});

describe("fieldErrors", () => {
  it("reports nothing about a blank draft's optional fields", () => {
    const errors = fieldErrors(emptyDraft);

    expect(errors.instagramUrl).toBeUndefined();
    expect(errors.websiteUrl).toBeUndefined();
    expect(errors.description).toBeUndefined();
  });

  it("marks the four required fields required while they are blank", () => {
    const errors = fieldErrors(emptyDraft);

    expect(errors.businessName).toBe("required");
    expect(errors.ownerName).toBe("required");
    expect(errors.email).toBe("required");
    expect(errors.phone).toBe("required");
  });

  it("distinguishes a malformed email from a missing one", () => {
    expect(fieldErrors({ ...filled, email: "nour" }).email).toBe("invalid");
  });

  it("refuses a phone number the contract's length bounds refuse", () => {
    expect(fieldErrors({ ...filled, phone: "0100" }).phone).toBe("invalid");
  });

  it("refuses a URL that is not one", () => {
    expect(
      fieldErrors({ ...filled, instagramUrl: "instagram.com/nour" }).instagramUrl
    ).toBe("invalid");
  });

  it("names a too-long value as too long rather than as invalid", () => {
    expect(
      fieldErrors({ ...filled, businessName: "x".repeat(121) }).businessName
    ).toBe("tooLong");
  });

  it("refuses a slug that is not lowercase-hyphenated", () => {
    expect(
      fieldErrors({ ...filled, closeNow: true, slug: "Nour Ceramics" }).slug
    ).toBe("invalid");
  });

  /**
   * The schema cannot express this: `slug` is `.optional()` because a lead
   * legitimately has none. Requiring it when closing is the form's own rule.
   */
  it("requires a slug once the rep has chosen to close", () => {
    expect(fieldErrors({ ...filled, closeNow: true, slug: "" }).slug).toBe(
      "required"
    );
    expect(fieldErrors({ ...filled, closeNow: false, slug: "" }).slug).toBeUndefined();
  });
});

describe("isStepComplete — the conversation's own order", () => {
  it("holds the first step until the shop has a name", () => {
    expect(isStepComplete(emptyDraft, "business")).toBe(false);
    expect(
      isStepComplete({ ...emptyDraft, businessName: "Nour Ceramics" }, "business")
    ).toBe(true);
  });

  it("holds the contact step until all three ways of reaching them are good", () => {
    expect(isStepComplete(emptyDraft, "contact")).toBe(false);
    expect(isStepComplete(filled, "contact")).toBe(true);
  });

  it("lets the closing step through with nothing filled in — filing a lead is a valid close", () => {
    expect(isStepComplete(filled, "close")).toBe(true);
  });
});

describe("isSubmittable", () => {
  it("is false for an empty draft and true for a complete one", () => {
    expect(isSubmittable(emptyDraft)).toBe(false);
    expect(isSubmittable(filled)).toBe(true);
  });

  it("is false when closing without a web address", () => {
    expect(isSubmittable({ ...filled, closeNow: true })).toBe(false);
    expect(
      isSubmittable({ ...filled, closeNow: true, slug: "nour-ceramics" })
    ).toBe(true);
  });
});

describe("suggestSlug — a suggestion, never an application", () => {
  it("derives a slug the contract accepts", () => {
    expect(suggestSlug("Nour Ceramics")).toBe("nour-ceramics");
    expect(suggestSlug("  The  Corner   Shop! ")).toBe("the-corner-shop");
  });

  /**
   * Most shop names here are Arabic. Returning "" rather than a
   * transliteration nobody asked for is what forces the rep to agree the
   * address with the owner out loud, which is the right conversation to have
   * about a permanent public URL.
   */
  it("returns nothing for a name with no latin characters", () => {
    expect(suggestSlug("نور للخزف")).toBe("");
  });

  it("never ends on a hyphen, which the slug pattern refuses", () => {
    expect(suggestSlug("Shop---")).toBe("shop");
  });
});

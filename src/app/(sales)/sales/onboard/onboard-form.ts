/**
 * The register form's rules, as pure functions over a draft.
 *
 * No React and no DOM, for the same reason the admin console's `terms-form.ts`
 * has none: a rep is standing in a shop with a customer waiting, and the thing
 * that must never be wrong is which fields the API will accept. That is
 * testable without rendering anything, and it is tested that way.
 *
 * EVERY RULE HERE IS THE CONTRACT'S, NOT AN INVENTED ONE.
 * `registerBrandBodySchema` is `.strict()` and mirrors `RegisterShopDto` field
 * for field. An earlier draft of the sales API asked for `name`, `categorySlug`,
 * `city`, `address` and `notes`; none of those exist on `BrandApplication` and
 * sending any of them is a 400, not an ignored key. So the form is built FROM
 * the schema — `fieldErrors` runs the real validator per field rather than
 * re-implementing "min 8 max 20" in a second place that can drift.
 */
import {
  registerBrandBodySchema,
  type RegisterBrandBody,
} from "@loqal/contracts/sales.contract";

/**
 * What the rep has typed. Every value is a string because every input is a
 * string; `bodyFrom` is what turns it into the contract's shape.
 *
 * `closeNow` is the discriminator, and it is a boolean on the FORM only. On the
 * wire it is the presence or absence of `slug`, which is the API's own
 * unambiguous signal (a BrandApplication has no slug column and a Brand always
 * needs one) — so no separate flag can disagree with it.
 */
export type OnboardDraft = {
  businessName: string;
  ownerName: string;
  email: string;
  phone: string;
  instagramUrl: string;
  websiteUrl: string;
  description: string;
  closeNow: boolean;
  slug: string;
};

export const emptyDraft: OnboardDraft = {
  businessName: "",
  ownerName: "",
  email: "",
  phone: "",
  instagramUrl: "",
  websiteUrl: "",
  description: "",
  closeNow: false,
  slug: "",
};

export type OnboardField = keyof Omit<OnboardDraft, "closeNow">;

/** The three steps, and which fields belong to each. */
export const ONBOARD_STEPS = [
  { id: "business", fields: ["businessName", "description"] },
  { id: "contact", fields: ["ownerName", "email", "phone"] },
  { id: "close", fields: ["instagramUrl", "websiteUrl", "slug"] },
] as const;

export type OnboardStepId = (typeof ONBOARD_STEPS)[number]["id"];

/**
 * The optional URL and text fields are omitted from the body when blank rather
 * than sent as `""`. `instagramUrl` is `z.string().url()` — an empty string
 * fails it, so a rep who simply has no Instagram to give would be blocked by a
 * validator meant for a malformed one.
 */
export function bodyFrom(draft: OnboardDraft): Record<string, unknown> {
  const trimmed = {
    businessName: draft.businessName.trim(),
    ownerName: draft.ownerName.trim(),
    email: draft.email.trim(),
    phone: draft.phone.trim(),
  };

  const optional: Record<string, string> = {};
  if (draft.instagramUrl.trim()) optional.instagramUrl = draft.instagramUrl.trim();
  if (draft.websiteUrl.trim()) optional.websiteUrl = draft.websiteUrl.trim();
  if (draft.description.trim()) optional.description = draft.description.trim();

  /**
   * The slug is sent ONLY when the rep chose to close. Ticking "file the
   * application", typing a slug, then unticking must not quietly create a shop.
   */
  const closing =
    draft.closeNow && draft.slug.trim() ? { slug: draft.slug.trim() } : {};

  return { ...trimmed, ...optional, ...closing };
}

/**
 * Which fields the contract would reject, keyed by field.
 *
 * A blank field reports nothing until it is required: `fieldErrors` is what the
 * screen shows beside an input, and a form that turns red before anybody has
 * typed is a form a rep learns to ignore. `missing` below is the separate
 * question of whether the step is finishable.
 */
export function fieldErrors(draft: OnboardDraft): Partial<Record<OnboardField, "required" | "invalid" | "tooLong">> {
  const body = bodyFrom(draft);
  const parsed = registerBrandBodySchema.safeParse(body);
  const errors: Partial<Record<OnboardField, "required" | "invalid" | "tooLong">> = {};

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (typeof field !== "string") continue;
      const key = field as OnboardField;

      // A key that is absent because it is blank-and-optional is not an error
      // the rep should see; a key that is absent because it is REQUIRED is.
      if (!(field in body)) {
        if (draft[key] === "" || draft[key] === undefined) {
          errors[key] = "required";
        }
        continue;
      }

      if (issue.code === "too_big") errors[key] = "tooLong";
      else if (draft[key] === "") errors[key] = "required";
      else errors[key] = "invalid";
    }
  }

  /**
   * The slug is the one field whose requiredness depends on another field, and
   * zod cannot say so here — it is `.optional()` on the schema because a lead
   * legitimately has none. Closing without one is the form's rule.
   */
  if (draft.closeNow && draft.slug.trim() === "") errors.slug = "required";

  return errors;
}

/** True when this step has nothing left to fix. */
export function isStepComplete(
  draft: OnboardDraft,
  step: OnboardStepId
): boolean {
  const fields = ONBOARD_STEPS.find((s) => s.id === step)?.fields ?? [];
  const errors = fieldErrors(draft);
  return fields.every((field) => errors[field as OnboardField] === undefined);
}

/** True when the whole draft would be accepted by `POST /v1/sales/brands`. */
export function isSubmittable(draft: OnboardDraft): boolean {
  return Object.keys(fieldErrors(draft)).length === 0;
}

/**
 * A slug suggested from the shop's name, never applied silently.
 *
 * This is the shop's permanent address on the storefront, so the rep confirms
 * it out loud with the owner. Deriving it and filling the field is help;
 * deriving it and skipping the field would be Loqal naming somebody's shop.
 * Non-latin names (most of them, here) reduce to nothing, and the function
 * returns "" rather than a transliteration nobody asked for.
 */
export function suggestSlug(businessName: string): string {
  return businessName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

/** What this submission is about to do, in the API's own terms. */
export type Outcome = "filed" | "created";

export function outcomeOf(draft: OnboardDraft): Outcome {
  return "slug" in bodyFrom(draft) ? "created" : "filed";
}

/** The typed body, for a caller that has already checked `isSubmittable`. */
export function parseBody(draft: OnboardDraft): RegisterBrandBody {
  return registerBrandBodySchema.parse(bodyFrom(draft));
}

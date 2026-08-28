import { z } from "zod";

/**
 * The pure half of the Add-a-shop sheet: no React, no fetch, no copy.
 *
 * It lives apart from the sheet because "would the API accept this?" is the
 * question the submit button asks on every keystroke, and answering it inside
 * a component makes it untestable without a DOM.
 */
/**
 * The three fields that make a person able to sign in to a shop.
 *
 * Split out of `NewShopDraft` because the brand page's owner block asks for
 * exactly these and nothing else — the shop already exists there. One
 * definition rather than two is the point: the rule for what the API will
 * accept as an owner must not be able to disagree with itself between the two
 * screens that ask for one.
 */
export type OwnerDraft = {
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
};

export type NewShopDraft = OwnerDraft & {
  name: string;
  slug: string;
};

export const emptyOwnerDraft: OwnerDraft = {
  ownerName: "",
  ownerEmail: "",
  ownerPhone: "",
};

export const emptyDraft: NewShopDraft = {
  name: "",
  slug: "",
  ...emptyOwnerDraft,
};

/**
 * The address a shop gets, derived from its name as it is typed.
 *
 * Latin only, and that is a real limitation rather than an oversight: a slug is
 * a URL path, and an Arabic shop name produces an empty one. When it does, the
 * admin types the address themselves — which is why this only ever suggests and
 * never overwrites a slug the admin has edited.
 */
export function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const slugField = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);

/**
 * True when the availability endpoint would answer rather than 400.
 *
 * The same rule the submit button uses, deliberately: a check that accepted
 * strings the create refuses could only answer "available" about an address
 * that can never exist.
 */
export function isCheckableSlug(slug: string): boolean {
  return slugField.safeParse(slug).success;
}

const ownerFields = {
  ownerName: z.string().trim().min(1).max(120),
  ownerEmail: z.string().trim().toLowerCase().email(),
  ownerPhone: z.string().trim().max(20),
};

export const ownerDraftSchema = z.object(ownerFields);

const draftSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: slugField,
  ...ownerFields,
});

/**
 * True when the API could actually create this account. Drives the invite
 * button on the brand page.
 *
 * The email is required and the phone is not, which is the same asymmetry the
 * whole feature rests on: Better Auth cannot create a user without an address,
 * and a missing number only means the link has to be carried by hand.
 */
export function isOwnerInvitable(draft: OwnerDraft): boolean {
  return ownerDraftSchema.safeParse(draft).success;
}

/**
 * True when the API would accept this draft. Drives the submit button.
 *
 * The owner's email is required here, and that is the point of the screen: a
 * shop created without one is a shop nobody can ever sign in to, which is the
 * exact state this feature exists to stop producing.
 */
export function isSubmittable(draft: NewShopDraft): boolean {
  return draftSchema.safeParse(draft).success;
}

/**
 * The owner block as the API wants it.
 *
 * The phone is OMITTED rather than sent empty: the API reads an absent phone
 * as "no number on file" and reports WhatsApp as skipped, which is a different
 * fact from a send that failed, and the result panel says so in different
 * words.
 */
export function ownerBodyFrom(draft: OwnerDraft) {
  return {
    name: draft.ownerName.trim(),
    email: draft.ownerEmail.trim().toLowerCase(),
    ...(draft.ownerPhone.trim() ? { phone: draft.ownerPhone.trim() } : {}),
  };
}

export function bodyFrom(draft: NewShopDraft) {
  return {
    name: draft.name.trim(),
    slug: draft.slug.trim(),
    owner: ownerBodyFrom(draft),
  };
}

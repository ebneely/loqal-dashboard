import { z } from "zod";

/**
 * The pure half of the Add-a-shop sheet: no React, no fetch, no copy.
 *
 * It lives apart from the sheet because "would the API accept this?" is the
 * question the submit button asks on every keystroke, and answering it inside
 * a component makes it untestable without a DOM.
 */
export type NewShopDraft = {
  name: string;
  slug: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
};

export const emptyDraft: NewShopDraft = {
  name: "",
  slug: "",
  ownerName: "",
  ownerEmail: "",
  ownerPhone: "",
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

const draftSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  ownerName: z.string().trim().min(1).max(120),
  ownerEmail: z.string().trim().toLowerCase().email(),
  ownerPhone: z.string().trim().max(20),
});

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

export function bodyFrom(draft: NewShopDraft) {
  return {
    name: draft.name.trim(),
    slug: draft.slug.trim(),
    owner: {
      name: draft.ownerName.trim(),
      email: draft.ownerEmail.trim().toLowerCase(),
      // Omitted rather than sent empty: the API reads an absent phone as "no
      // number on file" and reports WhatsApp as skipped, which is a different
      // fact from a send that failed.
      ...(draft.ownerPhone.trim() ? { phone: draft.ownerPhone.trim() } : {}),
    },
  };
}

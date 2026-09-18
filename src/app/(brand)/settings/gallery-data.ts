"use client";

import { z } from "zod";

import { api } from "@/lib/api";
import { useResource, type Resource } from "@/lib/resource";

/**
 * The shop's photographs — what the storefront's shop card plays when a
 * shopper hovers it. `GET /v1/brands/me/media` answers them in display order
 * with a short-lived URL each; `PUT` replaces the whole set, because the
 * array's order IS the display order and there is no partial version of that.
 *
 * `url` is nullable: a photo whose file has gone missing from storage still
 * holds its slot, and the screen must show the gap rather than crash on it.
 */
export const GALLERY_SLOTS = 5;

const galleryImageSchema = z.object({
  mediaId: z.string(),
  sortOrder: z.number().int(),
  url: z.string().nullable(),
});

export const gallerySchema = z.object({
  images: z.array(galleryImageSchema),
});

export type Gallery = z.infer<typeof gallerySchema>;
export type GalleryImage = z.infer<typeof galleryImageSchema>;

export function useGallery(): Resource<Gallery> {
  return useResource("brand-gallery", true, (signal) =>
    api.get(gallerySchema, "/v1/brands/me/media", { signal })
  );
}

/** Owner only on the API; an employee's attempt answers 403. */
export function saveGallery(mediaIds: readonly string[]): Promise<Gallery> {
  return api.put(gallerySchema, "/v1/brands/me/media", { mediaIds });
}

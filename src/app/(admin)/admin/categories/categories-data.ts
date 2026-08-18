"use client";

/**
 * What /admin/categories reads and writes.
 *
 * CONTRACT GAP: `@loqal/contracts` has NO category schema at all. Not a read
 * shape, not a write body, not the enum-free `{ ar, en }` name — `Category` is
 * referenced from `catalog.contract.ts` only as a `categoryId` on a product.
 * Every other plane in this dashboard parses against the shared package; this
 * one cannot, so the shapes are declared here, mirroring
 * `loqal-backend/src/modules/catalog/repositories/category.repository.ts`'s
 * `CATEGORY_FIELDS` and the two admin write DTOs.
 *
 * That is worth reporting rather than absorbing: a category rename that changes
 * shape upstream will reach this screen as a runtime parse failure instead of a
 * typecheck failure, which is the exact difference the contract package exists
 * to buy.
 *
 * A SECOND, SHARPER GAP: THERE ARE TWO ADMIN CATEGORY CONTROLLERS.
 *
 *   `CategoriesAdminController`  @Controller({ path: 'admin/categories' }) in
 *                                the ADMIN module. POST /, PATCH /:id,
 *                                PATCH /:id/parent, POST /reorder, DELETE /:id.
 *   `CatalogAdminController`     @Post('admin/categories'),
 *                                @Patch('admin/categories/:categoryId'),
 *                                @Delete('admin/categories/:categoryId') in the
 *                                CATALOG module.
 *
 * Three of those paths are declared twice, on the same version, with different
 * DTOs and different services behind them — Nest resolves them by module
 * registration order, so which service actually runs is decided by the import
 * list in `app.module.ts`. The two disagree: only the admin-module one can
 * reparent or reorder, and only the catalog-module one accepts `sortOrder` on
 * create. This file targets the admin-module surface because it is the only one
 * that can do the job, and says so here because a screen quietly depending on
 * module ordering is a bug waiting for a refactor.
 */
import { z } from "zod";

import { bilingualSchema } from "@loqal/contracts/contracts";

import { api } from "@/lib/api";
import { useResource, type Resource } from "@/lib/resource";

/**
 * `CATEGORY_FIELDS` as the repository selects it. `name` is a JSON column, so
 * it is `unknown` on the wire and resolved with `categoryName` below rather
 * than parsed strictly — a legacy row holding `{}` or a bare string must render
 * as something a human can click, not blank the whole taxonomy.
 */
export const categorySchema = z.object({
  id: z.string(),
  name: z.unknown(),
  slug: z.string(),
  parentId: z.string().nullable(),
  sortOrder: z.number().int(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type Category = z.infer<typeof categorySchema>;

export const categoryListSchema = z.array(categorySchema);

/**
 * The bilingual name, resolved for display, with every degenerate shape covered
 * because this column has no DTO in front of it anywhere.
 */
export function categoryName(name: unknown, locale: "en" | "ar"): string {
  if (typeof name === "string") return name;
  if (name && typeof name === "object") {
    const record = name as Record<string, unknown>;
    const preferred = record[locale];
    if (typeof preferred === "string" && preferred) return preferred;
    const other = record[locale === "en" ? "ar" : "en"];
    if (typeof other === "string" && other) return other;
  }
  return "";
}

/**
 * The only list a SUPER_ADMIN can read: the anonymous storefront one, flat. See
 * `category-tree.ts` for what that costs and why the tree is built in the
 * browser.
 */
export function useCategories(): Resource<readonly Category[]> {
  return useResource("admin-categories", true, (signal) =>
    api.get(categoryListSchema, "/v1/categories", { signal })
  );
}

// ---------------------------------------------------------------------------
// Writes — mirrored from the admin module's own DTOs
// ---------------------------------------------------------------------------

const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Lowercase words joined by single hyphens");

export const createCategoryBodySchema = z
  .object({
    name: bilingualSchema,
    slug: slugSchema,
    parentId: z.string().nullable().optional(),
  })
  .strict();

export type CreateCategoryBody = z.infer<typeof createCategoryBodySchema>;

export const updateCategoryBodySchema = z
  .object({ name: bilingualSchema.optional(), slug: slugSchema.optional() })
  .strict();

export type UpdateCategoryBody = z.infer<typeof updateCategoryBodySchema>;

const ADMIN_PATH = "/v1/admin/categories";

export const createCategory = (body: CreateCategoryBody) =>
  api.post(z.unknown(), ADMIN_PATH, createCategoryBodySchema.parse(body));

export const updateCategory = (id: string, body: UpdateCategoryBody) =>
  api.patch(
    z.unknown(),
    `${ADMIN_PATH}/${id}`,
    updateCategoryBodySchema.parse(body)
  );

/** Reparent. `null` moves it to the root. Cycles are refused server-side. */
export const moveCategory = (id: string, parentId: string | null) =>
  api.patch(z.unknown(), `${ADMIN_PATH}/${id}/parent`, { parentId });

/**
 * Reorder within ONE parent. `parentId` is sent because the DTO requires it,
 * even though `CategoriesAdminService.reorder` ignores it and writes sort
 * orders positionally — another small gap: two categories under different
 * parents can be given the same `sortOrder`, and nothing complains.
 */
export const reorderCategories = (
  parentId: string | null,
  orderedIds: readonly string[]
) =>
  api.post(z.unknown(), `${ADMIN_PATH}/reorder`, {
    parentId,
    orderedIds: [...orderedIds],
  });

export const deleteCategory = (id: string) =>
  api.delete(z.unknown(), `${ADMIN_PATH}/${id}`);

/** True when the create form would be accepted by the write contract. */
export const isCreatable = (body: {
  nameEn: string;
  nameAr: string;
  slug: string;
}): boolean =>
  createCategoryBodySchema.safeParse({
    name: {
      ...(body.nameEn.trim() ? { en: body.nameEn.trim() } : {}),
      ...(body.nameAr.trim() ? { ar: body.nameAr.trim() } : {}),
    },
    slug: body.slug,
  }).success;

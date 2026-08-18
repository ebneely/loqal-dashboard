"use client";

/**
 * Everything /admin/try-on reads and writes.
 *
 * BACKEND GAP — NEITHER RESPONSE IS IN THE CONTRACT PACKAGE. There is no try-on
 * file in it at all, so both shapes are described here, beside the fetch, and
 * both will move into the package the day one exists. `.strict()` on purpose:
 * this is a spend ceiling, and a field silently renamed should fail at this
 * seam rather than draw a gauge at zero.
 *
 * WHY THE STATE COMES FROM THE SERVER AND IS NEVER RECOMPUTED HERE.
 *
 * `budgetState` is a single function on the backend that both the render worker
 * and this dashboard call. The worker ACTS on it — at 85% of the ceiling the
 * next render silently drops to the fallback model, at 100% nothing new is
 * rendered at all and the cache answers. If this file recomputed the thresholds
 * from `percentUsed`, the screen could claim "full model" while the worker was
 * already downgrading, which is the one thing that function exists to prevent.
 * So the state is read, never derived.
 *
 * THE MONEY ON THIS SCREEN IS US DOLLARS. Every other figure in this console is
 * Egyptian pounds. `tryOnMonthlyBudgetCents` is an integer number of US cents
 * because it is the provider's bill, and `formatMoney` — which appends EGP —
 * must never be used on it.
 */
import { z } from "zod";

import { api } from "@/lib/api";
import { useResource, type Resource } from "@/lib/resource";

const SETTINGS_PATH = "/v1/admin/try-on/settings";
const MODELS_PATH = "/v1/admin/try-on/models";

/**
 * Four states, in the order they happen. WARNING is not a rendering decision —
 * nothing has changed yet at 70% — but it is the only warning anybody gets
 * before quality drops, so it is a state and not a colour.
 */
export const budgetStateSchema = z.enum([
  "OK",
  "WARNING",
  "DOWNGRADED",
  "STOPPED",
]);
export type BudgetState = z.infer<typeof budgetStateSchema>;

export const tryOnSettingsSchema = z
  .object({
    tryOnModelId: z.string(),
    tryOnFallbackModelId: z.string(),
    tryOnMonthlyBudgetCents: z.number().int(),
    tryOnAccountLifetimeCap: z.number().int(),
    monthSpendUsd: z.number(),
    monthBudgetUsd: z.number(),
    percentUsed: z.number().int(),
    budgetState: budgetStateSchema,
    /** Null when generation is stopped — there is no model a render would use. */
    activeModelId: z.string().nullable(),
    /** Keyed by TryOnRenderStatus and SPARSE: a status with none is absent. */
    rendersThisMonth: z.record(z.string(), z.number().int()),
  })
  .strict();
export type TryOnSettings = z.infer<typeof tryOnSettingsSchema>;

export const tryOnModelSchema = z
  .object({
    id: z.string(),
    costMicros: z.number().int(),
    costUsd: z.number(),
  })
  .strict();
export type TryOnModel = z.infer<typeof tryOnModelSchema>;

export const tryOnModelListSchema = z.array(tryOnModelSchema);

export function useTryOnSettings(): Resource<TryOnSettings> {
  return useResource("admin-try-on-settings", true, (signal) =>
    api.get(tryOnSettingsSchema, SETTINGS_PATH, { signal })
  );
}

export function useTryOnModels(): Resource<readonly TryOnModel[]> {
  return useResource("admin-try-on-models", true, (signal) =>
    api.get(tryOnModelListSchema, MODELS_PATH, { signal })
  );
}

/**
 * The write.
 *
 * The API refuses an empty PATCH with a 400 — a PATCH that changes nothing and
 * answers 200 reads as "saved" on a dashboard — so this refuses it too, before
 * the request, and the screen keeps its button disabled until something differs.
 */
export const updateTryOnSettingsBodySchema = z
  .object({
    tryOnModelId: z.string().optional(),
    tryOnFallbackModelId: z.string().optional(),
    tryOnMonthlyBudgetCents: z.number().int().min(0).max(10_000_000).optional(),
    tryOnAccountLifetimeCap: z.number().int().min(0).max(1_000).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Send at least one field to change",
  });
export type UpdateTryOnSettingsBody = z.infer<
  typeof updateTryOnSettingsBodySchema
>;

export const updateTryOnSettings = (body: UpdateTryOnSettingsBody) =>
  api.patch(z.unknown(), SETTINGS_PATH, updateTryOnSettingsBodySchema.parse(body));

// ---------------------------------------------------------------------------
// The diff, so a save names only what changed
// ---------------------------------------------------------------------------

export type TryOnForm = {
  tryOnModelId: string;
  tryOnFallbackModelId: string;
  tryOnMonthlyBudgetCents: string;
  tryOnAccountLifetimeCap: string;
};

export const formFrom = (settings: TryOnSettings): TryOnForm => ({
  tryOnModelId: settings.tryOnModelId,
  tryOnFallbackModelId: settings.tryOnFallbackModelId,
  tryOnMonthlyBudgetCents: String(settings.tryOnMonthlyBudgetCents),
  tryOnAccountLifetimeCap: String(settings.tryOnAccountLifetimeCap),
});

/**
 * Only the keys whose values actually differ.
 *
 * A field the admin never touched is not in the request at all, which is what
 * makes a concurrent change by somebody else survive this save instead of being
 * silently overwritten with the value that happened to be on screen.
 *
 * Returns null when nothing changed, or when a number field holds something
 * that is not a non-negative integer — the screen refuses rather than sending
 * `NaN`, which the API would take as a 400 nobody can act on.
 */
export function tryOnDiff(
  original: TryOnSettings,
  form: TryOnForm
): UpdateTryOnSettingsBody | null {
  const body: Record<string, string | number> = {};

  if (form.tryOnModelId !== original.tryOnModelId) {
    body.tryOnModelId = form.tryOnModelId;
  }
  if (form.tryOnFallbackModelId !== original.tryOnFallbackModelId) {
    body.tryOnFallbackModelId = form.tryOnFallbackModelId;
  }

  const budget = wholeNumber(form.tryOnMonthlyBudgetCents);
  if (budget === null) return null;
  if (budget !== original.tryOnMonthlyBudgetCents) {
    body.tryOnMonthlyBudgetCents = budget;
  }

  const cap = wholeNumber(form.tryOnAccountLifetimeCap);
  if (cap === null) return null;
  if (cap !== original.tryOnAccountLifetimeCap) {
    body.tryOnAccountLifetimeCap = cap;
  }

  const parsed = updateTryOnSettingsBodySchema.safeParse(body);
  return parsed.success ? parsed.data : null;
}

/** Strict on purpose: "12.5", "", "1e3" and " " are all refusals, not 12. */
function wholeNumber(raw: string): number | null {
  if (!/^\d+$/.test(raw.trim())) return null;
  const value = Number(raw.trim());
  return Number.isSafeInteger(value) ? value : null;
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

/**
 * US dollars, never EGP, and never through `formatMoney`.
 *
 * The API sends a float here (`spentMicros / 1_000_000`), which is the one
 * money-shaped value in this console that is not a decimal string. Rounding to
 * cents at the point of display is the honest treatment: the underlying number
 * is micros and the bill is in cents.
 */
export const formatUsd = (amount: number): string =>
  `$${(Math.round(amount * 100) / 100).toFixed(2)}`;

/**
 * A zero ceiling counts as FULLY USED on the backend (`used = 1` when the
 * budget is 0), so the feature serves cache only. That is a legitimate way to
 * switch try-on off, and it is also what an accidentally-cleared field looks
 * like — so the screen calls it out rather than drawing a gauge at 100% and
 * leaving the reader to work out why.
 */
export const ceilingIsZero = (settings: TryOnSettings): boolean =>
  settings.tryOnMonthlyBudgetCents === 0;

"use client";

/**
 * What both promo-code screens read and write.
 *
 * One module for two consoles: the shop's own codes live at
 * /v1/dashboard/promo-codes (scope BRAND, the shop pays) and loqaaal's at
 * /v1/admin/promo-codes (scope PLATFORM, loqaaal pays). Same row, same form,
 * same body — only the path differs, and the server sets the scope.
 *
 * The endpoints are newer than this screen. An API without them answers 404
 * and the screen says "not available yet" instead of an error. Rows are read
 * one by one and a row the screen cannot understand is dropped rather than
 * failing the whole list.
 */
import { z } from "zod";

import { api } from "@/lib/api";
import { checkMoney, checkWholeNumber } from "@/lib/field-rules";
import { useResource, type Resource } from "@/lib/resource";

export const SHOP_PROMO_PATH = "/v1/dashboard/promo-codes";
export const ADMIN_PROMO_PATH = "/v1/admin/promo-codes";

export type PromoKind = "PERCENT" | "FIXED";

/** Decimals arrive as strings from Prisma, but a number is read too. */
const decimal = z.union([z.string(), z.number()]).transform(String);
const maybe = <T extends z.ZodType>(schema: T) => schema.nullable().catch(null);

const promoCodeSchema = z.object({
  id: z.string(),
  code: z.string(),
  kind: z.enum(["PERCENT", "FIXED"]),
  value: decimal,
  maxDiscount: maybe(decimal),
  minSubtotal: maybe(decimal),
  startsAt: maybe(z.string()),
  endsAt: maybe(z.string()),
  usageLimit: maybe(z.number()),
  perCustomerLimit: maybe(z.number()),
  active: z.boolean().catch(true),
  redemptionCount: maybe(z.number()),
});

export type PromoCode = z.infer<typeof promoCodeSchema>;

/** A bare array or a `{ items }` page — whichever the API settles on. */
export function parsePromoList(raw: unknown): PromoCode[] {
  const items: unknown =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as { items?: unknown }).items
      : raw;
  if (!Array.isArray(items)) return [];
  return items.flatMap((item) => {
    const parsed = promoCodeSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

// shortcut: reads the first page only if the API pages; add "load more" once a shop has more codes than a page.
export function usePromoCodes(path: string): Resource<PromoCode[]> {
  return useResource(`promo-codes:${path}`, true, (signal) =>
    api.get(z.unknown(), path, { signal }).then(parsePromoList)
  );
}

// ---------------------------------------------------------------------------
// The form
// ---------------------------------------------------------------------------

export type PromoForm = {
  code: string;
  kind: PromoKind;
  value: string;
  maxDiscount: string;
  minSubtotal: string;
  /** `<input type="datetime-local">` values, in the browser's own time. */
  startsAt: string;
  endsAt: string;
  usageLimit: string;
  perCustomerLimit: string;
  active: boolean;
};

export const EMPTY_PROMO_FORM: PromoForm = {
  code: "",
  kind: "PERCENT",
  value: "",
  maxDiscount: "",
  minSubtotal: "",
  startsAt: "",
  endsAt: "",
  usageLimit: "",
  perCustomerLimit: "",
  active: true,
};

/** An ISO instant as a datetime-local value ("2026-11-16T09:30"), local time. */
export function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export const formFromCode = (row: PromoCode): PromoForm => ({
  code: row.code,
  kind: row.kind,
  value: row.value,
  maxDiscount: row.maxDiscount ?? "",
  minSubtotal: row.minSubtotal ?? "",
  startsAt: toLocalInput(row.startsAt),
  endsAt: toLocalInput(row.endsAt),
  usageLimit: row.usageLimit === null ? "" : String(row.usageLimit),
  perCustomerLimit: row.perCustomerLimit === null ? "" : String(row.perCustomerLimit),
  active: row.active,
});

export type PromoProblem =
  | "required"
  | "code"
  | "percent"
  | "money"
  | "positive"
  | "count"
  | "endBeforeStart";

const CODE_RULE = /^[A-Z0-9-]{3,20}$/;
const MAX_COUNT = 1_000_000;

const blank = (value: string) => value.trim() === "";

/** Pounds above zero, or null when blank. */
function checkPositiveMoney(value: string, required = false): PromoProblem | null {
  const problem = checkMoney(value, required);
  if (problem) return problem === "required" ? "required" : "money";
  return !blank(value) && Number(value.trim()) <= 0 ? "positive" : null;
}

/** What is wrong with each field, if anything. Save stays off while any is set. */
export function promoProblems(
  form: PromoForm
): Partial<Record<keyof PromoForm, PromoProblem>> {
  const found: Partial<Record<keyof PromoForm, PromoProblem | null>> = {
    code: blank(form.code)
      ? "required"
      : CODE_RULE.test(form.code.trim().toUpperCase())
        ? null
        : "code",
    value:
      form.kind === "PERCENT"
        ? blank(form.value)
          ? "required"
          : checkWholeNumber(form.value, 1, 90) && "percent"
        : checkPositiveMoney(form.value, true),
    // A cap only means something on a percentage; a fixed amount is its own cap.
    maxDiscount: form.kind === "PERCENT" ? checkPositiveMoney(form.maxDiscount) : null,
    minSubtotal: checkPositiveMoney(form.minSubtotal),
    usageLimit: checkWholeNumber(form.usageLimit, 1, MAX_COUNT) && "count",
    perCustomerLimit: checkWholeNumber(form.perCustomerLimit, 1, MAX_COUNT) && "count",
    endsAt:
      !blank(form.startsAt) &&
      !blank(form.endsAt) &&
      new Date(form.endsAt).getTime() <= new Date(form.startsAt).getTime()
        ? "endBeforeStart"
        : null,
  };
  return Object.fromEntries(
    Object.entries(found).filter(([, problem]) => problem)
  ) as Partial<Record<keyof PromoForm, PromoProblem>>;
}

export type PromoBody = {
  code: string;
  kind: PromoKind;
  value: string;
  maxDiscount: string | null;
  minSubtotal: string | null;
  startsAt: string | null;
  endsAt: string | null;
  usageLimit: number | null;
  perCustomerLimit: number | null;
  active: boolean;
};

/**
 * The write body. Money goes as decimal strings, counts as integers, dates as
 * ISO instants. A PATCH sends every field so a cleared one becomes null; a
 * POST leaves the unset ones out.
 */
export function toPromoBody(form: PromoForm, mode: "create" | "edit"): Partial<PromoBody> {
  const text = (value: string) => (blank(value) ? null : value.trim());
  const count = (value: string) => (blank(value) ? null : Number(value.trim()));
  const instant = (value: string) => (blank(value) ? null : new Date(value).toISOString());

  const body: PromoBody = {
    code: form.code.trim().toUpperCase(),
    kind: form.kind,
    value: form.value.trim(),
    maxDiscount: form.kind === "PERCENT" ? text(form.maxDiscount) : null,
    minSubtotal: text(form.minSubtotal),
    startsAt: instant(form.startsAt),
    endsAt: instant(form.endsAt),
    usageLimit: count(form.usageLimit),
    perCustomerLimit: count(form.perCustomerLimit),
    active: form.active,
  };
  if (mode === "edit") return body;
  return Object.fromEntries(
    Object.entries(body).filter(([, value]) => value !== null)
  ) as Partial<PromoBody>;
}

export const createPromoCode = (path: string, form: PromoForm) =>
  api.post(z.unknown(), path, toPromoBody(form, "create"));

export const updatePromoCode = (path: string, id: string, form: PromoForm) =>
  api.patch(z.unknown(), `${path}/${encodeURIComponent(id)}`, toPromoBody(form, "edit"));

/** Deactivate (or turn back on) without touching anything else. */
export const setPromoActive = (path: string, id: string, active: boolean) =>
  api.patch(z.unknown(), `${path}/${encodeURIComponent(id)}`, { active });

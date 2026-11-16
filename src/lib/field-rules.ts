/**
 * One check per kind of field the consoles ask for.
 *
 * Each returns null when the value is acceptable, or WHAT is wrong with it. The
 * screen turns that into a sentence under the field and keeps Save disabled, so
 * a bad value is named before it is sent rather than after the API refuses it.
 * Empty is fine unless `required` — most of these fields mean "not set" when blank.
 */
export type FieldProblem =
  | "required"
  | "money"
  | "wholeNumber"
  | "slug"
  | "email"
  | "mobile";

type Check = FieldProblem | null;

const blank = (value: string) => value.trim() === "";

/** Pounds with up to two decimals: `250`, `99.5`, `99.50`. */
export function checkMoney(value: string, required = false): Check {
  if (blank(value)) return required ? "required" : null;
  return /^\d{1,10}(\.\d{1,2})?$/.test(value.trim()) ? null : "money";
}

export function checkWholeNumber(
  value: string,
  min: number,
  max: number,
  required = false
): Check {
  if (blank(value)) return required ? "required" : null;
  const v = value.trim();
  if (!/^-?\d+$/.test(v)) return "wholeNumber";
  const n = Number(v);
  return n >= min && n <= max ? null : "wholeNumber";
}

/** A URL path segment: lowercase Latin letters, digits, single hyphens. */
export function checkSlug(value: string, required = true): Check {
  if (blank(value)) return required ? "required" : null;
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value.trim()) && value.trim().length <= 80
    ? null
    : "slug";
}

export function checkEmail(value: string, required = true): Check {
  if (blank(value)) return required ? "required" : null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ? null : "email";
}

/** An Egyptian mobile: 010/011/012/015 and eight more digits, optionally +20. */
export function checkEgyptMobile(value: string, required = false): Check {
  if (blank(value)) return required ? "required" : null;
  const digits = value.replace(/[\s-]/g, "");
  return /^(\+20|0020|20)?0?1[0125]\d{8}$/.test(digits) ? null : "mobile";
}

/** The sentence for a problem, with `{min}`/`{max}` filled in where it has them. */
export function problemText(
  copy: Record<FieldProblem, string>,
  problem: FieldProblem | null,
  range?: { min: number; max: number }
): string | null {
  if (!problem) return null;
  const text = copy[problem];
  return range
    ? text.replace("{min}", String(range.min)).replace("{max}", String(range.max))
    : text;
}

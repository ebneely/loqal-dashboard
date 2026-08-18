/**
 * How long a shopper has been waiting, as a phrase.
 *
 * This is the number the whole hero is about, so it is worth being blunt about
 * what it is not: it is not a timestamp. "Placed 14:20" makes a shop owner do
 * subtraction while a customer is at the counter. "3 h" does not.
 *
 * Digits stay Latin in both languages, as the money formatter does. A column
 * that mixes ٣ and 3 is how a 7 gets read as a 1.
 */
import type { Messages } from "@/messages";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * `since` is the contract's `waitingSince`, which is null once the brand has
 * acted — so a null here means "no clock is running", not "just arrived".
 */
export function waitedLabel(
  since: string | null | undefined,
  t: Messages,
  now: number = Date.now()
): string | null {
  if (!since) return null;

  const started = Date.parse(since);
  if (Number.isNaN(started)) return null;

  const elapsed = Math.max(0, now - started);

  if (elapsed < MINUTE) return t.brand.justNow;
  if (elapsed < HOUR) {
    return t.brand.waitedMinutes.replace("{n}", String(Math.floor(elapsed / MINUTE)));
  }
  if (elapsed < DAY) {
    return t.brand.waitedHours.replace("{n}", String(Math.floor(elapsed / HOUR)));
  }
  return t.brand.waitedDays.replace("{n}", String(Math.floor(elapsed / DAY)));
}

/** Milliseconds waited, for ranking. Never rendered. */
export function waitedFor(since: string | null | undefined, now: number = Date.now()): number {
  if (!since) return -1;
  const started = Date.parse(since);
  if (Number.isNaN(started)) return -1;
  return Math.max(0, now - started);
}

/** Longest wait first. The shopper who has waited most is the one at the top. */
export function byLongestWait<T extends { waitingSince: string | null }>(
  rows: readonly T[],
  now: number = Date.now()
): T[] {
  return [...rows].sort(
    (a, b) => waitedFor(b.waitingSince, now) - waitedFor(a.waitingSince, now)
  );
}

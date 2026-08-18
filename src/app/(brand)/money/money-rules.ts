/**
 * The parts of /money that are decisions rather than markup.
 *
 * Everything here is pure: no React, no fetch, no DOM. It is separate from the
 * screen because these are the rules the money screens are actually about —
 * which tab is open, whether a document exists, and which of two lines beside
 * each other is the reversal of the other — and each one is worth checking
 * without a browser.
 *
 * NOTHING in this file computes a total, and nothing turns an amount into a
 * number. Money arrives as a string and leaves as a string; `balanceDirection`
 * in @loqal/contracts/money reads the sign textually, which is the only reading
 * that cannot round.
 */
import type { LedgerEntry } from "@loqal/contracts/ledger.contract";
import type { InvoiceListItem } from "@loqal/contracts/invoice.contract";

// ---------------------------------------------------------------------------
// The four tabs
// ---------------------------------------------------------------------------

/**
 * Balance first, and it is not merely the leftmost tab — it is the answer to
 * the question a shop owner opens this screen with. The three lists behind it
 * explain the figure; none of them replaces it.
 */
export const MONEY_TABS = [
  "balance",
  "ledger",
  "settlements",
  "invoices",
] as const;

export type MoneyTab = (typeof MONEY_TABS)[number];

export const DEFAULT_MONEY_TAB: MoneyTab = "balance";

export const isMoneyTab = (value: string | null | undefined): value is MoneyTab =>
  typeof value === "string" && (MONEY_TABS as readonly string[]).includes(value);

/** A URL that names a tab this build does not have opens on the balance. */
export const moneyTabFrom = (value: string | null | undefined): MoneyTab =>
  isMoneyTab(value) ? value : DEFAULT_MONEY_TAB;

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

/**
 * `YYYY-MM-DD`, in both languages.
 *
 * Latin digits and one ordering everywhere, for the same reason the money
 * formatter keeps Latin digits: a column that mixes ٣ and 3, or that reads
 * 08-14 in one row and 14-08 in the next, is how a shop owner reconciles the
 * wrong line against a bank statement. This is a ledger; unambiguous beats
 * friendly.
 *
 * Reads the UTC parts rather than the local ones, so the same row does not
 * carry two different dates for two people looking at it in two time zones.
 */
export function formatDay(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${at.getUTCFullYear()}-${pad(at.getUTCMonth() + 1)}-${pad(
    at.getUTCDate()
  )}`;
}

/** The same, with the hour and minute — for a figure that says "as of". */
export function formatMoment(iso: string | null | undefined): string | null {
  const day = formatDay(iso);
  if (!day || !iso) return null;
  const at = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${day} ${pad(at.getUTCHours())}:${pad(at.getUTCMinutes())}`;
}

/** "2026-08-01 → 2026-08-07". Direction-agnostic: an arrow, never a hyphen. */
export function formatPeriod(from: string, to: string): string {
  return `${formatDay(from) ?? "—"} → ${formatDay(to) ?? "—"}`;
}

// ---------------------------------------------------------------------------
// The ledger is append-only, so a correction arrives beside its original
// ---------------------------------------------------------------------------

/**
 * A correction is a reversing entry, never an edit. That is the right rule and
 * it produces the one thing on this screen that reliably reads as a mistake: a
 * sale for 1,240 and a refund for −1,240 sitting next to each other, on the
 * same order, looking like the shop was charged twice.
 *
 * So the reversal is LABELLED rather than left to be inferred. This returns,
 * for each REFUND line whose order also carries a SALE in the rows already
 * loaded, the order number to name in that label — "reverses the sale on
 * #1042" — so a shop owner reads two facts instead of one error.
 *
 * Matched on `brandOrderId`, which is the identity; `orderNumber` is only what
 * is printed. A refund whose original has not been paged in yet is simply not
 * in the map — an unlabelled row is honest, an invented pairing is not.
 */
export function reversedOrders(
  rows: readonly LedgerEntry[]
): Map<string, string> {
  const soldOn = new Map<string, string>();
  for (const row of rows) {
    if (row.type === "SALE" && row.brandOrderId) {
      soldOn.set(row.brandOrderId, row.orderNumber ?? "");
    }
  }

  const pairs = new Map<string, string>();
  for (const row of rows) {
    if (row.type !== "REFUND" || !row.brandOrderId) continue;
    const number = soldOn.get(row.brandOrderId);
    if (number === undefined) continue;
    pairs.set(row.id, number || (row.orderNumber ?? ""));
  }
  return pairs;
}

// ---------------------------------------------------------------------------
// An invoice is raised long before it is issued
// ---------------------------------------------------------------------------

/**
 * `raisedAt` and `issuedAt` are two different moments and this screen has to
 * say so. The row is raised when the brand order completes; the PDF is rendered
 * asynchronously, and until that succeeds there is nothing to issue and nothing
 * to download.
 *
 *  issued            the document exists and can be named by its date
 *  awaitingDocument  the line is real, the document is not there yet
 *  failed            the render failed; nothing was issued and someone must act
 *
 * A GENERATED row with a null `issuedAt` resolves to `awaitingDocument`, not to
 * `issued`. The two fields disagreeing is a backend inconsistency, and the safe
 * reading of it is the one that does not print an issue date for a document
 * nobody can open.
 */
export type InvoiceIssueState = "issued" | "awaitingDocument" | "failed";

export function invoiceIssueState(
  invoice: Pick<InvoiceListItem, "status" | "issuedAt">
): InvoiceIssueState {
  if (invoice.status === "FAILED") return "failed";
  if (invoice.status === "GENERATED" && invoice.issuedAt) return "issued";
  return "awaitingDocument";
}

/** Only a document that exists may be offered. Never a raised row. */
export const invoiceIsIssued = (
  invoice: Pick<InvoiceListItem, "status" | "issuedAt">
): boolean => invoiceIssueState(invoice) === "issued";

"use client";

/**
 * Everything /money reads. It reads only; there is no write in this file and
 * there must never be one.
 *
 * Two refusals are structural rather than stylistic, so they are written here
 * where the requests are made:
 *
 *  a. THE LEDGER IS APPEND-ONLY. A correction is a reversing entry, never an
 *     edit. @loqal/contracts/ledger.contract declares no update and no delete
 *     body, this module declares no `patch` and no `delete`, and so the screen
 *     has nothing to hang an edit control off even by accident.
 *  b. A BRAND CANNOT MARK ITS OWN SETTLEMENT. `markSettlementBodySchema` exists
 *     for the ADMIN plane; there is no brand write route, and a button here
 *     would be an offer the API refuses. Settlements are fetched and nothing
 *     else.
 *
 * Every one of these endpoints is `@Roles(BRAND_OWNER)` and answers 403 to an
 * employee, so every hook takes `enabled` and is not called at all unless the
 * caller is an owner. Not called and discarded — not called. A request made
 * only to throw the answer away still puts a refusal in the API's logs for
 * something nobody asked for.
 */
import { useCallback, useState } from "react";
import { z } from "zod";

import {
  brandBalanceSchema,
  ledgerPageSchema,
  type BrandBalance,
  type LedgerEntry,
} from "@loqal/contracts/ledger.contract";
import {
  invoicePageSchema,
  type InvoiceListItem,
} from "@loqal/contracts/invoice.contract";
import {
  settlementRunPageSchema,
  type SettlementRun,
} from "@loqal/contracts/settlement.contract";

import { api } from "@/lib/api";
import { useCursorFeed, useResource, type CursorFeed, type Resource } from "@/lib/resource";

/**
 * Cursor pagination, never offset — the same rule the order list runs on. A
 * ledger grows from the top as orders settle, so an offset page two would skip
 * whatever arrived while page one was on screen.
 */
export const MONEY_PAGE_SIZE = 20;

/**
 * The signed balance. `direction` names the party; the sign is corroboration.
 *
 * Positive means Loqal owes the brand and negative means the brand owes Loqal,
 * and the same shop flips between the two in consecutive weeks because card
 * orders settle to Loqal and cash orders settle to the brand. That is the
 * normal rhythm of the business, not an error state.
 */
export function useBrandBalance(enabled: boolean): Resource<BrandBalance> {
  return useResource("money:balance", enabled, (signal) =>
    api.get(brandBalanceSchema, "/v1/brands/me/balance", { signal })
  );
}

export function useLedger(enabled: boolean): CursorFeed<LedgerEntry> {
  return useCursorFeed("money:ledger", enabled, (cursor, signal) =>
    api.get(ledgerPageSchema, "/v1/brands/me/ledger", {
      query: { cursor: cursor ?? undefined, limit: MONEY_PAGE_SIZE },
      signal,
    })
  );
}

/** Read-only to the brand. Loqal raises a run and a human at Loqal marks it. */
export function useSettlements(enabled: boolean): CursorFeed<SettlementRun> {
  return useCursorFeed("money:settlements", enabled, (cursor, signal) =>
    api.get(settlementRunPageSchema, "/v1/brands/me/settlements", {
      query: { cursor: cursor ?? undefined, limit: MONEY_PAGE_SIZE },
      signal,
    })
  );
}

/**
 * KNOWN GAP, and the screen is built to show it rather than to hide it.
 *
 * This endpoint answers 503 today: the `Invoice` Prisma model does not exist
 * yet and its migration is pending. Nothing here stubs a row to fill the gap —
 * a fabricated invoice list is worse than an empty screen, because a shop owner
 * would file tax against it. The error state is the honest output, and it is
 * given its own copy so it does not read as "your connection dropped".
 */
export function useInvoices(enabled: boolean): CursorFeed<InvoiceListItem> {
  return useCursorFeed("money:invoices", enabled, (cursor, signal) =>
    api.get(invoicePageSchema, "/v1/brands/me/invoices", {
      query: { cursor: cursor ?? undefined, limit: MONEY_PAGE_SIZE },
      signal,
    })
  );
}

/**
 * The PDF, asked for only when the document already exists.
 *
 * `GET /v1/brands/me/invoices/:id/pdf` answers with a short-lived presigned URL
 * — and with `pdfUrl: null` while the worker is still rendering, rather than a
 * link that would 404. So the screen offers this on an ISSUED row only, and
 * even then treats a null URL as "not there yet" instead of navigating nowhere.
 *
 * Parsed with a deliberately narrow local schema rather than
 * `invoiceDetailSchema`. That contract shape carries `status` and `raisedAt`,
 * which this endpoint does not send, and it would fail the whole download over
 * two fields the download does not need. The one field that matters is the URL.
 */
const invoiceDocumentSchema = z.object({
  pdfUrl: z.string().nullable(),
});

export type InvoiceDocument = {
  /** The invoice whose document is being fetched, or null when idle. */
  pendingId: string | null;
  failed: boolean;
  open: (invoiceId: string) => Promise<void>;
};

export function useInvoiceDocument(): InvoiceDocument {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const open = useCallback(async (invoiceId: string) => {
    setPendingId(invoiceId);
    setFailed(false);
    try {
      const found = await api.get(
        invoiceDocumentSchema,
        `/v1/brands/me/invoices/${invoiceId}/pdf`
      );
      if (!found.pdfUrl) {
        setFailed(true);
        return;
      }
      window.open(found.pdfUrl, "_blank", "noopener,noreferrer");
    } catch {
      // A 503 from the pending migration and a dead connection are the same
      // sentence to whoever pressed the button.
      setFailed(true);
    } finally {
      setPendingId(null);
    }
  }, []);

  return { pendingId, failed, open };
}

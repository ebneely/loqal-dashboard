/**
 * Fixtures for /money. They live here and only here — shipped route source
 * carries no sample balance, no sample account and no sample invoice.
 *
 * Every page below is checked against its contract schema in the suite, so a
 * contract change breaks these before it breaks a shop.
 */
import type { BrandBalance, LedgerPage } from "@loqal/contracts/ledger.contract";
import type { InvoicePage } from "@loqal/contracts/invoice.contract";
import type { SettlementRunPage } from "@loqal/contracts/settlement.contract";

export const NOW = new Date("2026-08-14T12:00:00.000Z");

const iso = (daysAgo: number) =>
  new Date(NOW.getTime() - daysAgo * 24 * 60 * 60_000).toISOString();

const ORDER_A = "0199a000-0000-7000-8000-0000000000a1";
const ORDER_B = "0199a000-0000-7000-8000-0000000000b2";

// ---------------------------------------------------------------------------
// Balance — the same shop, both weeks
// ---------------------------------------------------------------------------

/** The week the shop sold on card: Loqal collected, so Loqal owes it on. */
export const balanceOwedToBrand: BrandBalance = {
  amount: "1240.00",
  direction: "LOQAL_OWES_BRAND",
  asOf: iso(0),
};

/** The week the shop sold cash: it collected, so it owes Loqal the share. */
export const balanceOwedToLoqal: BrandBalance = {
  amount: "-480.75",
  direction: "BRAND_OWES_LOQAL",
  asOf: iso(0),
};

export const balanceSettled: BrandBalance = {
  amount: "0.00",
  direction: "SETTLED",
  asOf: iso(0),
};

// ---------------------------------------------------------------------------
// Ledger — a sale and the refund that reverses it, both still there
// ---------------------------------------------------------------------------

export const ledgerPage: LedgerPage = {
  items: [
    {
      id: "0199b000-0000-7000-8000-000000000001",
      type: "SALE",
      amount: "1240.00",
      note: "Order 1042",
      brandOrderId: ORDER_A,
      orderNumber: "1042",
      createdAt: iso(3),
    },
    {
      id: "0199b000-0000-7000-8000-000000000002",
      type: "REFUND",
      amount: "-1240.00",
      note: "Returned in full",
      brandOrderId: ORDER_A,
      orderNumber: "1042",
      createdAt: iso(2),
    },
    {
      id: "0199b000-0000-7000-8000-000000000003",
      type: "COMMISSION",
      amount: "-148.80",
      note: null,
      brandOrderId: ORDER_B,
      orderNumber: "1043",
      createdAt: iso(2),
    },
    {
      /** Closes a period, so it has no order and must not borrow one. */
      id: "0199b000-0000-7000-8000-000000000004",
      type: "PAYOUT",
      amount: "-900.00",
      note: "Settlement run",
      brandOrderId: null,
      orderNumber: null,
      createdAt: iso(1),
    },
  ],
  nextCursor: null,
};

export const ledgerPageWithCursor: LedgerPage = {
  items: ledgerPage.items.slice(0, 2),
  nextCursor: "0199b000-0000-7000-8000-000000000002",
};

export const ledgerSecondPage: LedgerPage = {
  items: ledgerPage.items.slice(2),
  nextCursor: null,
};

export const emptyLedger: LedgerPage = { items: [], nextCursor: null };

// ---------------------------------------------------------------------------
// Settlements — read-only to the brand, both directions
// ---------------------------------------------------------------------------

export const settlementsPage: SettlementRunPage = {
  items: [
    {
      id: "0199c000-0000-7000-8000-000000000001",
      brandId: "0199c000-0000-7000-8000-0000000000ff",
      brandName: "A shop",
      periodStart: iso(14),
      periodEnd: iso(7),
      netAmount: "1240.00",
      direction: "WE_PAY",
      status: "SENT",
      settlementMethod: "INSTAPAY",
      settlementDetails: null,
      markedBy: "0199c000-0000-7000-8000-0000000000ee",
      markedAt: iso(6),
      note: null,
      createdAt: iso(7),
    },
    {
      id: "0199c000-0000-7000-8000-000000000002",
      brandId: "0199c000-0000-7000-8000-0000000000ff",
      brandName: "A shop",
      periodStart: iso(7),
      periodEnd: iso(0),
      netAmount: "-480.75",
      direction: "THEY_PAY",
      status: "PENDING",
      settlementMethod: "BANK_TRANSFER",
      settlementDetails: null,
      markedBy: null,
      markedAt: null,
      note: null,
      createdAt: iso(0),
    },
  ],
  nextCursor: null,
};

export const emptySettlements: SettlementRunPage = {
  items: [],
  nextCursor: null,
};

// ---------------------------------------------------------------------------
// Invoices — raised, issued and failed are three different rows
// ---------------------------------------------------------------------------

export const invoicesPage: InvoicePage = {
  items: [
    {
      /** Raised and not issued: the document is still being made. */
      id: "0199d000-0000-7000-8000-000000000001",
      reference: "INV-2026-0007",
      brandOrderId: ORDER_A,
      orderNumber: "1042",
      netAmount: "1240.00",
      status: "PENDING",
      raisedAt: iso(1),
      issuedAt: null,
    },
    {
      id: "0199d000-0000-7000-8000-000000000002",
      reference: "INV-2026-0006",
      brandOrderId: ORDER_B,
      orderNumber: "1043",
      netAmount: "385.50",
      status: "GENERATED",
      raisedAt: iso(4),
      issuedAt: iso(3),
    },
    {
      id: "0199d000-0000-7000-8000-000000000003",
      reference: "INV-2026-0005",
      brandOrderId: ORDER_B,
      orderNumber: "1044",
      netAmount: "96.00",
      status: "FAILED",
      raisedAt: iso(6),
      issuedAt: null,
    },
  ],
  nextCursor: null,
};

export const emptyInvoices: InvoicePage = { items: [], nextCursor: null };

// @vitest-environment node
/**
 * The decisions /money makes, checked without a DOM.
 *
 * Node environment on purpose: nothing here renders, so these still report
 * honestly when the React tree is mid-repair.
 */
import { describe, expect, it } from "vitest";

import { balanceDirection } from "@loqal/contracts/money";

import {
  DEFAULT_MONEY_TAB,
  MONEY_TABS,
  formatDay,
  formatMoment,
  formatPeriod,
  invoiceIssueState,
  invoiceIsIssued,
  isMoneyTab,
  moneyTabFrom,
  reversedOrders,
} from "../money-rules";
import { invoicesPage, ledgerPage } from "./fixtures";

describe("the four tabs", () => {
  it("opens on the balance, which is the question the screen answers", () => {
    expect(MONEY_TABS[0]).toBe("balance");
    expect(DEFAULT_MONEY_TAB).toBe("balance");
  });

  it("falls back to the balance for a tab this build does not have", () => {
    expect(moneyTabFrom("ledger")).toBe("ledger");
    expect(moneyTabFrom("nonsense")).toBe("balance");
    expect(moneyTabFrom(null)).toBe("balance");
    expect(isMoneyTab("settlements")).toBe(true);
    expect(isMoneyTab("payouts")).toBe(false);
  });
});

describe("dates", () => {
  it("reads the UTC parts, so one row is not two dates in two time zones", () => {
    expect(formatDay("2026-08-14T23:30:00.000Z")).toBe("2026-08-14");
    expect(formatMoment("2026-08-14T23:30:00.000Z")).toBe("2026-08-14 23:30");
  });

  it("answers null rather than a wrong date for an unparseable value", () => {
    expect(formatDay(null)).toBeNull();
    expect(formatDay("not a date")).toBeNull();
    expect(formatMoment(undefined)).toBeNull();
  });

  it("joins a period with an arrow, never a hyphen a minus could be read as", () => {
    expect(
      formatPeriod("2026-08-01T00:00:00.000Z", "2026-08-07T00:00:00.000Z")
    ).toBe("2026-08-01 → 2026-08-07");
  });
});

describe("a correction is a reversing entry, never an edit", () => {
  it("names the sale a refund reverses when both are on screen", () => {
    const pairs = reversedOrders(ledgerPage.items);
    expect(pairs.get("0199b000-0000-7000-8000-000000000002")).toBe("1042");
  });

  it("labels only the refund, so the sale beside it stays an ordinary row", () => {
    const pairs = reversedOrders(ledgerPage.items);
    expect(pairs.has("0199b000-0000-7000-8000-000000000001")).toBe(false);
    expect(pairs.size).toBe(1);
  });

  it("leaves a refund unlabelled rather than inventing the sale it reverses", () => {
    const orphan = ledgerPage.items.filter((row) => row.type === "REFUND");
    expect(reversedOrders(orphan).size).toBe(0);
  });

  it("never pairs across orders", () => {
    const rows = ledgerPage.items.map((row) =>
      row.type === "REFUND"
        ? { ...row, brandOrderId: "0199a000-0000-7000-8000-0000000000c3" }
        : row
    );
    expect(reversedOrders(rows).size).toBe(0);
  });
});

describe("the balance is signed and the sign is read textually", () => {
  it("never parses money as a float", () => {
    expect(balanceDirection("1240.00")).toBe("LOQAL_OWES_BRAND");
    expect(balanceDirection("-480.75")).toBe("BRAND_OWES_LOQAL");
    expect(balanceDirection("0.00")).toBe("SETTLED");
    expect(balanceDirection("-0.00")).toBe("SETTLED");
  });
});

describe("a raised invoice is not an issued one", () => {
  const [pending, generated, failed] = invoicesPage.items;

  it("calls a raised row awaiting, never issued", () => {
    expect(invoiceIssueState(pending)).toBe("awaitingDocument");
    expect(invoiceIsIssued(pending)).toBe(false);
  });

  it("calls a rendered row issued", () => {
    expect(invoiceIssueState(generated)).toBe("issued");
    expect(invoiceIsIssued(generated)).toBe(true);
  });

  it("gives a failed render its own state rather than folding it into 'not yet'", () => {
    expect(invoiceIssueState(failed)).toBe("failed");
    expect(invoiceIsIssued(failed)).toBe(false);
  });

  /**
   * The two fields disagreeing is a backend inconsistency, and the safe reading
   * is the one that does not print an issue date for a document nobody can
   * open.
   */
  it("does not call GENERATED-with-no-issuedAt issued", () => {
    expect(
      invoiceIssueState({ status: "GENERATED", issuedAt: null })
    ).toBe("awaitingDocument");
  });
});

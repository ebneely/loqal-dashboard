import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { brandBalanceSchema, ledgerPageSchema } from "@loqal/contracts/ledger.contract";
import { invoicePageSchema } from "@loqal/contracts/invoice.contract";
import { settlementRunPageSchema } from "@loqal/contracts/settlement.contract";
import { en } from "@/messages/en";
import { LocaleProvider } from "@/lib/locale-context";

import {
  balanceOwedToBrand,
  balanceOwedToLoqal,
  balanceSettled,
  emptyInvoices,
  emptyLedger,
  emptySettlements,
  invoicesPage,
  ledgerPage,
  ledgerPageWithCursor,
  ledgerSecondPage,
  settlementsPage,
} from "./fixtures";

const replace = vi.fn();
let search = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn() }),
  usePathname: () => "/money",
  useSearchParams: () => search,
}));

const useSession = vi.fn();
vi.mock("@/lib/auth-client", () => ({
  useSession: () => useSession(),
  signOut: vi.fn(),
}));

/**
 * Only `api` is replaced. ApiError stays the real class — `listStateFor` does
 * an `instanceof` check on it, and a stubbed lookalike would make the 403 test
 * pass for the wrong reason.
 */
const get = vi.fn();
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, api: { ...actual.api, get } };
});

const { ApiError } = await import("@/lib/api");
const MoneyPage = (await import("../page")).default;
const { ar } = await import("@/messages/ar");

type Answers = {
  balance?: unknown;
  ledger?: unknown;
  settlements?: unknown;
  invoices?: unknown;
};

const answer = (value: unknown) =>
  value instanceof Error ? Promise.reject(value) : Promise.resolve(value);

function mockApi(answers: Answers) {
  get.mockImplementation((_schema: unknown, path: string) => {
    if (path === "/v1/brands/me/balance") {
      return answer(answers.balance ?? balanceOwedToBrand);
    }
    if (path === "/v1/brands/me/ledger") {
      return answer(answers.ledger ?? ledgerPage);
    }
    if (path === "/v1/brands/me/settlements") {
      return answer(answers.settlements ?? settlementsPage);
    }
    if (path === "/v1/brands/me/invoices") {
      return answer(answers.invoices ?? invoicesPage);
    }
    return Promise.reject(new Error(`unstubbed path ${path}`));
  });
}

const session = (role: "BRAND_OWNER" | "BRAND_EMPLOYEE") => ({
  data: {
    user: {
      id: "u-1",
      name: "Someone",
      role,
      brandId: "b-1",
      mustChangePassword: false,
    },
    session: { id: "s-1" },
  },
  isPending: false,
  error: null,
});

const renderMoney = (locale: "en" | "ar" = "en") =>
  render(
    <LocaleProvider locale={locale}>
      <MoneyPage />
    </LocaleProvider>
  );

/** Radix needs the pointer press before the click on a controlled tab list. */
const openTab = async (name: string) => {
  const trigger = await screen.findByRole("tab", { name });
  fireEvent.mouseDown(trigger);
  fireEvent.click(trigger);
  return trigger;
};

/**
 * Reset in beforeEach, not afterEach — a mock left configured by the previous
 * file is what makes one suite pass only when it runs second.
 */
beforeEach(() => {
  vi.restoreAllMocks();
  get.mockReset();
  replace.mockReset();
  search = new URLSearchParams();
  useSession.mockReturnValue(session("BRAND_OWNER"));
  mockApi({});
});

describe("/money fixtures match the shipped contracts", () => {
  it("parses every fixture with the contract that describes it", () => {
    for (const balance of [
      balanceOwedToBrand,
      balanceOwedToLoqal,
      balanceSettled,
    ]) {
      expect(brandBalanceSchema.safeParse(balance).success).toBe(true);
    }
    for (const page of [ledgerPage, ledgerPageWithCursor, ledgerSecondPage, emptyLedger]) {
      expect(ledgerPageSchema.safeParse(page).success).toBe(true);
    }
    expect(settlementRunPageSchema.safeParse(settlementsPage).success).toBe(true);
    expect(settlementRunPageSchema.safeParse(emptySettlements).success).toBe(true);
    expect(invoicePageSchema.safeParse(invoicesPage).success).toBe(true);
    expect(invoicePageSchema.safeParse(emptyInvoices).success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// The signed balance — the single most misreadable number in the product
// ---------------------------------------------------------------------------

describe("/money — the balance names the party in words", () => {
  it("names the brand when Loqal owes it, in English", async () => {
    mockApi({ balance: balanceOwedToBrand });
    renderMoney("en");

    const hero = await screen.findByTestId("money-balance");
    expect(within(hero).getByText("Loqal owes you")).toBeInTheDocument();
    expect(within(hero).getByText("1,240.00")).toBeInTheDocument();
  });

  it("names Loqal when the brand owes it, in English", async () => {
    mockApi({ balance: balanceOwedToLoqal });
    renderMoney("en");

    const hero = await screen.findByTestId("money-balance");
    // The party is written out; the minus sign is corroboration, not the
    // sentence. "You owe Loqal" is what a shop owner reads off a phone.
    expect(within(hero).getByText("You owe Loqal")).toBeInTheDocument();
    expect(within(hero).getByText("480.75")).toBeInTheDocument();
  });

  it("names Loqal when the brand owes it, in Arabic", async () => {
    mockApi({ balance: balanceOwedToLoqal });
    renderMoney("ar");

    const hero = await screen.findByTestId("money-balance");
    expect(
      within(hero).getByText("أنت مستحق عليك لـلوكال")
    ).toBeInTheDocument();
    // Latin digits in both languages: a column mixing ٣ and 3 is how a 7 gets
    // read as a 1 against a bank statement.
    expect(within(hero).getByText("480.75")).toBeInTheDocument();
  });

  it("names the brand when Loqal owes it, in Arabic", async () => {
    mockApi({ balance: balanceOwedToBrand });
    renderMoney("ar");

    const hero = await screen.findByTestId("money-balance");
    expect(
      within(hero).getByText("لوكال مستحق عليها لك")
    ).toBeInTheDocument();
  });

  it("says a settled balance is settled rather than showing a bare zero", async () => {
    mockApi({ balance: balanceSettled });
    renderMoney("en");

    const hero = await screen.findByTestId("money-balance");
    expect(
      within(hero).getByText("Nothing owed either way")
    ).toBeInTheDocument();
  });

  /** Both directions are normal, and the screen says so out loud. */
  it("tells the reader the figure goes both ways", async () => {
    renderMoney("en");
    expect(
      await screen.findByText(en.brand.balanceBothWays)
    ).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// The role boundary
// ---------------------------------------------------------------------------

describe("/money — an employee sees nothing, and nothing greyed", () => {
  beforeEach(() => {
    useSession.mockReturnValue(session("BRAND_EMPLOYEE"));
  });

  it("renders no balance, no ledger, no settlements and no invoices", async () => {
    renderMoney("en");

    expect(await screen.findByText(en.brand.deniedTitle)).toBeInTheDocument();
    expect(screen.queryByTestId("money-balance")).toBeNull();
    expect(screen.queryByTestId("money-ledger")).toBeNull();
    expect(screen.queryByTestId("money-settlements")).toBeNull();
    expect(screen.queryByTestId("money-invoices")).toBeNull();
  });

  it("renders no tab list at all — a Ledger tab is itself an answer", async () => {
    renderMoney("en");

    await screen.findByText(en.brand.deniedTitle);
    expect(screen.queryAllByRole("tab")).toHaveLength(0);
    expect(screen.queryByText(en.brand.ledgerTitle)).toBeNull();
    expect(screen.queryByText(en.brand.settlementsTitle)).toBeNull();
    expect(screen.queryByText(en.brand.invoicesTitle)).toBeNull();
  });

  /** Absent, never disabled. A greyed control still says the thing exists. */
  it("leaves nothing merely disabled", async () => {
    const { container } = renderMoney("en");

    await screen.findByText(en.brand.deniedTitle);
    expect(
      container.querySelectorAll(
        "[disabled], [aria-disabled='true'], [data-disabled]"
      )
    ).toHaveLength(0);
  });

  it("asks the API for nothing", async () => {
    renderMoney("en");

    await screen.findByText(en.brand.deniedTitle);
    // Not fetched and discarded — not fetched. A request made only to throw the
    // answer away still puts a refusal in the API's log.
    expect(get).not.toHaveBeenCalled();
  });

  it("says the same in Arabic", async () => {
    renderMoney("ar");
    expect(await screen.findByText(ar.brand.deniedTitle)).toBeInTheDocument();
  });
});

describe("/money — a 403 is a state, not a crash and not a toast", () => {
  it("draws the denied panel and names the role", async () => {
    mockApi({ balance: new ApiError(403, "Forbidden", "Forbidden") });
    const { container } = renderMoney("en");

    expect(await screen.findByText(en.brand.deniedTitle)).toBeInTheDocument();
    expect(container.querySelector('[data-state="denied"]')).not.toBeNull();
    expect(screen.getByText("BRAND_OWNER")).toBeInTheDocument();
    // Denied gets no retry: pressing it again changes nothing.
    expect(
      screen.queryByRole("button", { name: en.brand.retry })
    ).toBeNull();
  });

  it("puts nothing in a toaster", async () => {
    mockApi({ balance: new ApiError(403, "Forbidden", "Forbidden") });
    renderMoney("en");

    await screen.findByText(en.brand.deniedTitle);
    expect(document.querySelector("[data-sonner-toaster]")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// The ledger
// ---------------------------------------------------------------------------

describe("/money — the ledger is append-only", () => {
  it("offers no edit, no delete and no correction control anywhere", async () => {
    renderMoney("en");
    await openTab(en.brand.ledgerTitle);

    const ledger = await screen.findByTestId("money-ledger");
    expect(
      within(ledger).queryByRole("button", { name: /edit|delete|remove|fix|correct/i })
    ).toBeNull();
    expect(
      within(ledger).queryByRole("link", { name: /edit|delete|remove|fix|correct/i })
    ).toBeNull();
    // Nor a field to type a correction into.
    expect(within(ledger).queryAllByRole("textbox")).toHaveLength(0);
    expect(within(ledger).queryAllByRole("combobox")).toHaveLength(0);
    expect(ledger.querySelectorAll("input, select, textarea")).toHaveLength(0);
  });

  it("shows the refund beside the sale it reverses, and says which", async () => {
    renderMoney("en");
    await openTab(en.brand.ledgerTitle);

    const ledger = await screen.findByTestId("money-ledger");
    // Both rows are still there. The refund is labelled rather than the sale
    // being edited away.
    expect(within(ledger).getAllByText("Returned in full").length).toBeGreaterThan(0);
    expect(within(ledger).getAllByText("Order 1042").length).toBeGreaterThan(0);
    expect(
      within(ledger).getAllByText(
        en.brand.ledgerReversalOf.replace("{n}", "1042")
      ).length
    ).toBeGreaterThan(0);
    expect(within(ledger).getAllByText(en.brand.ledgerAppendOnly).length).toBe(1);
  });

  it("never shows a delivery fee — shipping does not reach the ledger", async () => {
    renderMoney("en");
    await openTab(en.brand.ledgerTitle);

    const ledger = await screen.findByTestId("money-ledger");
    expect(ledger.textContent).not.toMatch(/shipping|courier|delivery fee/i);
    expect(within(ledger).getAllByText(en.brand.shippingNote).length).toBe(1);
  });

  it("gives a line that closes a period no order to borrow", async () => {
    renderMoney("en");
    await openTab(en.brand.ledgerTitle);

    const ledger = await screen.findByTestId("money-ledger");
    expect(within(ledger).getAllByText(en.brand.ledgerNoOrder).length).toBeGreaterThan(0);
  });

  it("keeps the rows already read when a LATER page fails", async () => {
    mockApi({ ledger: ledgerPageWithCursor });
    renderMoney("en");
    await openTab(en.brand.ledgerTitle);

    const ledger = await screen.findByTestId("money-ledger");
    await within(ledger).findAllByText("Order 1042");

    mockApi({ ledger: new ApiError(500, "boom", "Internal") });
    fireEvent.click(within(ledger).getByRole("button", { name: en.brand.loadMore }));

    // The rows stay and the failure is drawn beside them, rather than the whole
    // screen becoming an error panel.
    expect(await screen.findByTestId("money-inline-retry")).toBeInTheDocument();
    expect(within(ledger).getAllByText("Order 1042").length).toBeGreaterThan(0);
  });

  it("draws the empty state when there is nothing in it", async () => {
    mockApi({ ledger: emptyLedger });
    renderMoney("en");
    await openTab(en.brand.ledgerTitle);

    expect(
      await screen.findByText(en.brand.ledgerEmptyTitle)
    ).toBeInTheDocument();
  });

  it("draws the error state, with a retry, when the first page fails", async () => {
    mockApi({ ledger: new ApiError(500, "boom", "Internal") });
    renderMoney("en");
    await openTab(en.brand.ledgerTitle);

    expect(
      await screen.findByText(en.brand.ledgerErrorTitle)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: en.brand.retry })
    ).toBeInTheDocument();
  });

  it("draws the denied state on a 403 rather than an error", async () => {
    mockApi({ ledger: new ApiError(403, "Forbidden", "Forbidden") });
    renderMoney("en");
    await openTab(en.brand.ledgerTitle);

    const ledger = await screen.findByTestId("money-ledger");
    expect(ledger.querySelector('[data-state="denied"]')).not.toBeNull();
  });

  it("draws the loading state before anything arrives", async () => {
    get.mockImplementation(() => new Promise(() => {}));
    renderMoney("en");
    await openTab(en.brand.ledgerTitle);

    const ledger = await screen.findByTestId("money-ledger");
    expect(ledger.querySelector('[aria-busy="true"]')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Settlements
// ---------------------------------------------------------------------------

describe("/money — a brand cannot mark its own settlement", () => {
  it("offers no button that would mark a run", async () => {
    renderMoney("en");
    await openTab(en.brand.settlementsTitle);

    const panel = await screen.findByTestId("money-settlements");
    expect(
      within(panel).queryByRole("button", { name: /mark|sent|received|cancel/i })
    ).toBeNull();
    expect(within(panel).getAllByText(en.brand.settlementNoAction).length).toBe(1);
  });

  it("names both directions in words rather than in the enum", async () => {
    renderMoney("en");
    await openTab(en.brand.settlementsTitle);

    const panel = await screen.findByTestId("money-settlements");
    expect(within(panel).getAllByText(en.brand.settlementWePay).length).toBeGreaterThan(0);
    expect(within(panel).getAllByText(en.brand.settlementTheyPay).length).toBeGreaterThan(0);
    expect(panel.textContent).not.toMatch(/WE_PAY|THEY_PAY/);
  });

  it("draws its empty state", async () => {
    mockApi({ settlements: emptySettlements });
    renderMoney("en");
    await openTab(en.brand.settlementsTitle);

    expect(
      await screen.findByText(en.brand.settlementsEmptyTitle)
    ).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------

describe("/money — a raised invoice is not an issued one", () => {
  it("offers no download for a raised row and does not call it issued", async () => {
    renderMoney("en");
    await openTab(en.brand.invoicesTitle);

    const panel = await screen.findByTestId("money-invoices");
    const rows = within(panel).getAllByText("INV-2026-0007");
    expect(rows.length).toBeGreaterThan(0);

    // Exactly one download button on the whole list: the one row whose document
    // exists. The raised row and the failed one offer nothing — absent, not
    // disabled, because a greyed button promises the file is nearly there.
    const downloads = within(panel).getAllByRole("button", {
      name: en.brand.invoiceDownload,
    });
    expect(downloads).toHaveLength(2); // the card stack and the table, one row
    expect(downloads.every((node) => !node.hasAttribute("disabled"))).toBe(true);

    expect(
      within(panel).getAllByText(en.brand.invoiceNotIssued).length
    ).toBeGreaterThan(0);
  });

  it("gives a failed render its own visible state", async () => {
    renderMoney("en");
    await openTab(en.brand.invoicesTitle);

    const panel = await screen.findByTestId("money-invoices");
    expect(
      within(panel).getAllByText(en.brand.invoiceFailed).length
    ).toBeGreaterThan(0);
  });

  it("shows the issue date only for the row that has one", async () => {
    renderMoney("en");
    await openTab(en.brand.invoicesTitle);

    const panel = await screen.findByTestId("money-invoices");
    // The GENERATED row was issued three days before the fixed clock.
    expect(within(panel).getAllByText("2026-08-11").length).toBeGreaterThan(0);
  });

  /** Known: this endpoint answers 503 today. The screen says so in its own words. */
  it("says invoices are not switched on rather than blaming the connection", async () => {
    mockApi({
      invoices: new ApiError(503, "not provisioned", "ServiceUnavailable"),
    });
    renderMoney("en");
    await openTab(en.brand.invoicesTitle);

    expect(
      await screen.findByText(en.brand.invoicesUnavailableTitle)
    ).toBeInTheDocument();
  });

  it("draws its empty state", async () => {
    mockApi({ invoices: emptyInvoices });
    renderMoney("en");
    await openTab(en.brand.invoicesTitle);

    expect(
      await screen.findByText(en.brand.invoicesEmptyTitle)
    ).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// The tabs
// ---------------------------------------------------------------------------

describe("/money — the tab lives in the URL", () => {
  it("opens on the balance", async () => {
    renderMoney("en");
    expect(await screen.findByTestId("money-balance")).toBeInTheDocument();
  });

  it("opens the tab the URL names", async () => {
    search = new URLSearchParams("tab=settlements");
    renderMoney("en");

    expect(await screen.findByTestId("money-settlements")).toBeInTheDocument();
  });

  it("falls back to the balance for a tab this build does not have", async () => {
    search = new URLSearchParams("tab=payouts");
    renderMoney("en");

    expect(await screen.findByTestId("money-balance")).toBeInTheDocument();
  });

  it("writes the tab into the address when it changes", async () => {
    renderMoney("en");
    await openTab(en.brand.ledgerTitle);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/money?tab=ledger"));
  });

  it("names every tab from the Arabic catalogue", async () => {
    renderMoney("ar");

    await screen.findByTestId("money-balance");
    for (const label of [
      ar.brand.balance,
      ar.brand.ledgerTitle,
      ar.brand.settlementsTitle,
      ar.brand.invoicesTitle,
    ]) {
      expect(screen.getByRole("tab", { name: label })).toBeInTheDocument();
    }
  });

  it("draws the whole ledger from the Arabic catalogue", async () => {
    renderMoney("ar");
    await openTab(ar.brand.ledgerTitle);

    const ledger = await screen.findByTestId("money-ledger");
    expect(within(ledger).getAllByText(ar.brand.ledgerAppendOnly).length).toBe(1);
    expect(within(ledger).getAllByText(ar.brand.shippingNote).length).toBe(1);
    expect(
      within(ledger).getAllByText(ar.brand.ledgerNoOrder).length
    ).toBeGreaterThan(0);
    // Latin digits and one date ordering in both languages.
    expect(within(ledger).getAllByText("2026-08-11").length).toBeGreaterThan(0);
  });

  it("fetches only the list whose tab is open", async () => {
    renderMoney("en");
    await screen.findByTestId("money-balance");

    const paths = get.mock.calls.map((call) => call[1]);
    expect(paths).toContain("/v1/brands/me/balance");
    expect(paths).not.toContain("/v1/brands/me/ledger");
    expect(paths).not.toContain("/v1/brands/me/settlements");
    expect(paths).not.toContain("/v1/brands/me/invoices");
  });
});

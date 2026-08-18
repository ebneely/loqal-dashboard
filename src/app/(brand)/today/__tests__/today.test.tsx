import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";

import { brandOrderPageSchema } from "@loqal/contracts/order.contract";
import { brandBalanceSchema } from "@loqal/contracts/ledger.contract";
import { en } from "@/messages/en";
import { LocaleProvider } from "@/lib/locale-context";

import {
  NOW,
  balanceOwed,
  chatThreads,
  emptyOrders,
  packedOrders,
  pendingOrders,
  productsPage,
  productsPageAllStocked,
} from "./fixtures";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/today",
  useSearchParams: () => new URLSearchParams(),
}));

const useSession = vi.fn();
vi.mock("@/lib/auth-client", () => ({
  useSession: () => useSession(),
  signOut: vi.fn(),
}));

/**
 * Only `api` is replaced. ApiError stays the real class — `listStateFor` does an
 * `instanceof` check on it, and a stubbed lookalike would make the 403 test pass
 * for the wrong reason.
 */
const get = vi.fn();
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, api: { ...actual.api, get } };
});

// Static, not dynamic: `vi.mock` is hoisted above every import in the file, so
// these already see the stubs above.
const { ApiError } = await import("@/lib/api");
const TodayPage = (await import("../page")).default;
const { ar } = await import("@/messages/ar");

type Answers = {
  pending?: unknown;
  packed?: unknown;
  products?: unknown;
  threads?: unknown;
  balance?: unknown;
};

/** `unknown` here means "an Error to throw", anything else means "resolve it". */
const answer = (value: unknown) =>
  value instanceof Error ? Promise.reject(value) : Promise.resolve(value);

function mockApi(answers: Answers) {
  get.mockImplementation((_schema: unknown, path: string, options?: { query?: Record<string, unknown> }) => {
    if (path === "/v1/dashboard/orders") {
      return options?.query?.status === "PACKED"
        ? answer(answers.packed ?? emptyOrders)
        : answer(answers.pending ?? emptyOrders);
    }
    if (path === "/v1/dashboard/products") return answer(answers.products ?? productsPageAllStocked);
    if (path === "/v1/dashboard/chat/threads") return answer(answers.threads ?? []);
    if (path === "/v1/brands/me/balance") return answer(answers.balance ?? balanceOwed);
    return Promise.reject(new Error(`unstubbed path ${path}`));
  });
}

const session = (role: "BRAND_OWNER" | "BRAND_EMPLOYEE", extra: Record<string, unknown> = {}) => ({
  data: {
    user: {
      id: "u-1",
      email: "owner@example.test",
      name: "Owner",
      role,
      brandId: "b-1",
      mustChangePassword: false,
      ...extra,
    },
    session: { id: "s-1" },
  },
  isPending: false,
  error: null,
});

const renderToday = (locale: "en" | "ar" = "en") =>
  render(
    <LocaleProvider locale={locale}>
      <TodayPage />
    </LocaleProvider>
  );

beforeEach(() => {
  // Date.now, not fake timers: waiting times are asserted to the minute, and
  // fake timers would also freeze the ones Testing Library's waitFor runs on.
  vi.spyOn(Date, "now").mockReturnValue(NOW.getTime());
  useSession.mockReturnValue(session("BRAND_OWNER"));
  mockApi({});
});

afterEach(() => {
  vi.restoreAllMocks();
  get.mockReset();
  push.mockReset();
});

describe("/today fixtures match the shipped contracts", () => {
  it("parses the order fixtures with brandOrderPageSchema", () => {
    expect(brandOrderPageSchema.safeParse(pendingOrders).success).toBe(true);
    expect(brandOrderPageSchema.safeParse(packedOrders).success).toBe(true);
  });

  it("parses the balance fixture with brandBalanceSchema", () => {
    expect(brandBalanceSchema.safeParse(balanceOwed).success).toBe(true);
  });
});

describe("/today — work waiting", () => {
  beforeEach(() => {
    mockApi({
      pending: pendingOrders,
      packed: packedOrders,
      products: productsPage,
      threads: chatThreads,
      balance: balanceOwed,
    });
  });

  it("leads with the shelf-check section as the hero", async () => {
    renderToday();

    const hero = await screen.findByTestId("today-shelf-check");
    expect(
      within(hero).getByText(en.brand.heroTitleMany.replace("{n}", "2"))
    ).toBeInTheDocument();
    expect(within(hero).getByText(en.brand.heroDesc)).toBeInTheDocument();

    // Hero first: every other section comes after it in document order.
    const sections = screen.getAllByRole("region");
    expect(sections[0]).toBe(hero);
  });

  it("shows the order number, item count and how long each has waited", async () => {
    renderToday();

    const hero = await screen.findByTestId("today-shelf-check");
    expect(within(hero).getAllByRole("link", { name: /1042/ }).length).toBeGreaterThan(0);
    // 22 minutes since waitingSince on the fixture clock.
    expect(within(hero).getAllByText("22 min").length).toBeGreaterThan(0);
    // 220 minutes -> 3 h.
    expect(within(hero).getAllByText("3 h").length).toBeGreaterThan(0);
    expect(within(hero).getAllByText("3").length).toBeGreaterThan(0);
  });

  it("puts the primary action in a bottom action bar, not the top bar", async () => {
    renderToday();

    await screen.findByTestId("today-shelf-check");
    const bar = screen.getByTestId("today-action-bar");
    expect(bar.closest('[data-slot="mobile-action-bar"]')).not.toBeNull();
    expect(within(bar).getByRole("link", { name: en.brand.shelfTitle })).toHaveAttribute(
      "href",
      "/orders/0199a000-0000-7000-8000-000000000002"
    );
  });

  it("orders the sections shelf check, packed, low stock, chat, balance", async () => {
    renderToday();

    await screen.findByTestId("today-shelf-check");
    await waitFor(() => expect(screen.getByTestId("today-balance")).toBeInTheDocument());

    const ids = screen
      .getAllByRole("region")
      .map((node) => node.getAttribute("data-testid"));
    expect(ids).toEqual([
      "today-shelf-check",
      "today-packed",
      "today-low-stock",
      "today-chat",
      "today-balance",
    ]);
  });

  it("says the brand sees only its own slice of an order", async () => {
    renderToday();

    const hero = await screen.findByTestId("today-shelf-check");
    expect(within(hero).getByText(en.brand.sliceOnly)).toBeInTheDocument();
  });

  it("renders no parent total and no sibling brand anywhere", async () => {
    const { container } = renderToday();

    await screen.findByTestId("today-shelf-check");
    expect(container.textContent).not.toMatch(/parentTotal|grandTotal/i);
  });

  it("lists a low-stock row per variant under the threshold", async () => {
    renderToday();

    const section = await screen.findByTestId("today-low-stock");
    expect(within(section).getAllByText("NEF-LS-S").length).toBeGreaterThan(0);
    expect(within(section).getAllByText("NEF-CS-1").length).toBeGreaterThan(0);
    // 40 in stock is not low stock.
    expect(within(section).queryByText("NEF-LS-M")).toBeNull();
  });
});

describe("/today — the owner/employee difference", () => {
  beforeEach(() => {
    mockApi({
      pending: pendingOrders,
      packed: packedOrders,
      products: productsPage,
      threads: chatThreads,
      balance: balanceOwed,
    });
  });

  it("renders the balance section for an owner", async () => {
    renderToday();

    const balance = await screen.findByTestId("today-balance");
    expect(within(balance).getByText(en.brand.balance)).toBeInTheDocument();
    expect(within(balance).getByText("1,875.25")).toBeInTheDocument();
  });

  it("renders NO balance section at all for an employee — absent, not disabled", async () => {
    useSession.mockReturnValue(session("BRAND_EMPLOYEE"));

    const { container } = renderToday();
    await screen.findByTestId("today-shelf-check");

    // Absent: no section, no heading, no figure, and nothing disabled standing
    // in for it. A greyed-out card would still tell a counter assistant that a
    // payout account exists and roughly what it says.
    expect(screen.queryByTestId("today-balance")).toBeNull();
    expect(screen.queryByText(en.brand.balance)).toBeNull();
    expect(screen.queryByText(en.brand.balanceSub)).toBeNull();
    expect(container.querySelector("[data-direction]")).toBeNull();
    expect(container.querySelector("[disabled], [aria-disabled='true']")).toBeNull();
  });

  it("never asks the balance endpoint as an employee", async () => {
    useSession.mockReturnValue(session("BRAND_EMPLOYEE"));

    renderToday();
    await screen.findByTestId("today-shelf-check");

    expect(
      get.mock.calls.some(([, path]) => path === "/v1/brands/me/balance")
    ).toBe(false);
  });

  it("renders the denied state when the API refuses the balance with a 403", async () => {
    // The nav is cosmetic; the backend RolesGuard is the boundary. An owner
    // whose grant was revoked mid-session must get a panel, not a crash.
    mockApi({
      pending: pendingOrders,
      balance: new ApiError(403, "Forbidden", "Forbidden"),
    });

    renderToday();

    const balance = await screen.findByTestId("today-balance");
    await waitFor(() =>
      expect(within(balance).getByText(en.brand.deniedTitle)).toBeInTheDocument()
    );
    expect(within(balance).getByText(en.brand.deniedBody)).toBeInTheDocument();
    expect(within(balance).getByText("BRAND_OWNER")).toBeInTheDocument();
    // Not a toast, and not an error panel.
    expect(within(balance).queryByRole("alert")).toBeNull();
    expect(screen.queryByText(en.brand.errorTitle)).toBeNull();
  });
});

describe("/today — the four list states", () => {
  it("draws the loading skeleton while the feed is in flight", () => {
    get.mockImplementation(() => new Promise(() => {}));

    const { container } = renderToday();

    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.queryByTestId("today-shelf-check")).toBeNull();
  });

  it("draws the empty state when nothing needs a human", async () => {
    mockApi({});

    renderToday();

    expect(await screen.findByText(en.brand.emptyTodayTitle)).toBeInTheDocument();
    expect(screen.getByText(en.brand.emptyTodayBody)).toBeInTheDocument();
    expect(screen.queryByTestId("today-shelf-check")).toBeNull();
  });

  it("draws the error state with a retry when the feed fails", async () => {
    mockApi({ pending: new ApiError(500, "boom", "InternalServerError") });

    renderToday();

    expect(await screen.findByText(en.brand.errorTitle)).toBeInTheDocument();
    expect(screen.getByText(en.brand.errorBody)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: en.brand.retry })).toBeInTheDocument();
  });

  it("draws the denied state when the feed itself is refused", async () => {
    mockApi({ pending: new ApiError(403, "Forbidden", "Forbidden") });

    renderToday();

    expect(await screen.findByText(en.brand.deniedTitle)).toBeInTheDocument();
    // Denied is not error: no retry button, because retrying changes nothing.
    expect(screen.queryByRole("button", { name: en.brand.retry })).toBeNull();
  });
});

describe("/today — bilingual", () => {
  it("takes its copy from ar.ts under the Arabic locale", async () => {
    mockApi({ pending: pendingOrders });

    renderToday("ar");

    const hero = await screen.findByTestId("today-shelf-check");
    expect(within(hero).getByText(ar.brand.heroDesc)).toBeInTheDocument();
  });
});

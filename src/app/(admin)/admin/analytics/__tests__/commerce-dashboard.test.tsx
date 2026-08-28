/**
 * The commerce dashboard, which is the register's hardest test.
 *
 * These assertions are the design brief made checkable. The shape of the
 * reference dashboards — four identical cards, an icon in a tinted circle on
 * each, a sparkline under every figure whether or not there is a shape to
 * draw — is what this screen is not, and "is not" only survives a refactor if
 * something fails when it comes back.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { LocaleProvider } from "@/lib/locale-context";
import { en } from "@/messages/en";
import { ar } from "@/messages/ar";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/admin/analytics",
  useSearchParams: () => new URLSearchParams(),
}));

const get = vi.fn();
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, api: { ...actual.api, get } };
});

const { ApiError } = await import("@/lib/api");
const { CommerceDashboard } = await import("../commerce-dashboard");
const { commerceDashboardSchema, windowStart } = await import(
  "../commerce-data"
);

const c = en.admin.commerce;

/** N days ending today, `traded` of them with orders on. */
const trend = (days: number, traded: number) =>
  Array.from({ length: days }, (_, index) => ({
    day: `2026-0${index < 9 ? "8" : "9"}-${String((index % 28) + 1).padStart(2, "0")}`,
    orders: index < traded ? 3 : 0,
    revenue: index < traded ? "600.00" : "0.00",
  }));

const dashboard = (overrides: Record<string, unknown> = {}) =>
  commerceDashboardSchema.parse({
    range: { from: "2026-07-30", to: "2026-08-28" },
    totals: {
      orders: 36,
      revenue: "14400.00",
      customers: 22,
      averageOrderValue: "400.00",
    },
    previous: {
      orders: 30,
      revenue: "12000.00",
      customers: 19,
      averageOrderValue: "400.00",
    },
    trend: trend(30, 12),
    byStatus: [
      { status: "DELIVERED", count: 27 },
      { status: "PENDING_BRAND", count: 6 },
      { status: "CANCELLED", count: 3 },
    ],
    byGovernorate: [
      { code: "CAI", orders: 20, revenue: "8000.00" },
      { code: "GIZ", orders: 9, revenue: "3600.00" },
      { code: "ALX", orders: 7, revenue: "2800.00" },
    ],
    topProducts: [
      { name: "Prayer mat", qty: 18, revenue: "3600.00" },
      { name: "Kids abaya", qty: 12, revenue: "4800.00" },
    ],
    ...overrides,
  });

const empty = dashboard({
  totals: { orders: 0, revenue: "0.00", customers: 0, averageOrderValue: null },
  previous: {
    orders: 0,
    revenue: "0.00",
    customers: 0,
    averageOrderValue: null,
  },
  trend: trend(30, 0),
  byStatus: [],
  byGovernorate: [],
  topProducts: [],
});

const answer = (value: unknown) =>
  value instanceof Error ? Promise.reject(value) : Promise.resolve(value);

const renderScreen = (locale: "en" | "ar" = "en") =>
  render(
    <LocaleProvider locale={locale}>
      <CommerceDashboard
        scope="platform"
        copy={locale === "ar" ? ar.admin.commerce : c}
        requiredRole="SUPER_ADMIN"
      />
    </LocaleProvider>
  );

beforeEach(() => {
  vi.clearAllMocks();
  get.mockImplementation(() => answer(dashboard()));
});

describe("one figure leads, and three follow", () => {
  it("gives revenue the primary slot and nothing else", async () => {
    // NOT four identical cards. The product register names that shape twice
    // as the thing to avoid, and the reason is that it encodes no decision:
    // every panel the same size because nothing worked out which mattered.
    renderScreen();

    await screen.findByTestId("commerce-figure-primary");

    expect(screen.getAllByTestId("commerce-figure-primary")).toHaveLength(1);
    expect(screen.getAllByTestId("commerce-figure-secondary")).toHaveLength(3);
  });

  it("sets the revenue figure at the size reserved for a balance, and no larger", async () => {
    renderScreen();

    const primary = await screen.findByTestId("commerce-figure-primary");

    expect(primary).toHaveTextContent("14,400.00 EGP");
    expect(primary.querySelector('[data-num=""]')?.className).toContain(
      "text-3xl"
    );
  });

  it("names orders, customers and the average order as the three secondary", async () => {
    renderScreen();

    await screen.findByTestId("commerce-figure-primary");
    const secondary = screen.getAllByTestId("commerce-figure-secondary");

    expect(secondary.map((node) => node.getAttribute("data-key"))).toEqual([
      "orders",
      "customers",
      "aov",
    ]);
    expect(secondary[0]).toHaveTextContent("36");
    expect(secondary[1]).toHaveTextContent("22");
    expect(secondary[2]).toHaveTextContent("400.00 EGP");
  });
});

describe("a sparkline has to earn its place", () => {
  it("draws nothing under the figure when the window barely traded", async () => {
    // Six days with orders is not a shape. A flat line under a number is
    // furniture that looks like information.
    get.mockImplementation(() => answer(dashboard({ trend: trend(30, 6) })));

    renderScreen();

    await screen.findByTestId("commerce-figure-primary");
    expect(screen.queryByLabelText(c.sparkLabel)).toBeNull();
  });

  it("draws once seven days have actually traded", async () => {
    get.mockImplementation(() => answer(dashboard({ trend: trend(30, 7) })));

    renderScreen();

    expect(await screen.findByLabelText(c.sparkLabel)).toBeInTheDocument();
  });
});

describe("a delta needs a baseline worth comparing to", () => {
  it("says so once, quietly, rather than printing +300% off four orders", async () => {
    get.mockImplementation(() =>
      answer(
        dashboard({
          previous: {
            orders: 4,
            revenue: "1600.00",
            customers: 3,
            averageOrderValue: "400.00",
          },
        })
      )
    );

    renderScreen();

    expect(await screen.findByText(c.deltaThin)).toBeInTheDocument();
    expect(document.querySelector("[data-direction]")).toBeNull();
  });

  it("reports the direction in words as well as in colour", async () => {
    renderScreen();

    await screen.findByTestId("commerce-figure-primary");
    const delta = document.querySelector("[data-direction]");

    // 14,400 against 12,000.
    expect(delta?.getAttribute("data-direction")).toBe("up");
    expect(delta?.textContent).toContain("20%");
    expect(delta?.textContent).toContain(c.deltaVs);
    expect(screen.queryByText(c.deltaThin)).toBeNull();
  });
});

describe("empty is a state, and it teaches", () => {
  it("says what will fill the screen rather than drawing a wall of nothing", async () => {
    get.mockImplementation(() => answer(empty));

    renderScreen();

    expect(await screen.findByText(c.emptyTitle)).toBeInTheDocument();
    expect(screen.getByText(c.emptyBody)).toBeInTheDocument();
  });

  it("still renders zero as zero, because zero is an answer", async () => {
    get.mockImplementation(() => answer(empty));

    renderScreen();

    const primary = await screen.findByTestId("commerce-figure-primary");

    expect(primary).toHaveTextContent("0.00 EGP");
  });

  it("refuses to print an average of nothing", async () => {
    // 0 orders does not mean an average of 0. "0.00 EGP" over an empty window
    // reports a collapse where there was no trade.
    get.mockImplementation(() => answer(empty));

    renderScreen();

    await screen.findByTestId("commerce-figure-primary");
    const aov = screen
      .getAllByTestId("commerce-figure-secondary")
      .find((node) => node.getAttribute("data-key") === "aov");

    expect(aov).not.toHaveTextContent("0.00 EGP");
    expect(screen.getByText(c.aovNone)).toBeInTheDocument();
  });

  it("greys the country and says why, rather than drawing an empty box", async () => {
    get.mockImplementation(() => answer(empty));

    renderScreen();

    expect(await screen.findByText(c.mapEmpty)).toBeInTheDocument();
  });
});

describe("the geography", () => {
  it("names every governorate in the reader's language", async () => {
    renderScreen();

    expect(
      await screen.findByLabelText(/^Cairo: 20 orders/)
    ).toBeInTheDocument();
  });

  it("reports the orders it could not place rather than dropping them", async () => {
    get.mockImplementation(() => answer(dashboard({ unmapped: 4 })));

    renderScreen();

    expect(await screen.findByText(/4 orders went to an address/)).toBeInTheDocument();
  });

  it("says the map is where orders went, not where the shops are", async () => {
    renderScreen();

    expect(await screen.findByText(c.mapGap)).toBeInTheDocument();
  });
});

describe("the breakdowns", () => {
  it("states the total the ring divides up, so nothing has to be estimated", async () => {
    renderScreen();

    const total = await screen.findByTestId("commerce-status-total");

    expect(total).toHaveTextContent("36");
    expect(total).toHaveTextContent(c.statusTotal);
  });

  it("names each status in the console's own words", async () => {
    renderScreen();

    expect(await screen.findByText("Delivered")).toBeInTheDocument();
    expect(screen.getByText("Check the shelf")).toBeInTheDocument();
  });

  it("lists what sold, with its quantity and its money", async () => {
    renderScreen();

    expect(await screen.findAllByText("Prayer mat")).not.toHaveLength(0);
    expect(screen.getAllByText("3,600.00 EGP").length).toBeGreaterThan(0);
  });

  it("says nothing sold rather than drawing an empty table", async () => {
    get.mockImplementation(() => answer(empty));

    renderScreen();

    expect(await screen.findByText(c.productsEmpty)).toBeInTheDocument();
  });
});

describe("two series, two tabs — never two lines on one axis", () => {
  it("starts on revenue and switches to orders", async () => {
    // Revenue and a count on one pair of axes need two scales, and a chart
    // with two scales is one whose crossings mean nothing.
    renderScreen();

    expect(
      await screen.findByLabelText(`${c.trendTitle}: ${c.seriesRevenue}`)
    ).toBeInTheDocument();

    /* Radix does not activate a tab on a synthetic click alone. */
    const tab = screen.getByRole("tab", { name: c.seriesOrders });
    fireEvent.mouseDown(tab);
    fireEvent.click(tab);

    expect(
      await screen.findByLabelText(`${c.trendTitle}: ${c.seriesOrders}`)
    ).toBeInTheDocument();
  });
});

describe("the range control", () => {
  it("asks for a Cairo window rather than a browser one", async () => {
    renderScreen();

    await screen.findByTestId("commerce-figure-primary");

    expect(get).toHaveBeenCalledWith(
      expect.anything(),
      "/v1/admin/analytics/dashboard",
      expect.objectContaining({ query: { from: windowStart(30) } })
    );
  });

  it("refetches on a new window", async () => {
    renderScreen();

    await screen.findByTestId("commerce-figure-primary");
    fireEvent.change(screen.getByLabelText(c.rangeLabel), {
      target: { value: "7" },
    });

    await screen.findByTestId("commerce-figure-primary");
    expect(get).toHaveBeenLastCalledWith(
      expect.anything(),
      "/v1/admin/analytics/dashboard",
      expect.objectContaining({ query: { from: windowStart(7) } })
    );
  });
});

describe("the four states, all of them drawn", () => {
  it("draws a skeleton, never a spinner", () => {
    get.mockImplementation(() => new Promise(() => {}));

    const { container } = renderScreen();

    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it("draws the error state with a retry", async () => {
    get.mockImplementation(() =>
      answer(new ApiError(500, "boom", "InternalServerError"))
    );

    renderScreen();

    expect(await screen.findByText(c.errorTitle)).toBeInTheDocument();
    expect(screen.getByText(c.retry)).toBeInTheDocument();
  });

  it("draws denied on a 403 and names the role that would have been allowed", async () => {
    get.mockImplementation(() =>
      answer(new ApiError(403, "Forbidden", "Forbidden"))
    );

    renderScreen();

    expect(await screen.findByText(c.deniedTitle)).toBeInTheDocument();
    expect(screen.getByText("SUPER_ADMIN")).toBeInTheDocument();
  });
});

describe("bilingual", () => {
  it("takes its copy from ar.ts and keeps every digit Latin", async () => {
    const { container } = renderScreen("ar");

    await screen.findByTestId("commerce-figure-primary");
    expect(screen.queryByText(c.emptyTitle)).toBeNull();
    expect(container.textContent).not.toMatch(/[٠-٩۰-۹]/);
  });

  it("names the governorates in Arabic", async () => {
    renderScreen("ar");

    expect(await screen.findByLabelText(/^القاهرة: 20/)).toBeInTheDocument();
  });
});

describe("what this screen is banned from being", () => {
  const source = () =>
    readFile(
      join(process.cwd(), "src/app/(admin)/admin/analytics/commerce-dashboard.tsx"),
      "utf8"
    );

  it("carries no gradient and no glass", async () => {
    const code = await source();

    expect(code).not.toMatch(/gradient/i);
    expect(code).not.toMatch(/backdrop-blur|bg-white\/|bg-black\//);
  });

  it("sets no figure larger than the signed balance", async () => {
    const code = await source();

    expect(code).not.toMatch(/\btext-(4|5|6|7|8|9)xl\b/);
  });

  it("names no colour that is not a token", async () => {
    const code = await source();

    expect(code).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(code).not.toMatch(
      /\b(bg|text|border)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d/
    );
  });
});

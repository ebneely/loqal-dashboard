import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { en } from "@/messages/en";
import { LocaleProvider } from "@/lib/locale-context";

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
const { AnalyticsScreen } = await import("../analytics-screen");
const { formatBps, platformOverviewSchema, viewsToCheckoutBps } = await import(
  "../analytics-data"
);
const { commerceDashboardSchema } = await import("../commerce-data");
const { ar } = await import("@/messages/ar");

const overview = platformOverviewSchema.parse({
  totalEvents: 12400,
  totalVisitors: 3120,
  byType: {
    PRODUCT_VIEW: 8000,
    BRAND_VIEW: 1200,
    SEARCH: 2000,
    SEARCH_ZERO_RESULT: 400,
    CART_ADD: 600,
    CHECKOUT_START: 200,
  },
  topZeroResultSearches: [
    { term: "prayer mat", count: 41 },
    { term: "kids abaya", count: 22 },
  ],
});

/**
 * The commerce dashboard above the separator. Small on purpose: this suite is
 * about the event counters, and `commerce-dashboard.test.tsx` is where that
 * half is argued with. `previous.orders` is under the minimum, so no delta is
 * drawn and no percentage of this fixture can collide with the ratio below.
 */
const commerce = commerceDashboardSchema.parse({
  range: { from: "2026-07-30", to: "2026-08-28" },
  totals: {
    orders: 9,
    revenue: "3600.00",
    customers: 7,
    averageOrderValue: "400.00",
  },
  previous: {
    orders: 2,
    revenue: "800.00",
    customers: 2,
    averageOrderValue: "400.00",
  },
  trend: [{ day: "2026-08-28", orders: 9, revenue: "3600.00" }],
  byStatus: [{ status: "DELIVERED", count: 9 }],
  byGovernorate: [{ code: "CAI", orders: 9, revenue: "3600.00" }],
  topProducts: [{ name: "Prayer mat", qty: 9, revenue: "3600.00" }],
});

const answer = (value: unknown) =>
  value instanceof Error ? Promise.reject(value) : Promise.resolve(value);

/** Two endpoints behind one screen. Answer each by path. */
const routed = (
  overviewAnswer: unknown = overview,
  commerceAnswer: unknown = commerce
) =>
  get.mockImplementation((_schema: unknown, path: string) =>
    answer(path.includes("/dashboard") ? commerceAnswer : overviewAnswer)
  );

const renderScreen = (locale: "en" | "ar" = "en") =>
  render(
    <LocaleProvider locale={locale}>
      <AnalyticsScreen />
    </LocaleProvider>
  );

beforeEach(() => {
  vi.clearAllMocks();
  routed();
});

describe("the analytics response shape, which no contract describes", () => {
  it("accepts a sparse byType, because a type with no events is absent", () => {
    expect(
      platformOverviewSchema.safeParse({
        ...overview,
        byType: { PRODUCT_VIEW: 1 },
      }).success
    ).toBe(true);
  });

  it("accepts an event type nobody has shipped yet rather than refusing the page", () => {
    expect(
      platformOverviewSchema.safeParse({
        ...overview,
        byType: { ...overview.byType, WISHLIST_ADD: 9 },
      }).success
    ).toBe(true);
  });

  it("still refuses a top-level key nobody declared", () => {
    expect(
      platformOverviewSchema.safeParse({ ...overview, gmv: "12000.00" }).success
    ).toBe(false);
  });
});

describe("views-to-checkout is a ratio, not a conversion rate", () => {
  it("computes it in basis points from two event counters", () => {
    expect(viewsToCheckoutBps(overview)).toBe(250);
    expect(formatBps(250)).toBe("2.50%");
  });

  it("answers null when there were no views, because 0/0 is not 0%", () => {
    const empty = platformOverviewSchema.parse({ ...overview, byType: {} });
    expect(viewsToCheckoutBps(empty)).toBeNull();
  });
});

describe("/admin/analytics — what is missing is stated, not invented", () => {
  it("says GMV, orders per brand and conversion are not on this endpoint", async () => {
    renderScreen();

    await screen.findByText(en.admin.gmvMissingTitle);
    expect(screen.getByTestId("gmv-missing")).toHaveTextContent(
      en.admin.gmvMissingBody
    );
  });

  /**
   * THIS ASSERTION WAS "queryByText(/EGP/) IS NULL", AND IT WAS RIGHT.
   *
   * When it was written this screen had exactly one endpoint behind it, that
   * endpoint carried no money, and a money figure here could only have come
   * from inventing one. The constraint was never "analytics may not show
   * revenue" — it was "revenue may not be derived from a response that does
   * not contain it", and it is now met by reading a DIFFERENT endpoint rather
   * than abandoned.
   *
   * So the assertion moves rather than goes: money on this page must trace to
   * the commerce response, and the overview half must still carry none of its
   * own. The second test below is the one that would have caught the original
   * bug, and it still would.
   */
  it("draws money only from the endpoint that has it", async () => {
    renderScreen();

    await screen.findByText(en.admin.gmvMissingTitle);
    expect(screen.getAllByText(/3,600\.00 EGP/).length).toBeGreaterThan(0);
  });

  it("draws no money at all when only the overview answers", async () => {
    routed(overview, new ApiError(500, "boom", "InternalServerError"));

    renderScreen();

    await screen.findByText(en.admin.gmvMissingTitle);
    expect(screen.queryByText(/EGP/)).toBeNull();
  });

  it("labels the ratio as a ratio and never as conversion", async () => {
    renderScreen();

    await screen.findByText(en.admin.gmvMissingTitle);
    expect(screen.getByText("2.50%")).toBeInTheDocument();
    expect(screen.getByText(en.admin.viewsToCheckoutNote)).toBeInTheDocument();
  });

  it("says the response is not in the contract package", async () => {
    renderScreen();

    expect(
      await screen.findByText(en.admin.analyticsShapeGap)
    ).toBeInTheDocument();
  });
});

describe("/admin/analytics — the two figures cover different periods", () => {
  it("marks events as the window and visitors as all time", async () => {
    // They are not a matched pair, and the larger one is the one that gets
    // quoted out loud.
    renderScreen();

    await screen.findByText(en.admin.gmvMissingTitle);
    expect(screen.getByText(en.admin.visitorsAllTime)).toBeInTheDocument();
    expect(screen.getAllByText(en.admin.last30).length).toBeGreaterThan(1);
  });
});

describe("/admin/analytics — zero-result searches", () => {
  it("lists what shoppers asked for and Loqal could not answer", async () => {
    renderScreen();

    expect(await screen.findAllByText("prayer mat")).not.toHaveLength(0);
    expect(screen.getAllByText("41").length).toBeGreaterThan(0);
  });

  it("says so when nothing came back empty, rather than drawing an empty table", async () => {
    routed({ ...overview, topZeroResultSearches: [] });

    renderScreen();

    expect(await screen.findByText(en.admin.zeroEmpty)).toBeInTheDocument();
  });
});

describe("/admin/analytics — states", () => {
  it("draws the loading skeleton", () => {
    get.mockImplementation(() => new Promise(() => {}));

    const { container } = renderScreen();

    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it("draws denied on a 403 and names the role", async () => {
    get.mockImplementation(() =>
      answer(new ApiError(403, "Forbidden", "Forbidden"))
    );

    renderScreen();

    expect(await screen.findByText(en.admin.deniedTitle)).toBeInTheDocument();
    // Two sections, two grants, two refusals — each naming the role it wanted
    // rather than one of them silently rendering nothing.
    expect(screen.getByText(en.admin.commerce.deniedTitle)).toBeInTheDocument();
    expect(screen.getAllByText("SUPER_ADMIN").length).toBe(2);
  });

  it("draws the error state with a retry", async () => {
    get.mockImplementation(() =>
      answer(new ApiError(500, "boom", "InternalServerError"))
    );

    renderScreen();

    expect(await screen.findByText(en.admin.errorTitle)).toBeInTheDocument();
  });
});

describe("/admin/analytics — bilingual", () => {
  it("takes its copy from ar.ts under the Arabic locale", async () => {
    renderScreen("ar");

    expect(
      await screen.findByText(ar.admin.gmvMissingTitle)
    ).toBeInTheDocument();
    expect(screen.queryByText(en.admin.gmvMissingTitle)).toBeNull();
  });
});

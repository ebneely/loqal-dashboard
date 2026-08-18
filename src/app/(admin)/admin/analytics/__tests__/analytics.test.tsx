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

const answer = (value: unknown) =>
  value instanceof Error ? Promise.reject(value) : Promise.resolve(value);

const renderScreen = (locale: "en" | "ar" = "en") =>
  render(
    <LocaleProvider locale={locale}>
      <AnalyticsScreen />
    </LocaleProvider>
  );

beforeEach(() => {
  vi.clearAllMocks();
  get.mockImplementation(() => answer(overview));
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

  it("draws no money figure anywhere, because the response carries none", async () => {
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
    get.mockImplementation(() =>
      answer({ ...overview, topZeroResultSearches: [] })
    );

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
    expect(screen.getByText("SUPER_ADMIN")).toBeInTheDocument();
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

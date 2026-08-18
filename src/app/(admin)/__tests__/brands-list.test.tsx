import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { adminBrandPageSchema } from "@loqal/contracts/brand.contract";
import { en } from "@/messages/en";
import { LocaleProvider } from "@/lib/locale-context";

import {
  brandOwedMoney,
  brandOwingMoney,
  brandsPage,
  brandsPageWithCursor,
  brandsPageWithoutPlacement,
  emptyBrandsPage,
} from "./fixtures";

const replace = vi.fn();
let search = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn() }),
  usePathname: () => "/admin/brands",
  useSearchParams: () => search,
}));

const get = vi.fn();
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, api: { ...actual.api, get } };
});

const { ApiError } = await import("@/lib/api");
const { BrandsScreen } = await import("../admin/brands/brands-screen");
const { adminBrandRowPageSchema } = await import("../admin/brands/brands-data");
const { ar } = await import("@/messages/ar");

const answer = (value: unknown) =>
  value instanceof Error ? Promise.reject(value) : Promise.resolve(value);

const renderScreen = (locale: "en" | "ar" = "en") =>
  render(
    <LocaleProvider locale={locale}>
      <BrandsScreen />
    </LocaleProvider>
  );

beforeEach(() => {
  vi.clearAllMocks();
  search = new URLSearchParams();
  get.mockImplementation(() => answer(brandsPage));
});

describe("/admin/brands fixtures match the shipped contract", () => {
  it("parses a placement-free page with the contract's own schema", () => {
    // The extension is ADDITIVE. What the endpoint sends today still parses
    // against `adminBrandPageSchema` unchanged.
    expect(
      adminBrandPageSchema.safeParse(brandsPageWithoutPlacement).success
    ).toBe(true);
  });

  it("accepts placement fields the day the backend adds them", () => {
    expect(adminBrandRowPageSchema.safeParse(brandsPage).success).toBe(true);
    expect(
      adminBrandRowPageSchema.safeParse(brandsPageWithoutPlacement).success
    ).toBe(true);
  });

  it("still refuses a key nobody declared", () => {
    const drifted = {
      items: [{ ...brandOwedMoney, secretMargin: "0.4" }],
      nextCursor: null,
    };
    expect(adminBrandRowPageSchema.safeParse(drifted).success).toBe(false);
  });
});

describe("/admin/brands — paid placement is labelled", () => {
  it("labels a promoted brand as promoted, whatever the ordering", async () => {
    const { container } = renderScreen();

    await screen.findAllByText(brandOwedMoney.name);
    expect(screen.getAllByText(en.admin.promotedLabel).length).toBeGreaterThan(0);
    expect(
      container.querySelectorAll('[data-promoted="true"]').length
    ).toBeGreaterThan(0);
    // And the un-promoted one is not labelled by accident.
    expect(screen.getAllByText(en.admin.notPromoted).length).toBeGreaterThan(0);
  });

  it("shows the disclosure the moment the list is ranked by placement", async () => {
    search = new URLSearchParams("sort=placement");

    renderScreen();

    await screen.findAllByText(brandOwedMoney.name);
    expect(
      await screen.findByTestId("placement-disclosure")
    ).toHaveTextContent(en.admin.placementOrderBanner);
  });

  it("shows no disclosure when the ordering reads nothing anybody paid for", async () => {
    renderScreen();

    await screen.findAllByText(brandOwedMoney.name);
    expect(screen.queryByTestId("placement-disclosure")).toBeNull();
  });

  it("refuses to rank by placement when the endpoint sends no placement", async () => {
    // Sorting every row into `false` and calling the result "the storefront's
    // order" would be a guess presented as a fact.
    search = new URLSearchParams("sort=placement");
    get.mockImplementation(() => answer(brandsPageWithoutPlacement));

    renderScreen();

    await screen.findAllByText(brandOwedMoney.name);
    expect(
      screen.getByText(en.admin.placementSortUnavailable)
    ).toBeInTheDocument();
    expect(screen.queryByTestId("placement-disclosure")).toBeNull();
    // And the row says the field is missing rather than claiming "not promoted".
    expect(screen.getAllByText(en.admin.placementUnknown).length).toBeGreaterThan(
      0
    );
    expect(screen.queryByText(en.admin.notPromoted)).toBeNull();
  });

  it("always carries the rule in words beneath the list", async () => {
    renderScreen();

    await screen.findAllByText(brandOwedMoney.name);
    expect(screen.getAllByText(en.admin.promotedRule).length).toBeGreaterThan(0);
  });
});

describe("/admin/brands — the signed balance names the party", () => {
  it("names Loqal as the debtor when the balance is positive", async () => {
    const { container } = renderScreen();

    await screen.findAllByText(brandOwedMoney.name);
    const owed = container.querySelector(
      '[data-direction="LOQAL_OWES_BRAND"]'
    );
    expect(owed).not.toBeNull();
    expect(owed?.getAttribute("aria-label")).toContain("Loqal owes this brand");
  });

  it("names the brand as the debtor when the balance is negative", async () => {
    const { container } = renderScreen();

    await screen.findAllByText(brandOwingMoney.name);
    const owes = container.querySelector(
      '[data-direction="BRAND_OWES_LOQAL"]'
    );
    expect(owes).not.toBeNull();
    expect(owes?.getAttribute("aria-label")).toContain("This brand owes Loqal");
  });

  it("names both parties in Arabic too, and keeps the digits Latin", async () => {
    const { container } = renderScreen("ar");

    await screen.findAllByText(brandOwedMoney.name);
    const owed = container.querySelector('[data-direction="LOQAL_OWES_BRAND"]');
    const owes = container.querySelector('[data-direction="BRAND_OWES_LOQAL"]');

    expect(owed?.getAttribute("aria-label")).toContain(
      "لوكال مستحق عليها لهذه العلامة"
    );
    expect(owes?.getAttribute("aria-label")).toContain(
      "هذه العلامة مستحق عليها للوكال"
    );
    expect(owed?.getAttribute("aria-label")).toContain("1,240.00");
  });

  it("says what gross sales excludes, because shipping is never Loqal's money", async () => {
    renderScreen();

    await screen.findAllByText(brandOwedMoney.name);
    expect(screen.getByText(en.admin.grossSalesNote)).toBeInTheDocument();
    expect(screen.getAllByText("48,200.00 EGP").length).toBeGreaterThan(0);
  });
});

describe("/admin/brands — navigation and filters", () => {
  it("gives every row its own address", async () => {
    renderScreen();

    const links = await screen.findAllByRole("link", {
      name: brandOwedMoney.name,
    });
    expect(links[0]).toHaveAttribute(
      "href",
      `/admin/brands/${brandOwedMoney.id}`
    );
  });

  it("sends status and search to the endpoint rather than filtering here", async () => {
    search = new URLSearchParams("status=SUSPENDED&q=candles");

    renderScreen();

    await waitFor(() => expect(get).toHaveBeenCalled());
    const [, path, options] = get.mock.calls[0] as [
      unknown,
      string,
      { query?: Record<string, unknown> },
    ];
    expect(path).toBe("/v1/admin/brands");
    expect(options.query?.status).toBe("SUSPENDED");
    expect(options.query?.search).toBe("candles");
  });

  it("ignores a status the enum has never heard of", async () => {
    search = new URLSearchParams("status=PUBLISHED");

    renderScreen();

    await waitFor(() => expect(get).toHaveBeenCalled());
    const [, , options] = get.mock.calls[0] as [
      unknown,
      string,
      { query?: Record<string, unknown> },
    ];
    expect(options.query?.status).toBeUndefined();
  });
});

describe("/admin/brands — a later page failing keeps the rows on screen", () => {
  it("draws an inline retry rather than throwing the list away", async () => {
    // useCursorFeed deliberately keeps rows when a LATER page fails, and every
    // list screen so far discarded them by returning a full-page error.
    get.mockImplementationOnce(() => answer(brandsPageWithCursor));
    get.mockImplementationOnce(() =>
      answer(new ApiError(500, "boom", "InternalServerError"))
    );

    renderScreen();

    const more = await screen.findByRole("button", { name: en.admin.loadMore });
    fireEvent.click(more);

    expect(await screen.findByTestId("brands-inline-error")).toHaveTextContent(
      en.admin.pageFailedBody
    );
    // The rows are still there.
    expect(screen.getAllByText(brandOwedMoney.name).length).toBeGreaterThan(0);
    expect(screen.getAllByText(brandOwingMoney.name).length).toBeGreaterThan(0);
    // And the full-page panel was not drawn over them.
    expect(screen.queryByText(en.admin.errorTitle)).toBeNull();
  });
});

describe("/admin/brands — the four list states", () => {
  it("draws the loading skeleton while the first page is in flight", () => {
    get.mockImplementation(() => new Promise(() => {}));

    const { container } = renderScreen();

    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it("draws the empty state when nothing matches", async () => {
    get.mockImplementation(() => answer(emptyBrandsPage));

    renderScreen();

    expect(
      await screen.findByText(en.admin.brandsEmptyTitle)
    ).toBeInTheDocument();
  });

  it("draws the error state with a retry when the FIRST page fails", async () => {
    get.mockImplementation(() =>
      answer(new ApiError(500, "boom", "InternalServerError"))
    );

    renderScreen();

    expect(await screen.findByText(en.admin.errorTitle)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: en.admin.retry })
    ).toBeInTheDocument();
  });

  it("draws the denied state, with no retry, on a 403", async () => {
    get.mockImplementation(() =>
      answer(new ApiError(403, "Forbidden", "Forbidden"))
    );

    renderScreen();

    expect(await screen.findByText(en.admin.deniedTitle)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: en.admin.retry })).toBeNull();
    expect(screen.getByText("SUPER_ADMIN")).toBeInTheDocument();
  });
});

describe("/admin/brands — bilingual", () => {
  it("takes its copy from ar.ts under the Arabic locale", async () => {
    renderScreen("ar");

    await screen.findAllByText(brandOwedMoney.name);
    expect(screen.getAllByText(ar.admin.promotedLabel).length).toBeGreaterThan(0);
    expect(screen.getByText(ar.admin.grossSalesNote)).toBeInTheDocument();
    expect(screen.queryByText(en.admin.grossSalesNote)).toBeNull();
  });
});

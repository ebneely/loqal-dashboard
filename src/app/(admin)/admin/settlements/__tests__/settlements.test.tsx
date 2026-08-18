import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { en } from "@/messages/en";
import { LocaleProvider } from "@/lib/locale-context";

import {
  emptyRunsPage,
  owedRun,
  owingRun,
  runsPage,
  runsPageWithCursor,
} from "./fixtures";

const replace = vi.fn();
let search = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn() }),
  usePathname: () => "/admin/settlements",
  useSearchParams: () => search,
}));

const get = vi.fn();
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, api: { ...actual.api, get } };
});

const { ApiError } = await import("@/lib/api");
const { SettlementsScreen } = await import("../settlements-screen");
const { ar } = await import("@/messages/ar");

const answer = (value: unknown) =>
  value instanceof Error ? Promise.reject(value) : Promise.resolve(value);

const renderScreen = (locale: "en" | "ar" = "en") =>
  render(
    <LocaleProvider locale={locale}>
      <SettlementsScreen />
    </LocaleProvider>
  );

beforeEach(() => {
  vi.clearAllMocks();
  search = new URLSearchParams();
  get.mockImplementation(() => answer(runsPage));
});

describe("/admin/settlements — nothing moves money from a list", () => {
  it("draws no marking button anywhere on the list", async () => {
    // Marking writes a closing ledger entry and cannot be undone. It belongs
    // beside the evidence, on the detail screen, and nowhere else.
    renderScreen();

    await screen.findAllByText(owedRun.brandName);
    expect(screen.queryByRole("button", { name: en.admin.markSent })).toBeNull();
    expect(
      screen.queryByRole("button", { name: en.admin.markReceived })
    ).toBeNull();
    expect(screen.queryByRole("button", { name: en.admin.cancelRun })).toBeNull();
  });

  it("says up front that a human marks every run", async () => {
    renderScreen();

    await screen.findAllByText(owedRun.brandName);
    expect(screen.getByText(en.admin.nothingAutomatic)).toBeInTheDocument();
  });

  it("gives every run its own address, which is where the buttons live", async () => {
    renderScreen();

    const links = await screen.findAllByRole("link", {
      name: owedRun.brandName,
    });
    expect(links[0]).toHaveAttribute(
      "href",
      `/admin/settlements/${owedRun.id}`
    );
  });
});

describe("/admin/settlements — the signed figure names the party", () => {
  it("names Loqal as the debtor on a positive run", async () => {
    const { container } = renderScreen();

    await screen.findAllByText(owedRun.brandName);
    const owed = container.querySelector('[data-direction="LOQAL_OWES_BRAND"]');
    expect(owed?.getAttribute("aria-label")).toContain("Loqal owes this brand");
  });

  it("names the brand as the debtor on a negative run", async () => {
    const { container } = renderScreen();

    await screen.findAllByText(owingRun.brandName);
    const owes = container.querySelector('[data-direction="BRAND_OWES_LOQAL"]');
    expect(owes?.getAttribute("aria-label")).toContain("This brand owes Loqal");
  });

  it("shows the API's own direction beside the sign, not instead of it", async () => {
    // The sign is derived from the balance and the direction is what the API
    // decided. When those disagree, an admin needs both rather than a merge.
    const { container } = renderScreen();

    await screen.findAllByText(owedRun.brandName);
    expect(
      container.querySelector('[data-direction-decision="WE_PAY"]')
    ).not.toBeNull();
    expect(
      container.querySelector('[data-direction-decision="THEY_PAY"]')
    ).not.toBeNull();
  });
});

describe("/admin/settlements — filters are the endpoint's own", () => {
  it("sends status and brandId to the endpoint", async () => {
    search = new URLSearchParams(
      "status=PENDING&brandId=0199dddd-0000-7000-8000-000000000001"
    );

    renderScreen();

    await waitFor(() => expect(get).toHaveBeenCalled());
    const [, path, options] = get.mock.calls[0] as [
      unknown,
      string,
      { query?: Record<string, unknown> },
    ];
    expect(path).toBe("/v1/admin/settlement-runs");
    expect(options.query?.status).toBe("PENDING");
    expect(options.query?.brandId).toBe(
      "0199dddd-0000-7000-8000-000000000001"
    );
  });

  it("ignores a status the enum has never heard of", async () => {
    search = new URLSearchParams("status=PAID");

    renderScreen();

    await waitFor(() => expect(get).toHaveBeenCalled());
    const [, , options] = get.mock.calls[0] as [
      unknown,
      string,
      { query?: Record<string, unknown> },
    ];
    expect(options.query?.status).toBeUndefined();
  });

  it("says in words that this list filters by id and not by name", async () => {
    // Filtering by name in the browser would only search the page already
    // downloaded, which on a cursor-paged list is a lie about what was searched.
    renderScreen();

    await screen.findAllByText(owedRun.brandName);
    expect(screen.getByText(en.admin.brandFilterGap)).toBeInTheDocument();
  });
});

describe("/admin/settlements — a later page failing keeps the rows on screen", () => {
  it("draws an inline retry rather than throwing the list away", async () => {
    get.mockImplementationOnce(() => answer(runsPageWithCursor));
    get.mockImplementationOnce(() =>
      answer(new ApiError(500, "boom", "InternalServerError"))
    );

    renderScreen();

    const more = await screen.findByRole("button", { name: en.admin.loadMore });
    fireEvent.click(more);

    expect(
      await screen.findByTestId("settlements-inline-error")
    ).toHaveTextContent(en.admin.pageFailedBody);
    expect(screen.getAllByText(owedRun.brandName).length).toBeGreaterThan(0);
    expect(screen.queryByText(en.admin.errorTitle)).toBeNull();
  });
});

describe("/admin/settlements — the four list states", () => {
  it("draws the loading skeleton while the first page is in flight", () => {
    get.mockImplementation(() => new Promise(() => {}));

    const { container } = renderScreen();

    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it("draws the empty state when no run has been raised", async () => {
    get.mockImplementation(() => answer(emptyRunsPage));

    renderScreen();

    expect(
      await screen.findByText(en.admin.settlementsEmptyTitle)
    ).toBeInTheDocument();
  });

  it("draws the error state with a retry when the FIRST page fails", async () => {
    get.mockImplementation(() =>
      answer(new ApiError(500, "boom", "InternalServerError"))
    );

    renderScreen();

    expect(await screen.findByText(en.admin.errorTitle)).toBeInTheDocument();
  });

  it("draws the denied state, with no retry, on a 403", async () => {
    get.mockImplementation(() =>
      answer(new ApiError(403, "Forbidden", "Forbidden"))
    );

    renderScreen();

    expect(await screen.findByText(en.admin.deniedTitle)).toBeInTheDocument();
    expect(screen.getByText("SUPER_ADMIN")).toBeInTheDocument();
  });
});

describe("/admin/settlements — bilingual", () => {
  it("takes its copy from ar.ts and names both parties in Arabic", async () => {
    const { container } = renderScreen("ar");

    await screen.findAllByText(owedRun.brandName);
    expect(screen.getByText(ar.admin.settlementsNote)).toBeInTheDocument();
    expect(
      container
        .querySelector('[data-direction="LOQAL_OWES_BRAND"]')
        ?.getAttribute("aria-label")
    ).toContain("لوكال مستحق عليها لهذه العلامة");
  });
});

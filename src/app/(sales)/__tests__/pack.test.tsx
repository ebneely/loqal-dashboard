/**
 * /pack — the one screen whose output is spoken to somebody who cannot see it.
 *
 * The two properties worth a test suite: every figure carries its own period,
 * and "withheld" is never rendered as "nothing measured".
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { LocaleProvider } from "@/lib/locale-context";
import { en } from "@/messages/en";
import { ar } from "@/messages/ar";

import {
  flatCategories,
  notMeasuredPack,
  reportedPack,
  withheldPack,
} from "./fixtures";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/pack",
  useSearchParams: () => new URLSearchParams(),
}));

const get = vi.fn();
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, api: { ...actual.api, get } };
});

const { ApiError } = await import("@/lib/api");
const { PackScreen } = await import("../sales/pack/pack-screen");

const s = en.sales;

/** The screen makes two different calls; answer each by path. */
const routeGet = (pack: unknown) =>
  get.mockImplementation((_schema: unknown, path: string) =>
    path === "/v1/categories"
      ? Promise.resolve(flatCategories)
      : pack instanceof Error
        ? Promise.reject(pack)
        : Promise.resolve(pack)
  );

const renderScreen = (locale: "en" | "ar" = "en") =>
  render(
    <LocaleProvider locale={locale}>
      <PackScreen />
    </LocaleProvider>
  );

const chooseHome = async () => {
  fireEvent.change(await screen.findByLabelText(s.chooseCategory), {
    target: { value: "home" },
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  routeGet(reportedPack);
});

describe("choosing a category", () => {
  it("reads the only category list a rep can reach", async () => {
    renderScreen();

    await waitFor(() => expect(get).toHaveBeenCalled());
    expect(get.mock.calls[0][1]).toBe("/v1/categories");
  });

  it("asks for nothing until a category is chosen", async () => {
    renderScreen();

    expect(await screen.findByText(s.categoryEmptyTitle)).toBeInTheDocument();
    expect(
      get.mock.calls.map((call) => call[1] as string)
    ).not.toContain("/v1/sales/pack");
  });

  it("passes the slug as the query the API's strict DTO expects", async () => {
    renderScreen();
    await chooseHome();

    await waitFor(() =>
      expect(
        get.mock.calls.some((call) => call[1] === "/v1/sales/pack")
      ).toBe(true)
    );
    const call = get.mock.calls.find((c) => c[1] === "/v1/sales/pack");
    expect((call?.[2] as { query: Record<string, string> }).query).toEqual({
      category: "home",
    });
  });

  /**
   * A category whose JSON `name` column is `{}` renders as an empty option a
   * rep cannot tell from any other, and picking the wrong one puts the wrong
   * market's numbers in front of a shop owner.
   */
  it("drops a category with no usable name rather than offering a blank option", async () => {
    renderScreen();

    await screen.findByLabelText(s.chooseCategory);
    expect(screen.getByRole("option", { name: "Home" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "unnamed" })).toBeNull();
  });

  it("says so when the taxonomy comes back empty", async () => {
    get.mockImplementation(() => Promise.resolve([]));

    renderScreen();

    expect(await screen.findByText(s.categoryNoneTitle)).toBeInTheDocument();
  });
});

describe("every figure carries its own period", () => {
  /**
   * BACKEND BUG. `totalEvents` is windowed to 30 days; `totalVisitors` is
   * `countAll()` — all time. Two differently-scoped numbers printed side by side
   * read as one proof, and the inflated one is what gets quoted out loud.
   */
  it("labels the two traffic figures with different periods", async () => {
    renderScreen();
    await chooseHome();

    await screen.findByTestId("sales-pack");
    expect(screen.getByText(s.last30)).toBeInTheDocument();
    expect(screen.getByText(s.allTime)).toBeInTheDocument();
  });

  it("says in a sentence that the two are not a matched pair", async () => {
    renderScreen();
    await chooseHome();

    expect(await screen.findByTestId("pack-scope-warning")).toBeInTheDocument();
    expect(screen.getByText(s.scopeWarnBody)).toBeInTheDocument();
  });

  /**
   * The response carries no `generatedAt`. `new Date()` here would be the
   * moment this tab opened — the stale-screenshot problem wearing a timestamp.
   */
  it("warns that the pack has no timestamp rather than inventing one", async () => {
    renderScreen();
    await chooseHome();

    expect(await screen.findByTestId("pack-no-as-of")).toBeInTheDocument();
    expect(screen.getByText(s.noAsOfBody)).toBeInTheDocument();
    expect(screen.queryByText(s.asOfLabel)).toBeNull();
  });

  it("prints the timestamp and drops the warning the day the API sends one", async () => {
    routeGet({ ...reportedPack, generatedAt: "2026-08-17T09:00:00.000Z" });

    renderScreen();
    await chooseHome();

    expect(await screen.findByText("2026-08-17")).toBeInTheDocument();
    expect(screen.queryByTestId("pack-no-as-of")).toBeNull();
  });
});

describe("withheld is not the same claim as nothing measured", () => {
  it("draws a deliberate blocked panel below the k-anonymity floor", async () => {
    routeGet(withheldPack);

    renderScreen();
    await chooseHome();

    const panel = await screen.findByTestId("comparison-withheld");
    expect(panel).toHaveAttribute("data-reason", "K_ANONYMITY");
    expect(screen.getByText(s.blockedTitle)).toBeInTheDocument();
    // And it turns the refusal into a selling point rather than an apology.
    expect(screen.getByText(s.blockedReassure)).toBeInTheDocument();
  });

  it("never renders a withheld figure as a zero or a dash", async () => {
    routeGet(withheldPack);

    renderScreen();
    await chooseHome();

    await screen.findByTestId("comparison-withheld");
    expect(screen.queryByTestId("comparison-reported")).toBeNull();
    expect(screen.queryByText(s.medianLabel)).toBeNull();
  });

  /**
   * Enough brands to report, and none has recorded a month of orders. An
   * absence of data, not a figure being held back — and a rep must not read the
   * second as the first in front of a prospect.
   */
  it("says nothing has been measured when the median is null", async () => {
    routeGet(notMeasuredPack);

    renderScreen();
    await chooseHome();

    expect(
      await screen.findByTestId("comparison-not-measured")
    ).toBeInTheDocument();
    expect(screen.getByText(s.notMeasuredBody)).toBeInTheDocument();
    expect(screen.queryByTestId("comparison-withheld")).toBeNull();
  });

  it("reports the median with the sample size, and names no shop", async () => {
    renderScreen();
    await chooseHome();

    const card = await screen.findByTestId("comparison-reported");
    expect(card).toHaveTextContent("42");
    expect(
      screen.getByText(s.comparisonWith.replace("{n}", "9"))
    ).toBeInTheDocument();
  });
});

describe("failures", () => {
  it("draws the denied panel and names the role on a 403", async () => {
    get.mockImplementation(() =>
      Promise.reject(
        new ApiError(403, "Your role cannot perform this action", "Forbidden")
      )
    );

    renderScreen();

    expect(await screen.findByText(s.deniedTitle)).toBeInTheDocument();
    expect(screen.getByText("SALES")).toBeInTheDocument();
  });

  it("offers a retry when the pack itself fails", async () => {
    routeGet(new ApiError(500, "boom", "InternalServerError"));

    renderScreen();
    await chooseHome();

    expect(await screen.findByText(s.errorTitle)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: s.retry })).toBeInTheDocument();
  });
});

describe("Arabic", () => {
  it("draws the withheld panel in Arabic", async () => {
    routeGet(withheldPack);

    renderScreen("ar");

    fireEvent.change(await screen.findByLabelText(ar.sales.chooseCategory), {
      target: { value: "home" },
    });

    expect(await screen.findByText(ar.sales.blockedTitle)).toBeInTheDocument();
    expect(screen.queryByText(s.blockedTitle)).toBeNull();
  });

  it("names the categories in Arabic", async () => {
    renderScreen("ar");

    expect(
      await screen.findByRole("option", { name: "المنزل" })
    ).toBeInTheDocument();
  });

  it("keeps every figure in Latin digits", async () => {
    /**
     * This screen is read ALOUD to a shop owner off a phone at arm's length,
     * and it was formatting with `ar-EG` — ٣٨٠٬٠٠٠ into Source Code Pro,
     * which carries no Arabic glyph and falls back mid-number.
     */
    const { container } = renderScreen("ar");

    fireEvent.change(await screen.findByLabelText(ar.sales.chooseCategory), {
      target: { value: "home" },
    });

    expect(await screen.findByText("380,000")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/[٠-٩۰-۹]/);
  });
});

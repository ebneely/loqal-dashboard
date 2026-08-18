import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { en } from "@/messages/en";
import { LocaleProvider } from "@/lib/locale-context";

import {
  NOW,
  decidedPage,
  emptyReturnsPage,
  pageWithCursor,
  returnsPage,
  undecidedPage,
} from "./fixtures";

const replace = vi.fn();
let search = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn() }),
  usePathname: () => "/returns",
  useSearchParams: () => search,
}));

const get = vi.fn();
const post = vi.fn();
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, api: { ...actual.api, get, post } };
});

const { ApiError } = await import("@/lib/api");
const { ReturnsScreen } = await import("../returns-screen");
const { ar } = await import("@/messages/ar");

const answer = (value: unknown) =>
  value instanceof Error ? Promise.reject(value) : Promise.resolve(value);

const renderReturns = (locale: "en" | "ar" = "en") =>
  render(
    <LocaleProvider locale={locale}>
      <ReturnsScreen />
    </LocaleProvider>
  );

/**
 * Reset in beforeEach, not afterEach. This file's own `afterEach` runs BEFORE
 * the setup file's `cleanup`, so a reset there leaves a component that is still
 * unmounting holding a mock that answers `undefined`.
 */
beforeEach(() => {
  vi.restoreAllMocks();
  get.mockReset();
  post.mockReset();
  replace.mockReset();
  vi.spyOn(Date, "now").mockReturnValue(NOW.getTime());
  search = new URLSearchParams();
  get.mockImplementation(() => answer(returnsPage));
  post.mockImplementation(() => answer({}));
});

describe("/returns — a route nobody has chosen is not rendered as one", () => {
  it("leads with the returns still waiting on a decision", async () => {
    renderReturns();

    await screen.findByTestId("returns-undecided");
    const sections = screen
      .getAllByRole("region")
      .map((node) => node.getAttribute("data-testid"))
      .filter(Boolean);

    expect(sections).toEqual([
      "returns-undecided",
      "returns-walk-in",
      "returns-courier",
    ]);
  });

  it("keeps an undecided row out of both route sections", async () => {
    renderReturns();

    const undecided = await screen.findByTestId("returns-undecided");
    const walkIn = screen.getByTestId("returns-walk-in");
    const courier = screen.getByTestId("returns-courier");

    expect(within(undecided).getAllByText("#2044").length).toBeGreaterThan(0);
    expect(within(walkIn).queryByText("#2044")).toBeNull();
    expect(within(courier).queryByText("#2044")).toBeNull();
  });

  it("says out loud that approving is where the route gets chosen", async () => {
    renderReturns();

    const undecided = await screen.findByTestId("returns-undecided");
    expect(
      within(undecided).getByText(en.brand.returnUndecidedNote)
    ).toBeInTheDocument();
  });
});

describe("/returns — WALK_IN leads", () => {
  it("renders the walk-in section before the courier one", async () => {
    renderReturns();

    await screen.findByTestId("returns-walk-in");
    const sections = screen
      .getAllByRole("region")
      .map((node) => node.getAttribute("data-testid"))
      .filter(Boolean);

    expect(sections.indexOf("returns-walk-in")).toBeLessThan(
      sections.indexOf("returns-courier")
    );
  });

  it("says why a walk-in is the better outcome, in words", async () => {
    renderReturns();

    const walkIn = await screen.findByTestId("returns-walk-in");
    // The heading titles the card and captions the table under it.
    expect(within(walkIn).getAllByText(en.brand.returnWalkIn).length).toBeGreaterThan(0);
    expect(within(walkIn).getByText(en.brand.returnWalkInNote)).toBeInTheDocument();
  });

  it("keeps each route's rows in its own section", async () => {
    renderReturns();

    const walkIn = await screen.findByTestId("returns-walk-in");
    const courier = screen.getByTestId("returns-courier");

    expect(within(walkIn).getAllByText("#2042").length).toBeGreaterThan(0);
    expect(within(walkIn).getAllByText("#2043").length).toBeGreaterThan(0);
    expect(within(walkIn).queryByText("#2041")).toBeNull();
    expect(within(courier).getAllByText("#2041").length).toBeGreaterThan(0);
  });
});

describe("/returns — a row opens the order it came out of", () => {
  it("links the order number to its brand order, rather than printing it inert", async () => {
    renderReturns();

    await screen.findByTestId("returns-undecided");
    const links = await screen.findAllByRole("link", { name: "#2044" });
    expect(links.length).toBeGreaterThan(0);
    expect(links[0]).toHaveAttribute(
      "href",
      "/orders/0199d100-0000-7000-8000-000000000006"
    );
  });
});

describe("/returns — deciding", () => {
  it("sends the route the brand chose, because approving IS that choice", async () => {
    get.mockImplementation(() => answer(undecidedPage));

    renderReturns();

    await screen.findByTestId("returns-undecided");
    fireEvent.click(screen.getAllByRole("button", { name: en.brand.approveWalkIn })[0]!);

    await waitFor(() => expect(post).toHaveBeenCalled());
    const [, path, body] = post.mock.calls[0] as [unknown, string, unknown];
    expect(path).toBe(
      "/v1/dashboard/returns/0199b100-0000-7000-8000-000000000005/approve"
    );
    // Never `{}` — `approveReturnBodySchema` requires a route and gives it no
    // default, so an empty body is a 400 on the one button that matters.
    expect(body).toEqual({ route: "WALK_IN" });

    // And the list is re-read afterwards, because the decision endpoint answers
    // with a row @loqal/contracts has no schema for — the contract-backed list
    // is what the screen trusts.
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
  });

  it("offers the courier answer as its own button, never as a default", async () => {
    get.mockImplementation(() => answer(undecidedPage));

    renderReturns();

    await screen.findByTestId("returns-undecided");
    fireEvent.click(screen.getAllByRole("button", { name: en.brand.approveCourier })[0]!);

    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(post.mock.calls[0]![2]).toEqual({ route: "COURIER" });

    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
  });

  it("says what approving does before it is pressed", async () => {
    renderReturns();

    await screen.findByTestId("returns-undecided");
    expect(screen.getAllByText(en.brand.approveConsequence).length).toBeGreaterThan(0);
  });

  it("will not reject without a reason — a shopper will ask", async () => {
    get.mockImplementation(() => answer(undecidedPage));

    renderReturns();

    await screen.findByTestId("returns-undecided");
    fireEvent.click(screen.getAllByRole("button", { name: en.brand.reject })[0]!);

    await screen.findByText(en.brand.rejectTitle);
    expect(screen.getByText(en.brand.rejectReasonRequired)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: en.brand.rejectConfirm }));
    await waitFor(() => expect(post).not.toHaveBeenCalled());
  });

  it("sends the reason the shopper is shown", async () => {
    get.mockImplementation(() => answer(undecidedPage));

    renderReturns();

    await screen.findByTestId("returns-undecided");
    fireEvent.click(screen.getAllByRole("button", { name: en.brand.reject })[0]!);

    await screen.findByText(en.brand.rejectTitle);
    fireEvent.change(screen.getByLabelText(en.brand.reason), {
      target: { value: "  Worn, not resellable  " },
    });
    fireEvent.click(screen.getByRole("button", { name: en.brand.rejectConfirm }));

    await waitFor(() => expect(post).toHaveBeenCalled());
    const [, path, body] = post.mock.calls[0] as [unknown, string, unknown];
    expect(path).toMatch(/\/reject$/);
    expect(body).toEqual({ reason: "Worn, not resellable" });

    // Settled inside the test rather than after it: a decision reloads the
    // list, and a fetch left in flight past the teardown is a flaky suite.
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
  });

  it("says what rejecting costs, and it is not a restock", async () => {
    get.mockImplementation(() => answer(undecidedPage));

    renderReturns();

    await screen.findByTestId("returns-undecided");
    fireEvent.click(screen.getAllByRole("button", { name: en.brand.reject })[0]!);

    await screen.findByText(en.brand.rejectTitle);
    expect(screen.getByText(en.brand.conseqNoRestock)).toBeInTheDocument();
    expect(screen.getByText(en.brand.conseqReasonSent)).toBeInTheDocument();
    expect(screen.getByText(en.brand.conseqStaysDelivered)).toBeInTheDocument();
  });

  it("offers no decision on a return that is already decided", async () => {
    get.mockImplementation(() => answer(decidedPage));

    renderReturns();

    await screen.findByTestId("returns-walk-in");
    expect(screen.queryByRole("button", { name: en.brand.approveWalkIn })).toBeNull();
    expect(screen.queryByRole("button", { name: en.brand.approveCourier })).toBeNull();
    expect(screen.queryByRole("button", { name: en.brand.reject })).toBeNull();
  });

  it("says so when a decision does not go through", async () => {
    get.mockImplementation(() => answer(undecidedPage));
    post.mockImplementation(() => answer(new ApiError(409, "decided", "Conflict")));

    renderReturns();

    await screen.findByTestId("returns-undecided");
    fireEvent.click(screen.getAllByRole("button", { name: en.brand.approveWalkIn })[0]!);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      en.brand.returnDecideFailed
    );
  });
});

describe("/returns — a return is per brand order", () => {
  it("says the other shop's half of the basket can stay delivered", async () => {
    renderReturns();

    await screen.findByTestId("returns-walk-in");
    expect(screen.getByText(en.brand.returnNote)).toBeInTheDocument();
  });

  it("renders no parent order figure", async () => {
    const { container } = renderReturns();

    await screen.findByTestId("returns-walk-in");
    expect(container.textContent).not.toMatch(/parentTotal|grandTotal/i);
  });
});

describe("/returns — filter and paging", () => {
  it("offers all four statuses plus an unfiltered option", async () => {
    renderReturns();

    const select = await screen.findByLabelText(en.brand.filterStatus);
    expect(within(select).getAllByRole("option")).toHaveLength(5);
  });

  it("puts the chosen status in the URL", async () => {
    renderReturns();

    const select = await screen.findByLabelText(en.brand.filterStatus);
    fireEvent.change(select, { target: { value: "REQUESTED" } });

    expect(replace).toHaveBeenCalledWith("/returns?status=REQUESTED");
  });

  it("appends the next page rather than replacing the list", async () => {
    get.mockImplementationOnce(() => answer(pageWithCursor));
    get.mockImplementationOnce(() => answer(decidedPage));

    renderReturns();

    const more = await screen.findByRole("button", { name: en.brand.loadMore });
    fireEvent.click(more);

    await waitFor(() =>
      expect(screen.getAllByText("#2039").length).toBeGreaterThan(0)
    );
    expect(screen.getAllByText("#2041").length).toBeGreaterThan(0);
  });
});

describe("/returns — the four list states", () => {
  it("draws the loading skeleton", () => {
    get.mockImplementation(() => new Promise(() => {}));

    const { container } = renderReturns();

    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it("draws the empty state", async () => {
    get.mockImplementation(() => answer(emptyReturnsPage));

    renderReturns();

    expect(await screen.findByText(en.brand.returnsEmptyTitle)).toBeInTheDocument();
    expect(screen.getByText(en.brand.returnsEmptyBody)).toBeInTheDocument();
  });

  it("draws the error state with a retry", async () => {
    get.mockImplementation(() =>
      answer(new ApiError(500, "boom", "InternalServerError"))
    );

    renderReturns();

    expect(await screen.findByText(en.brand.returnsErrorTitle)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: en.brand.retry })).toBeInTheDocument();
  });

  it("draws the denied state, with no retry", async () => {
    get.mockImplementation(() => answer(new ApiError(403, "Forbidden", "Forbidden")));

    renderReturns();

    expect(await screen.findByText(en.brand.brandOnlyTitle)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: en.brand.retry })).toBeNull();
  });
});

describe("/returns — bilingual", () => {
  it("takes its copy from ar.ts under the Arabic locale", async () => {
    renderReturns("ar");

    const walkIn = await screen.findByTestId("returns-walk-in");
    expect(within(walkIn).getByText(ar.brand.returnWalkInNote)).toBeInTheDocument();
    expect(screen.getByText(ar.brand.returnNote)).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: ar.brand.approveWalkIn }).length
    ).toBeGreaterThan(0);
  });

  it("still leads with the undecided section, then the walk-ins, under Arabic", async () => {
    renderReturns("ar");

    await screen.findByTestId("returns-undecided");
    const sections = screen
      .getAllByRole("region")
      .map((node) => node.getAttribute("data-testid"))
      .filter(Boolean);
    expect(sections).toEqual([
      "returns-undecided",
      "returns-walk-in",
      "returns-courier",
    ]);
  });
});

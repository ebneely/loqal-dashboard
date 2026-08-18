import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { brandOrderPageSchema } from "@loqal/contracts/order.contract";
import { en } from "@/messages/en";
import { LocaleProvider } from "@/lib/locale-context";

import {
  NOW,
  emptyOrdersPage,
  ordersPage,
  pageWithCursor,
  pageWithShippingService,
  secondPage,
} from "./fixtures";

const replace = vi.fn();
let search = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn() }),
  usePathname: () => "/orders",
  useSearchParams: () => search,
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
const { OrdersScreen } = await import("../orders-screen");
const { ar } = await import("@/messages/ar");

const answer = (value: unknown) =>
  value instanceof Error ? Promise.reject(value) : Promise.resolve(value);

const renderOrders = (locale: "en" | "ar" = "en") =>
  render(
    <LocaleProvider locale={locale}>
      <OrdersScreen />
    </LocaleProvider>
  );

beforeEach(() => {
  vi.spyOn(Date, "now").mockReturnValue(NOW.getTime());
  search = new URLSearchParams();
  get.mockImplementation(() => answer(ordersPage));
});

afterEach(() => {
  vi.restoreAllMocks();
  get.mockReset();
  replace.mockReset();
});

describe("/orders fixtures match the shipped contract", () => {
  it("parses every page fixture with brandOrderPageSchema", () => {
    for (const page of [
      ordersPage,
      emptyOrdersPage,
      pageWithCursor,
      secondPage,
      pageWithShippingService,
    ]) {
      expect(brandOrderPageSchema.safeParse(page).success).toBe(true);
    }
  });
});

describe("/orders — the list", () => {
  it("shows each order as a link, not a click handler on a card", async () => {
    renderOrders();

    const rows = await screen.findAllByRole("link", { name: /1042/ });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]).toHaveAttribute(
      "href",
      "/orders/0199a000-0000-7000-8000-000000000001"
    );
  });

  /**
   * The whole reason `waitingSince` exists. #1041 was placed AFTER #1042 and
   * has waited far longer, because #1042's clock restarted on a payment retry.
   * A list sorted by placedAt gets this backwards and buries the shopper who
   * has been waiting since breakfast.
   */
  it("ranks by how long the shopper has waited, not by when it was placed", async () => {
    renderOrders();

    await screen.findAllByRole("link", { name: /1042/ });
    const links = screen
      .getAllByRole("link")
      .map((node) => node.textContent)
      .filter((text) => text?.startsWith("#"));

    expect(links[0]).toBe("#1041");
  });

  it("shows this shop's own subtotal and never a basket figure", async () => {
    const { container } = renderOrders();

    await screen.findAllByRole("link", { name: /1042/ });
    expect(screen.getAllByText("1,240.00 EGP").length).toBeGreaterThan(0);
    expect(container.textContent).not.toMatch(/parentTotal|grandTotal/i);
    expect(screen.getAllByText(en.brand.sliceOnly).length).toBeGreaterThan(0);
  });

  it("names the two live delivery routes", async () => {
    renderOrders();

    await screen.findAllByRole("link", { name: /1042/ });
    expect(screen.getAllByText(en.brand.routeRider).length).toBeGreaterThan(0);
    expect(screen.getAllByText(en.brand.routeOwn).length).toBeGreaterThan(0);
  });

  it("puts the shelf check under the thumb, pointing at the longest wait", async () => {
    renderOrders();

    await screen.findAllByRole("link", { name: /1042/ });
    const bar = screen.getByTestId("orders-action-bar");
    expect(bar.closest('[data-slot="mobile-action-bar"]')).not.toBeNull();
    expect(
      within(bar).getByRole("link", { name: en.brand.actConfirm })
    ).toHaveAttribute("href", "/orders/0199a000-0000-7000-8000-000000000001");
  });
});

describe("/orders — SHIPPING_SERVICE renders nowhere", () => {
  it("drops the row even though the API answered with one", async () => {
    get.mockImplementation(() => answer(pageWithShippingService));

    const { container } = renderOrders();

    await screen.findAllByRole("link", { name: /1042/ });
    // Neither the order, nor its number, nor the enum value itself.
    expect(screen.queryByText(/9001/)).toBeNull();
    expect(container.innerHTML).not.toMatch(/SHIPPING_SERVICE/);
    expect(
      container.querySelectorAll('[data-status="PACKED"]').length
    ).toBeGreaterThan(0);
  });
});

describe("/orders — the status filter", () => {
  it("offers all twelve statuses plus an unfiltered option", async () => {
    renderOrders();

    const select = await screen.findByLabelText(en.brand.filterStatus);
    expect(within(select).getAllByRole("option")).toHaveLength(13);
    expect(within(select).getByRole("option", { name: en.brand.filterAll })).toBeInTheDocument();
  });

  it("puts the chosen status in the URL rather than in component state", async () => {
    renderOrders();

    const select = await screen.findByLabelText(en.brand.filterStatus);
    fireEvent.change(select, { target: { value: "PACKED" } });

    expect(replace).toHaveBeenCalledWith("/orders?status=PACKED");
  });

  it("asks the API for the status in the URL", async () => {
    search = new URLSearchParams("status=PACKED");

    renderOrders();

    await waitFor(() => expect(get).toHaveBeenCalled());
    const [, path, options] = get.mock.calls[0] as [
      unknown,
      string,
      { query?: Record<string, unknown> },
    ];
    expect(path).toBe("/v1/dashboard/orders");
    expect(options.query?.status).toBe("PACKED");
  });

  it("ignores a status the enum has never heard of", async () => {
    search = new URLSearchParams("status=NOT_A_STATUS");

    renderOrders();

    await waitFor(() => expect(get).toHaveBeenCalled());
    const [, , options] = get.mock.calls[0] as [
      unknown,
      string,
      { query?: Record<string, unknown> },
    ];
    expect(options.query?.status).toBeUndefined();
  });
});

describe("/orders — cursor pagination", () => {
  it("appends the next page rather than replacing the list", async () => {
    get.mockImplementationOnce(() => answer(pageWithCursor));
    get.mockImplementationOnce(() => answer(secondPage));

    renderOrders();

    const more = await screen.findByRole("button", { name: en.brand.loadMore });
    fireEvent.click(more);

    await waitFor(() =>
      expect(screen.getAllByText("#1039").length).toBeGreaterThan(0)
    );
    // The first page is still there — a cursor anchors to a row rather than an
    // offset, so nothing is skipped when the list shrinks underneath.
    expect(screen.getAllByText("#1042").length).toBeGreaterThan(0);
  });

  it("offers no load-more when the page is the last one", async () => {
    renderOrders();

    await screen.findAllByRole("link", { name: /1042/ });
    expect(screen.queryByRole("button", { name: en.brand.loadMore })).toBeNull();
  });
});

describe("/orders — the four list states", () => {
  it("draws the loading skeleton while the first page is in flight", () => {
    get.mockImplementation(() => new Promise(() => {}));

    const { container } = renderOrders();

    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it("draws the empty state when this status holds nothing", async () => {
    get.mockImplementation(() => answer(emptyOrdersPage));

    renderOrders();

    expect(await screen.findByText(en.brand.ordersEmptyTitle)).toBeInTheDocument();
    expect(screen.getByText(en.brand.ordersEmptyBody)).toBeInTheDocument();
  });

  it("draws the error state with a retry", async () => {
    get.mockImplementation(() =>
      answer(new ApiError(500, "boom", "InternalServerError"))
    );

    renderOrders();

    expect(await screen.findByText(en.brand.ordersErrorTitle)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: en.brand.retry })).toBeInTheDocument();
  });

  it("draws the denied state, with no retry, on a 403", async () => {
    get.mockImplementation(() => answer(new ApiError(403, "Forbidden", "Forbidden")));

    renderOrders();

    expect(await screen.findByText(en.brand.brandOnlyTitle)).toBeInTheDocument();
    // Denied is not error: pressing retry changes nothing, so there is no button.
    expect(screen.queryByRole("button", { name: en.brand.retry })).toBeNull();
    expect(screen.getByText("BRAND_OWNER")).toBeInTheDocument();
  });
});

describe("/orders — bilingual", () => {
  it("takes its copy from ar.ts under the Arabic locale", async () => {
    renderOrders("ar");

    expect(await screen.findByText(ar.brand.filterStatus)).toBeInTheDocument();
    expect(screen.getAllByText(ar.brand.routeRider).length).toBeGreaterThan(0);
    expect(screen.getAllByText(ar.brand.sliceOnly).length).toBeGreaterThan(0);
  });

  it("keeps money in Latin digits under Arabic, as the ledger does", async () => {
    renderOrders("ar");

    await screen.findByText(ar.brand.filterStatus);
    expect(screen.getAllByText("1,240.00 EGP").length).toBeGreaterThan(0);
  });
});

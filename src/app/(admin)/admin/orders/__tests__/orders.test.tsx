import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { en } from "@/messages/en";
import { LocaleProvider } from "@/lib/locale-context";

import {
  emptyOrdersPage,
  ordersPage,
  ordersPageWithCursor,
  twoShopOrder,
} from "./fixtures";

const replace = vi.fn();
let search = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn() }),
  usePathname: () => "/admin/orders",
  useSearchParams: () => search,
}));

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

const renderScreen = (locale: "en" | "ar" = "en") =>
  render(
    <LocaleProvider locale={locale}>
      <OrdersScreen />
    </LocaleProvider>
  );

beforeEach(() => {
  vi.clearAllMocks();
  search = new URLSearchParams();
  get.mockImplementation(() => answer(ordersPage));
});

describe("/admin/orders — the basket total, and who may see it", () => {
  it("always carries the rule that no brand ever sees the grand total", async () => {
    renderScreen();

    await screen.findAllByText(twoShopOrder.orderNumber);
    expect(screen.getByText(en.admin.combinedTotalNote)).toBeInTheDocument();
  });

  it("prints the grand total and the shop count on the same row", async () => {
    renderScreen();

    await screen.findAllByText(twoShopOrder.orderNumber);
    expect(screen.getAllByText("1,890.00 EGP").length).toBeGreaterThan(0);
    // A basket of one and a basket of three are different objects.
    expect(screen.getAllByText("2").length).toBeGreaterThan(0);
  });

  it("draws the PARENT status, which no brand order ever carries", async () => {
    // PROCESSING and SHIPPED exist only on the parent — they are what a basket
    // looks like when its shops disagree.
    const { container } = renderScreen();

    await screen.findAllByText(twoShopOrder.orderNumber);
    expect(
      container.querySelector('[data-status="PROCESSING"]')
    ).not.toBeNull();
  });

  it("does not word the parent's PENDING_BRAND as an instruction to pack", async () => {
    get.mockImplementation(() =>
      answer({
        items: [{ ...twoShopOrder, status: "PENDING_BRAND" }],
        nextCursor: null,
      })
    );

    renderScreen();

    await screen.findAllByText(twoShopOrder.orderNumber);
    // "Check the shelf" is the shop's own imperative and belongs to
    // BrandOrderStatus, not to a parent order an admin is reading about.
    expect(screen.queryByText("Check the shelf")).toBeNull();
    expect(screen.getAllByText("Waiting on a shop").length).toBeGreaterThan(0);
  });
});

describe("/admin/orders — navigation and the filter the endpoint actually has", () => {
  it("gives every row its own address", async () => {
    renderScreen();

    const links = await screen.findAllByRole("link", {
      name: twoShopOrder.orderNumber,
    });
    expect(links[0]).toHaveAttribute(
      "href",
      `/admin/orders/${twoShopOrder.id}`
    );
  });

  it("sends the status to the endpoint rather than filtering here", async () => {
    search = new URLSearchParams("status=DELIVERED");

    renderScreen();

    await waitFor(() => expect(get).toHaveBeenCalled());
    const [, path, options] = get.mock.calls[0] as [
      unknown,
      string,
      { query?: Record<string, unknown> },
    ];
    expect(path).toBe("/v1/admin/orders");
    expect(options.query?.status).toBe("DELIVERED");
  });

  it("ignores a status the parent-order enum has never heard of", async () => {
    // PACKED is a BrandOrderStatus. The parent order does not have it.
    search = new URLSearchParams("status=PACKED");

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

describe("/admin/orders — a later page failing keeps the rows on screen", () => {
  it("draws an inline retry rather than throwing the list away", async () => {
    get.mockImplementationOnce(() => answer(ordersPageWithCursor));
    get.mockImplementationOnce(() =>
      answer(new ApiError(500, "boom", "InternalServerError"))
    );

    renderScreen();

    const more = await screen.findByRole("button", { name: en.admin.loadMore });
    fireEvent.click(more);

    expect(
      await screen.findByTestId("admin-orders-inline-error")
    ).toHaveTextContent(en.admin.pageFailedBody);
    expect(
      screen.getAllByText(twoShopOrder.orderNumber).length
    ).toBeGreaterThan(0);
    expect(screen.queryByText(en.admin.errorTitle)).toBeNull();
  });
});

describe("/admin/orders — the four list states", () => {
  it("draws the loading skeleton while the first page is in flight", () => {
    get.mockImplementation(() => new Promise(() => {}));

    const { container } = renderScreen();

    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it("draws the empty state when nothing matches", async () => {
    get.mockImplementation(() => answer(emptyOrdersPage));

    renderScreen();

    expect(
      await screen.findByText(en.admin.ordersEmptyTitle)
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

describe("/admin/orders — bilingual", () => {
  it("takes its copy from ar.ts under the Arabic locale", async () => {
    renderScreen("ar");

    await screen.findAllByText(twoShopOrder.orderNumber);
    expect(screen.getByText(ar.admin.combinedTotalNote)).toBeInTheDocument();
    expect(screen.queryByText(en.admin.combinedTotalNote)).toBeNull();
  });

  it("keeps the money digits Latin in Arabic, as every other screen does", async () => {
    renderScreen("ar");

    await screen.findAllByText(twoShopOrder.orderNumber);
    expect(screen.getAllByText("1,890.00 EGP").length).toBeGreaterThan(0);
  });
});

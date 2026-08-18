import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { en } from "@/messages/en";
import { LocaleProvider } from "@/lib/locale-context";

import {
  shippingServiceDetail,
  shortCollectedDetail,
  twoShopDetail,
  unpaidDetail,
} from "./fixtures";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/admin/orders/x",
  useSearchParams: () => new URLSearchParams(),
}));

const get = vi.fn();
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, api: { ...actual.api, get } };
});

const { ApiError } = await import("@/lib/api");
const { AdminOrderDetailScreen } = await import("../[id]/order-detail");
const { attributeLabel, snapshotName, sumMoney } = await import(
  "../orders-data"
);
const { ar } = await import("@/messages/ar");

const answer = (value: unknown) =>
  value instanceof Error ? Promise.reject(value) : Promise.resolve(value);

const renderScreen = (locale: "en" | "ar" = "en") =>
  render(
    <LocaleProvider locale={locale}>
      <AdminOrderDetailScreen id={twoShopDetail.id} />
    </LocaleProvider>
  );

beforeEach(() => {
  vi.clearAllMocks();
  get.mockImplementation(() => answer(twoShopDetail));
});

describe("reading a frozen snapshot", () => {
  it("coerces an attribute value the column was never constrained to hold", () => {
    // `{ size: 42 }` is legal in the JSON column and frozen forever. A
    // value-typed schema would reject the whole order permanently.
    expect(attributeLabel({ size: 42, colour: "sand" })).toBe(
      "size: 42 · colour: sand"
    );
  });

  it("drops an attribute with no value rather than printing an empty pair", () => {
    expect(attributeLabel({ size: null, colour: "sand", fit: "" })).toBe(
      "colour: sand"
    );
  });

  it("falls back across languages before falling back to the sentence", () => {
    expect(snapshotName({ name: { ar: "قميص" } }, "en", "unnamed")).toBe("قميص");
    expect(snapshotName({ name: {} }, "en", "unnamed")).toBe("unnamed");
  });
});

describe("summing money as strings", () => {
  it("adds two-decimal figures a float would get wrong", () => {
    expect(sumMoney(["144.00", "76.80"])).toBe("220.80");
  });

  it("refuses rather than rounding when a figure is not money", () => {
    expect(sumMoney(["144.00", "1,200"])).toBeNull();
  });
});

describe("/admin/orders/[id] — the whole basket, once", () => {
  it("shows both shops' slices and their differing statuses", async () => {
    const { container } = renderScreen();

    await screen.findByText(twoShopDetail.orderNumber);
    // One delivered, one not looked at yet. That disagreement is the reason
    // this screen exists, so it is visible without opening anything.
    expect(container.querySelector('[data-status="DELIVERED"]')).not.toBeNull();
    expect(
      container.querySelector('[data-status="PENDING_BRAND"]')
    ).not.toBeNull();
    expect(
      container.querySelectorAll("[data-brand-order]")
    ).toHaveLength(2);
  });

  it("adds up the shops' commission and payout without a float", async () => {
    renderScreen();

    await screen.findByText(twoShopDetail.orderNumber);
    expect(screen.getAllByText("220.80 EGP").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1,579.20 EGP").length).toBeGreaterThan(0);
  });

  it("names an item the shop never named, rather than printing nothing", async () => {
    renderScreen();

    await screen.findByText(twoShopDetail.orderNumber);
    expect(
      screen.getAllByText(en.admin.unnamedProduct).length
    ).toBeGreaterThan(0);
  });

  it("says once that it has no route to a product photo", async () => {
    renderScreen();

    await screen.findByText(twoShopDetail.orderNumber);
    expect(screen.getByText(en.admin.noMediaRoute)).toBeInTheDocument();
  });
});

describe("/admin/orders/[id] — SHIPPING_SERVICE renders as nothing", () => {
  it("draws no route chip at all for the method that is not live", async () => {
    get.mockImplementation(() => answer(shippingServiceDetail));

    const { container } = renderScreen();

    await screen.findByText(twoShopDetail.orderNumber);
    // Not a greyed pill, not an em-dash, not the raw enum name — a greyed pill
    // still reads as "this exists and is switched off today".
    expect(container.querySelector("[data-route]")).toBeNull();
    expect(screen.queryByText(/SHIPPING_SERVICE/)).toBeNull();
    expect(screen.queryByText(en.admin.deliveryRider)).toBeNull();
    expect(screen.queryByText(en.admin.deliveryOwn)).toBeNull();
  });

  it("still draws the chip for a route that IS live", async () => {
    const { container } = renderScreen();

    await screen.findByText(twoShopDetail.orderNumber);
    expect(
      container.querySelector('[data-route="RIDER_PER_BRAND"]')
    ).not.toBeNull();
  });
});

describe("/admin/orders/[id] — payment is per payment, not per order", () => {
  it("shows a basket-wide charge as one row rather than flattening it", async () => {
    const { container } = renderScreen();

    await screen.findByText(twoShopDetail.orderNumber);
    expect(container.querySelectorAll("[data-payment]")).toHaveLength(1);
    expect(screen.getByText(en.admin.paymentsNote)).toBeInTheDocument();
  });

  it("shows what was COLLECTED beside what was charged", async () => {
    // Cash arrives per courier per brand, so collected can be less — and that
    // gap is the first thing a settlement dispute turns on.
    get.mockImplementation(() => answer(shortCollectedDetail));

    renderScreen();

    await screen.findByText(twoShopDetail.orderNumber);
    expect(screen.getAllByText("1,200.00 EGP").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1,890.00 EGP").length).toBeGreaterThan(0);
  });

  it("says an order has no payment row yet, which is a real state", async () => {
    get.mockImplementation(() => answer(unpaidDetail));

    renderScreen();

    expect(await screen.findByText(en.admin.noPayments)).toBeInTheDocument();
  });

  it("says whether the money settles to Loqal or to the shop", async () => {
    renderScreen();

    await screen.findByText(twoShopDetail.orderNumber);
    expect(
      screen.getByText(`${en.admin.settlesTo}: ${en.admin.settlesToPlatform}`)
    ).toBeInTheDocument();
  });
});

describe("/admin/orders/[id] — the shopper", () => {
  it("says a guest checkout is a guest checkout", async () => {
    renderScreen();

    await screen.findByText(twoShopDetail.orderNumber);
    expect(screen.getByText(en.admin.guestCheckout)).toBeInTheDocument();
    expect(screen.getByText(en.admin.phoneNotVerified)).toBeInTheDocument();
  });
});

describe("/admin/orders/[id] — the three failure states", () => {
  it("draws notFound, with a way back, on a 404", async () => {
    get.mockImplementation(() =>
      answer(new ApiError(404, "Order not found", "NotFound"))
    );

    renderScreen();

    expect(
      await screen.findByText(en.admin.orderNotFoundTitle)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: en.admin.backToOrders })
    ).toHaveAttribute("href", "/admin/orders");
  });

  it("draws denied on a 403 and names the role", async () => {
    get.mockImplementation(() =>
      answer(new ApiError(403, "Forbidden", "Forbidden"))
    );

    renderScreen();

    expect(await screen.findByText(en.admin.deniedTitle)).toBeInTheDocument();
    expect(screen.getByText("SUPER_ADMIN")).toBeInTheDocument();
  });

  it("draws the error state with a retry on anything else", async () => {
    get.mockImplementation(() =>
      answer(new ApiError(500, "boom", "InternalServerError"))
    );

    renderScreen();

    expect(await screen.findByText(en.admin.errorTitle)).toBeInTheDocument();
  });
});

describe("/admin/orders/[id] — bilingual", () => {
  it("takes its copy from ar.ts under the Arabic locale", async () => {
    renderScreen("ar");

    await screen.findByText(twoShopDetail.orderNumber);
    expect(screen.getByText(ar.admin.perBrandNote)).toBeInTheDocument();
    expect(screen.queryByText(en.admin.perBrandNote)).toBeNull();
  });

  it("prefers the Arabic product name when there is one", async () => {
    renderScreen("ar");

    await screen.findByText(twoShopDetail.orderNumber);
    expect(screen.getAllByText("قميص كتان").length).toBeGreaterThan(0);
  });
});

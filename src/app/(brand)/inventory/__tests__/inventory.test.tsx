import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { en } from "@/messages/en";
import { LocaleProvider } from "@/lib/locale-context";

import {
  V_HEALTHY_ON_HAND,
  V_PLAIN,
  V_UNSCANNED,
  adjustments,
  emptyProducts,
  levelHealthyOnHand,
  levelPlain,
  levelScarf,
  products,
} from "./fixtures";

const nav = vi.hoisted(() => ({ params: new URLSearchParams() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/inventory",
  useSearchParams: () => nav.params,
}));

const get = vi.fn();
const post = vi.fn();
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, api: { ...actual.api, get, post } };
});

const { ApiError } = await import("@/lib/api");
const InventoryPage = (await import("../page")).default;
const { ar } = await import("@/messages/ar");

const answer = (value: unknown) =>
  value instanceof Error ? Promise.reject(value) : Promise.resolve(value);

const LEVELS: Record<string, unknown> = {
  [V_HEALTHY_ON_HAND]: levelHealthyOnHand,
  [V_PLAIN]: levelPlain,
  [V_UNSCANNED]: levelScarf,
};

function mockApi(options: { list?: unknown; levels?: Record<string, unknown> } = {}) {
  const levels = options.levels ?? LEVELS;
  get.mockImplementation((_schema: unknown, path: string) => {
    if (path === "/v1/dashboard/products") return answer(options.list ?? products);
    if (path.endsWith("/adjustments")) return answer(adjustments);
    const match = /\/v1\/dashboard\/inventory\/variants\/([^/]+)$/.exec(path);
    if (match) {
      const level = levels[match[1] as string];
      return level
        ? Promise.resolve(level)
        : Promise.reject(new Error("no level for this variant"));
    }
    return Promise.reject(new Error(`unstubbed path ${path}`));
  });
  post.mockResolvedValue(adjustments[0]);
}

const renderInventory = (locale: "en" | "ar" = "en") =>
  render(
    <LocaleProvider locale={locale}>
      <InventoryPage />
    </LocaleProvider>
  );

beforeEach(() => {
  nav.params = new URLSearchParams();
  get.mockReset();
  post.mockReset();
  mockApi();
});

describe("/inventory — available and reserved are two numbers", () => {
  it("shows both, separately, for the same variant", async () => {
    renderInventory();

    const available = await screen.findAllByTestId(`available-${V_HEALTHY_ON_HAND}`);
    const reserved = screen.getAllByTestId(`reserved-${V_HEALTHY_ON_HAND}`);
    expect(available[0]).toHaveTextContent("2");
    expect(reserved[0]).toHaveTextContent("18");
    // And they are not the same element, and neither is the on-hand figure.
    expect(available[0]).not.toBe(reserved[0]);
  });

  it("gives each of the three figures its own column heading", async () => {
    renderInventory();

    await screen.findAllByTestId(`available-${V_HEALTHY_ON_HAND}`);
    expect(screen.getAllByText(en.brand.onHand).length).toBeGreaterThan(0);
    expect(screen.getAllByText(en.brand.available).length).toBeGreaterThan(0);
    expect(screen.getAllByText(en.brand.reserved).length).toBeGreaterThan(0);
  });

  it("says what availability actually is", async () => {
    renderInventory();

    await screen.findAllByTestId(`available-${V_HEALTHY_ON_HAND}`);
    expect(screen.getByText(en.brand.stockNote)).toBeInTheDocument();
  });
});

describe("/inventory — low stock reads availability, not the shelf count", () => {
  it("lists a variant with twenty on the shelf and eighteen held as running out", async () => {
    renderInventory();

    const section = await screen.findByTestId("inventory-running-out");
    expect(
      within(section).getAllByTestId(`available-${V_HEALTHY_ON_HAND}`).length
    ).toBeGreaterThan(0);
    expect(within(section).getByText(en.brand.runningOutNote)).toBeInTheDocument();
    // The comfortable one is not in it.
    expect(
      within(section).queryByTestId(`available-${V_PLAIN}`)
    ).toBeNull();
  });

  it("draws a dash rather than the on-hand count when availability is unknown", async () => {
    mockApi({ levels: {} });

    renderInventory();

    const all = await screen.findByTestId("inventory-all");
    expect(within(all).queryByTestId(`available-${V_HEALTHY_ON_HAND}`)).toBeNull();
    expect(within(all).getAllByText("—").length).toBeGreaterThan(0);
    // No running-out claim can be made from stock on hand alone.
    expect(screen.queryByTestId("inventory-running-out")).toBeNull();
  });

  it("says on the screen that there is no low-stock endpoint behind it", async () => {
    renderInventory();

    await screen.findByTestId("inventory-all");
    expect(
      screen.getByText(en.brand.availabilityUnknownNote.replace("{n}", "3"))
    ).toBeInTheDocument();
  });
});

describe("/inventory — adjustments need a reason", () => {
  beforeEach(() => {
    nav.params = new URLSearchParams(`variant=${V_HEALTHY_ON_HAND}`);
  });

  it("shows the variant's three figures apart in the detail panel", async () => {
    renderInventory();

    await screen.findByTestId("inventory-variant");
    // The per-variant fetch is a second round trip after the product list, so
    // the panel exists before the two figures do.
    await waitFor(() =>
      expect(screen.getByTestId("variant-available")).toHaveTextContent("2")
    );
    expect(screen.getByTestId("variant-reserved")).toHaveTextContent("18");
  });

  it("will not save until a reason is chosen", async () => {
    renderInventory();

    await screen.findByTestId("inventory-variant");
    const save = screen.getByRole("button", { name: en.brand.saveAdjust });
    expect(save).toBeDisabled();

    fireEvent.change(screen.getByLabelText(en.brand.deltaField), {
      target: { value: "-3" },
    });
    // A delta on its own is still not enough.
    expect(save).toBeDisabled();
    expect(screen.getByText(en.brand.adjustBlockedHint)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(en.brand.reason), {
      target: { value: "DAMAGE" },
    });
    expect(save).not.toBeDisabled();
  });

  it("refuses a zero, which would record nothing", async () => {
    renderInventory();

    await screen.findByTestId("inventory-variant");
    fireEvent.change(screen.getByLabelText(en.brand.deltaField), {
      target: { value: "0" },
    });
    fireEvent.change(screen.getByLabelText(en.brand.reason), {
      target: { value: "DAMAGE" },
    });
    expect(screen.getByRole("button", { name: en.brand.saveAdjust })).toBeDisabled();
  });

  it("sends the delta, the reason and the note", async () => {
    renderInventory();

    await screen.findByTestId("inventory-variant");
    fireEvent.change(screen.getByLabelText(en.brand.deltaField), {
      target: { value: "-3" },
    });
    fireEvent.change(screen.getByLabelText(en.brand.reason), {
      target: { value: "DAMAGE" },
    });
    fireEvent.change(screen.getByLabelText(en.brand.noteField), {
      target: { value: "Water on the shelf" },
    });
    fireEvent.click(screen.getByRole("button", { name: en.brand.saveAdjust }));

    await waitFor(() => expect(post).toHaveBeenCalled());
    const [, path, body] = post.mock.calls[0] as [unknown, string, Record<string, unknown>];
    expect(path).toBe(
      `/v1/dashboard/inventory/variants/${V_HEALTHY_ON_HAND}/adjustments`
    );
    expect(body).toEqual({
      delta: -3,
      reason: "DAMAGE",
      note: "Water on the shelf",
    });
  });
});

describe("/inventory — the adjustment history answers 'where did my stock go'", () => {
  beforeEach(() => {
    nav.params = new URLSearchParams(`variant=${V_HEALTHY_ON_HAND}`);
  });

  it("shows the reason, the change, the balance after and who", async () => {
    renderInventory();

    await screen.findByTestId("inventory-variant");
    await waitFor(() =>
      expect(screen.getAllByText(en.brand.stockReason.OPENING).length).toBeGreaterThan(0)
    );
    expect(screen.getAllByText("+24").length).toBeGreaterThan(0);
    expect(screen.getAllByText("-4").length).toBeGreaterThan(0);
    expect(screen.getAllByText(en.brand.stockReason.SALE).length).toBeGreaterThan(0);
    // A null actor is the system, not a person.
    expect(screen.getAllByText(en.brand.whoSystem).length).toBeGreaterThan(0);
    expect(screen.getAllByText(en.brand.whoStaff).length).toBeGreaterThan(0);
  });
});

describe("/inventory — the four list states", () => {
  it("draws the loading skeleton while the list is in flight", () => {
    get.mockImplementation(() => new Promise(() => {}));

    const { container } = renderInventory();

    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it("draws the empty state with a way to add stock", async () => {
    mockApi({ list: emptyProducts });

    renderInventory();

    expect(
      await screen.findByText(en.brand.inventoryEmptyTitle)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: en.brand.addPhotos })
    ).toHaveAttribute("href", "/products/bulk");
  });

  it("draws the error state with a retry", async () => {
    mockApi({ list: new ApiError(500, "boom", "InternalServerError") });

    renderInventory();

    expect(
      await screen.findByText(en.brand.inventoryErrorTitle)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: en.brand.retry })
    ).toBeInTheDocument();
  });

  it("draws the denied state, and gives it no retry", async () => {
    mockApi({ list: new ApiError(403, "Forbidden", "Forbidden") });

    renderInventory();

    expect(
      await screen.findByText(en.brand.catalogOnlyTitle)
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: en.brand.retry })).toBeNull();
  });
});

describe("/inventory — bilingual", () => {
  it("takes its copy from ar.ts under the Arabic locale", async () => {
    renderInventory("ar");

    await screen.findAllByTestId(`available-${V_HEALTHY_ON_HAND}`);
    expect(screen.getByText(ar.brand.stockNote)).toBeInTheDocument();
    expect(screen.getAllByText(ar.brand.reserved).length).toBeGreaterThan(0);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

import { en } from "@/messages/en";
import { LocaleProvider } from "@/lib/locale-context";

import {
  activeProducts,
  categories,
  emptyProducts,
  mixedProducts,
  productId,
} from "./fixtures";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/products",
  useSearchParams: () => new URLSearchParams(),
}));

/**
 * Only `api` is replaced. ApiError stays the real class — `listStateFor` does an
 * `instanceof` check on it, and a stubbed lookalike would make the 403 test pass
 * for the wrong reason.
 */
const get = vi.fn();
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, api: { ...actual.api, get } };
});

const { ApiError } = await import("@/lib/api");
const ProductsPage = (await import("../page")).default;
const { ar } = await import("@/messages/ar");

const answer = (value: unknown) =>
  value instanceof Error ? Promise.reject(value) : Promise.resolve(value);

function mockApi(products: unknown) {
  get.mockImplementation((_schema: unknown, path: string) => {
    if (path === "/v1/dashboard/products") return answer(products);
    if (path === "/v1/categories") return answer(categories);
    return Promise.reject(new Error(`unstubbed path ${path}`));
  });
}

const renderProducts = (locale: "en" | "ar" = "en") =>
  render(
    <LocaleProvider locale={locale}>
      <ProductsPage />
    </LocaleProvider>
  );

beforeEach(() => mockApi(activeProducts));

afterEach(() => {
  vi.restoreAllMocks();
  get.mockReset();
});

describe("/products — a draft with no name and no price", () => {
  beforeEach(() => mockApi(mixedProducts));

  it("says 'no name yet' rather than leaving the cell blank", async () => {
    renderProducts();

    const cells = await screen.findAllByTestId(`product-name-${productId(9)}`);
    expect(cells.length).toBeGreaterThan(0);
    for (const cell of cells) {
      expect(cell).toHaveTextContent(en.brand.needsName);
      expect(cell.textContent?.trim()).not.toBe("");
      expect(cell).toHaveAttribute("data-unset", "name");
    }
  });

  it("says 'no price yet' and NEVER renders 0.00 for a null price", async () => {
    const { container } = renderProducts();

    const cells = await screen.findAllByTestId(`product-price-${productId(9)}`);
    for (const cell of cells) {
      expect(cell).toHaveTextContent(en.brand.needsPrice);
    }
    // A zero price that reaches a storefront costs a shop real money. It must
    // not be anywhere on this screen.
    expect(container.textContent).not.toMatch(/\b0\.00\b/);
  });

  it("still gives the unnamed draft a real link with an address", async () => {
    renderProducts();

    const cells = await screen.findAllByTestId(`product-name-${productId(9)}`);
    expect(cells[0]?.tagName).toBe("A");
    expect(cells[0]).toHaveAttribute("href", `/products/${productId(9)}`);
  });

  it("counts the unfinished drafts and points at the grid that fixes them", async () => {
    renderProducts();

    const banner = await screen.findByTestId("products-needs-attention");
    expect(
      within(banner).getByText(en.brand.needsAttention.replace("{n}", "1"))
    ).toBeInTheDocument();
    expect(within(banner).getByText(en.brand.noPriceNote)).toBeInTheDocument();
    expect(
      within(banner).getByRole("link", { name: en.brand.finishDrafts })
    ).toHaveAttribute("href", "/products/bulk");
  });
});

describe("/products — a priced product", () => {
  it("formats a real price and does not call it missing", async () => {
    renderProducts();

    const cells = await screen.findAllByTestId(`product-price-${productId(1)}`);
    expect(cells[0]).toHaveTextContent("149.99 EGP");
    expect(screen.queryByText(en.brand.needsPrice)).toBeNull();
  });

  it("shows the product status as a pill", async () => {
    const { container } = renderProducts();

    await screen.findAllByTestId(`product-price-${productId(1)}`);
    // ACTIVE, not the design system's PUBLISHED — the contract wins.
    expect(container.querySelector('[data-status="ACTIVE"]')).not.toBeNull();
    expect(container.querySelector('[data-status="PUBLISHED"]')).toBeNull();
  });
});

describe("/products — the four list states", () => {
  it("draws the loading skeleton while the list is in flight", () => {
    get.mockImplementation(() => new Promise(() => {}));

    const { container } = renderProducts();

    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it("draws the empty state with a way to add photos", async () => {
    mockApi(emptyProducts);

    renderProducts();

    expect(
      await screen.findByText(en.brand.productsEmptyTitle)
    ).toBeInTheDocument();
    expect(screen.getByText(en.brand.productsEmptyBody)).toBeInTheDocument();
    // ListState's own action is a button and cannot navigate, so the way out is
    // composed beside it as a real link.
    expect(
      screen.getByRole("link", { name: en.brand.addPhotos })
    ).toHaveAttribute("href", "/products/bulk");
  });

  it("draws the error state with a retry", async () => {
    mockApi(new ApiError(500, "boom", "InternalServerError"));

    renderProducts();

    expect(
      await screen.findByText(en.brand.productsErrorTitle)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: en.brand.retry })
    ).toBeInTheDocument();
  });

  it("draws the denied state, and gives it no retry", async () => {
    mockApi(new ApiError(403, "Forbidden", "Forbidden"));

    renderProducts();

    expect(
      await screen.findByText(en.brand.catalogOnlyTitle)
    ).toBeInTheDocument();
    expect(screen.getByText("BRAND_OWNER")).toBeInTheDocument();
    // Denied is not error: pressing retry would change nothing.
    expect(screen.queryByRole("button", { name: en.brand.retry })).toBeNull();
  });
});

describe("/products — bilingual", () => {
  it("takes its copy from ar.ts under the Arabic locale", async () => {
    mockApi(mixedProducts);

    renderProducts("ar");

    const cells = await screen.findAllByTestId(`product-name-${productId(9)}`);
    expect(cells[0]).toHaveTextContent(ar.brand.needsName);
    expect(screen.getByText(ar.brand.searchNote)).toBeInTheDocument();
  });

  it("prefers the Arabic name when there is one", async () => {
    mockApi(mixedProducts);

    renderProducts("ar");

    const cells = await screen.findAllByTestId(`product-name-${productId(1)}`);
    expect(cells[0]).toHaveTextContent("قميص كتان 1");
  });
});

describe("/products — search, and what it honestly is", () => {
  it("says it only narrows what is already loaded", async () => {
    renderProducts();

    await screen.findAllByTestId(`product-price-${productId(1)}`);
    expect(screen.getByText(en.brand.searchNote)).toBeInTheDocument();
  });

  it("never sends a `search` query parameter, which the API would reject", async () => {
    renderProducts();

    await screen.findAllByTestId(`product-price-${productId(1)}`);
    const productCalls = get.mock.calls.filter(
      ([, path]) => path === "/v1/dashboard/products"
    );
    expect(productCalls.length).toBeGreaterThan(0);
    for (const [, , options] of productCalls) {
      expect(Object.keys((options as { query: object }).query)).not.toContain(
        "search"
      );
    }
  });
});

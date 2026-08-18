import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { dashboardProductSchema } from "@loqal/contracts/catalog.contract";
import { en } from "@/messages/en";
import { LocaleProvider } from "@/lib/locale-context";

const replace = vi.fn();
let search = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn() }),
  usePathname: () => "/admin/products",
  useSearchParams: () => search,
}));

const get = vi.fn();
const patch = vi.fn();
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, api: { ...actual.api, get, patch } };
});

const { ApiError } = await import("@/lib/api");
const { ProductsScreen } = await import("../products-screen");
const {
  adminProductPageSchema,
  clampPage,
  pageCount,
  readPage,
} = await import("../products-data");
const { ar } = await import("@/messages/ar");

const brand = {
  id: "0199dddd-0000-7000-8000-000000000001",
  name: "Nile Ceramics",
  slug: "nile-ceramics",
  logoMediaId: null,
};

const pricedProduct = {
  id: "0199aaaa-0000-7000-8000-000000000001",
  brandId: brand.id,
  categoryId: "0199bbbb-0000-7000-8000-000000000001",
  name: { en: "Glazed bowl", ar: "طبق مزجج" },
  slug: "glazed-bowl",
  // One decimal, straight off the Decimal column. Not "149.90".
  basePrice: "149.9",
  status: "ACTIVE",
  createdAt: "2026-08-01T00:00:00.000Z",
  brand,
};

/** A photo-only draft: both NOT NULL sentinels, exactly as they arrive. */
const sentinelProduct = {
  ...pricedProduct,
  id: "0199aaaa-0000-7000-8000-000000000002",
  name: {},
  slug: "untitled-draft",
  basePrice: "-1",
  status: "DRAFT",
};

const page = adminProductPageSchema.parse({
  items: [pricedProduct, sentinelProduct],
  total: 2,
  page: 1,
  perPage: 20,
});

const manyPages = adminProductPageSchema.parse({
  items: [pricedProduct],
  total: 45,
  page: 2,
  perPage: 20,
});

const answer = (value: unknown) =>
  value instanceof Error ? Promise.reject(value) : Promise.resolve(value);

const renderScreen = (locale: "en" | "ar" = "en") =>
  render(
    <LocaleProvider locale={locale}>
      <ProductsScreen />
    </LocaleProvider>
  );

beforeEach(() => {
  vi.clearAllMocks();
  search = new URLSearchParams();
  get.mockImplementation(() => answer(page));
  patch.mockImplementation(() => answer({}));
});

describe("the wire this endpoint actually answers with", () => {
  it("parses the raw Prisma row the catalog contract would reject", () => {
    // `adminListProducts` returns `repo.adminList()` untouched — it never goes
    // through `toDashboardShape`, so the sentinels arrive intact.
    expect(adminProductPageSchema.safeParse(page).success).toBe(true);

    // And the contract's own product schema cannot read it.
    expect(dashboardProductSchema.safeParse(sentinelProduct).success).toBe(
      false
    );
  });

  it("still refuses a key nobody declared", () => {
    expect(
      adminProductPageSchema.safeParse({
        ...page,
        items: [{ ...pricedProduct, secretMargin: "0.4" }],
      }).success
    ).toBe(false);
  });
});

describe("/admin/products — the two sentinels are never printed as values", () => {
  it("says a draft has no price rather than printing -1.00 EGP", async () => {
    renderScreen();

    await screen.findAllByText("Glazed bowl");
    expect(screen.getAllByText(en.admin.notPriced).length).toBeGreaterThan(0);
    expect(screen.queryByText(/-1\.00 EGP/)).toBeNull();
    expect(screen.queryByText(/−1\.00 EGP/)).toBeNull();
  });

  it("says a draft has no name rather than printing an empty cell", async () => {
    renderScreen();

    await screen.findAllByText("Glazed bowl");
    expect(screen.getAllByText(en.admin.notNamed).length).toBeGreaterThan(0);
  });

  it("pads a one-decimal price to the two the rest of the console prints", async () => {
    renderScreen();

    expect((await screen.findAllByText("149.90 EGP")).length).toBeGreaterThan(0);
  });
});

describe("/admin/products — offset paging is declared, not hidden", () => {
  it("says the list is paged by number and can shift under the reader", async () => {
    renderScreen();

    await screen.findAllByText("Glazed bowl");
    expect(screen.getByText(en.admin.offsetPagedTitle)).toBeInTheDocument();
    expect(screen.getByText(en.admin.offsetPagedBody)).toBeInTheDocument();
  });

  it("draws prev/next rather than a Load more button that would be a lie", async () => {
    renderScreen();

    await screen.findAllByText("Glazed bowl");
    expect(
      screen.getByRole("button", { name: en.admin.nextPage })
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: en.admin.loadMore })).toBeNull();
  });

  it("counts a zero-row list as one page, never zero", () => {
    expect(pageCount(0, 20)).toBe(1);
    expect(pageCount(45, 20)).toBe(3);
    expect(pageCount(40, 20)).toBe(2);
  });

  it("clamps a hand-typed page number onto a real page", () => {
    expect(clampPage(900, 45, 20)).toBe(3);
    expect(clampPage(0, 45, 20)).toBe(1);
  });

  it("treats a page param that is not a whole number as page 1", () => {
    for (const raw of ["nine", "-2", "1.5", "", null]) {
      expect(readPage(raw)).toBe(1);
    }
    expect(readPage("4")).toBe(4);
  });

  it("sends page and perPage to the endpoint", async () => {
    search = new URLSearchParams("page=2&status=DRAFT&brandId=" + brand.id);
    get.mockImplementation(() => answer(manyPages));

    renderScreen();

    await waitFor(() => expect(get).toHaveBeenCalled());
    const [, path, options] = get.mock.calls[0] as [
      unknown,
      string,
      { query?: Record<string, unknown> },
    ];
    expect(path).toBe("/v1/admin/products");
    expect(options.query?.page).toBe(2);
    expect(options.query?.perPage).toBe(20);
    expect(options.query?.status).toBe("DRAFT");
    expect(options.query?.brandId).toBe(brand.id);
  });

  it("resets to the first page when a filter changes", async () => {
    search = new URLSearchParams("page=3");

    renderScreen();

    await screen.findAllByText("Glazed bowl");
    fireEvent.change(screen.getByLabelText(en.admin.filterStatus), {
      target: { value: "DRAFT" },
    });

    expect(replace).toHaveBeenCalledWith("/admin/products?status=DRAFT");
  });
});

describe("/admin/products — the override says what it does", () => {
  it("names all three surprising consequences before confirming", async () => {
    renderScreen();

    await screen.findAllByText("Glazed bowl");
    fireEvent.click(screen.getAllByRole("button", { name: /Apply the override/ })[0]);

    expect(
      await screen.findByText(en.admin.overrideBeatsBrand)
    ).toBeInTheDocument();
    expect(screen.getByText(en.admin.overrideNoLadder)).toBeInTheDocument();
    expect(screen.getByText(en.admin.overrideNeverDeletes)).toBeInTheDocument();
  });

  it("sends the chosen status to the status route", async () => {
    renderScreen();

    await screen.findAllByText("Glazed bowl");
    fireEvent.click(screen.getAllByRole("button", { name: /Apply the override/ })[0]);

    const confirms = await screen.findAllByRole("button", {
      name: en.admin.overrideAction,
    });
    fireEvent.click(confirms[confirms.length - 1]);

    await waitFor(() => expect(patch).toHaveBeenCalled());
    const [, path, body] = patch.mock.calls[0] as [unknown, string, unknown];
    expect(path).toBe(`/v1/admin/products/${pricedProduct.id}/status`);
    expect(body).toEqual({ status: "ARCHIVED" });
  });

  it("offers every status, including archiving straight from draft", async () => {
    // The usual draft-to-active-to-archived order does not apply here: a policy
    // violation must be archivable from any state.
    renderScreen();

    await screen.findAllByText("Glazed bowl");
    fireEvent.click(screen.getAllByRole("button", { name: /Apply the override/ })[0]);

    const select = await screen.findByLabelText(en.admin.chooseStatus);
    expect(select.querySelectorAll("option")).toHaveLength(3);
  });
});

describe("/admin/products — the four list states", () => {
  it("draws the loading skeleton", () => {
    get.mockImplementation(() => new Promise(() => {}));

    const { container } = renderScreen();

    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it("draws the empty state when nothing matches", async () => {
    get.mockImplementation(() =>
      answer({ items: [], total: 0, page: 1, perPage: 20 })
    );

    renderScreen();

    expect(
      await screen.findByText(en.admin.productsEmptyTitle)
    ).toBeInTheDocument();
  });

  it("draws denied on a 403 and names the role", async () => {
    get.mockImplementation(() =>
      answer(new ApiError(403, "Forbidden", "Forbidden"))
    );

    renderScreen();

    expect(await screen.findByText(en.admin.deniedTitle)).toBeInTheDocument();
    expect(screen.getByText("SUPER_ADMIN")).toBeInTheDocument();
  });
});

describe("/admin/products — bilingual", () => {
  it("prefers the Arabic name and takes its copy from ar.ts", async () => {
    renderScreen("ar");

    await screen.findAllByText("طبق مزجج");
    expect(screen.getByText(ar.admin.offsetPagedTitle)).toBeInTheDocument();
    expect(screen.queryByText(en.admin.offsetPagedTitle)).toBeNull();
  });
});

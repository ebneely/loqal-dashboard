import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { en } from "@/messages/en";
import { LocaleProvider } from "@/lib/locale-context";

import { categories, productId, wireDraft, wireProduct, wireVariant } from "./fixtures";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/products/1",
  useSearchParams: () => new URLSearchParams(),
}));

const get = vi.fn();
const patch = vi.fn();
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, api: { ...actual.api, get, patch } };
});

const { ProductEditor } = await import("../[id]/product-editor");

const answer = (value: unknown) =>
  value instanceof Error ? Promise.reject(value) : Promise.resolve(value);

function mockApi(product: unknown) {
  get.mockImplementation((_schema: unknown, path: string) => {
    if (path.startsWith("/v1/dashboard/products/")) return answer(product);
    if (path === "/v1/categories") return answer(categories);
    return Promise.reject(new Error(`unstubbed path ${path}`));
  });
  patch.mockResolvedValue({});
}

const renderEditor = (id = productId(1), locale: "en" | "ar" = "en") =>
  render(
    <LocaleProvider locale={locale}>
      <ProductEditor id={id} />
    </LocaleProvider>
  );

/**
 * Reset at the START of each test, never at the end.
 *
 * A successful write reloads the product, and that reload's effect can still be
 * in flight when the assertion passes. Tearing the stub down in an afterEach
 * makes `api.get` answer `undefined` to a request the component legitimately
 * made, which fails the test that already passed.
 */
beforeEach(() => {
  get.mockReset();
  patch.mockReset();
  mockApi(
    wireProduct(1, {
      variants: [
        wireVariant(1, { price: "149.99", stockOnHand: 12 }),
        wireVariant(2, { sku: "SKU-2-XL", attributes: { size: "XL" }, price: "179.99" }),
      ],
    })
  );
});

describe("/products/[id] — at least one language, never both", () => {
  it("offers an Arabic tab and an English tab", async () => {
    renderEditor();

    expect(
      await screen.findByRole("tab", { name: en.brand.english })
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: en.brand.arabic })).toBeInTheDocument();
  });

  it("saves a product that has only an Arabic name", async () => {
    mockApi(wireDraft(9));
    renderEditor(productId(9));

    // Radix activates a tab on mousedown, not on a synthetic click alone.
    const arabicTab = await screen.findByRole("tab", { name: en.brand.arabic });
    fireEvent.mouseDown(arabicTab);
    fireEvent.click(arabicTab);

    fireEvent.change(await screen.findByLabelText(en.brand.nameArabic), {
      target: { value: "قميص كتان" },
    });
    fireEvent.click(screen.getByRole("button", { name: en.brand.save }));

    await waitFor(() => expect(patch).toHaveBeenCalled());
    const [, path, body] = patch.mock.calls[0] as [unknown, string, Record<string, unknown>];
    expect(path).toBe(`/v1/dashboard/products/${productId(9)}`);
    expect(body.name).toEqual({ ar: "قميص كتان" });
  });

  it("refuses to save a product with neither language, and says which rule", async () => {
    mockApi(wireDraft(9));
    renderEditor(productId(9));

    fireEvent.click(await screen.findByRole("button", { name: en.brand.save }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        en.brand.oneLangRequired
      )
    );
    expect(patch).not.toHaveBeenCalled();
  });
});

describe("/products/[id] — an unset price is never a zero", () => {
  it("leaves the price field empty and says the draft is unfinished", async () => {
    mockApi(wireDraft(9));
    const { container } = renderEditor(productId(9));

    const price = (await screen.findByLabelText(
      en.brand.basePrice
    )) as HTMLInputElement;
    expect(price.value).toBe("");
    expect(container.textContent).not.toMatch(/\b0\.00\b/);
    expect(screen.getByTestId("product-gaps")).toHaveTextContent(
      en.brand.publishNoPrice
    );
  });

  it("will not let a priceless draft be published", async () => {
    mockApi(wireDraft(9));
    renderEditor(productId(9));

    const publish = await screen.findByRole("button", { name: en.brand.publish });
    expect(publish).toBeDisabled();
    expect(screen.getByText(en.brand.publishBlockedHint)).toBeInTheDocument();
  });

  it("never sends a price the shop owner did not type", async () => {
    mockApi(wireDraft(9));
    renderEditor(productId(9));

    fireEvent.change(await screen.findByLabelText(en.brand.nameEn), {
      target: { value: "Linen shirt" },
    });
    fireEvent.click(screen.getByRole("button", { name: en.brand.save }));

    await waitFor(() => expect(patch).toHaveBeenCalled());
    const [, , body] = patch.mock.calls[0] as [unknown, string, Record<string, unknown>];
    expect(body).not.toHaveProperty("basePrice");
  });
});

describe("/products/[id] — variants carry their own price and stock", () => {
  it("shows a different price per variant", async () => {
    renderEditor();

    expect(await screen.findAllByText("149.99 EGP")).not.toHaveLength(0);
    // An XL may legitimately cost more than an S.
    expect(screen.getAllByText("179.99 EGP")).not.toHaveLength(0);
    expect(screen.getAllByText("SKU-2-XL")).not.toHaveLength(0);
  });
});

describe("/products/[id] — archive, never delete", () => {
  it("says a past order keeps what it was bought at, before anything happens", async () => {
    renderEditor();

    fireEvent.click(
      await screen.findByRole("button", { name: en.brand.archiveAction })
    );

    expect(await screen.findByText(en.brand.archiveTitle)).toBeInTheDocument();
    expect(
      screen.getByText(en.brand.conseqArchivedKept)
    ).toBeInTheDocument();
    expect(screen.getByText(en.brand.conseqArchivedHidden)).toBeInTheDocument();
    expect(screen.getByText(en.brand.conseqArchivedFinal)).toBeInTheDocument();
  });

  it("archives rather than deleting when confirmed", async () => {
    renderEditor();

    fireEvent.click(
      await screen.findByRole("button", { name: en.brand.archiveAction })
    );
    fireEvent.click(
      await screen.findByRole("button", { name: en.brand.archiveConfirm })
    );

    await waitFor(() => expect(patch).toHaveBeenCalled());
    const [, path, body] = patch.mock.calls[0] as [unknown, string, Record<string, unknown>];
    expect(path).toBe(`/v1/dashboard/products/${productId(1)}/status`);
    expect(body).toEqual({ status: "ARCHIVED" });
  });
});

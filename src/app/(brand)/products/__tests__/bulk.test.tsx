import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { en } from "@/messages/en";
import { LocaleProvider } from "@/lib/locale-context";

import { emptyProducts, mediaId, page, productId, wireDraft, wireProduct } from "./fixtures";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/products/bulk",
  useSearchParams: () => new URLSearchParams(),
}));

const get = vi.fn();
const post = vi.fn();
const patch = vi.fn();
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, api: { ...actual.api, get, post, patch } };
});

const BulkPage = (await import("../bulk/page")).default;
const { ar } = await import("@/messages/ar");

/** Forty DRAFT rows that already carry a name and a price — the save case. */
const fortyFilledDrafts = page(
  Array.from({ length: 40 }, (_, index) =>
    wireProduct(index + 1, { status: "DRAFT" })
  )
);

const mockList = (products: unknown) => {
  get.mockImplementation((_schema: unknown, path: string) => {
    if (path === "/v1/dashboard/products") return Promise.resolve(products);
    if (path === "/v1/categories") return Promise.resolve([]);
    return Promise.reject(new Error(`unstubbed path ${path}`));
  });
};

const renderBulk = (locale: "en" | "ar" = "en") =>
  render(
    <LocaleProvider locale={locale}>
      <BulkPage />
    </LocaleProvider>
  );

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  patch.mockReset();
  mockList(fortyFilledDrafts);
});

describe("/products/bulk — the grid, not a wizard", () => {
  it("opens every waiting draft as a row on one screen", async () => {
    renderBulk();

    const grid = await screen.findByTestId("bulk-grid");
    expect(within(grid).getAllByRole("listitem")).toHaveLength(40);
    // Forty products, one screen, no next-step button anywhere.
    expect(screen.queryByRole("button", { name: /next/i })).toBeNull();
  });

  it("puts the name and the price of each row in editable fields", async () => {
    renderBulk();

    await screen.findByTestId("bulk-grid");
    const name = screen.getByLabelText(en.brand.nameEn, {
      selector: `#bulk-name-${productId(1)}`,
    }) as HTMLInputElement;
    expect(name.value).toBe("Linen shirt 1");
  });

  it("draws its empty state when nothing is waiting", async () => {
    mockList(emptyProducts);
    renderBulk();

    expect(await screen.findByText(en.brand.bulkEmptyTitle)).toBeInTheDocument();
  });
});

describe("/products/bulk — one bad row does not discard thirty-nine good ones", () => {
  const brokenIndex = 17;

  beforeEach(() => {
    patch.mockImplementation((_schema: unknown, _path: string, body: unknown) => {
      const rows = (body as { products: { id: string }[] }).products;
      return Promise.resolve({
        results: rows.map((row, index) =>
          index === brokenIndex
            ? { id: row.id, ok: false, reason: "Could not update this product" }
            : {
                id: row.id,
                ok: true,
                product: wireProduct(index + 1, { id: row.id, status: "DRAFT" }),
              }
        ),
      });
    });
  });

  it("says how many landed rather than 'something failed'", async () => {
    renderBulk();

    await screen.findByTestId("bulk-grid");
    fireEvent.click(
      within(screen.getByTestId("bulk-desktop-actions")).getByRole("button", {
        name: en.brand.bulkSaveAction.replace("{n}", "40"),
      })
    );

    const note = await screen.findByTestId("bulk-save-note");
    expect(note).toHaveTextContent(
      en.brand.bulkSavedSome.replace("{ok}", "39").replace("{n}", "40")
    );
  });

  it("names WHICH row failed, next to that row", async () => {
    renderBulk();

    await screen.findByTestId("bulk-grid");
    fireEvent.click(
      within(screen.getByTestId("bulk-desktop-actions")).getByRole("button", {
        name: en.brand.bulkSaveAction.replace("{n}", "40"),
      })
    );

    const failedId = productId(brokenIndex + 1);
    const error = await screen.findByTestId(`bulk-row-error-${failedId}`);
    expect(error).toHaveTextContent("Could not update this product");
    // Inside its own row, not in a banner over the whole grid.
    expect(error.closest(`[data-testid="bulk-row-${failedId}"]`)).not.toBeNull();
  });

  it("keeps the other thirty-nine marked saved", async () => {
    renderBulk();

    await screen.findByTestId("bulk-grid");
    fireEvent.click(
      within(screen.getByTestId("bulk-desktop-actions")).getByRole("button", {
        name: en.brand.bulkSaveAction.replace("{n}", "40"),
      })
    );

    await screen.findByTestId("bulk-save-note");
    expect(screen.getAllByText(en.brand.savedOk)).toHaveLength(39);
    expect(screen.getAllByText(/Not saved/)).toHaveLength(1);
  });

  it("sends one body per row, in input order", async () => {
    renderBulk();

    await screen.findByTestId("bulk-grid");
    fireEvent.click(
      within(screen.getByTestId("bulk-desktop-actions")).getByRole("button", {
        name: en.brand.bulkSaveAction.replace("{n}", "40"),
      })
    );

    await waitFor(() => expect(patch).toHaveBeenCalled());
    const [, path, body] = patch.mock.calls[0] as [unknown, string, { products: { id: string }[] }];
    expect(path).toBe("/v1/dashboard/products/bulk");
    expect(body.products).toHaveLength(40);
    expect(body.products[0]?.id).toBe(productId(1));
  });
});

describe("/products/bulk — publishing refuses a product with no price and says so", () => {
  const pricelessId = productId(3);

  beforeEach(() => {
    mockList(
      page([
        wireProduct(1, { status: "DRAFT" }),
        wireProduct(2, { status: "DRAFT" }),
        wireDraft(3),
      ])
    );
    post.mockImplementation((_schema: unknown, path: string) => {
      if (path === "/v1/dashboard/products/bulk-publish") {
        return Promise.resolve({
          published: [productId(1), productId(2)],
          failed: [
            { id: pricelessId, reasons: ["name is not set", "price is not set"] },
          ],
        });
      }
      return Promise.reject(new Error(`unstubbed path ${path}`));
    });
  });

  it("names which product was refused and why, in the reader's language", async () => {
    renderBulk();

    await screen.findByTestId("bulk-grid");
    fireEvent.click(
      within(screen.getByTestId("bulk-desktop-actions")).getByRole("button", {
        name: en.brand.publish,
      })
    );

    const refusal = await screen.findByTestId(`bulk-publish-error-${pricelessId}`);
    expect(refusal).toHaveTextContent(en.brand.publishNoPrice);
    expect(refusal).toHaveTextContent(en.brand.publishNoName);
    expect(
      refusal.closest(`[data-testid="bulk-row-${pricelessId}"]`)
    ).not.toBeNull();
  });

  it("reports the count and never claims everything went live", async () => {
    renderBulk();

    await screen.findByTestId("bulk-grid");
    fireEvent.click(
      within(screen.getByTestId("bulk-desktop-actions")).getByRole("button", {
        name: en.brand.publish,
      })
    );

    const note = await screen.findByTestId("bulk-publish-note");
    expect(note).toHaveTextContent(
      en.brand.bulkPublishedSome.replace("{ok}", "2").replace("{n}", "3")
    );
  });

  it("flags the priceless row BEFORE anything is sent, and never shows a zero", async () => {
    const { container } = renderBulk();

    await screen.findByTestId("bulk-grid");
    expect(
      screen.getByTestId(`bulk-blocked-${pricelessId}`)
    ).toHaveTextContent(en.brand.needsPrice);
    const price = document.getElementById(
      `bulk-price-${pricelessId}`
    ) as HTMLInputElement;
    expect(price.value).toBe("");
    expect(container.textContent).not.toMatch(/\b0\.00\b/);
  });

  it("says the same thing in Arabic", async () => {
    renderBulk("ar");

    await screen.findByTestId("bulk-grid");
    fireEvent.click(
      within(screen.getByTestId("bulk-desktop-actions")).getByRole("button", {
        name: ar.brand.publish,
      })
    );

    const refusal = await screen.findByTestId(`bulk-publish-error-${pricelessId}`);
    expect(refusal).toHaveTextContent(ar.brand.publishNoPrice);
  });
});

describe("/products/bulk — photos go straight to storage", () => {
  beforeEach(() => {
    mockList(emptyProducts);
    post.mockImplementation((_schema: unknown, path: string) => {
      if (path === "/v1/dashboard/media/uploads") {
        return Promise.resolve({
          key: "products/b-1/photo.jpg",
          uploadUrl: "https://storage.example.test/put",
          expiresIn: 900,
        });
      }
      if (path === "/v1/dashboard/media/uploads/confirm") {
        return Promise.resolve({ id: mediaId(1), key: "products/b-1/photo.jpg" });
      }
      if (path === "/v1/dashboard/products/bulk-draft") {
        return Promise.resolve([wireDraft(1)]);
      }
      return Promise.reject(new Error(`unstubbed path ${path}`));
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 200 }))
    );
  });

  it("PUTs the bytes at the presigned URL rather than through the API", async () => {
    renderBulk();

    const input = await screen.findByLabelText(en.brand.addPhotos);
    const file = new File(["x"], "shirt.jpg", { type: "image/jpeg" });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() =>
      expect(screen.getByTestId("bulk-upload-shirt.jpg")).toHaveTextContent(
        en.brand.bulkDone
      )
    );

    const put = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(put?.[0]).toBe("https://storage.example.test/put");
    expect((put?.[1] as RequestInit).method).toBe("PUT");
    // The image never travels through the Nest process.
    expect(
      post.mock.calls.some(([, path]) => path === "/v1/dashboard/media/uploads")
    ).toBe(true);
  });

  it("turns confirmed photos into drafts and shows each one as a row", async () => {
    renderBulk();

    const input = await screen.findByLabelText(en.brand.addPhotos);
    fireEvent.change(input, {
      target: { files: [new File(["x"], "shirt.jpg", { type: "image/jpeg" })] },
    });

    const button = await screen.findByRole("button", {
      name: en.brand.createDrafts.replace("{n}", "1"),
    });
    await waitFor(() => expect(button).not.toBeDisabled());
    fireEvent.click(button);

    const grid = await screen.findByTestId("bulk-grid");
    expect(within(grid).getAllByRole("listitem")).toHaveLength(1);
    const [, path, body] = post.mock.calls.find(
      ([, callPath]) => callPath === "/v1/dashboard/products/bulk-draft"
    ) as [unknown, string, { mediaIds: string[] }];
    expect(path).toBe("/v1/dashboard/products/bulk-draft");
    expect(body.mediaIds).toEqual([mediaId(1)]);
  });

  it("marks a photo that failed rather than failing the whole drop", async () => {
    post.mockImplementation((_schema: unknown, path: string) => {
      if (path === "/v1/dashboard/media/uploads") {
        return Promise.reject(new Error("no ticket"));
      }
      return Promise.reject(new Error(`unstubbed path ${path}`));
    });

    renderBulk();

    const input = await screen.findByLabelText(en.brand.addPhotos);
    fireEvent.change(input, {
      target: { files: [new File(["x"], "bad.jpg", { type: "image/jpeg" })] },
    });

    await waitFor(() =>
      expect(screen.getByTestId("bulk-upload-bad.jpg")).toHaveTextContent(
        en.brand.uploadFailed
      )
    );
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { en } from "@/messages/en";
import { LocaleProvider } from "@/lib/locale-context";

import { flatCategories, orphanedCategory } from "./fixtures";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/admin/categories",
  useSearchParams: () => new URLSearchParams(),
}));

const get = vi.fn();
const post = vi.fn();
const patch = vi.fn();
const del = vi.fn();
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    api: { ...actual.api, get, post, patch, delete: del },
  };
});

const { ApiError } = await import("@/lib/api");
const { CategoriesScreen } = await import(
  "../admin/categories/categories-screen"
);
const { ar } = await import("@/messages/ar");

const answer = (value: unknown) =>
  value instanceof Error ? Promise.reject(value) : Promise.resolve(value);

/**
 * A category name appears twice on this screen by design — once as the row and
 * once as an option in every OTHER row's parent picker — so every lookup is
 * scoped to the tree rather than to the document.
 */
const inTree = async (text: string) =>
  within(await screen.findByTestId("category-tree")).getAllByText(text)[0];

const renderScreen = (locale: "en" | "ar" = "en") =>
  render(
    <LocaleProvider locale={locale}>
      <CategoriesScreen />
    </LocaleProvider>
  );

beforeEach(() => {
  vi.clearAllMocks();
  get.mockImplementation(() => answer(flatCategories));
  post.mockImplementation(() => answer({}));
  patch.mockImplementation(() => answer({}));
  del.mockImplementation(() => answer({}));
});

describe("/admin/categories — the tree comes from a flat array", () => {
  it("reads the only list this console may read", async () => {
    renderScreen();

    await waitFor(() => expect(get).toHaveBeenCalled());
    const [, path] = get.mock.calls[0] as [unknown, string];
    expect(path).toBe("/v1/categories");
  });

  it("renders nesting the response never contained", async () => {
    const { container } = renderScreen();

    await inTree("Home");
    const rows = Array.from(
      container.querySelectorAll("[data-category-id]")
    ).map((node) => ({
      id: node.getAttribute("data-category-id"),
      depth: node.getAttribute("data-depth"),
    }));

    expect(rows).toEqual([
      { id: "c-home", depth: "0" },
      { id: "c-kitchen", depth: "1" },
      { id: "c-mugs", depth: "2" },
      { id: "c-plates", depth: "2" },
      { id: "c-fashion", depth: "0" },
    ]);
  });

  it("says the nesting was rebuilt here rather than sent", async () => {
    renderScreen();

    expect(await screen.findByText(en.admin.flatListTitle)).toBeInTheDocument();
    expect(screen.getByText(en.admin.flatListBody)).toBeInTheDocument();
  });

  it("keeps a row whose parent is missing, and says so", async () => {
    get.mockImplementation(() =>
      answer([...flatCategories, orphanedCategory])
    );

    renderScreen();

    expect(await inTree("Orphaned")).toBeInTheDocument();
    expect(screen.getByText(en.admin.orphaned)).toBeInTheDocument();
  });
});

describe("/admin/categories — reordering works with a thumb", () => {
  it("offers explicit move controls at every width, not only below md", async () => {
    // Drag is unusable on a phone: a 44px row, a scrolling page, and a
    // long-press the browser reads as a text selection.
    renderScreen();

    await inTree("Mugs");
    expect(
      screen.getByRole("button", { name: `${en.admin.moveDown}: Mugs` })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: `${en.admin.moveUp}: Plates` })
    ).toBeInTheDocument();
  });

  it("posts the whole sibling order, under the right parent", async () => {
    renderScreen();

    await inTree("Plates");
    fireEvent.click(
      screen.getByRole("button", { name: `${en.admin.moveUp}: Plates` })
    );

    await waitFor(() => expect(post).toHaveBeenCalled());
    const [, path, body] = post.mock.calls[0] as [unknown, string, unknown];
    expect(path).toBe("/v1/admin/categories/reorder");
    expect(body).toEqual({
      parentId: "c-kitchen",
      orderedIds: ["c-plates", "c-mugs"],
    });
  });

  it("sends nothing when the move would change nothing", async () => {
    renderScreen();

    await inTree("Mugs");
    fireEvent.click(
      screen.getByRole("button", { name: `${en.admin.moveUp}: Mugs` })
    );

    expect(post).not.toHaveBeenCalled();
  });
});

describe("/admin/categories — reparenting", () => {
  it("never offers a category its own subtree as a parent", async () => {
    renderScreen();

    await inTree("Home");
    const control = screen.getByLabelText(`${en.admin.move}: Home`);
    const options = Array.from(control.querySelectorAll("option")).map(
      (node) => node.getAttribute("value")
    );

    expect(options).not.toContain("c-home");
    expect(options).not.toContain("c-kitchen");
    expect(options).not.toContain("c-plates");
    expect(options).toContain("c-fashion");
  });

  it("PATCHes the parent route", async () => {
    renderScreen();

    await inTree("Fashion");
    fireEvent.change(screen.getByLabelText(`${en.admin.move}: Fashion`), {
      target: { value: "c-home" },
    });

    await waitFor(() => expect(patch).toHaveBeenCalled());
    const [, path, body] = patch.mock.calls[0] as [unknown, string, unknown];
    expect(path).toBe("/v1/admin/categories/c-fashion/parent");
    expect(body).toEqual({ parentId: "c-home" });
  });
});

describe("/admin/categories — creating and renaming", () => {
  it("refuses a create the write contract would refuse", async () => {
    renderScreen();

    await inTree("Home");
    expect(
      screen.getByRole("button", { name: en.admin.createCategory })
    ).toBeDisabled();

    fireEvent.change(screen.getByLabelText(en.admin.categoryNameEn), {
      target: { value: "Lighting" },
    });
    fireEvent.change(screen.getByLabelText(en.admin.categorySlug), {
      target: { value: "Not A Slug" },
    });

    expect(
      screen.getByRole("button", { name: en.admin.createCategory })
    ).toBeDisabled();
  });

  it("creates with one language, because both would be unfinishable", async () => {
    renderScreen();

    await inTree("Home");
    fireEvent.change(screen.getByLabelText(en.admin.categoryNameEn), {
      target: { value: "Lighting" },
    });
    fireEvent.change(screen.getByLabelText(en.admin.categorySlug), {
      target: { value: "lighting" },
    });
    fireEvent.change(screen.getByLabelText(en.admin.parent), {
      target: { value: "c-home" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: en.admin.createCategory })
    );

    await waitFor(() => expect(post).toHaveBeenCalled());
    const [, path, body] = post.mock.calls[0] as [unknown, string, unknown];
    expect(path).toBe("/v1/admin/categories");
    expect(body).toEqual({
      name: { en: "Lighting" },
      slug: "lighting",
      parentId: "c-home",
    });
  });

  it("renames in place", async () => {
    renderScreen();

    await inTree("Mugs");
    fireEvent.click(screen.getAllByRole("button", { name: en.admin.rename })[2]);
    fireEvent.change(await screen.findByLabelText(en.admin.renameTitle), {
      target: { value: "Cups" },
    });
    fireEvent.click(screen.getByRole("button", { name: en.admin.saveName }));

    await waitFor(() => expect(patch).toHaveBeenCalled());
    const [, path, body] = patch.mock.calls[0] as [unknown, string, unknown];
    expect(path).toBe("/v1/admin/categories/c-mugs");
    expect(body).toEqual({ name: { en: "Cups" } });
  });
});

describe("/admin/categories — deleting says what it affects", () => {
  const openDelete = async () => {
    renderScreen();
    await inTree("Fashion");
    const buttons = screen.getAllByRole("button", {
      name: en.admin.deleteAction,
    });
    fireEvent.click(buttons[buttons.length - 1]);
  };

  it("names the products and children a delete would blank", async () => {
    // The foreign key is ON DELETE SET NULL: a delete that reaches the database
    // silently clears categoryId on every product beneath it. A migration is
    // pending; until then the service guard is the only protection.
    await openDelete();

    expect(
      await screen.findByText(en.admin.deleteAffectsProducts)
    ).toBeInTheDocument();
    expect(screen.getByText(en.admin.deleteAffectsChildren)).toBeInTheDocument();
    expect(screen.getByText(en.admin.deleteGuardOnly)).toBeInTheDocument();
  });

  it("calls the delete route once confirmed", async () => {
    await openDelete();

    const confirm = await screen.findAllByRole("button", {
      name: en.admin.deleteAction,
    });
    fireEvent.click(confirm[confirm.length - 1]);

    await waitFor(() => expect(del).toHaveBeenCalled());
    const [, path] = del.mock.calls[0] as [unknown, string];
    expect(path).toBe("/v1/admin/categories/c-fashion");
  });

  it("shows the API's own refusal rather than a generic failure", async () => {
    del.mockImplementation(() =>
      answer(
        new ApiError(409, "This category still has products", "Conflict")
      )
    );

    await openDelete();
    const confirm = await screen.findAllByRole("button", {
      name: en.admin.deleteAction,
    });
    fireEvent.click(confirm[confirm.length - 1]);

    expect(
      await screen.findByText("This category still has products")
    ).toBeInTheDocument();
  });
});

describe("/admin/categories — the four list states", () => {
  it("draws the loading skeleton", () => {
    get.mockImplementation(() => new Promise(() => {}));

    const { container } = renderScreen();

    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it("draws the empty state on an empty taxonomy", async () => {
    get.mockImplementation(() => answer([]));

    renderScreen();

    expect(
      await screen.findByText(en.admin.categoriesEmptyTitle)
    ).toBeInTheDocument();
  });

  it("draws the error state with a retry", async () => {
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

describe("/admin/categories — bilingual", () => {
  it("shows Arabic names and Arabic copy under ar", async () => {
    renderScreen("ar");

    expect(await inTree("المنزل")).toBeInTheDocument();
    expect(screen.getByText(ar.admin.flatListTitle)).toBeInTheDocument();
    expect(screen.queryByText("Home")).toBeNull();
  });

  it("renames into the language the console is being read in", async () => {
    renderScreen("ar");

    await inTree("أكواب");
    fireEvent.click(screen.getAllByRole("button", { name: ar.admin.rename })[2]);
    fireEvent.change(await screen.findByLabelText(ar.admin.renameTitle), {
      target: { value: "فناجين" },
    });
    fireEvent.click(screen.getByRole("button", { name: ar.admin.saveName }));

    await waitFor(() => expect(patch).toHaveBeenCalled());
    const [, , body] = patch.mock.calls[0] as [unknown, string, unknown];
    expect(body).toEqual({ name: { ar: "فناجين" } });
  });
});

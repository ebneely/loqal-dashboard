import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { en } from "@/messages/en";
import { LocaleProvider } from "@/lib/locale-context";

/**
 * The shop's five photo slots.
 *
 * Three rules, each of which the storefront depends on: there are never holes
 * (only the next empty slot can be filled), every change is one PUT of the
 * whole ordered list (so the order on screen IS the order shoppers see), and
 * an employee is shown the photos with no controls at all — absent, not
 * disabled, as everywhere else on this screen.
 */
const get = vi.fn();
const put = vi.fn();
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, api: { ...actual.api, get, put } };
});

let role = "BRAND_OWNER";
vi.mock("@/lib/auth-client", () => ({
  useSession: () => ({ data: { user: { role } }, isPending: false }),
}));

const { GallerySection } = await import("../gallery-section");
const g = en.brand.gallery;

const photo = (n: number) => ({
  mediaId: `m-${n}`,
  sortOrder: n,
  url: `https://cdn.example/${n}.jpg`,
});

const renderGallery = () =>
  render(
    <LocaleProvider locale="en">
      <GallerySection />
    </LocaleProvider>
  );

beforeEach(() => {
  role = "BRAND_OWNER";
  get.mockReset();
  put.mockReset();
});

describe("the gallery — no holes", () => {
  it("offers exactly one place to add a photo, the next empty slot", async () => {
    get.mockResolvedValue({ images: [photo(0), photo(1)] });
    renderGallery();

    await waitFor(() =>
      expect(screen.getAllByRole("button", { name: g.add })).toHaveLength(1)
    );

    // Two photos, one add button, and the remaining two slots are placeholders
    // rather than buttons that exist only to refuse.
    const slots = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(slots).toHaveLength(5);
    expect(within(slots[2]).getByRole("button", { name: g.add })).toBeInTheDocument();
    expect(within(slots[3]).queryByRole("button")).toBeNull();
    expect(within(slots[4]).queryByRole("button")).toBeNull();
  });

  it("marks the first slot as required and the rest as optional", async () => {
    get.mockResolvedValue({ images: [] });
    renderGallery();

    await waitFor(() => expect(screen.getByText(g.main)).toBeInTheDocument());
    expect(screen.getAllByText(g.required)).toHaveLength(1);
    expect(screen.getAllByText(g.optional)).toHaveLength(4);
  });
});

describe("the gallery — one write, the whole set", () => {
  it("removing a photo PUTs the list without it, in order", async () => {
    get.mockResolvedValue({ images: [photo(0), photo(1), photo(2)] });
    put.mockResolvedValue({ images: [photo(0), photo(2)] });
    renderGallery();

    const slots = await waitFor(() =>
      within(screen.getByRole("list")).getAllByRole("listitem")
    );
    fireEvent.click(within(slots[1]).getByRole("button", { name: g.remove }));

    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    expect(put.mock.calls[0][1]).toBe("/v1/brands/me/media");
    expect(put.mock.calls[0][2]).toEqual({ mediaIds: ["m-0", "m-2"] });
  });

  it("making a photo the main one moves it to the front and keeps the rest in order", async () => {
    get.mockResolvedValue({ images: [photo(0), photo(1), photo(2)] });
    put.mockResolvedValue({ images: [photo(2), photo(0), photo(1)] });
    renderGallery();

    const slots = await waitFor(() =>
      within(screen.getByRole("list")).getAllByRole("listitem")
    );
    fireEvent.click(within(slots[2]).getByRole("button", { name: g.makeMain }));

    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    expect(put.mock.calls[0][2]).toEqual({ mediaIds: ["m-2", "m-0", "m-1"] });
  });
});

describe("the gallery — an employee sees, and cannot change", () => {
  beforeEach(() => {
    role = "BRAND_EMPLOYEE";
  });

  it("shows the photos with no controls at all, not disabled ones", async () => {
    get.mockResolvedValue({ images: [photo(0)] });
    const { container } = renderGallery();

    await waitFor(() => expect(screen.getByText(g.readOnly)).toBeInTheDocument());
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(
      container.querySelectorAll("[disabled], [aria-disabled='true'], [data-disabled]")
    ).toHaveLength(0);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { en } from "@/messages/en";
import { LocaleProvider } from "@/lib/locale-context";

const replace = vi.fn();
const search = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn() }),
  usePathname: () => "/admin/brands",
  useSearchParams: () => search,
}));

const post = vi.fn();
const get = vi.fn();
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, api: { ...actual.api, get, post } };
});

const { ApiError } = await import("@/lib/api");
const { NewShopSheet } = await import("../new-shop-sheet");
const { BrandsScreen } = await import("../brands-screen");
const { slugify, isSubmittable, bodyFrom } = await import("../new-shop-form");
const { ar } = await import("@/messages/ar");

const a = en.admin;

const onCreated = vi.fn();

const renderSheet = (locale: "en" | "ar" = "en") =>
  render(
    <LocaleProvider locale={locale}>
      <NewShopSheet open onOpenChange={vi.fn()} onCreated={onCreated} />
    </LocaleProvider>
  );

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

const created = {
  brand: { id: "b1", name: "Zamalek Boutique", slug: "zamalek-boutique" },
  invite: {
    userId: "u1",
    inviteUrl: "https://dash.test/set-password?token=abc",
    delivery: { whatsapp: "sent", email: "not-configured" },
  },
};

const submitValidDraft = async () => {
  type(a.shopName, "Zamalek Boutique");
  type(a.ownerName, "Salma");
  type(a.ownerEmail, "salma@example.test");
  fireEvent.click(screen.getByRole("button", { name: a.createShop }));
  await waitFor(() => expect(post).toHaveBeenCalled());
};

beforeEach(() => {
  vi.clearAllMocks();
  post.mockResolvedValue(created);
});

describe("new-shop-form — the pure rules", () => {
  it("derives a Latin address and produces nothing from an Arabic name", () => {
    // Not an oversight: a slug is a URL path, and there is no transliteration
    // here that would be right. An empty suggestion is the admin's cue to type
    // the address themselves.
    expect(slugify("  Zamalek Boutique  ")).toBe("zamalek-boutique");
    expect(slugify("Café 24/7!")).toBe("caf-24-7");
    expect(slugify("بوتيك الزمالك")).toBe("");
  });

  it("refuses a draft the API would refuse", () => {
    const valid = {
      name: "Zamalek Boutique",
      slug: "zamalek-boutique",
      ownerName: "Salma",
      ownerEmail: "salma@example.test",
      ownerPhone: "",
    };

    expect(isSubmittable(valid)).toBe(true);
    expect(isSubmittable({ ...valid, ownerEmail: "" })).toBe(false);
    expect(isSubmittable({ ...valid, ownerEmail: "salma@" })).toBe(false);
    expect(isSubmittable({ ...valid, slug: "Zamalek Boutique" })).toBe(false);
    expect(isSubmittable({ ...valid, name: "  " })).toBe(false);
  });

  it("omits the phone rather than sending an empty one", () => {
    const draft = {
      name: " Zamalek Boutique ",
      slug: "zamalek-boutique",
      ownerName: " Salma ",
      ownerEmail: " Salma@Example.Test ",
      ownerPhone: "   ",
    };

    expect(bodyFrom(draft)).toEqual({
      name: "Zamalek Boutique",
      slug: "zamalek-boutique",
      owner: { name: "Salma", email: "salma@example.test" },
    });
  });
});

describe("Add a shop", () => {
  it("suggests an address from the name, and stops once the admin edits it", () => {
    renderSheet();
    type(a.shopName, "Zamalek Boutique");
    expect(screen.getByLabelText(a.shopSlug)).toHaveValue("zamalek-boutique");

    type(a.shopSlug, "zamalek");
    type(a.shopName, "Zamalek Boutique Cairo");
    expect(screen.getByLabelText(a.shopSlug)).toHaveValue("zamalek");
  });

  it("keeps the submit button disabled until the owner can actually be created", () => {
    renderSheet();
    type(a.shopName, "Zamalek Boutique");
    // A shop with no owner email is a shop nobody can sign in to.
    expect(
      screen.getByRole("button", { name: a.createShop })
    ).toBeDisabled();
  });

  it("sends the draft the pure rules describe", async () => {
    renderSheet();
    await submitValidDraft();

    expect(post.mock.calls[0][1]).toBe("/v1/brands");
    expect(post.mock.calls[0][2]).toEqual({
      name: "Zamalek Boutique",
      slug: "zamalek-boutique",
      owner: { name: "Salma", email: "salma@example.test" },
    });
  });

  it("shows every delivery outcome, not just success", async () => {
    renderSheet();
    await submitValidDraft();

    expect(await screen.findByText(a.outcomeSent)).toBeInTheDocument();
    expect(screen.getByText(a.outcomeNotConfigured)).toBeInTheDocument();
  });

  it("offers the link even when everything sent", async () => {
    post.mockResolvedValue({
      ...created,
      invite: {
        ...created.invite,
        delivery: { whatsapp: "sent", email: "sent" },
      },
    });
    renderSheet();
    await submitValidDraft();

    // The escape hatch is always there, not only after a failure.
    expect(
      await screen.findByRole("button", { name: a.copyLink })
    ).toBeInTheDocument();
  });

  it("keeps the result on screen instead of closing over it", async () => {
    renderSheet();
    await submitValidDraft();

    await screen.findByText(a.inviteResult);
    // The form is gone; the sheet is not. Closing is what tells the list to
    // reload, and nothing has closed yet.
    expect(screen.queryByLabelText(a.shopName)).toBeNull();
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("blames the address, not the request, when the address is taken", async () => {
    post.mockRejectedValue(new ApiError(409, "slug taken", "Conflict"));
    renderSheet();
    await submitValidDraft();

    expect(await screen.findByText(a.slugTaken)).toBeInTheDocument();
    expect(screen.queryByText(a.saveFailed)).toBeNull();
    // The draft survives, because retyping it is the whole cost of the mistake.
    expect(screen.getByLabelText(a.shopName)).toHaveValue("Zamalek Boutique");
  });

  it("says nothing was changed when the request itself failed", async () => {
    post.mockRejectedValue(new ApiError(500, "boom", "ServerError"));
    renderSheet();
    await submitValidDraft();

    expect(await screen.findByText(a.saveFailed)).toBeInTheDocument();
    expect(screen.queryByText(a.slugTaken)).toBeNull();
  });

  it("renders in Arabic", () => {
    renderSheet("ar");
    expect(screen.getByText(ar.admin.addShop)).toBeInTheDocument();
    expect(screen.queryByText(a.addShop)).toBeNull();
  });
});

describe("/admin/brands offers the way in", () => {
  it("puts the trigger on the list screen, which had no way to create a shop at all", async () => {
    get.mockResolvedValue({ items: [], nextCursor: null });

    render(
      <LocaleProvider locale="en">
        <BrandsScreen />
      </LocaleProvider>
    );

    expect(
      await screen.findByRole("button", { name: a.addShop })
    ).toBeInTheDocument();
  });
});

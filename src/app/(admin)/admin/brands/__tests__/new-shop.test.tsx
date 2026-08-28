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
  get.mockResolvedValue({ available: true });
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

describe("Is this address free?", () => {
  it("asks about the address derived from the name, not only one typed by hand", async () => {
    renderSheet();
    type(a.shopName, "Zamalek Boutique");

    expect(await screen.findByText(a.slugFree)).toBeInTheDocument();
    expect(get.mock.calls[0][1]).toBe("/v1/admin/brands/slug-available");
    expect(get.mock.calls[0][2].query).toEqual({ slug: "zamalek-boutique" });
  });

  it("says it is checking while the answer is in flight", () => {
    get.mockReturnValue(new Promise(() => {}));
    renderSheet();
    type(a.shopName, "Zamalek Boutique");

    expect(screen.getByText(a.slugChecking)).toBeInTheDocument();
  });

  it("reports a taken address before a submit is ever attempted", async () => {
    get.mockResolvedValue({ available: false });
    renderSheet();
    type(a.shopName, "Zamalek Boutique");
    type(a.ownerName, "Salma");
    type(a.ownerEmail, "salma@example.test");

    expect(await screen.findByText(a.slugTaken)).toBeInTheDocument();
    // The whole point: the admin never gets to spend the submit. Everything
    // else in this sheet is valid and the button is still refused.
    expect(screen.getByRole("button", { name: a.createShop })).toBeDisabled();
    expect(post).not.toHaveBeenCalled();
  });

  it("never asks about an address the endpoint would refuse", async () => {
    renderSheet();
    // The endpoint 400s on a malformed slug, so asking about one buys a red
    // error for a string the submit button already refuses.
    type(a.shopSlug, "Zamalek Boutique");
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(get).not.toHaveBeenCalled();
    expect(screen.getByText(a.shopSlugHint)).toBeInTheDocument();
  });

  it("does not turn an aborted check into an answer", async () => {
    const signals: AbortSignal[] = [];
    get.mockImplementation((_schema, _path, options) => {
      signals.push(options.signal);
      return new Promise((_resolve, reject) => {
        options.signal.addEventListener("abort", () =>
          reject(new DOMException("The operation was aborted.", "AbortError"))
        );
      });
    });

    renderSheet();
    type(a.shopSlug, "zamalek-boutique");
    await waitFor(() => expect(get).toHaveBeenCalledTimes(1));

    type(a.shopSlug, "zamalek-boutique-cairo");
    await waitFor(() => expect(signals[0].aborted).toBe(true));

    // An abort is this component cancelling itself, not the API saying no.
    expect(screen.queryByText(a.slugTaken)).toBeNull();
    expect(screen.queryByText(a.saveFailed)).toBeNull();
    expect(screen.getByText(a.slugChecking)).toBeInTheDocument();
  });

  it("keeps the 409 as the truth when the check said the address was free", async () => {
    // The check reads a replica and is advisory. Brand.slug is unique and the
    // create still answers 409, and that answer outranks this one.
    get.mockResolvedValue({ available: true });
    post.mockRejectedValue(new ApiError(409, "slug taken", "Conflict"));
    renderSheet();
    await submitValidDraft();

    expect(await screen.findByText(a.slugTaken)).toBeInTheDocument();
    expect(screen.queryByText(a.slugFree)).toBeNull();
  });

  it("says nothing at all when the check itself failed", async () => {
    get.mockRejectedValue(new ApiError(500, "boom", "ServerError"));
    renderSheet();
    type(a.shopName, "Zamalek Boutique");

    await waitFor(() => expect(get).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.getByText(a.shopSlugHint)).toBeInTheDocument()
    );
    expect(screen.queryByText(a.slugTaken)).toBeNull();
    expect(screen.queryByText(a.saveFailed)).toBeNull();
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

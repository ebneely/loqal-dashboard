import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { en } from "@/messages/en";
import { LocaleProvider } from "@/lib/locale-context";

import {
  bareProfile,
  employeeProfile,
  ownerProfile,
  profileWithShippingService,
} from "./fixtures";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/settings",
  useSearchParams: () => new URLSearchParams(),
}));

/**
 * Only `api` is replaced. ApiError stays the real class — `listStateFor` does
 * an `instanceof` check on it.
 */
const get = vi.fn();
const patch = vi.fn();
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, api: { ...actual.api, get, patch } };
});

const { ApiError } = await import("@/lib/api");
const SettingsPage = (await import("../page")).default;
const { ar } = await import("@/messages/ar");

const answer = (value: unknown) =>
  value instanceof Error ? Promise.reject(value) : Promise.resolve(value);

const renderSettings = (locale: "en" | "ar" = "en") =>
  render(
    <LocaleProvider locale={locale}>
      <SettingsPage />
    </LocaleProvider>
  );

/** Reset in beforeEach, not afterEach. */
beforeEach(() => {
  vi.restoreAllMocks();
  get.mockReset();
  patch.mockReset();
  get.mockImplementation(() => answer(ownerProfile));
  patch.mockImplementation(() => answer(ownerProfile));
});

// ---------------------------------------------------------------------------
// The role split
// ---------------------------------------------------------------------------

describe("/settings — the owner blocks are absent for an employee", () => {
  beforeEach(() => {
    get.mockImplementation(() => answer(employeeProfile));
  });

  it("renders no payout block and no Loqal terms block", async () => {
    renderSettings("en");

    await screen.findByTestId("settings-trading");
    expect(screen.queryByTestId("settings-payout")).toBeNull();
    expect(screen.queryByTestId("settings-loqal-terms")).toBeNull();
    expect(screen.queryByText(en.brand.payoutMethod)).toBeNull();
    expect(screen.queryByText(en.brand.payoutAccount)).toBeNull();
    expect(screen.queryByText(en.brand.monthlyFee)).toBeNull();
  });

  /** Absent, never disabled. A greyed field still says an account exists. */
  it("leaves no payout control merely disabled", async () => {
    const { container } = renderSettings("en");

    await screen.findByTestId("settings-trading");
    expect(
      container.querySelectorAll(
        "[disabled], [aria-disabled='true'], [data-disabled]"
      )
    ).toHaveLength(0);
  });

  it("still shows the blocks the shop itself decides", async () => {
    renderSettings("en");

    expect(await screen.findByTestId("settings-profile")).toBeInTheDocument();
    expect(screen.getByTestId("settings-trading")).toBeInTheDocument();
    expect(screen.getByTestId("settings-invoice-identity")).toBeInTheDocument();
    expect(screen.getByTestId("settings-notification")).toBeInTheDocument();
  });
});

describe("/settings — the owner sees both money blocks", () => {
  it("shows the payout account so a quiet change to it is noticeable", async () => {
    renderSettings("en");

    const payout = await screen.findByTestId("settings-payout");
    expect(within(payout).getByText(en.brand.payoutMethod)).toBeInTheDocument();
    expect(within(payout).getByText("InstaPay")).toBeInTheDocument();
    expect(
      within(payout).getByText(en.brand.payoutCheckNote)
    ).toBeInTheDocument();
  });

  /**
   * The shipped `PATCH /v1/brands/me` takes neither settlement field, so this
   * block is facts rather than a form. A disabled input would be a save button
   * that fails after the shop has typed its account number.
   */
  it("draws the payout as facts, with no form control", async () => {
    renderSettings("en");

    const payout = await screen.findByTestId("settings-payout");
    expect(payout.querySelectorAll("input, select, textarea")).toHaveLength(0);
    expect(within(payout).queryAllByRole("textbox")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Loqal's terms
// ---------------------------------------------------------------------------

describe("/settings — Loqal's terms are facts, not a disabled form", () => {
  it("renders every term as text with no form control anywhere in the block", async () => {
    renderSettings("en");

    const terms = await screen.findByTestId("settings-loqal-terms");
    expect(terms.querySelectorAll("input, select, textarea, button")).toHaveLength(0);
    expect(within(terms).queryAllByRole("textbox")).toHaveLength(0);
    expect(within(terms).queryAllByRole("combobox")).toHaveLength(0);
    expect(within(terms).queryAllByRole("checkbox")).toHaveLength(0);
    // Nothing greyed either: a disabled input invites an argument about
    // editing it, and a sentence does not.
    expect(
      terms.querySelectorAll("[disabled], [aria-disabled='true']")
    ).toHaveLength(0);
  });

  it("says who set them", async () => {
    renderSettings("en");

    const terms = await screen.findByTestId("settings-loqal-terms");
    expect(within(terms).getByText(en.brand.loqalTermsNote)).toBeInTheDocument();
  });

  it("reads a percentage as a percentage, never as a bare number", async () => {
    renderSettings("en");

    const terms = await screen.findByTestId("settings-loqal-terms");
    expect(within(terms).getByText("12%")).toBeInTheDocument();
    expect(within(terms).getByText("350.00 EGP")).toBeInTheDocument();
    expect(within(terms).getByText("2026-12-31")).toBeInTheDocument();
  });

  it("says a fixed per-order fee in money", async () => {
    get.mockImplementation(() => answer(bareProfile));
    renderSettings("en");

    const terms = await screen.findByTestId("settings-loqal-terms");
    expect(within(terms).getByText("8.00 EGP")).toBeInTheDocument();
    expect(within(terms).getAllByText(en.brand.notSet).length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Delivery routes
// ---------------------------------------------------------------------------

describe("/settings — only the live delivery routes are offered", () => {
  it("offers exactly two routes and never the shipping service", async () => {
    renderSettings("en");

    await screen.findByTestId("settings-trading");
    const boxes = screen.getAllByRole("checkbox");
    expect(boxes).toHaveLength(2);
    expect(
      screen.getByRole("checkbox", { name: en.brand.routeRiderOpt })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: en.brand.routeOwnOpt })
    ).toBeInTheDocument();
    expect(screen.queryByText(/shipping/i)).toBeNull();
  });

  it("does not fail, or re-offer, when the row already carries the dead route", async () => {
    get.mockImplementation(() => answer(profileWithShippingService));
    renderSettings("en");

    await screen.findByTestId("settings-trading");
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
  });

  it("refuses a shop with no route at all", async () => {
    renderSettings("en");

    await screen.findByTestId("settings-trading");
    for (const box of screen.getAllByRole("checkbox")) fireEvent.click(box);
    fireEvent.click(screen.getByRole("button", { name: en.brand.save }));

    expect(await screen.findByText(en.brand.routesRequired)).toBeInTheDocument();
    expect(patch).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// The images
// ---------------------------------------------------------------------------

describe("/settings — the logo cannot be shown and the screen says so", () => {
  it("draws no image and explains why", async () => {
    const { container } = renderSettings("en");

    const media = await screen.findByTestId("settings-media");
    expect(
      within(media).getByText(en.brand.mediaUnavailableTitle)
    ).toBeInTheDocument();
    // A broken <img> would read as "your logo is gone".
    expect(container.querySelectorAll("img")).toHaveLength(0);
    expect(within(media).getByText(ownerProfile.logoMediaId!)).toBeInTheDocument();
    expect(within(media).getByText(en.brand.mediaNone)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Saving
// ---------------------------------------------------------------------------

describe("/settings — the save", () => {
  it("sends the flat body the API accepts, and nothing else", async () => {
    renderSettings("en");

    await screen.findByTestId("settings-trading");
    fireEvent.change(screen.getByLabelText(en.brand.brandName), {
      target: { value: "A renamed shop" },
    });
    fireEvent.click(screen.getByRole("button", { name: en.brand.save }));

    await waitFor(() => expect(patch).toHaveBeenCalled());
    const [, path, body] = patch.mock.calls[0] as [unknown, string, Record<string, unknown>];
    expect(path).toBe("/v1/brands/me");
    expect(body.name).toBe("A renamed shop");
    expect(Object.keys(body)).not.toContain("trading");
    expect(Object.keys(body)).not.toContain("settlementMethod");
    expect(Object.keys(body)).not.toContain("invoiceTerms");
    expect(await screen.findByText(en.brand.savedOk)).toBeInTheDocument();
  });

  it("refuses to save a description with no language in it", async () => {
    renderSettings("en");

    await screen.findByTestId("settings-profile");
    fireEvent.change(screen.getByLabelText(en.brand.descEn), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText(en.brand.descArabic), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: en.brand.save }));

    await waitFor(() =>
      expect(screen.getAllByText(en.brand.oneLangRequired).length).toBeGreaterThan(1)
    );
    expect(patch).not.toHaveBeenCalled();
  });

  it("says so plainly when the API refuses the write on role", async () => {
    patch.mockImplementation(() =>
      Promise.reject(new ApiError(403, "Forbidden", "Forbidden"))
    );
    renderSettings("en");

    await screen.findByTestId("settings-trading");
    fireEvent.click(screen.getByRole("button", { name: en.brand.save }));

    expect(
      await screen.findByText(en.brand.settingsSaveDenied)
    ).toBeInTheDocument();
  });

  it("keeps one save control at every width", async () => {
    renderSettings("en");

    await screen.findByTestId("settings-trading");
    expect(
      screen.getAllByRole("button", { name: en.brand.save })
    ).toHaveLength(1);
    const bar = screen.getByTestId("settings-action-bar");
    expect(bar.closest('[data-slot="mobile-action-bar"]')).toHaveAttribute(
      "data-hide-at",
      "never"
    );
  });
});

// ---------------------------------------------------------------------------
// The states
// ---------------------------------------------------------------------------

describe("/settings — the states", () => {
  it("draws the loading state before anything arrives", () => {
    get.mockImplementation(() => new Promise(() => {}));
    const { container } = renderSettings("en");

    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it("draws the error state, with a retry", async () => {
    get.mockImplementation(() =>
      Promise.reject(new ApiError(500, "boom", "Internal"))
    );
    renderSettings("en");

    expect(
      await screen.findByText(en.brand.settingsErrorTitle)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: en.brand.retry })
    ).toBeInTheDocument();
  });

  it("draws denied on a 403 rather than a crash or a toast", async () => {
    get.mockImplementation(() =>
      Promise.reject(new ApiError(403, "Forbidden", "Forbidden"))
    );
    const { container } = renderSettings("en");

    expect(
      await screen.findByText(en.brand.settingsDeniedTitle)
    ).toBeInTheDocument();
    expect(container.querySelector('[data-state="denied"]')).not.toBeNull();
    expect(document.querySelector("[data-sonner-toaster]")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Arabic
// ---------------------------------------------------------------------------

describe("/settings — Arabic", () => {
  it("labels every block from the Arabic catalogue", async () => {
    renderSettings("ar");

    const payout = await screen.findByTestId("settings-payout");
    expect(within(payout).getByText(ar.brand.payoutMethod)).toBeInTheDocument();
    expect(screen.getByText(ar.brand.loqalTermsNote)).toBeInTheDocument();
    expect(screen.getByText(ar.brand.routesLiveOnly)).toBeInTheDocument();
  });

  it("keeps money and dates in Latin digits, as the money row does", async () => {
    renderSettings("ar");

    const terms = await screen.findByTestId("settings-loqal-terms");
    expect(within(terms).getByText("350.00 EGP")).toBeInTheDocument();
    expect(within(terms).getByText("2026-12-31")).toBeInTheDocument();
  });
});

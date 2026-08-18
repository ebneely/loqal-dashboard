import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { en } from "@/messages/en";
import { LocaleProvider } from "@/lib/locale-context";

import { brandDetail, suspendedBrandDetail } from "./fixtures";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => `/admin/brands/${brandDetail.id}`,
  useSearchParams: () => new URLSearchParams(),
}));

const get = vi.fn();
const post = vi.fn();
const patch = vi.fn();
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, api: { ...actual.api, get, post, patch } };
});

const { ApiError } = await import("@/lib/api");
const { BrandDetail } = await import("../admin/brands/[id]/brand-detail");
const { adminBrandDetailSchema } = await import(
  "../admin/brands/[id]/brand-detail-data"
);
const { ar } = await import("@/messages/ar");

const answer = (value: unknown) =>
  value instanceof Error ? Promise.reject(value) : Promise.resolve(value);

const renderScreen = (locale: "en" | "ar" = "en", id = brandDetail.id) =>
  render(
    <LocaleProvider locale={locale}>
      <BrandDetail id={id} />
    </LocaleProvider>
  );

/** Radix tabs need a mouseDown before the click, or the panel never swaps. */
const openTab = async (name: string) => {
  const trigger = await screen.findByRole("tab", { name });
  fireEvent.mouseDown(trigger);
  fireEvent.click(trigger);
  return trigger;
};

beforeEach(() => {
  vi.clearAllMocks();
  get.mockImplementation(() => answer(brandDetail));
  post.mockImplementation(() => answer(brandDetail));
  patch.mockImplementation(() => answer(brandDetail));
});

describe("/admin/brands/[id] — the flat admin detail", () => {
  it("parses the response the endpoint actually sends", () => {
    expect(adminBrandDetailSchema.safeParse(brandDetail).success).toBe(true);
  });

  it("survives a column nobody has rendered yet", async () => {
    // ADMIN_DETAIL_FIELDS is a select over a forty-column table with no DTO in
    // front of it. A strict schema would blank the only screen that can suspend
    // a brand over a column nothing reads.
    const parsed = adminBrandDetailSchema.safeParse({
      ...brandDetail,
      somethingAddedLastTuesday: true,
    });
    expect(parsed.success).toBe(true);
  });

  it("reads the whole brand from one address", async () => {
    renderScreen();

    await waitFor(() => expect(get).toHaveBeenCalled());
    const [, path] = get.mock.calls[0] as [unknown, string];
    expect(path).toBe(`/v1/admin/brands/${brandDetail.id}`);
  });

  it("puts the two computed figures above the tabs", async () => {
    const { container } = renderScreen();

    await screen.findByText(brandDetail.name);
    expect(screen.getAllByText("48,200.00 EGP").length).toBeGreaterThan(0);
    expect(
      container.querySelector('[data-direction="LOQAL_OWES_BRAND"]')
    ).not.toBeNull();
  });
});

describe("/admin/brands/[id] — commercial terms", () => {
  it("makes the current deal obvious before any field is read", async () => {
    renderScreen();

    await openTab(en.admin.tabTerms);
    expect(screen.getByText(en.admin.currentDeal)).toBeInTheDocument();
    expect(screen.getByText("12.00%")).toBeInTheDocument();
    expect(screen.getAllByText("350.00").length).toBeGreaterThan(0);
  });

  it("shows what changed, and refuses to save when nothing has", async () => {
    renderScreen();

    await openTab(en.admin.tabTerms);
    expect(screen.getByText(en.admin.noChanges)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: en.admin.saveTerms })
    ).toBeDisabled();
  });

  it("names each field that moved, from and to", async () => {
    renderScreen();

    await openTab(en.admin.tabTerms);
    fireEvent.change(screen.getByLabelText(en.admin.monthlyFee), {
      target: { value: "400.00" },
    });

    const diff = screen.getByTestId("terms-diff");
    expect(diff).toHaveTextContent("350.00");
    expect(diff).toHaveTextContent("400.00");
  });

  it("PATCHes only what moved, to the terms route", async () => {
    renderScreen();

    await openTab(en.admin.tabTerms);
    fireEvent.change(screen.getByLabelText(en.admin.monthlyFee), {
      target: { value: "400.00" },
    });
    fireEvent.click(screen.getByRole("button", { name: en.admin.saveTerms }));

    await waitFor(() => expect(patch).toHaveBeenCalled());
    const [, path, body] = patch.mock.calls[0] as [unknown, string, unknown];
    expect(path).toBe(`/v1/brands/${brandDetail.id}/terms`);
    expect(body).toEqual({ monthlyFee: "400.00" });
  });

  it("carries the payout account, and names the audit gap beside it", async () => {
    // A SALES rep could recently redirect this field invisibly, and nothing
    // records who changed it or when. The screen must not imply otherwise.
    renderScreen();

    await openTab(en.admin.tabTerms);
    expect(screen.getByLabelText(en.admin.account)).toHaveValue(
      "nefertari-payouts"
    );
    expect(screen.getByText(en.admin.accountAuditGap)).toBeInTheDocument();
  });
});

describe("/admin/brands/[id] — standing", () => {
  it("keeps Loqal's judgement beside the computed badges, never merged", async () => {
    renderScreen();

    await openTab(en.admin.tabStanding);
    expect(screen.getByText("72")).toBeInTheDocument();
    expect(screen.getByText("/ 100")).toBeInTheDocument();
    expect(screen.getByText(en.admin.reputationNote)).toBeInTheDocument();
    // Two separate cards, two separate kinds of claim.
    expect(screen.getByText(en.admin.computedBadges)).toBeInTheDocument();
    expect(screen.getByText(en.admin.verifiedBadges)).toBeInTheDocument();
    expect(screen.getByText("SAME_DAY_SHIPPER")).toBeInTheDocument();
  });

  it("says who set the score and when", async () => {
    renderScreen();

    await openTab(en.admin.tabStanding);
    expect(
      screen.getByText(/2026-07-02/)
    ).toBeInTheDocument();
  });

  it("writes the score to its own SUPER_ADMIN-only route", async () => {
    renderScreen();

    await openTab(en.admin.tabStanding);
    fireEvent.change(screen.getByLabelText(en.admin.scoreLabel), {
      target: { value: "81" },
    });
    fireEvent.click(screen.getByRole("button", { name: en.admin.saveScore }));

    await waitFor(() => expect(patch).toHaveBeenCalled());
    const [, path, body] = patch.mock.calls[0] as [unknown, string, unknown];
    expect(path).toBe(`/v1/admin/brands/${brandDetail.id}/reputation-score`);
    expect(body).toEqual({ score: 81 });
  });
});

describe("/admin/brands/[id] — placement", () => {
  it("labels the brand as promoted right beside the switch", async () => {
    renderScreen();

    await openTab(en.admin.tabPlacement);
    expect(screen.getAllByText(en.admin.promotedLabel).length).toBeGreaterThan(0);
    expect(screen.getByText(en.admin.promotedRule)).toBeInTheDocument();
  });

  it("shows sortOrder as a fact, because no route writes it", async () => {
    renderScreen();

    await openTab(en.admin.tabPlacement);
    const field = screen.getByLabelText(en.admin.sortOrder);
    expect(field).toHaveValue("3");
    expect(field).toHaveAttribute("readonly");
    expect(screen.getByText(en.admin.sortOrderReadOnly)).toBeInTheDocument();
  });

  it("sends only the two fields the promotion route accepts", async () => {
    renderScreen();

    await openTab(en.admin.tabPlacement);
    fireEvent.click(
      screen.getByRole("button", { name: en.admin.savePlacement })
    );

    await waitFor(() => expect(patch).toHaveBeenCalled());
    const [, path, body] = patch.mock.calls[0] as [unknown, string, unknown];
    expect(path).toBe(`/v1/admin/brands/${brandDetail.id}/promotion`);
    expect(body).toEqual({
      isPromoted: true,
      featuredUntil: "2026-09-30T00:00:00.000Z",
    });
  });
});

describe("/admin/brands/[id] — suspension", () => {
  const openSheet = async () => {
    renderScreen();
    await openTab(en.admin.tabDanger);
    fireEvent.click(
      screen.getByRole("button", { name: en.admin.suspendAction })
    );
  };

  it("states BOTH consequences in words: gone now, orders still complete", async () => {
    await openSheet();

    expect(
      await screen.findByText(en.admin.suspendVanishes)
    ).toBeInTheDocument();
    expect(screen.getByText(en.admin.suspendInFlight)).toBeInTheDocument();
    expect(screen.getByText(en.admin.suspendSettlements)).toBeInTheDocument();
  });

  it("cannot be confirmed without a reason", async () => {
    await openSheet();

    fireEvent.click(
      await screen.findByRole("button", { name: en.admin.reasonRequired })
    );

    expect(post).not.toHaveBeenCalled();
  });

  it("posts the reason to the suspend route", async () => {
    await openSheet();

    fireEvent.change(await screen.findByLabelText(en.admin.suspendReason), {
      target: { value: "Counterfeit goods" },
    });
    const confirm = screen.getAllByRole("button", {
      name: en.admin.suspendAction,
    });
    fireEvent.click(confirm[confirm.length - 1]);

    await waitFor(() => expect(post).toHaveBeenCalled());
    const [, path, body] = post.mock.calls[0] as [unknown, string, unknown];
    expect(path).toBe(`/v1/admin/brands/${brandDetail.id}/suspend`);
    expect(body).toEqual({ reason: "Counterfeit goods" });
  });

  it("offers reactivation, and no suspension, for a suspended brand", async () => {
    get.mockImplementation(() => answer(suspendedBrandDetail));

    renderScreen();

    await openTab(en.admin.tabDanger);
    expect(
      screen.getByRole("button", { name: en.admin.reactivateAction })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: en.admin.suspendAction })
    ).toBeNull();
  });

  it("states both consequences in Arabic too", async () => {
    renderScreen("ar");

    await openTab(ar.admin.tabDanger);
    fireEvent.click(
      screen.getByRole("button", { name: ar.admin.suspendAction })
    );

    expect(
      await screen.findByText(ar.admin.suspendVanishes)
    ).toBeInTheDocument();
    expect(screen.getByText(ar.admin.suspendInFlight)).toBeInTheDocument();
  });
});

describe("/admin/brands/[id] — the four screen states", () => {
  it("draws the loading skeleton", () => {
    get.mockImplementation(() => new Promise(() => {}));

    const { container } = renderScreen();

    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it("draws a not-found panel with a way out on a 404", async () => {
    get.mockImplementation(() =>
      answer(new ApiError(404, "No such brand", "NotFound"))
    );

    renderScreen();

    expect(
      await screen.findByText(en.admin.brandNotFoundTitle)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: en.admin.backToBrands })
    ).toHaveAttribute("href", "/admin/brands");
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
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";

import { en } from "@/messages/en";
import { LocaleProvider } from "@/lib/locale-context";

import {
  brandDetail,
  brandWithActiveOwner,
  brandWithInvitedOwner,
  brandWithNullOwner,
  inviteResultPayload,
  suspendedBrandDetail,
} from "./fixtures";

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

/**
 * THE OWNER BLOCK.
 *
 * `owner` is being added to `GET /v1/admin/brands/:id` in the backend repo, by
 * somebody else, on their own schedule. So the first two tests are the ones
 * that matter most: the screen has to be correct on BOTH sides of that deploy,
 * and the state it shows while the field is missing has to be the truthful one
 * rather than a crash or a blank.
 */
describe("/admin/brands/[id] — the owner block", () => {
  it("parses a response with no owner field at all", () => {
    // Today's backend. Optional, not merely nullable.
    expect(adminBrandDetailSchema.safeParse(brandDetail).success).toBe(true);
    expect(adminBrandDetailSchema.parse(brandDetail).owner).toBeUndefined();
  });

  it("parses an explicit null and an owner alike", () => {
    expect(adminBrandDetailSchema.safeParse(brandWithNullOwner).success).toBe(
      true
    );
    const parsed = adminBrandDetailSchema.safeParse(brandWithInvitedOwner);
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.owner?.mustChangePassword).toBe(true);
  });

  it("says nobody can sign in when the field is absent", async () => {
    renderScreen();

    expect(await screen.findByText(en.admin.ownerNone)).toBeInTheDocument();
    expect(screen.getByText(en.admin.ownerNoneBody)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: en.admin.inviteOwner })
    ).toBeInTheDocument();
  });

  it("says the same thing for an explicit null", async () => {
    get.mockImplementation(() => answer(brandWithNullOwner));

    renderScreen();

    expect(await screen.findByText(en.admin.ownerNone)).toBeInTheDocument();
  });

  it("reads invited from mustChangePassword, and offers a fresh link", async () => {
    get.mockImplementation(() => answer(brandWithInvitedOwner));

    renderScreen();

    expect(await screen.findByText(en.admin.ownerInvited)).toBeInTheDocument();
    expect(screen.getByText(en.admin.ownerInvitedBody)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: en.admin.resendInvite })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: en.admin.inviteOwner })
    ).toBeNull();
  });

  it("reads active from the same column, and offers no invite", async () => {
    get.mockImplementation(() => answer(brandWithActiveOwner));

    const { container } = renderScreen();

    // Scoped to the block: `ownerActive` and the brand's own ACTIVE pill are
    // the same word, and they are two different facts about two different
    // things.
    const block = await waitFor(() => {
      const found = container.querySelector('[data-slot="owner-block"]');
      expect(found).not.toBeNull();
      return found as HTMLElement;
    });

    expect(within(block).getByText(en.admin.ownerActive)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: en.admin.inviteOwner })
    ).toBeNull();
    expect(screen.queryByRole("button", { name: en.admin.resendInvite })).toBeNull();
  });

  it("keeps the invite disabled until the account could actually be created", async () => {
    renderScreen();

    fireEvent.click(
      await screen.findByRole("button", { name: en.admin.inviteOwner })
    );

    const submit = await screen.findByRole("button", {
      name: en.admin.createShop,
    });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByLabelText(en.admin.ownerName), {
      target: { value: "Salma Fouad" },
    });
    fireEvent.change(screen.getByLabelText(en.admin.ownerEmail), {
      target: { value: "salma@example.test" },
    });

    await waitFor(() => expect(submit).toBeEnabled());
  });

  it("posts the owner to the brand's own invite route and shows the link", async () => {
    post.mockImplementation(() => answer(inviteResultPayload));

    renderScreen();

    fireEvent.click(
      await screen.findByRole("button", { name: en.admin.inviteOwner })
    );
    fireEvent.change(screen.getByLabelText(en.admin.ownerName), {
      target: { value: "Salma Fouad" },
    });
    fireEvent.change(screen.getByLabelText(en.admin.ownerEmail), {
      target: { value: "Salma@Example.Test" },
    });
    fireEvent.click(screen.getByRole("button", { name: en.admin.createShop }));

    await waitFor(() => expect(post).toHaveBeenCalled());
    const [, path, body] = post.mock.calls[0] as [unknown, string, unknown];
    expect(path).toBe(`/v1/admin/brands/${brandDetail.id}/invite-owner`);
    // Lower-cased and trimmed before it leaves, the same as Add-a-shop.
    expect(body).toEqual({ name: "Salma Fouad", email: "salma@example.test" });

    // The link is on screen as text, because it is the escape hatch for every
    // delivery that did not land.
    expect(
      await screen.findByText(inviteResultPayload.inviteUrl)
    ).toBeInTheDocument();
    expect(screen.getByText(en.admin.outcomeSent)).toBeInTheDocument();
    expect(
      screen.getByText(en.admin.outcomeNotConfigured)
    ).toBeInTheDocument();
  });

  it("reloads the brand once the owner exists", async () => {
    post.mockImplementation(() => answer(inviteResultPayload));

    renderScreen();

    fireEvent.click(
      await screen.findByRole("button", { name: en.admin.inviteOwner })
    );
    fireEvent.change(screen.getByLabelText(en.admin.ownerName), {
      target: { value: "Salma Fouad" },
    });
    fireEvent.change(screen.getByLabelText(en.admin.ownerEmail), {
      target: { value: "salma@example.test" },
    });
    fireEvent.click(screen.getByRole("button", { name: en.admin.createShop }));

    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
  });

  it("mints a fresh link for an owner who never arrived", async () => {
    get.mockImplementation(() => answer(brandWithInvitedOwner));
    post.mockImplementation(() => answer(inviteResultPayload));

    renderScreen();

    fireEvent.click(
      await screen.findByRole("button", { name: en.admin.resendInvite })
    );

    await waitFor(() => expect(post).toHaveBeenCalled());
    const [, path] = post.mock.calls[0] as [unknown, string];
    expect(path).toBe(`/v1/admin/brands/${brandDetail.id}/resend-invite`);
    expect(
      await screen.findByText(inviteResultPayload.inviteUrl)
    ).toBeInTheDocument();
  });

  it("says the invite did not go through rather than pretending it did", async () => {
    get.mockImplementation(() => answer(brandWithInvitedOwner));
    post.mockImplementation(() =>
      answer(new ApiError(500, "boom", "InternalServerError"))
    );

    renderScreen();

    fireEvent.click(
      await screen.findByRole("button", { name: en.admin.resendInvite })
    );

    // Not `findByRole("alert")` — the "invited, not accepted" panel is an
    // Alert too, and it is not the failure.
    const failure = await screen.findByText(en.admin.actionFailed);
    expect(failure).toHaveAttribute("role", "alert");
  });

  /**
   * WHAT THE FAILURE ACTUALLY SAYS. "That did not go through. Nothing was
   * changed." was printed for every refusal, including the 409 the API
   * describes precisely — the sign-in screen's old bug again, a confident
   * sentence about the wrong cause.
   */
  const failedWith = async (error: Error) => {
    get.mockImplementation(() => answer(brandWithInvitedOwner));
    post.mockImplementation(() => answer(error));

    renderScreen();

    fireEvent.click(
      await screen.findByRole("button", { name: en.admin.resendInvite })
    );
  };

  it("says the email already has an account, in the API's own words", async () => {
    const said = "A user with this email already exists";
    await failedWith(new ApiError(409, said, "Conflict"));

    expect(await screen.findByText(en.admin.ownerExists)).toBeInTheDocument();
    expect(screen.getByText(said)).toBeInTheDocument();
    expect(screen.queryByText(en.admin.actionFailed)).toBeNull();
  });

  it("says the action is not available when the route is not there", async () => {
    // A 404 is the endpoint or the brand missing. Saying "nothing was changed"
    // is true and useless; saying the input was refused would be false.
    await failedWith(
      new ApiError(404, "Cannot POST /v1/admin/brands/x/resend-invite", "NotFound")
    );

    expect(
      await screen.findByText(en.admin.actionUnavailable)
    ).toBeInTheDocument();
    expect(screen.queryByText(en.admin.actionFailed)).toBeNull();
  });

  it("repeats what the API refused about the input", async () => {
    const said = "email must be an email";
    await failedWith(new ApiError(422, said, "UnprocessableEntity"));

    expect(await screen.findByText(en.admin.actionRefused)).toBeInTheDocument();
    expect(screen.getByText(said)).toBeInTheDocument();
  });

  it("stays generic for a failure nothing is known about", async () => {
    // The one case the old wording was right about. A dropped connection is
    // not an ApiError at all, so there is no sentence to borrow.
    await failedWith(new TypeError("Failed to fetch"));

    const failure = await screen.findByText(en.admin.actionFailed);
    expect(failure).toHaveAttribute("role", "alert");
  });

  it("clears the last failure when the next attempt is made", async () => {
    await failedWith(new ApiError(409, "already exists", "Conflict"));
    await screen.findByText(en.admin.ownerExists);

    post.mockImplementation(() => answer(inviteResultPayload));
    fireEvent.click(screen.getByRole("button", { name: en.admin.resendInvite }));

    await waitFor(() =>
      expect(screen.queryByText(en.admin.ownerExists)).toBeNull()
    );
  });

  it("names the section in Arabic too", async () => {
    get.mockImplementation(() => answer(brandWithActiveOwner));

    renderScreen("ar");

    expect(await screen.findByText(ar.admin.ownerActive)).toBeInTheDocument();
    expect(screen.getByText(ar.admin.ownerSection)).toBeInTheDocument();
  });
});

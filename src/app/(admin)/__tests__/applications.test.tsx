import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { brandApplicationSchema } from "@loqal/contracts/admin.contract";
import { en } from "@/messages/en";
import { LocaleProvider } from "@/lib/locale-context";

import {
  applications,
  applicationWithoutInstagram,
  approveResultPayload,
  inviteResultPayload,
  pendingApplication,
  proposedApplication,
  publicApplication,
  rejectedApplication,
} from "./fixtures";

const replace = vi.fn();
let search = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn() }),
  usePathname: () => "/admin/applications",
  useSearchParams: () => search,
}));

/**
 * Only `api` is replaced. ApiError stays the real class — `listStateFor` does
 * an `instanceof` check on it, and a stubbed lookalike would make the 403 test
 * pass for the wrong reason.
 */
const get = vi.fn();
const post = vi.fn();
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, api: { ...actual.api, get, post } };
});

const { ApiError } = await import("@/lib/api");
const { ApplicationsScreen } = await import(
  "../admin/applications/applications-screen"
);
const { adminBrandApplicationSchema } = await import(
  "../admin/applications/applications-data"
);
const { ar } = await import("@/messages/ar");

const answer = (value: unknown) =>
  value instanceof Error ? Promise.reject(value) : Promise.resolve(value);

const renderScreen = (locale: "en" | "ar" = "en") =>
  render(
    <LocaleProvider locale={locale}>
      <ApplicationsScreen />
    </LocaleProvider>
  );

/** Reset in beforeEach, not afterEach — a mock left armed leaks forwards. */
beforeEach(() => {
  vi.clearAllMocks();
  search = new URLSearchParams();
  get.mockImplementation(() => answer(applications));
  post.mockImplementation(() => answer(approveResultPayload));
});

describe("/admin/applications fixtures match the shipped contract", () => {
  it("parses every fixture with brandApplicationSchema", () => {
    for (const row of applications) {
      expect(brandApplicationSchema.safeParse(row).success).toBe(true);
    }
  });

  it("carries no userId and no password, because rejection creates neither", () => {
    for (const row of applications) {
      expect("userId" in row).toBe(false);
      expect("password" in row).toBe(false);
    }
  });
});

describe("/admin/applications — the bare array", () => {
  it("asks the unpaginated endpoint with no cursor and no query", async () => {
    renderScreen();

    await waitFor(() => expect(get).toHaveBeenCalled());
    const [, path, options] = get.mock.calls[0] as [
      unknown,
      string,
      { query?: Record<string, unknown> } | undefined,
    ];
    expect(path).toBe("/v1/admin/brand-applications");
    expect(options?.query).toBeUndefined();
  });

  it("says out loud that the queue arrived whole", async () => {
    renderScreen();

    expect(await screen.findByText(en.admin.unpagedTitle)).toBeInTheDocument();
    expect(screen.getByText(en.admin.unpagedBody)).toBeInTheDocument();
    // No load-more, because there is no cursor to press.
    expect(screen.queryByRole("button", { name: en.admin.loadMore })).toBeNull();
  });

  it("filters and searches in the browser, over rows already downloaded", async () => {
    renderScreen();

    await screen.findByText(pendingApplication.businessName);
    expect(get).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByLabelText(en.admin.searchLabel), {
      target: { value: "sinai" },
    });

    expect(
      screen.getByText(applicationWithoutInstagram.businessName)
    ).toBeInTheDocument();
    expect(screen.queryByText(pendingApplication.businessName)).toBeNull();
    // Not a second request: there is no query string to send it to.
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("puts the status filter in the URL", async () => {
    renderScreen();

    await screen.findByText(pendingApplication.businessName);
    fireEvent.change(screen.getByLabelText(en.admin.filterStatus), {
      target: { value: "REJECTED" },
    });

    expect(replace).toHaveBeenCalledWith(
      "/admin/applications?status=REJECTED"
    );
  });
});

describe("/admin/applications — Instagram is the storefront", () => {
  it("renders the Instagram account as a real link", async () => {
    renderScreen();

    const link = await screen.findByRole("link", {
      name: pendingApplication.instagramUrl ?? "",
    });
    expect(link).toHaveAttribute("href", pendingApplication.instagramUrl);
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("states its absence in words rather than leaving a blank field", async () => {
    // An empty row reads as a rendering bug. "No Instagram given" is a fact a
    // reviewer should weigh before approving a shop with no visible catalog.
    renderScreen();

    expect(await screen.findByText(en.admin.noInstagram)).toBeInTheDocument();
  });
});

describe("/admin/applications — approving", () => {
  it("says the credentials go out as a one-time link, never a password", async () => {
    renderScreen();

    await screen.findByText(pendingApplication.businessName);
    fireEvent.click(
      screen.getAllByRole("button", { name: en.admin.approveAndInvite })[0]
    );

    expect(await screen.findByText(en.admin.inviteTitle)).toBeInTheDocument();
    expect(screen.getByText(en.admin.inviteBody)).toBeInTheDocument();
  });

  it("posts to the approve route and reloads the queue", async () => {
    renderScreen();

    await screen.findByText(pendingApplication.businessName);
    fireEvent.click(
      screen.getAllByRole("button", { name: en.admin.approveAndInvite })[0]
    );
    const confirm = await screen.findAllByRole("button", {
      name: en.admin.approveAndInvite,
    });
    fireEvent.click(confirm[confirm.length - 1]);

    await waitFor(() => expect(post).toHaveBeenCalled());
    const [, path] = post.mock.calls[0] as [unknown, string];
    expect(path).toBe(
      `/v1/admin/brand-applications/${pendingApplication.id}/approve`
    );
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
  });
});

describe("/admin/applications — rejecting", () => {
  const openReject = async () => {
    renderScreen();
    await screen.findByText(pendingApplication.businessName);
    fireEvent.click(screen.getAllByRole("button", { name: en.admin.reject })[0]);
  };

  it("names all three consequences before it lets anyone confirm", async () => {
    await openReject();

    expect(await screen.findByText(en.admin.rejectNoBrand)).toBeInTheDocument();
    expect(screen.getByText(en.admin.rejectNoUser)).toBeInTheDocument();
    expect(screen.getByText(en.admin.rejectReasonKept)).toBeInTheDocument();
  });

  it("CANNOT be submitted without a reason", async () => {
    await openReject();

    const confirm = await screen.findByRole("button", {
      name: en.admin.reasonRequired,
    });
    fireEvent.click(confirm);

    expect(post).not.toHaveBeenCalled();
    expect(screen.getByText(en.admin.reasonRequiredBody)).toBeInTheDocument();
  });

  it("still refuses a reason that is only whitespace", async () => {
    // The contract trims before it checks, so the screen has to as well —
    // otherwise the button enables and the API answers 400.
    await openReject();

    fireEvent.change(await screen.findByLabelText(en.admin.rejectReason), {
      target: { value: "   " },
    });
    fireEvent.click(
      screen.getByRole("button", { name: en.admin.reasonRequired })
    );

    expect(post).not.toHaveBeenCalled();
  });

  it("sends the reason once one is written", async () => {
    await openReject();

    fireEvent.change(await screen.findByLabelText(en.admin.rejectReason), {
      target: { value: "Resells stock it does not hold." },
    });
    fireEvent.click(screen.getByRole("button", { name: en.admin.reject }));

    await waitFor(() => expect(post).toHaveBeenCalled());
    const [, path, body] = post.mock.calls[0] as [unknown, string, unknown];
    expect(path).toBe(
      `/v1/admin/brand-applications/${pendingApplication.id}/reject`
    );
    expect(body).toEqual({ reason: "Resells stock it does not hold." });
  });
});

describe("/admin/applications — decided rows", () => {
  it("shows the recorded reason and offers no buttons", async () => {
    get.mockImplementation(() => answer([rejectedApplication]));

    renderScreen();

    await screen.findByText(rejectedApplication.businessName);
    expect(
      screen.getByText(
        `${en.admin.rejectionReason}: ${rejectedApplication.rejectionReason}`
      )
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: en.admin.reject })).toBeNull();
  });
});

describe("/admin/applications — the four list states", () => {
  it("draws the loading skeleton while the queue is in flight", () => {
    get.mockImplementation(() => new Promise(() => {}));

    const { container } = renderScreen();

    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it("draws the empty state when nothing is waiting", async () => {
    get.mockImplementation(() => answer([]));

    renderScreen();

    expect(
      await screen.findByText(en.admin.applicationsEmptyTitle)
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

describe("/admin/applications — bilingual", () => {
  it("takes its copy from ar.ts under the Arabic locale", async () => {
    renderScreen("ar");

    expect(await screen.findByText(ar.admin.unpagedTitle)).toBeInTheDocument();
    expect(screen.getByText(ar.admin.noInstagram)).toBeInTheDocument();
    expect(screen.queryByText(en.admin.unpagedTitle)).toBeNull();
  });
});

/**
 * THE PROPOSAL, AND THE TWO THINGS APPROVAL NEEDS THAT THE APPLICATION CANNOT
 * CARRY.
 *
 * A rep agrees terms in the shop and files them as a PROPOSAL — nothing there
 * reaches a Brand until an admin approves. A public application has none of it.
 * Both arrive on the same endpoint, so every one of these columns is optional
 * and the sheet has to read as a complete sentence either way.
 */
describe("/admin/applications — the proposal", () => {
  it("still parses a row written before any of the columns existed", () => {
    // Today's response. Nothing added here may make yesterday's row invalid.
    for (const row of applications) {
      expect(adminBrandApplicationSchema.safeParse(row).success).toBe(true);
    }
  });

  it("parses a proposal, including the null email the public door allows", () => {
    const parsed = adminBrandApplicationSchema.safeParse(proposedApplication);

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.email).toBeNull();
    expect(parsed.success && parsed.data.proposedSlug).toBe("zamalek-boutique");
  });

  it("strips a column nobody has rendered yet rather than blanking the queue", () => {
    // BrandApplication gained eleven columns in one migration and will gain
    // more. A strict read would turn the next one into an empty review queue.
    expect(
      adminBrandApplicationSchema.safeParse({
        ...proposedApplication,
        proposedSomethingAddedLastTuesday: true,
      }).success
    ).toBe(true);
  });

  it("shows what the rep proposed in the approve sheet", async () => {
    get.mockImplementation(() => answer([proposedApplication]));

    renderScreen();

    await screen.findByText(proposedApplication.businessName);
    fireEvent.click(
      screen.getAllByRole("button", { name: en.admin.approveAndInvite })[0]
    );

    expect(await screen.findByText(en.admin.proposedBy)).toBeInTheDocument();
    expect(screen.getByText(en.admin.monthlyFee)).toBeInTheDocument();
    expect(screen.getByText(en.admin.cadenceWeekly)).toBeInTheDocument();
    expect(screen.getByText(en.admin.methodInstapay)).toBeInTheDocument();
    expect(screen.queryByText(en.admin.proposedNone)).toBeNull();
  });

  it("says nothing was proposed when the shop came through the public form", async () => {
    get.mockImplementation(() => answer([publicApplication]));

    renderScreen();

    await screen.findByText(publicApplication.businessName);
    fireEvent.click(
      screen.getAllByRole("button", { name: en.admin.approveAndInvite })[0]
    );

    expect(await screen.findByText(en.admin.proposedNone)).toBeInTheDocument();
  });

  it("pre-fills the address with the proposed one and lets it be changed", async () => {
    get.mockImplementation(() => answer([proposedApplication]));

    renderScreen();

    await screen.findByText(proposedApplication.businessName);
    fireEvent.click(
      screen.getAllByRole("button", { name: en.admin.approveAndInvite })[0]
    );

    const slug = (await screen.findByLabelText(
      en.admin.shopSlug
    )) as HTMLInputElement;
    expect(slug.value).toBe("zamalek-boutique");

    fireEvent.change(slug, { target: { value: "zamalek" } });
    fireEvent.change(screen.getByLabelText(en.admin.ownerEmail), {
      target: { value: "salma@example.test" },
    });

    const confirm = screen.getAllByRole("button", {
      name: en.admin.approveAndInvite,
    });
    fireEvent.click(confirm[confirm.length - 1]);

    await waitFor(() => expect(post).toHaveBeenCalled());
    const [, , body] = post.mock.calls[0] as [unknown, string, unknown];
    expect(body).toEqual({
      slug: "zamalek",
      ownerEmail: "salma@example.test",
    });
  });

  it("refuses to approve an application with no email until one is given", async () => {
    get.mockImplementation(() => answer([proposedApplication]));

    renderScreen();

    await screen.findByText(proposedApplication.businessName);
    fireEvent.click(
      screen.getAllByRole("button", { name: en.admin.approveAndInvite })[0]
    );

    expect(
      await screen.findByText(en.admin.ownerEmailMissing)
    ).toBeInTheDocument();

    const buttons = screen.getAllByRole("button", {
      name: en.admin.approveAndInvite,
    });
    const confirm = buttons[buttons.length - 1];
    expect(confirm).toBeDisabled();

    fireEvent.change(screen.getByLabelText(en.admin.ownerEmail), {
      target: { value: "salma@" },
    });
    expect(confirm).toBeDisabled();

    fireEvent.change(screen.getByLabelText(en.admin.ownerEmail), {
      target: { value: "salma@example.test" },
    });
    await waitFor(() => expect(confirm).toBeEnabled());
  });

  it("asks for no email when the application already carries one", async () => {
    get.mockImplementation(() => answer([publicApplication]));

    renderScreen();

    await screen.findByText(publicApplication.businessName);
    fireEvent.click(
      screen.getAllByRole("button", { name: en.admin.approveAndInvite })[0]
    );

    await screen.findByText(en.admin.proposedNone);
    expect(screen.queryByText(en.admin.ownerEmailMissing)).toBeNull();
    const buttons = screen.getAllByRole("button", {
      name: en.admin.approveAndInvite,
    });
    expect(buttons[buttons.length - 1]).toBeEnabled();
  });

  it("keeps the invite link on screen instead of closing on success", async () => {
    get.mockImplementation(() => answer([publicApplication]));

    renderScreen();

    await screen.findByText(publicApplication.businessName);
    fireEvent.click(
      screen.getAllByRole("button", { name: en.admin.approveAndInvite })[0]
    );
    const buttons = await screen.findAllByRole("button", {
      name: en.admin.approveAndInvite,
    });
    fireEvent.click(buttons[buttons.length - 1]);

    // The panel replaces the form and the sheet stays open. A toast would fade
    // in four seconds and take the only copy of the link with it.
    expect(
      await screen.findByText(inviteResultPayload.inviteUrl)
    ).toBeInTheDocument();
    expect(screen.getByText(en.admin.stepBrand)).toBeInTheDocument();
    expect(screen.getByText(en.admin.outcomeNotConfigured)).toBeInTheDocument();
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
  });

  it("names the proposal section in Arabic too", async () => {
    get.mockImplementation(() => answer([proposedApplication]));

    renderScreen("ar");

    await screen.findByText(proposedApplication.businessName);
    fireEvent.click(
      screen.getAllByRole("button", { name: ar.admin.approveAndInvite })[0]
    );

    expect(await screen.findByText(ar.admin.proposedBy)).toBeInTheDocument();
    expect(screen.getByText(ar.admin.ownerEmailMissing)).toBeInTheDocument();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { en } from "@/messages/en";
import { LocaleProvider } from "@/lib/locale-context";

import {
  NOW,
  answeredReview,
  badges,
  badgesWithoutVerified,
  emptyReputation,
  hiddenReview,
  openReview,
  reputation,
  reputationWithLeakedScore,
  verifiedBadge,
} from "./fixtures";

const get = vi.fn();
const patch = vi.fn();
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, api: { ...actual.api, get, patch } };
});

const { ApiError } = await import("@/lib/api");
const { ReviewsScreen } = await import("../reviews-screen");
const { ar } = await import("@/messages/ar");

const answer = (value: unknown) =>
  value instanceof Error ? Promise.reject(value) : Promise.resolve(value);

const routed = (reputationBody: unknown, badgesBody: unknown) =>
  (_schema: unknown, path: string) =>
    answer(path.endsWith("/badges") ? badgesBody : reputationBody);

const renderReviews = (locale: "en" | "ar" = "en") =>
  render(
    <LocaleProvider locale={locale}>
      <ReviewsScreen />
    </LocaleProvider>
  );

/** Radix does not activate a tab on a synthetic click alone. */
const openTab = (name: string) => {
  const tab = screen.getByRole("tab", { name });
  fireEvent.mouseDown(tab);
  fireEvent.click(tab);
};

beforeEach(() => {
  vi.restoreAllMocks();
  get.mockReset();
  patch.mockReset();
  vi.spyOn(Date, "now").mockReturnValue(NOW.getTime());
  get.mockImplementation(routed(reputation, badges));
});

describe("/reviews — the reviews", () => {
  it("reads both planes: the reputation body and the badges overview", async () => {
    renderReviews();

    await waitFor(() => expect(get.mock.calls.length).toBeGreaterThan(1));
    const paths = get.mock.calls.map(([, path]) => path);
    expect(paths).toContain("/v1/brands/me/reputation");
    expect(paths).toContain("/v1/brands/me/badges");
  });

  it("says a review needs a delivered order behind it", async () => {
    renderReviews();

    expect(await screen.findByText(en.brand.reviewsNote)).toBeInTheDocument();
  });

  it("draws every review, newest first", async () => {
    renderReviews();

    await screen.findByText(answeredReview.body as string);
    const cards = screen.getAllByTestId(/^review-/);
    expect(cards.map((card) => card.dataset.testid)).toEqual([
      `review-${answeredReview.id}`,
      `review-${hiddenReview.id}`,
      `review-${openReview.id}`,
    ]);
  });

  it("gives the rating an accessible name rather than only stars", async () => {
    renderReviews();

    await screen.findByText(answeredReview.body as string);
    expect(
      screen.getByLabelText(en.brand.ratingOf.replace("{n}", "5"))
    ).toBeInTheDocument();
  });

  /**
   * Hidden, never deleted, and never without a recorded reason. A shop that
   * cannot see what was hidden about it cannot tell moderation from a bug.
   */
  it("shows a hidden review with the reason recorded against it", async () => {
    renderReviews();

    const card = await screen.findByTestId(`review-${hiddenReview.id}`);
    expect(within(card).getByText(en.brand.reviewHidden)).toBeInTheDocument();
    expect(card).toHaveTextContent(hiddenReview.hiddenReason as string);
  });

  it("shows an existing reply and offers no second one", async () => {
    renderReviews();

    const card = await screen.findByTestId(`review-${answeredReview.id}`);
    expect(card).toHaveTextContent(answeredReview.brandReply as string);
    expect(within(card).queryByRole("button", { name: en.brand.replySend })).toBeNull();
  });
});

describe("/reviews — the brand's one reply", () => {
  it("posts the reply and re-renders from what the API answered", async () => {
    const replied = {
      ...openReview,
      brandReply: "Sorry about that — send it back and we will swap it.",
      brandRepliedAt: NOW.toISOString(),
    };
    patch.mockImplementation(() => answer(replied));

    renderReviews();

    const card = await screen.findByTestId(`review-${openReview.id}`);
    fireEvent.change(within(card).getByLabelText(en.brand.yourReply), {
      target: { value: replied.brandReply },
    });
    fireEvent.click(
      within(card).getByRole("button", { name: en.brand.replySend })
    );

    await waitFor(() => expect(patch).toHaveBeenCalled());
    expect(await screen.findByText(replied.brandReply)).toBeInTheDocument();
    const [, path, body] = patch.mock.calls[0] as [
      unknown,
      string,
      { body: string },
    ];
    expect(path).toBe(`/v1/brands/me/reputation/reviews/${openReview.id}/reply`);
    expect(body.body).toBe(replied.brandReply);
  });

  it("refuses an empty reply and says why", async () => {
    renderReviews();

    const card = await screen.findByTestId(`review-${openReview.id}`);
    fireEvent.click(
      within(card).getByRole("button", { name: en.brand.replySend })
    );

    expect(
      await within(card).findByText(en.brand.replyRequired)
    ).toBeInTheDocument();
    expect(patch).not.toHaveBeenCalled();
  });

  it("says the reply failed rather than losing what was typed", async () => {
    patch.mockImplementation(() =>
      answer(new ApiError(500, "boom", "InternalServerError"))
    );

    renderReviews();

    const card = await screen.findByTestId(`review-${openReview.id}`);
    const box = within(card).getByLabelText(en.brand.yourReply);
    fireEvent.change(box, { target: { value: "We will look into it." } });
    fireEvent.click(
      within(card).getByRole("button", { name: en.brand.replySend })
    );

    expect(
      await within(card).findByText(en.brand.replyFailed)
    ).toBeInTheDocument();
    expect(box).toHaveValue("We will look into it.");
  });

  it("never offers to edit or remove the review itself", async () => {
    renderReviews();

    await screen.findByText(answeredReview.body as string);
    expect(screen.queryByRole("button", { name: /hide|delete|remove/i })).toBeNull();
  });
});

describe("/reviews — the two kinds of badge", () => {
  it("keeps computed and verified under two headings with no total", async () => {
    renderReviews();
    await screen.findByText(en.brand.reviewsNote);
    openTab(en.brand.reviewsTabBadges);

    expect(
      await screen.findByText(en.brand.badgesComputedTitle)
    ).toBeInTheDocument();
    expect(screen.getByText(en.brand.badgesVerifiedTitle)).toBeInTheDocument();
    // Two regions, two card treatments, never one merged figure.
    expect(
      screen.getByRole("region", { name: en.brand.badgesComputedTitle })
    ).not.toBe(
      screen.getByRole("region", { name: en.brand.badgesVerifiedTitle })
    );
  });

  /**
   * The sentence that has to survive every redesign of this screen. Not a
   * disabled control either — a greyed button still invites the argument.
   */
  it("offers nothing that could switch a computed badge on", async () => {
    renderReviews();
    await screen.findByText(en.brand.reviewsNote);
    openTab(en.brand.reviewsTabBadges);

    const region = await screen.findByRole("region", {
      name: en.brand.badgesComputedTitle,
    });
    expect(
      within(region).getByTestId("computed-not-grantable")
    ).toHaveTextContent(en.brand.badgesComputedNote);
    expect(within(region).queryAllByRole("button")).toHaveLength(0);
    expect(within(region).queryAllByRole("checkbox")).toHaveLength(0);
    expect(within(region).queryAllByRole("switch")).toHaveLength(0);
  });

  it("draws all three computed types, earned or not, each with progress", async () => {
    renderReviews();
    await screen.findByText(en.brand.reviewsNote);
    openTab(en.brand.reviewsTabBadges);

    for (const type of ["SAME_DAY_SHIPPER", "FAST_CONFIRM", "RARELY_CANCELS"]) {
      const card = await screen.findByTestId(`computed-badge-${type}`);
      expect(
        within(card).getByRole("progressbar", {
          name: en.brand.badgeName[type as keyof typeof en.brand.badgeName],
        })
      ).toBeInTheDocument();
    }
  });

  /**
   * "Two more delivered orders earns it", not a bare "not earned". The gate is
   * measured in ORDERS while the gate is what is unmet.
   */
  it("says how many more delivered orders a badge needs", async () => {
    renderReviews();
    await screen.findByText(en.brand.reviewsNote);
    openTab(en.brand.reviewsTabBadges);

    const card = await screen.findByTestId("computed-badge-RARELY_CANCELS");
    expect(card).toHaveTextContent(
      en.brand.badgeSampleNeeded.replace("{n}", "2")
    );
    expect(card).toHaveAttribute("data-standing", "belowSample");
  });

  it("names the number a metric has to reach, in the unit it is in", async () => {
    renderReviews();
    await screen.findByText(en.brand.reviewsNote);
    openTab(en.brand.reviewsTabBadges);

    const sameDay = await screen.findByTestId("computed-badge-SAME_DAY_SHIPPER");
    expect(sameDay).toHaveTextContent(
      en.brand.badgeAtLeast.replace("{current}", "86%").replace("{target}", "80%")
    );

    const confirm = screen.getByTestId("computed-badge-FAST_CONFIRM");
    expect(confirm).toHaveTextContent(
      en.brand.badgeAtMost
        .replace("{current}", "95 min")
        .replace("{target}", "60 min")
    );
  });

  /**
   * `earned` (nightly) and `qualifies` (live) can legitimately disagree for a
   * window. Both are shown, and which one moved is said.
   */
  it("shows a badge that is earned and no longer qualifying as both", async () => {
    renderReviews();
    await screen.findByText(en.brand.reviewsNote);
    openTab(en.brand.reviewsTabBadges);

    const card = await screen.findByTestId("computed-badge-FAST_CONFIRM");
    expect(card).toHaveAttribute("data-standing", "slipping");
    expect(within(card).getByText(en.brand.badgeEarned)).toBeInTheDocument();
    expect(within(card).getByTestId("badge-slipping")).toHaveTextContent(
      en.brand.badgeSlipping
    );
  });

  it("shows a badge that qualifies but has not been awarded yet", async () => {
    get.mockImplementation(
      routed(reputation, {
        computed: [
          { ...badges.computed[1], earned: false, earnedAt: null, qualifies: true },
        ],
        verified: [],
      })
    );

    renderReviews();
    await screen.findByText(en.brand.reviewsNote);
    openTab(en.brand.reviewsTabBadges);

    const card = await screen.findByTestId("computed-badge-SAME_DAY_SHIPPER");
    expect(card).toHaveAttribute("data-standing", "pending");
    expect(within(card).getByTestId("badge-pending")).toHaveTextContent(
      en.brand.badgePending
    );
  });

  it("draws a verified badge as a dated, expiring, human decision", async () => {
    renderReviews();
    await screen.findByText(en.brand.reviewsNote);
    openTab(en.brand.reviewsTabBadges);

    const card = await screen.findByTestId(`verified-badge-${verifiedBadge.id}`);
    expect(card).toHaveTextContent(en.brand.verifiedName.PRICE_CHECKED);
    expect(card).toHaveTextContent(verifiedBadge.checkedAgainst);
    expect(card).toHaveTextContent(en.brand.badgeExpires);
    // Visually distinct from a computed card, not the same neutral surface.
    expect(card.className).not.toBe(
      screen.getByTestId("computed-badge-SAME_DAY_SHIPPER").className
    );
  });

  it("says there is nothing to apply for when no verified badge is held", async () => {
    get.mockImplementation(routed(reputation, badgesWithoutVerified));

    renderReviews();
    await screen.findByText(en.brand.reviewsNote);
    openTab(en.brand.reviewsTabBadges);

    expect(
      await screen.findByText(en.brand.badgesVerifiedNoneTitle)
    ).toBeInTheDocument();
  });

  it("labels paid placement as bought and never as a badge", async () => {
    renderReviews();
    await screen.findByText(en.brand.reviewsNote);
    openTab(en.brand.reviewsTabBadges);

    const placement = await screen.findByTestId("placement");
    expect(placement).toHaveTextContent(en.brand.placementOn);
    expect(placement).toHaveTextContent(en.brand.placementNote);
    expect(
      within(
        screen.getByRole("region", { name: en.brand.badgesComputedTitle })
      ).queryByTestId("placement")
    ).toBeNull();
  });
});

describe("/reviews — Loqal's private score never appears", () => {
  it("renders no 0–100 judgement even when the API sends one", async () => {
    get.mockImplementation(routed(reputationWithLeakedScore, badges));

    const { container } = renderReviews();

    await screen.findByText(answeredReview.body as string);
    openTab(en.brand.reviewsTabBadges);
    await screen.findByTestId("placement");

    expect(container.textContent).not.toContain("87");
    expect(container.textContent).not.toMatch(/reputation score/i);
  });
});

describe("/reviews — the states", () => {
  it("draws the loading skeleton while the first reads are in flight", () => {
    get.mockImplementation(() => new Promise(() => {}));

    const { container } = renderReviews();

    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it("ties the empty state to there being nothing delivered to review", async () => {
    get.mockImplementation(routed(emptyReputation, badges));

    renderReviews();

    expect(
      await screen.findByText(en.brand.reviewsEmptyTitle)
    ).toBeInTheDocument();
    expect(screen.getByText(en.brand.reviewsEmptyBody)).toBeInTheDocument();
  });

  it("draws the error state with a retry", async () => {
    get.mockImplementation(() =>
      answer(new ApiError(500, "boom", "InternalServerError"))
    );

    renderReviews();

    expect(
      await screen.findByText(en.brand.reviewsErrorTitle)
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: en.brand.retry }).length
    ).toBeGreaterThan(0);
  });

  it("draws the denied state, with no retry, on a 403", async () => {
    get.mockImplementation(() =>
      answer(new ApiError(403, "Forbidden", "Forbidden"))
    );

    renderReviews();

    expect(
      await screen.findByText(en.brand.reviewsOnlyTitle)
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: en.brand.retry })).toBeNull();
  });
});

describe("/reviews — bilingual", () => {
  it("takes its copy from ar.ts under the Arabic locale", async () => {
    renderReviews("ar");

    expect(await screen.findByText(ar.brand.reviewsNote)).toBeInTheDocument();
    openTab(ar.brand.reviewsTabBadges);
    expect(
      await screen.findByText(ar.brand.badgesComputedNote)
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("computed-badge-SAME_DAY_SHIPPER")
    ).toHaveTextContent(ar.brand.badgeName.SAME_DAY_SHIPPER);
  });
});

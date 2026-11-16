import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { en } from "@/messages/en";
import { LocaleProvider } from "@/lib/locale-context";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/admin/reviews",
  useSearchParams: () => new URLSearchParams(),
}));

const get = vi.fn();
const post = vi.fn();
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, api: { ...actual.api, get, post } };
});

const { ApiError } = await import("@/lib/api");
const { ReviewsScreen } = await import("../reviews-screen");
const { isHideable, isReviewId } = await import("../reviews-data");
const { ar } = await import("@/messages/ar");

const REVIEW_ID = "0199aaaa-0000-7000-8000-000000000001";

const answer = (value: unknown) =>
  value instanceof Error ? Promise.reject(value) : Promise.resolve(value);

const renderScreen = (locale: "en" | "ar" = "en") =>
  render(
    <LocaleProvider locale={locale}>
      <ReviewsScreen />
    </LocaleProvider>
  );

/** Renders, then waits for the by-id form an API without the list falls back to. */
const renderFallback = async () => {
  renderScreen();
  await screen.findByLabelText(en.admin.reviewIdLabel);
};

const fill = (id: string, reason: string) => {
  fireEvent.change(screen.getByLabelText(en.admin.reviewIdLabel), {
    target: { value: id },
  });
  fireEvent.change(screen.getByLabelText(en.admin.hideReason), {
    target: { value: reason },
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  post.mockImplementation(() => answer({}));
});

describe("the reason the API demands", () => {
  it("refuses an empty or whitespace-only reason", () => {
    // A review is never deleted and there is no lesser tier to have excluded
    // it from, so the reason IS the answer to an accusation of censorship.
    expect(isHideable("")).toBe(false);
    expect(isHideable("   ")).toBe(false);
    expect(isHideable("Counterfeit accusation with no evidence")).toBe(true);
  });

  it("refuses a reason longer than the API accepts", () => {
    expect(isHideable("x".repeat(500))).toBe(true);
    expect(isHideable("x".repeat(501))).toBe(false);
  });

  it("refuses an id that is not an id", () => {
    expect(isReviewId("not-an-id")).toBe(false);
    expect(isReviewId(REVIEW_ID)).toBe(true);
    expect(isReviewId(` ${REVIEW_ID} `)).toBe(true);
  });
});

const visibleReview = {
  id: REVIEW_ID,
  brandId: "0199dddd-0000-7000-8000-000000000001",
  brandName: "Zeit Atelier",
  rating: 2,
  body: "Arrived late and torn.",
  createdAt: "2026-11-01T10:00:00.000Z",
  hiddenAt: null,
  hiddenReason: null,
  brandReply: null,
};

const hiddenReview = {
  ...visibleReview,
  id: "0199aaaa-0000-7000-8000-000000000002",
  body: "Spam link",
  hiddenAt: "2026-11-02T10:00:00.000Z",
  hiddenReason: "Spam",
};

/** The list route answers; the shop picker's own read gets an empty page. */
const withList = (items: unknown[]) =>
  get.mockImplementation((_schema: unknown, path: string) =>
    answer(path === "/v1/admin/reviews" ? { items, nextCursor: null } : { items: [], nextCursor: null })
  );

/** An API that predates the list route. */
const withoutList = () =>
  get.mockImplementation((_schema: unknown, path: string) =>
    path === "/v1/admin/reviews"
      ? answer(new ApiError(404, "Cannot GET", "NotFound"))
      : answer({ items: [], nextCursor: null })
  );

describe("/admin/reviews — the list", () => {
  it("lists reviews with their shop, rating and state", async () => {
    withList([visibleReview, hiddenReview]);

    renderScreen();

    expect(await screen.findAllByText("Arrived late and torn.")).not.toHaveLength(0);
    expect(screen.getAllByText("Zeit Atelier").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Spam").length).toBeGreaterThan(0);
  });

  it("filters by hidden state and shop through the API", async () => {
    withList([]);

    renderScreen();

    expect(await screen.findByText(en.admin.reviewsEmpty)).toBeInTheDocument();
    const call = get.mock.calls.find((c) => c[1] === "/v1/admin/reviews") as [
      unknown,
      string,
      { query: Record<string, unknown> },
    ];
    expect(call[2].query.hidden).toBeUndefined();
  });

  it("hides a row with a reason, through the existing sheet", async () => {
    withList([visibleReview]);

    renderScreen();

    await screen.findAllByText("Arrived late and torn.");
    fireEvent.click(screen.getAllByRole("button", { name: en.admin.hide })[0]);
    expect(await screen.findByText(en.admin.hideNeverDeleted)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(en.admin.hideReason), {
      target: { value: "  Abusive language  " },
    });
    const confirms = screen.getAllByRole("button", { name: en.admin.hideTitle });
    fireEvent.click(confirms[confirms.length - 1]);

    await waitFor(() => expect(post).toHaveBeenCalled());
    const [, path, body] = post.mock.calls[0] as [unknown, string, unknown];
    expect(path).toBe(`/v1/admin/reviews/${REVIEW_ID}/hide`);
    expect(body).toEqual({ reason: "Abusive language" });
  });
});

describe("/admin/reviews — an API without the list falls back to hiding by id", () => {
  beforeEach(() => {
    withoutList();
  });

  it("keeps the button disabled until both fields are acceptable", async () => {
    renderScreen();

    const button = await screen.findByRole("button", { name: en.admin.hideTitle });
    expect(button).toBeDisabled();

    fill(REVIEW_ID, "");
    expect(button).toBeDisabled();

    fill("nonsense", "A good reason");
    expect(button).toBeDisabled();

    fill(REVIEW_ID, "A good reason");
    expect(button).toBeEnabled();
  });

  it("says the id is wrong rather than letting the API answer 404", async () => {
    await renderFallback();

    fill("nonsense", "A good reason");
    expect(screen.getByText(en.admin.reviewIdInvalid)).toBeInTheDocument();
  });

  it("names all three consequences before confirming", async () => {
    await renderFallback();

    fill(REVIEW_ID, "Counterfeit accusation with no evidence");
    fireEvent.click(screen.getByRole("button", { name: en.admin.hideTitle }));

    expect(
      await screen.findByText(en.admin.hideNeverDeleted)
    ).toBeInTheDocument();
    expect(screen.getAllByText(en.admin.hideReasonLogged).length).toBeGreaterThan(
      0
    );
    expect(screen.getByText(en.admin.hideAffectsScore)).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it("posts the trimmed reason to the one route that exists", async () => {
    await renderFallback();

    fill(` ${REVIEW_ID} `, "  Counterfeit accusation  ");
    fireEvent.click(screen.getByRole("button", { name: en.admin.hideTitle }));

    const confirms = await screen.findAllByRole("button", {
      name: en.admin.hideTitle,
    });
    fireEvent.click(confirms[confirms.length - 1]);

    await waitFor(() => expect(post).toHaveBeenCalled());
    const [, path, body] = post.mock.calls[0] as [unknown, string, unknown];
    expect(path).toBe(`/v1/admin/reviews/${REVIEW_ID}/hide`);
    expect(body).toEqual({ reason: "Counterfeit accusation" });
  });

  it("says the row is still there and the reason is recorded", async () => {
    await renderFallback();

    fill(REVIEW_ID, "Counterfeit accusation");
    fireEvent.click(screen.getByRole("button", { name: en.admin.hideTitle }));
    const confirms = await screen.findAllByRole("button", {
      name: en.admin.hideTitle,
    });
    fireEvent.click(confirms[confirms.length - 1]);

    expect(await screen.findByText(en.admin.reviewHidden)).toBeInTheDocument();
  });

  it("draws the denied panel on a 403 rather than a generic failure", async () => {
    post.mockImplementation(() =>
      answer(new ApiError(403, "Forbidden", "Forbidden"))
    );

    await renderFallback();

    fill(REVIEW_ID, "Counterfeit accusation");
    fireEvent.click(screen.getByRole("button", { name: en.admin.hideTitle }));
    const confirms = await screen.findAllByRole("button", {
      name: en.admin.hideTitle,
    });
    fireEvent.click(confirms[confirms.length - 1]);

    expect(await screen.findByText(en.admin.deniedTitle)).toBeInTheDocument();
    expect(screen.getByText(/SUPER_ADMIN/)).toBeInTheDocument();
  });

  it("reports any other failure as a failure that changed nothing", async () => {
    post.mockImplementation(() =>
      answer(new ApiError(404, "Not found", "NotFound"))
    );

    await renderFallback();

    fill(REVIEW_ID, "Counterfeit accusation");
    fireEvent.click(screen.getByRole("button", { name: en.admin.hideTitle }));
    const confirms = await screen.findAllByRole("button", {
      name: en.admin.hideTitle,
    });
    fireEvent.click(confirms[confirms.length - 1]);

    expect(await screen.findByText(en.admin.actionFailed)).toBeInTheDocument();
  });
});

describe("/admin/reviews — bilingual", () => {
  it("takes its copy from ar.ts under the Arabic locale", async () => {
    withList([visibleReview]);

    renderScreen("ar");

    expect(await screen.findByText(ar.admin.reviewsNote)).toBeInTheDocument();
    expect(screen.queryByText(en.admin.reviewsNote)).toBeNull();
  });
});

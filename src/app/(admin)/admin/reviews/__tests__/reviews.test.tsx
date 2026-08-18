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

describe("/admin/reviews — there is no list, and the screen says so", () => {
  it("explains that no admin route lists reviews", async () => {
    renderScreen();

    expect(screen.getByText(en.admin.reviewsNoListTitle)).toBeInTheDocument();
    expect(screen.getByText(en.admin.reviewsNoListBody)).toBeInTheDocument();
  });

  it("makes no GET at all, because there is nothing to fetch", async () => {
    renderScreen();

    await waitFor(() => expect(screen.getByLabelText(en.admin.reviewIdLabel)));
    // Assembling a list from the storefront's public endpoints would look like
    // an admin review inbox and would become the thing people relied on.
    expect(get).not.toHaveBeenCalled();
  });

  it("draws no table and no rows", () => {
    renderScreen();

    expect(screen.queryByRole("table")).toBeNull();
  });
});

describe("/admin/reviews — hiding one", () => {
  it("keeps the button disabled until both fields are acceptable", () => {
    renderScreen();

    const button = screen.getByRole("button", { name: en.admin.hideTitle });
    expect(button).toBeDisabled();

    fill(REVIEW_ID, "");
    expect(button).toBeDisabled();

    fill("nonsense", "A good reason");
    expect(button).toBeDisabled();

    fill(REVIEW_ID, "A good reason");
    expect(button).toBeEnabled();
  });

  it("says the id is wrong rather than letting the API answer 404", () => {
    renderScreen();

    fill("nonsense", "A good reason");
    expect(screen.getByText(en.admin.reviewIdInvalid)).toBeInTheDocument();
  });

  it("names all three consequences before confirming", async () => {
    renderScreen();

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
    renderScreen();

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
    renderScreen();

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

    renderScreen();

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

    renderScreen();

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
  it("takes its copy from ar.ts under the Arabic locale", () => {
    renderScreen("ar");

    expect(screen.getByText(ar.admin.reviewsNoListTitle)).toBeInTheDocument();
    expect(screen.queryByText(en.admin.reviewsNoListTitle)).toBeNull();
  });
});

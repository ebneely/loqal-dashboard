/**
 * /terms — the screen where authorization is the subject.
 *
 * The central assertion of the whole console lives here: a brand the rep is not
 * bound to renders as UN-ACTIONABLE, with no control that could produce the
 * API's 404, and with a sentence saying why.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { LocaleProvider } from "@/lib/locale-context";
import { en } from "@/messages/en";
import { ar } from "@/messages/ar";

import {
  REP_ID,
  SEEDED_BRAND_ID,
  SIGNED_BRAND_ID,
  boundedBand,
  leadOnlyLedger,
  mixedLedger,
  signedBrandLedger,
  unboundedBand,
} from "./fixtures";

const searchParams = { current: new URLSearchParams() };
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/terms",
  useSearchParams: () => searchParams.current,
}));

vi.mock("@/lib/auth-client", () => ({
  useSession: () => ({
    data: {
      user: { id: REP_ID, email: "rep@example.test", role: "SALES" },
      session: { id: "s-1" },
    },
    isPending: false,
    error: null,
  }),
  signOut: vi.fn(),
  authClient: { signOut: vi.fn() },
}));

const get = vi.fn();
const post = vi.fn();
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, api: { ...actual.api, get, post } };
});

const { ApiError } = await import("@/lib/api");
const { TermsScreen } = await import("../terms/terms-screen");
const { ledgerKey } = await import("../signed-brands");

const s = en.sales;

const seed = (ledger: unknown) =>
  window.sessionStorage.setItem(ledgerKey(REP_ID), JSON.stringify(ledger));

const renderScreen = (locale: "en" | "ar" = "en") =>
  render(
    <LocaleProvider locale={locale}>
      <TermsScreen />
    </LocaleProvider>
  );

beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
  searchParams.current = new URLSearchParams();
  get.mockImplementation(() => Promise.resolve(boundedBand));
  post.mockImplementation(() => Promise.resolve({ brandId: SIGNED_BRAND_ID }));
});

// ---------------------------------------------------------------------------
// The one that matters
// ---------------------------------------------------------------------------

describe("a brand the rep is not bound to is UN-ACTIONABLE", () => {
  /**
   * The five seeded brands carry no BrandApplication at all, so
   * `isSignedBy` is false for every rep and `setTerms` answers 404. This is the
   * exact shape of "admin-priced only".
   */
  it("draws no offer form for a seeded, admin-priced brand", async () => {
    seed(signedBrandLedger);
    searchParams.current = new URLSearchParams(`brandId=${SEEDED_BRAND_ID}`);

    renderScreen();

    const panel = await screen.findByTestId("brand-not-actionable");
    expect(panel).toHaveAttribute("data-reason", "NOT_YOURS");
    expect(panel).toHaveAttribute("data-brand-id", SEEDED_BRAND_ID);
    expect(screen.queryByTestId("offer-form")).toBeNull();
  });

  /**
   * Not a disabled button either. `SalesService.setTerms` answers 404 rather
   * than 403 precisely so this route cannot be used as an enumeration oracle,
   * and a control whose only outcome is that refusal reads to a rep as "this
   * shop does not exist" while they are standing inside it.
   */
  it("offers no send control at all — not even a disabled one", async () => {
    seed(signedBrandLedger);
    searchParams.current = new URLSearchParams(`brandId=${SEEDED_BRAND_ID}`);

    renderScreen();

    await screen.findByTestId("brand-not-actionable");
    expect(screen.queryByRole("button", { name: s.sendOffer })).toBeNull();
  });

  it("says why, in words a salesperson can repeat to the owner", async () => {
    seed(signedBrandLedger);
    searchParams.current = new URLSearchParams(`brandId=${SEEDED_BRAND_ID}`);

    renderScreen();

    expect(await screen.findByText(s.notYoursTitle)).toBeInTheDocument();
    expect(screen.getByText(s.notYoursBody)).toBeInTheDocument();
    // And it says the refusal is identical for a missing shop, so nobody reads
    // this screen as a way to find out which shops Loqal has.
    expect(screen.getByText(s.brandNotFoundBody)).toBeInTheDocument();
  });

  it("refuses an arbitrary id pasted into the URL the same way", async () => {
    seed(signedBrandLedger);
    searchParams.current = new URLSearchParams("brandId=not-a-real-brand");

    renderScreen();

    expect(await screen.findByTestId("brand-not-actionable")).toBeInTheDocument();
    expect(screen.queryByTestId("offer-form")).toBeNull();
  });

  it("never calls the write for a brand it refused", async () => {
    seed(signedBrandLedger);
    searchParams.current = new URLSearchParams(`brandId=${SEEDED_BRAND_ID}`);

    renderScreen();

    await screen.findByTestId("brand-not-actionable");
    expect(post).not.toHaveBeenCalled();
  });
});

describe("a lead the rep filed but did not close", () => {
  it("renders as un-actionable with its own reason, not as a brand", async () => {
    seed(leadOnlyLedger);

    renderScreen();

    const lead = await screen.findByTestId("candidate-lead");
    expect(lead).toHaveAttribute("data-actionable", "false");
    expect(lead).toHaveAttribute("data-reason", "LEAD_NOT_CLOSED");
    expect(screen.queryByTestId("candidate-brand")).toBeNull();
    expect(screen.queryByTestId("offer-form")).toBeNull();
  });

  /**
   * The correction the earlier copy could not have made. An admin approving the
   * application later stamps `reviewedBy` with the ADMIN's id, so this rep is
   * refused for good.
   */
  it("says an admin approving it later does not hand it back to this rep", async () => {
    seed(leadOnlyLedger);

    renderScreen();

    expect(await screen.findByText(s.leadNotClosedTitle)).toBeInTheDocument();
    expect(screen.getByText(s.leadNotClosedBody)).toBeInTheDocument();
    expect(screen.getByText(s.cannotPriceChip)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// The shop the rep DID sign
// ---------------------------------------------------------------------------

describe("a brand this rep closed in this session", () => {
  it("draws the offer form", async () => {
    seed(signedBrandLedger);
    searchParams.current = new URLSearchParams(`brandId=${SIGNED_BRAND_ID}`);

    renderScreen();

    expect(await screen.findByTestId("offer-form")).toBeInTheDocument();
    expect(screen.queryByTestId("brand-not-actionable")).toBeNull();
  });

  it("becomes actionable by picking it out of the list, with no id in the URL", async () => {
    seed(signedBrandLedger);

    renderScreen();

    fireEvent.click(await screen.findByTestId("candidate-brand"));

    expect(await screen.findByTestId("offer-form")).toBeInTheDocument();
  });

  it("posts the commission and the free period to the brand's own path", async () => {
    seed(signedBrandLedger);
    searchParams.current = new URLSearchParams(`brandId=${SIGNED_BRAND_ID}`);

    renderScreen();

    await screen.findByTestId("offer-form");
    fireEvent.change(screen.getByLabelText(s.commission), {
      target: { value: "6" },
    });
    fireEvent.click(screen.getByRole("button", { name: s.sendOffer }));

    await waitFor(() => expect(post).toHaveBeenCalled());
    const [, path, body] = post.mock.calls[0] as [unknown, string, Record<string, unknown>];
    expect(path).toBe(`/v1/sales/brands/${SIGNED_BRAND_ID}/terms`);
    expect(body.perOrderChargeType).toBe("PERCENT");
    expect(body.perOrderChargeValue).toBe("6.00");
  });

  /**
   * `settlementDetails` is not on `setSalesTermsSchema` at all — the schema is
   * `.strict()`, so a rep's body cannot reach the payout column. The screen must
   * not render it either, and must say so rather than leaving a silent gap.
   */
  it("never shows or sends the payout account", async () => {
    seed(signedBrandLedger);
    searchParams.current = new URLSearchParams(`brandId=${SIGNED_BRAND_ID}`);

    renderScreen();

    await screen.findByTestId("offer-form");
    expect(screen.getByText(s.payoutNotHere)).toBeInTheDocument();
    expect(screen.queryByText(en.admin.account)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: s.sendOffer }));
    await waitFor(() => expect(post).toHaveBeenCalled());
    const [, , body] = post.mock.calls[0] as [unknown, string, Record<string, unknown>];
    expect(body.settlementDetails).toBeUndefined();
    expect(body.monthlyFee).toBeUndefined();
    expect(body.status).toBeUndefined();
  });

  it("confirms only what the API said it wrote", async () => {
    seed(signedBrandLedger);
    searchParams.current = new URLSearchParams(`brandId=${SIGNED_BRAND_ID}`);
    post.mockImplementation(() =>
      Promise.resolve({
        brandId: SIGNED_BRAND_ID,
        perOrderChargeValue: "6.00",
        freeUntil: "2026-09-17T12:00:00.000Z",
      })
    );

    renderScreen();

    await screen.findByTestId("offer-form");
    fireEvent.click(screen.getByRole("button", { name: s.sendOffer }));

    expect(await screen.findByTestId("terms-sent")).toBeInTheDocument();
    expect(screen.getByText(s.sentTitle)).toBeInTheDocument();
    expect(screen.getByText("2026-09-17")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// The band
// ---------------------------------------------------------------------------

describe("the band a rep may close inside", () => {
  it("reads it from the sales plane's own route", async () => {
    seed(signedBrandLedger);

    renderScreen();

    await waitFor(() => expect(get).toHaveBeenCalled());
    const [, path] = get.mock.calls[0] as [unknown, string];
    expect(path).toBe("/v1/sales/terms/band");
  });

  it("refuses to send a commission below the floor", async () => {
    seed(signedBrandLedger);
    searchParams.current = new URLSearchParams(`brandId=${SIGNED_BRAND_ID}`);

    renderScreen();

    await screen.findByTestId("offer-form");
    fireEvent.change(screen.getByLabelText(s.commission), {
      target: { value: "1" },
    });

    expect(screen.getByText(s.belowFloor)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: s.sendOffer })).toBeDisabled();
  });

  it("shows an out-of-band free period as a refused option rather than hiding it", async () => {
    seed(signedBrandLedger);
    searchParams.current = new URLSearchParams(`brandId=${SIGNED_BRAND_ID}`);

    renderScreen();

    await screen.findByTestId("offer-form");
    const option = screen.getByRole("option", {
      name: `4 ${s.months} — ${s.outOfBandOption}`,
    });
    expect(option).toBeDisabled();
  });

  it("says a band is not set rather than calling an unbounded offer inside one", async () => {
    seed(signedBrandLedger);
    get.mockImplementation(() => Promise.resolve(unboundedBand));

    renderScreen();

    expect(await screen.findByTestId("band-unbounded")).toBeInTheDocument();
    expect(screen.getByText(s.unboundedBody)).toBeInTheDocument();
  });

  /**
   * The server compares against `addMonths(now, maxFreeMonths)` at the moment
   * the request lands, so a screen that sat open can send a date that is now
   * out of band. That is a 422, and it is never a silent clamp.
   */
  it("reloads the band on a 422 instead of nudging the figure to fit", async () => {
    seed(signedBrandLedger);
    searchParams.current = new URLSearchParams(`brandId=${SIGNED_BRAND_ID}`);
    post.mockImplementation(() =>
      Promise.reject(
        new ApiError(422, "Outside the band a rep may close without admin approval", "Unprocessable Entity")
      )
    );

    renderScreen();

    await screen.findByTestId("offer-form");
    fireEvent.click(screen.getByRole("button", { name: s.sendOffer }));

    expect(await screen.findByTestId("terms-refused")).toBeInTheDocument();
    expect(screen.getByText(s.refusedBody)).toBeInTheDocument();
    // The violations array the service builds is dropped by the exception
    // filter, so the screen says which figures to re-check rather than
    // inventing a reason.
    expect(screen.getByText(s.violationsHiddenNote)).toBeInTheDocument();
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
  });

  it("words a 404 from the write exactly as a missing shop", async () => {
    seed(signedBrandLedger);
    searchParams.current = new URLSearchParams(`brandId=${SIGNED_BRAND_ID}`);
    post.mockImplementation(() =>
      Promise.reject(new ApiError(404, "No such brand", "Not Found"))
    );

    renderScreen();

    await screen.findByTestId("offer-form");
    fireEvent.click(screen.getByRole("button", { name: s.sendOffer }));

    expect(await screen.findByTestId("terms-not-found")).toBeInTheDocument();
    expect(screen.getByText(s.brandNotFoundTitle)).toBeInTheDocument();
  });

  it("draws the denied panel and names the role on a 403", async () => {
    get.mockImplementation(() =>
      Promise.reject(new ApiError(403, "Your role cannot perform this action", "Forbidden"))
    );

    renderScreen();

    expect(await screen.findByText(s.deniedTitle)).toBeInTheDocument();
    expect(screen.getByText("SALES")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// The missing list endpoint
// ---------------------------------------------------------------------------

describe("the list endpoint that does not exist", () => {
  /**
   * There is no `GET /v1/sales/brands`. The screen must not imply the list it
   * shows is Loqal's record of what this rep has signed.
   */
  it("says the list is this phone's, not Loqal's", async () => {
    seed(mixedLedger);

    renderScreen();

    expect(await screen.findByText(s.signedHereOnlyTitle)).toBeInTheDocument();
    expect(screen.getByText(s.signedHereOnlyBody)).toBeInTheDocument();
  });

  it("never asks for a brand list, because there is none to ask for", async () => {
    seed(mixedLedger);

    renderScreen();

    await waitFor(() => expect(get).toHaveBeenCalled());
    const paths = get.mock.calls.map((call) => call[1] as string);
    expect(paths).toEqual(["/v1/sales/terms/band"]);
  });

  it("sends a rep with nothing registered to the register screen", async () => {
    renderScreen();

    expect(await screen.findByText(s.noBrandTitle)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: s.startOnboard })
    ).toHaveAttribute("href", "/onboard");
  });
});

describe("Arabic", () => {
  it("draws the refusal in Arabic rather than falling back to English", async () => {
    seed(signedBrandLedger);
    searchParams.current = new URLSearchParams(`brandId=${SEEDED_BRAND_ID}`);

    renderScreen("ar");

    expect(await screen.findByText(ar.sales.notYoursTitle)).toBeInTheDocument();
    expect(screen.queryByText(s.notYoursTitle)).toBeNull();
  });
});

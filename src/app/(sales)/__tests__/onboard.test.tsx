/**
 * /onboard — the one write that creates something, and the only thing in the
 * system that binds a brand to a rep.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { LocaleProvider } from "@/lib/locale-context";
import { en } from "@/messages/en";

import {
  LEAD_APPLICATION_ID,
  REP_ID,
  SIGNED_APPLICATION_ID,
  SIGNED_BRAND_ID,
} from "./fixtures";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/onboard",
  useSearchParams: () => new URLSearchParams(),
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

const post = vi.fn();
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, api: { ...actual.api, post } };
});

const { ApiError } = await import("@/lib/api");
const { OnboardScreen } = await import("../sales/onboard/onboard-screen");
const { ledgerKey, parseLedger } = await import("../signed-brands");

const s = en.sales;

const createdResponse = {
  application: {
    id: SIGNED_APPLICATION_ID,
    businessName: "Nour Ceramics",
    status: "APPROVED",
  },
  brand: { id: SIGNED_BRAND_ID, name: "Nour Ceramics", slug: "nour-ceramics" },
};

const filedResponse = {
  application: {
    id: LEAD_APPLICATION_ID,
    businessName: "Zamalek Flowers",
    status: "PENDING",
  },
  brand: null,
};

const renderScreen = () =>
  render(
    <LocaleProvider locale="en">
      <OnboardScreen />
    </LocaleProvider>
  );

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

const next = () =>
  fireEvent.click(
    screen.getByRole("button", {
      name: (name) => name === s.nextStep || name === s.finishOnboard,
    })
  );

/** Fill the two steps before the closing one. */
const fillThroughContact = () => {
  type(s.shopName, "Nour Ceramics");
  next();
  type(s.ownerName, "Nour Hassan");
  type(s.email, "nour@example.test");
  type(s.phone, "01001234567");
  next();
};

const ledger = () =>
  parseLedger(window.sessionStorage.getItem(ledgerKey(REP_ID)));

beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
  post.mockImplementation(() => Promise.resolve(createdResponse));
});

describe("the three steps follow the conversation, not the schema", () => {
  it("asks what the shop is before asking for a web address", () => {
    renderScreen();

    expect(screen.getByLabelText(s.shopName)).toBeInTheDocument();
    expect(screen.queryByLabelText(s.slugLabel)).toBeNull();
    expect(screen.queryByLabelText(s.email)).toBeNull();
  });

  it("holds the first step until the shop has a name", () => {
    renderScreen();

    expect(
      screen.getByRole("button", { name: s.nextStep })
    ).toBeDisabled();

    type(s.shopName, "Nour Ceramics");
    expect(screen.getByRole("button", { name: s.nextStep })).toBeEnabled();
  });

  it("names a malformed email as one, not as a missing field", () => {
    renderScreen();
    type(s.shopName, "Nour Ceramics");
    next();

    type(s.email, "nour");

    expect(screen.getByTestId("error-email")).toHaveTextContent(s.badEmail);
  });
});

describe("the closing choice, and what each branch really means", () => {
  it("asks for a web address only once the rep chooses to close", () => {
    renderScreen();
    fillThroughContact();

    expect(screen.queryByLabelText(s.slugLabel)).toBeNull();

    fireEvent.click(screen.getByLabelText(s.closeNow));
    expect(screen.getByLabelText(s.slugLabel)).toBeInTheDocument();
  });

  /**
   * THE CORRECTION. An admin approving the application later stamps
   * `BrandApplication.reviewedBy` with the ADMIN's id, so the rep who captured
   * the lead is refused on /terms for good. The choice has to say that BEFORE
   * it is made.
   */
  it("says up front that filing a lead hands the offer to whoever approves it", () => {
    renderScreen();
    fillThroughContact();

    expect(screen.getByTestId("file-only-rep-note")).toHaveTextContent(
      s.fileOnlyRepNote
    );
  });

  it("suggests a web address from the shop name without applying it silently", () => {
    renderScreen();
    fillThroughContact();
    fireEvent.click(screen.getByLabelText(s.closeNow));

    expect(screen.getByLabelText(s.slugLabel)).toHaveValue("");

    fireEvent.click(screen.getByRole("button", { name: s.slugSuggest }));
    expect(screen.getByLabelText(s.slugLabel)).toHaveValue("nour-ceramics");
  });
});

describe("filing a lead", () => {
  beforeEach(() => post.mockImplementation(() => Promise.resolve(filedResponse)));

  it("sends no slug at all", async () => {
    renderScreen();
    fillThroughContact();
    next();
    fireEvent.click(screen.getByRole("button", { name: s.fileOnly }));

    await waitFor(() => expect(post).toHaveBeenCalled());
    const [, path, body] = post.mock.calls[0] as [unknown, string, Record<string, unknown>];
    expect(path).toBe("/v1/sales/brands");
    expect("slug" in body).toBe(false);
  });

  it("says no shop was created, and repeats the admin-approval warning", async () => {
    renderScreen();
    fillThroughContact();
    next();
    fireEvent.click(screen.getByRole("button", { name: s.fileOnly }));

    const outcome = await screen.findByTestId("onboard-outcome");
    expect(outcome).toHaveAttribute("data-outcome", "filed");
    expect(screen.getByText(s.filedBody)).toBeInTheDocument();
    expect(screen.getByTestId("lead-admin-warning")).toHaveTextContent(
      s.fileOnlyRepNote
    );
  });

  it("offers no route to the offer screen, because there is nothing to price", async () => {
    renderScreen();
    fillThroughContact();
    next();
    fireEvent.click(screen.getByRole("button", { name: s.fileOnly }));

    await screen.findByTestId("onboard-outcome");
    expect(screen.queryByRole("link", { name: s.goToTerms })).toBeNull();
  });

  it("records it as a lead, never as a signed brand", async () => {
    renderScreen();
    fillThroughContact();
    next();
    fireEvent.click(screen.getByRole("button", { name: s.fileOnly }));

    await screen.findByTestId("onboard-outcome");
    await waitFor(() => expect(ledger().leads).toHaveLength(1));
    expect(ledger().signed).toEqual([]);
  });
});

describe("closing the deal", () => {
  const close = () => {
    fillThroughContact();
    fireEvent.click(screen.getByLabelText(s.closeNow));
    type(s.slugLabel, "nour-ceramics");
    next();
    fireEvent.click(screen.getByRole("button", { name: s.closeNow }));
  };

  it("sends the slug, which is what makes this the closing path", async () => {
    renderScreen();
    close();

    await waitFor(() => expect(post).toHaveBeenCalled());
    const [, , body] = post.mock.calls[0] as [unknown, string, Record<string, unknown>];
    expect(body.slug).toBe("nour-ceramics");
  });

  it("says what actually binds the shop to this rep", async () => {
    renderScreen();
    close();

    const outcome = await screen.findByTestId("onboard-outcome");
    expect(outcome).toHaveAttribute("data-outcome", "created");
    expect(screen.getByText(s.createdBoundNote)).toBeInTheDocument();
  });

  it("hands the new brand id straight to the offer screen", async () => {
    renderScreen();
    close();

    await screen.findByTestId("onboard-outcome");
    expect(screen.getByRole("link", { name: s.goToTerms })).toHaveAttribute(
      "href",
      `/terms?brandId=${SIGNED_BRAND_ID}`
    );
  });

  it("records the brand and the application that binds it", async () => {
    renderScreen();
    close();

    await screen.findByTestId("onboard-outcome");
    await waitFor(() => expect(ledger().signed).toHaveLength(1));
    expect(ledger().signed[0]).toMatchObject({
      brandId: SIGNED_BRAND_ID,
      applicationId: SIGNED_APPLICATION_ID,
      slug: "nour-ceramics",
    });
  });

  /**
   * The two writes are not transactional: `BrandsService.create` can fail after
   * the application row is committed. What the ledger records has to be what the
   * API DID, never what the draft asked for.
   */
  it("records a lead when the rep asked to close but only the application landed", async () => {
    post.mockImplementation(() => Promise.resolve(filedResponse));

    renderScreen();
    close();

    const outcome = await screen.findByTestId("onboard-outcome");
    expect(outcome).toHaveAttribute("data-outcome", "filed");
    await waitFor(() => expect(ledger().leads).toHaveLength(1));
    expect(ledger().signed).toEqual([]);
  });
});

describe("failures", () => {
  it("reports a slug collision in the API's own words and saves nothing", async () => {
    post.mockImplementation(() =>
      Promise.reject(new ApiError(409, "That slug is already taken", "Conflict"))
    );

    renderScreen();
    fillThroughContact();
    fireEvent.click(screen.getByLabelText(s.closeNow));
    type(s.slugLabel, "nour-ceramics");
    next();
    fireEvent.click(screen.getByRole("button", { name: s.closeNow }));

    expect(await screen.findByTestId("submit-failed")).toHaveTextContent(
      "That slug is already taken"
    );
    expect(ledger().signed).toEqual([]);
  });

  it("draws the denied panel and names the role on a 403", async () => {
    post.mockImplementation(() =>
      Promise.reject(
        new ApiError(403, "Your role cannot perform this action", "Forbidden")
      )
    );

    renderScreen();
    fillThroughContact();
    next();
    fireEvent.click(screen.getByRole("button", { name: s.fileOnly }));

    expect(await screen.findByText(s.deniedTitle)).toBeInTheDocument();
    expect(screen.getByText("SALES")).toBeInTheDocument();
  });
});

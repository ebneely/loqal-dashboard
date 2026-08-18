import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { en } from "@/messages/en";
import { LocaleProvider } from "@/lib/locale-context";

import {
  agreeingDetail,
  disagreeingDetail,
  markedDetail,
  owedRun,
  partialDetail,
  remainingLinesPage,
  theyPayDetail,
} from "./fixtures";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/admin/settlements/x",
  useSearchParams: () => new URLSearchParams(),
}));

const get = vi.fn();
const patch = vi.fn();
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, api: { ...actual.api, get, patch } };
});

const { ApiError } = await import("@/lib/api");
const { SettlementRunDetailScreen } = await import("../[id]/run-detail");
const { ar } = await import("@/messages/ar");

const answer = (value: unknown) =>
  value instanceof Error ? Promise.reject(value) : Promise.resolve(value);

const renderScreen = (locale: "en" | "ar" = "en") =>
  render(
    <LocaleProvider locale={locale}>
      <SettlementRunDetailScreen id={owedRun.id} />
    </LocaleProvider>
  );

beforeEach(() => {
  vi.clearAllMocks();
  get.mockImplementation(() => answer(agreeingDetail));
  patch.mockImplementation(() => answer({}));
});

describe("/admin/settlements/[id] — everything to check is on one screen", () => {
  it("shows the period, the direction, the destination and the lines together", async () => {
    const { container } = renderScreen();

    await screen.findByText(owedRun.brandName);
    expect(screen.getByText(en.admin.checkFirstTitle)).toBeInTheDocument();
    expect(
      container.querySelector('[data-direction-decision="WE_PAY"]')
    ).not.toBeNull();
    expect(screen.getByText(owedRun.settlementDetails)).toBeInTheDocument();
    expect(screen.getAllByText(en.admin.entrySale).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(en.admin.entryCommission).length
    ).toBeGreaterThan(0);
  });

  it("says so when the brand has no payout destination on it", async () => {
    get.mockImplementation(() => answer(theyPayDetail));

    renderScreen();

    await screen.findByText("Maadi Textiles");
    expect(screen.getByText(en.admin.destinationUnset)).toBeInTheDocument();
    expect(screen.getByText(en.admin.methodUnset)).toBeInTheDocument();
  });
});

describe("/admin/settlements/[id] — the sum check is a refusal, not a decoration", () => {
  it("confirms the lines add up once every page is loaded", async () => {
    const { container } = renderScreen();

    await screen.findByText(owedRun.brandName);
    expect(container.querySelector('[data-sum="agrees"]')).not.toBeNull();
    expect(screen.getByText(en.admin.linesAllLoaded)).toBeInTheDocument();
  });

  it("states in capitals that the lines DO NOT add up, and still draws the button", async () => {
    // Refusing to draw the button would send the admin to a database console
    // rather than to a conversation.
    get.mockImplementation(() => answer(disagreeingDetail));

    const { container } = renderScreen();

    await screen.findByText(owedRun.brandName);
    expect(container.querySelector('[data-sum="disagrees"]')).not.toBeNull();
    expect(screen.getByText(en.admin.linesDisagree)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: en.admin.markSent })
    ).toBeInTheDocument();
  });

  it("gives no verdict at all while a page of lines remains", async () => {
    get.mockImplementation(() => answer(partialDetail));

    const { container } = renderScreen();

    await screen.findByText(owedRun.brandName);
    expect(container.querySelector('[data-sum="incomplete"]')).not.toBeNull();
    expect(container.querySelector('[data-sum="disagrees"]')).toBeNull();
    expect(container.querySelector('[data-sum="agrees"]')).toBeNull();
    expect(screen.getByText(en.admin.linesMoreToLoad)).toBeInTheDocument();
  });

  it("reaches a verdict once the remaining lines are walked in", async () => {
    get.mockImplementationOnce(() => answer(partialDetail));
    get.mockImplementationOnce(() => answer(remainingLinesPage));

    const { container } = renderScreen();

    const more = await screen.findByRole("button", { name: en.admin.loadMore });
    fireEvent.click(more);

    await waitFor(() =>
      expect(container.querySelector('[data-sum="agrees"]')).not.toBeNull()
    );
    expect(screen.getByText(en.admin.linesAllLoaded)).toBeInTheDocument();
  });

  it("keeps the lines on screen when a later page of them fails", async () => {
    get.mockImplementationOnce(() => answer(partialDetail));
    get.mockImplementationOnce(() =>
      answer(new ApiError(500, "boom", "InternalServerError"))
    );

    renderScreen();

    const more = await screen.findByRole("button", { name: en.admin.loadMore });
    fireEvent.click(more);

    expect(await screen.findByTestId("lines-inline-error")).toHaveTextContent(
      en.admin.pageFailedBody
    );
    // The lines already loaded are still correct and still there.
    expect(screen.getAllByText(en.admin.entrySale).length).toBeGreaterThan(0);
    expect(screen.queryByText(en.admin.errorTitle)).toBeNull();
  });

  it("repeats the disagreement inside the sheet, over the thumb", async () => {
    get.mockImplementation(() => answer(disagreeingDetail));

    renderScreen();

    const button = await screen.findByRole("button", {
      name: en.admin.markSent,
    });
    fireEvent.click(button);

    // Somebody who scrolled past the warning on the way down has to see it
    // again with their thumb already over the confirm.
    await waitFor(() =>
      expect(screen.getAllByText(en.admin.linesDisagree).length).toBeGreaterThan(
        1
      )
    );
  });
});

describe("/admin/settlements/[id] — direction decides the verb", () => {
  it("offers SENT and never RECEIVED on a run Loqal owes", async () => {
    renderScreen();

    await screen.findByText(owedRun.brandName);
    expect(
      screen.getByRole("button", { name: en.admin.markSent })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: en.admin.markReceived })
    ).toBeNull();
  });

  it("offers RECEIVED and never SENT on a run the brand owes", async () => {
    get.mockImplementation(() => answer(theyPayDetail));

    renderScreen();

    await screen.findByText("Maadi Textiles");
    expect(
      screen.getByRole("button", { name: en.admin.markReceived })
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: en.admin.markSent })).toBeNull();
  });

  it("offers cancelling in both directions", async () => {
    renderScreen();

    await screen.findByText(owedRun.brandName);
    expect(
      screen.getByRole("button", { name: en.admin.cancelRun })
    ).toBeInTheDocument();
  });
});

describe("/admin/settlements/[id] — there is no way back to pending", () => {
  it("draws no button at all on a run that was already marked", async () => {
    get.mockImplementation(() => answer(markedDetail));

    renderScreen();

    await screen.findByText(owedRun.brandName);
    expect(screen.getByText(en.admin.alreadyMarked)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: en.admin.markSent })).toBeNull();
    expect(screen.queryByRole("button", { name: en.admin.cancelRun })).toBeNull();
  });

  it("says why, on every run, before anything is pressed", async () => {
    renderScreen();

    await screen.findByText(owedRun.brandName);
    expect(screen.getByText(en.admin.noWayBackTitle)).toBeInTheDocument();
  });

  it("shows who marked it and when, on a run that was", async () => {
    get.mockImplementation(() => answer(markedDetail));

    renderScreen();

    await screen.findByText(owedRun.brandName);
    expect(screen.getByText("InstaPay ref 88213")).toBeInTheDocument();
  });
});

describe("/admin/settlements/[id] — marking", () => {
  it("sends the contract's own body, and only after the sheet is confirmed", async () => {
    renderScreen();

    fireEvent.click(await screen.findByRole("button", { name: en.admin.markSent }));
    expect(patch).not.toHaveBeenCalled();

    const confirms = await screen.findAllByRole("button", {
      name: en.admin.markSent,
    });
    fireEvent.click(confirms[confirms.length - 1]);

    await waitFor(() => expect(patch).toHaveBeenCalled());
    const [, path, body] = patch.mock.calls[0] as [unknown, string, unknown];
    expect(path).toBe(`/v1/admin/settlement-runs/${owedRun.id}`);
    expect(body).toEqual({ status: "SENT" });
  });

  it("carries a note when one was written, and omits the key when not", async () => {
    renderScreen();

    const note = await screen.findByLabelText(en.admin.noteLabel);
    fireEvent.change(note, { target: { value: "  transfer 4821  " } });

    fireEvent.click(screen.getByRole("button", { name: en.admin.markSent }));
    const confirms = await screen.findAllByRole("button", {
      name: en.admin.markSent,
    });
    fireEvent.click(confirms[confirms.length - 1]);

    await waitFor(() => expect(patch).toHaveBeenCalled());
    const [, , body] = patch.mock.calls[0] as [unknown, string, unknown];
    expect(body).toEqual({ status: "SENT", note: "transfer 4821" });
  });

  it("refuses a note longer than the API accepts, before the request", async () => {
    renderScreen();

    const note = await screen.findByLabelText(en.admin.noteLabel);
    fireEvent.change(note, { target: { value: "x".repeat(301) } });

    expect(
      screen.getByRole("button", { name: en.admin.markSent })
    ).toBeDisabled();
    expect(patch).not.toHaveBeenCalled();
  });

  it("reports a failure and changes nothing on screen", async () => {
    patch.mockImplementation(() =>
      answer(new ApiError(409, "Conflict", "Conflict"))
    );

    renderScreen();

    fireEvent.click(await screen.findByRole("button", { name: en.admin.markSent }));
    const confirms = await screen.findAllByRole("button", {
      name: en.admin.markSent,
    });
    fireEvent.click(confirms[confirms.length - 1]);

    expect(await screen.findByText(en.admin.actionFailed)).toBeInTheDocument();
  });
});

describe("/admin/settlements/[id] — the three failure states", () => {
  it("draws notFound, with a way back, on a 404", async () => {
    get.mockImplementation(() =>
      answer(new ApiError(404, "No such settlement run", "NotFound"))
    );

    renderScreen();

    expect(
      await screen.findByText(en.admin.runNotFoundTitle)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: en.admin.backToSettlements })
    ).toHaveAttribute("href", "/admin/settlements");
  });

  it("draws denied on a 403 and names the role", async () => {
    get.mockImplementation(() =>
      answer(new ApiError(403, "Forbidden", "Forbidden"))
    );

    renderScreen();

    expect(await screen.findByText(en.admin.deniedTitle)).toBeInTheDocument();
    expect(screen.getByText("SUPER_ADMIN")).toBeInTheDocument();
  });
});

describe("/admin/settlements/[id] — bilingual", () => {
  it("takes its copy from ar.ts under the Arabic locale", async () => {
    renderScreen("ar");

    await screen.findByText(owedRun.brandName);
    expect(screen.getByText(ar.admin.noWayBackTitle)).toBeInTheDocument();
    expect(screen.queryByText(en.admin.noWayBackTitle)).toBeNull();
  });
});

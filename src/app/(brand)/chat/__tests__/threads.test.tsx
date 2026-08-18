import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { en } from "@/messages/en";
import { LocaleProvider } from "@/lib/locale-context";

import {
  NOW,
  emptyThreadList,
  escalatedThread,
  threadList,
  waitingThread,
} from "./fixtures";

/**
 * Only `api` is replaced. ApiError stays the real class — `listStateFor` does
 * an `instanceof` check on it, and a stubbed lookalike would make the 403 test
 * pass for the wrong reason.
 */
const get = vi.fn();
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, api: { ...actual.api, get } };
});

const { ApiError } = await import("@/lib/api");
const { ThreadsScreen } = await import("../threads-screen");
const { ar } = await import("@/messages/ar");

const answer = (value: unknown) =>
  value instanceof Error ? Promise.reject(value) : Promise.resolve(value);

const renderChat = (locale: "en" | "ar" = "en") =>
  render(
    <LocaleProvider locale={locale}>
      <ThreadsScreen />
    </LocaleProvider>
  );

// Reset in beforeEach, not afterEach: a mock left configured by the previous
// file is what makes the first test of this one fail for no visible reason.
beforeEach(() => {
  vi.restoreAllMocks();
  get.mockReset();
  vi.spyOn(Date, "now").mockReturnValue(NOW.getTime());
  get.mockImplementation(() => answer(threadList));
});

describe("/chat — the missing unread count", () => {
  /**
   * The thread row carries no `unreadCount` and no `lastSenderType`, so the
   * design system's "Unread chat · oldest 22 min" is not renderable. The screen
   * says what it knows and says out loud what it does not.
   */
  it("prints no unread number anywhere", async () => {
    const { container } = renderChat();

    await screen.findAllByRole("link", { name: en.brand.chatPartyGuest });
    expect(screen.getByTestId("chat-no-count")).toHaveTextContent(
      en.brand.chatNoCount
    );
    // The word appears once, in the sentence explaining that the number is not
    // computable. It never appears attached to a figure.
    expect(container.textContent).not.toMatch(/\d+\s*unread/i);
    expect(container.textContent).not.toMatch(/unread\s*[:·]?\s*\d+/i);
  });

  it("labels the wait rather than a count", async () => {
    renderChat();

    await screen.findAllByRole("link", { name: en.brand.chatPartyGuest });
    expect(
      screen.getAllByText(en.brand.chatWaitingOnYou).length
    ).toBeGreaterThan(0);
    // 22 minutes of waiting, said as a duration.
    expect(
      screen.getAllByText(en.brand.chatWaitedFor.replace("{t}", "22 min"))
        .length
    ).toBeGreaterThan(0);
  });

  it("claims no name and no address for either kind of shopper", async () => {
    renderChat();

    await screen.findAllByRole("link", { name: en.brand.chatPartyGuest });
    expect(screen.getByText(en.brand.chatNoNames)).toBeInTheDocument();
    expect(
      screen.getAllByText(en.brand.chatPartyShopper).length
    ).toBeGreaterThan(0);
  });
});

describe("/chat — the escalation countdown", () => {
  it("shows how long is left before the shop's WhatsApp is used", async () => {
    renderChat();

    await screen.findAllByRole("link", { name: en.brand.chatPartyGuest });
    expect(
      screen.getAllByText(en.brand.chatEscalatesIn.replace("{t}", "8 min"))
        .length
    ).toBeGreaterThan(0);
    expect(screen.getAllByTestId("chat-countdown").length).toBeGreaterThan(0);
  });

  it("says a fired escalation has fired", async () => {
    renderChat();

    await screen.findAllByRole("link", { name: en.brand.chatPartyGuest });
    expect(screen.getAllByTestId("chat-escalated").length).toBeGreaterThan(0);
  });

  /**
   * The threshold is a PlatformSetting sent down with every thread, so a shop
   * on a different number sees its own. The screen must never print 30 from a
   * constant of its own.
   */
  it("takes the threshold from the response, not from a constant", async () => {
    get.mockImplementation(() =>
      answer([{ ...waitingThread, unansweredThresholdMinutes: 45 }])
    );

    renderChat();

    const note = await screen.findByTestId("chat-threshold-note");
    expect(note).toHaveTextContent(
      en.brand.chatEscalationRule.replace("{n}", "45")
    );
    expect(note.textContent).not.toMatch(/\b30\b/);
  });

  it("prints no phone number, whatever the design copy says", async () => {
    const { container } = renderChat();

    await screen.findAllByRole("link", { name: en.brand.chatPartyGuest });
    expect(container.textContent).not.toMatch(/01[0-2,5]\s?\d{4}\s?\d{4}/);
  });
});

describe("/chat — the list", () => {
  it("ranks the longest wait first", async () => {
    renderChat();

    await screen.findAllByRole("link", { name: en.brand.chatPartyGuest });
    const hrefs = screen
      .getAllByRole("link")
      .map((node) => node.getAttribute("href"))
      .filter((href): href is string => Boolean(href?.startsWith("/chat/")));

    expect(hrefs[0]).toBe(`/chat/${escalatedThread.id}`);
  });

  it("makes each row a real anchor rather than a click handler", async () => {
    renderChat();

    const rows = await screen.findAllByRole("link", {
      name: en.brand.chatPartyGuest,
    });
    expect(rows[0]).toHaveAttribute("href", `/chat/${waitingThread.id}`);
  });

  it("puts the longest wait under the thumb", async () => {
    renderChat();

    await screen.findAllByRole("link", { name: en.brand.chatPartyGuest });
    const bar = screen.getByTestId("chat-action-bar");
    expect(bar.closest('[data-slot="mobile-action-bar"]')).not.toBeNull();
    expect(
      within(bar).getByRole("link", { name: en.brand.chatAnswerOldest })
    ).toHaveAttribute("href", `/chat/${escalatedThread.id}`);
  });
});

describe("/chat — the list states", () => {
  it("draws the loading skeleton while the first read is in flight", () => {
    get.mockImplementation(() => new Promise(() => {}));

    const { container } = renderChat();

    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it("draws the empty state when the shop has never been written to", async () => {
    get.mockImplementation(() => answer(emptyThreadList));

    renderChat();

    expect(
      await screen.findByText(en.brand.chatThreadsEmptyTitle)
    ).toBeInTheDocument();
  });

  it("draws the error state with a retry when the first read fails", async () => {
    get.mockImplementation(() =>
      answer(new ApiError(500, "boom", "InternalServerError"))
    );

    renderChat();

    expect(await screen.findByText(en.brand.chatErrorTitle)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: en.brand.retry })
    ).toBeInTheDocument();
  });

  it("draws the denied state, with no retry, on a 403", async () => {
    get.mockImplementation(() =>
      answer(new ApiError(403, "Forbidden", "Forbidden"))
    );

    renderChat();

    expect(await screen.findByText(en.brand.chatOnlyTitle)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: en.brand.retry })).toBeNull();
  });
});

describe("/chat — a failed refresh keeps the list", () => {
  /**
   * The trap every other list screen currently falls into: `listStateFor` maps
   * any error to a full-page panel, so a refresh that fails throws away rows
   * the shop owner was reading. Here the rows stay and the failure is a strip
   * above them.
   */
  it("keeps the rows on screen and offers an inline retry", async () => {
    renderChat();

    await screen.findAllByRole("link", { name: en.brand.chatPartyGuest });

    get.mockImplementation(() =>
      answer(new ApiError(500, "boom", "InternalServerError"))
    );
    fireEvent.click(screen.getByRole("button", { name: en.brand.chatRefresh }));

    const stale = await screen.findByTestId("chat-stale");
    expect(stale).toHaveTextContent(en.brand.chatStaleTitle);

    // Still a list, not a panel instead of one.
    expect(
      screen.getAllByRole("link", { name: en.brand.chatPartyGuest }).length
    ).toBeGreaterThan(0);
    expect(screen.queryByText(en.brand.chatErrorTitle)).toBeNull();
  });

  it("recovers the list when the retry succeeds", async () => {
    renderChat();

    await screen.findAllByRole("link", { name: en.brand.chatPartyGuest });

    get.mockImplementation(() =>
      answer(new ApiError(500, "boom", "InternalServerError"))
    );
    fireEvent.click(screen.getByRole("button", { name: en.brand.chatRefresh }));
    await screen.findByTestId("chat-stale");

    get.mockImplementation(() => answer(threadList));
    fireEvent.click(
      within(screen.getByTestId("chat-stale")).getByRole("button", {
        name: en.brand.retry,
      })
    );

    await waitFor(() => expect(screen.queryByTestId("chat-stale")).toBeNull());
  });

  /**
   * A 403 is the one error that must NOT keep rows: it means "you may not have
   * this", not "could not ask".
   */
  it("clears the list on a permission refusal", async () => {
    renderChat();

    await screen.findAllByRole("link", { name: en.brand.chatPartyGuest });

    get.mockImplementation(() =>
      answer(new ApiError(403, "Forbidden", "Forbidden"))
    );
    fireEvent.click(screen.getByRole("button", { name: en.brand.chatRefresh }));

    expect(await screen.findByText(en.brand.chatOnlyTitle)).toBeInTheDocument();
    expect(screen.queryByTestId("chat-stale")).toBeNull();
    expect(
      screen.queryByRole("link", { name: en.brand.chatPartyGuest })
    ).toBeNull();
  });
});

describe("/chat — bilingual", () => {
  it("takes its copy from ar.ts under the Arabic locale", async () => {
    renderChat("ar");

    expect(
      (await screen.findAllByRole("link", { name: ar.brand.chatPartyGuest }))
        .length
    ).toBeGreaterThan(0);
    expect(screen.getByText(ar.brand.chatNoCount)).toBeInTheDocument();
    // The countdown speaks Arabic too — the minutes phrase comes from ar.ts,
    // not from a hard-coded "min".
    expect(
      screen.getAllByText(
        ar.brand.chatEscalatesIn.replace(
          "{t}",
          ar.brand.waitedMinutes.replace("{n}", "8")
        )
      ).length
    ).toBeGreaterThan(0);
  });
});

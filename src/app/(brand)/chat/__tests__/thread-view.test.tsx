import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { en } from "@/messages/en";
import { LocaleProvider } from "@/lib/locale-context";

import {
  NOW,
  brandMessage,
  messageWithAttachment,
  sentMessage,
  shopperMessage,
  threadMessages,
  waitingThread,
} from "./fixtures";

const get = vi.fn();
const post = vi.fn();
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, api: { ...actual.api, get, post } };
});

const { ApiError } = await import("@/lib/api");
const { ThreadView } = await import("../[threadId]/thread-view");

const answer = (value: unknown) =>
  value instanceof Error ? Promise.reject(value) : Promise.resolve(value);

const renderThread = () =>
  render(
    <LocaleProvider locale="en">
      <ThreadView threadId={waitingThread.id} />
    </LocaleProvider>
  );

beforeEach(() => {
  vi.restoreAllMocks();
  get.mockReset();
  post.mockReset();
  vi.spyOn(Date, "now").mockReturnValue(NOW.getTime());
  get.mockImplementation(() => answer(threadMessages));
  post.mockImplementation(() => answer({ ok: true }));
});

describe("/chat/[threadId] — the conversation", () => {
  it("asks the API for this thread's messages", async () => {
    renderThread();

    await waitFor(() => expect(get).toHaveBeenCalled());
    const [, path] = get.mock.calls[0] as [unknown, string];
    expect(path).toBe(`/v1/dashboard/chat/threads/${waitingThread.id}/messages`);
  });

  it("draws every message, whoever sent it", async () => {
    renderThread();

    expect(await screen.findByText(shopperMessage.body)).toBeInTheDocument();
    expect(screen.getByText(brandMessage.body)).toBeInTheDocument();
    expect(screen.getByText(messageWithAttachment.body)).toBeInTheDocument();
  });

  /**
   * `ThreadParty` is four values and nothing to do with UserRole. A guest is
   * labelled a guest rather than folded into "shopper".
   */
  it("names each side by ThreadParty, not by role", async () => {
    renderThread();

    await screen.findByText(shopperMessage.body);
    expect(screen.getAllByText(en.brand.senderGuest).length).toBeGreaterThan(0);
    expect(screen.getAllByText(en.brand.senderBrand).length).toBeGreaterThan(0);
  });

  it("shows an attachment exists and never pretends it can be opened", async () => {
    const { container } = renderThread();

    await screen.findByText(messageWithAttachment.body);
    expect(screen.getByText(en.brand.attachmentLabel)).toBeInTheDocument();
    expect(screen.getByText(en.brand.attachmentNoAddress)).toBeInTheDocument();
    // The media id is not an address and is not printed as one.
    expect(container.textContent).not.toContain(
      messageWithAttachment.attachments[0]?.mediaId
    );
  });

  /**
   * Presence on this backend is asymmetric on purpose — a brand may learn only
   * that somebody is in THIS thread, never who is browsing — and on this plane
   * it is not served at all. So nothing about it is drawn.
   */
  it("renders no presence, no typing state and no roster", async () => {
    const { container } = renderThread();

    await screen.findByText(shopperMessage.body);
    expect(container.textContent).not.toMatch(/online|typing|viewing|present/i);
  });
});

describe("/chat/[threadId] — the read receipt", () => {
  it("marks the thread read up to the newest shopper message", async () => {
    renderThread();

    await screen.findByText(messageWithAttachment.body);
    await waitFor(() =>
      expect(
        post.mock.calls.some(
          ([, path]) =>
            path === `/v1/dashboard/chat/threads/${waitingThread.id}/read`
        )
      ).toBe(true)
    );

    const call = post.mock.calls.find(
      ([, path]) =>
        path === `/v1/dashboard/chat/threads/${waitingThread.id}/read`
    ) as [unknown, string, { upToMessageId: string }];
    expect(call[2].upToMessageId).toBe(messageWithAttachment.id);
  });

  /**
   * Reading a thread stops the countdown to WhatsApp, because `Message.readAt`
   * is the same column the fall-through tests. That is a consequence a shop
   * owner has to be told about, not one to discover.
   */
  it("says out loud that opening it stopped the countdown", async () => {
    renderThread();

    expect(await screen.findByTestId("thread-read-note")).toHaveTextContent(
      en.brand.threadReadStopsClock
    );
  });

  it("marks nothing, and says nothing, when the shop already answered", async () => {
    get.mockImplementation(() => answer([shopperMessage, brandMessage]));

    renderThread();

    await screen.findByText(brandMessage.body);
    expect(screen.queryByTestId("thread-read-note")).toBeNull();
    expect(
      post.mock.calls.some(([, path]) => String(path).endsWith("/read"))
    ).toBe(false);
  });
});

describe("/chat/[threadId] — answering", () => {
  it("posts the reply and puts it on screen without refetching", async () => {
    post.mockImplementation((_schema: unknown, path: string) =>
      path.endsWith("/messages") ? answer(sentMessage) : answer({ ok: true })
    );

    renderThread();

    const box = await screen.findByLabelText(en.brand.typeHere);
    fireEvent.change(box, { target: { value: sentMessage.body } });
    fireEvent.click(screen.getByRole("button", { name: en.brand.send }));

    expect(await screen.findByText(sentMessage.body)).toBeInTheDocument();

    const call = post.mock.calls.find(([, path]) =>
      String(path).endsWith("/messages")
    ) as [unknown, string, { body: string; attachmentMediaIds: string[] }];
    expect(call[1]).toBe(
      `/v1/dashboard/chat/threads/${waitingThread.id}/messages`
    );
    expect(call[2].body).toBe(sentMessage.body);
  });

  it("refuses to post an empty message and says why", async () => {
    renderThread();

    await screen.findByLabelText(en.brand.typeHere);
    fireEvent.click(screen.getByRole("button", { name: en.brand.send }));

    expect(await screen.findByText(en.brand.messageRequired)).toBeInTheDocument();
    expect(
      post.mock.calls.some(([, path]) => String(path).endsWith("/messages"))
    ).toBe(false);
  });

  it("says the send failed rather than losing what was typed", async () => {
    post.mockImplementation((_schema: unknown, path: string) =>
      path.endsWith("/messages")
        ? answer(new ApiError(500, "boom", "InternalServerError"))
        : answer({ ok: true })
    );

    renderThread();

    const box = await screen.findByLabelText(en.brand.typeHere);
    fireEvent.change(box, { target: { value: "Yes, we have it." } });
    fireEvent.click(screen.getByRole("button", { name: en.brand.send }));

    expect(await screen.findByText(en.brand.sendFailed)).toBeInTheDocument();
    expect(box).toHaveValue("Yes, we have it.");
  });

  /**
   * `hideAt="never"` is what keeps ONE composer in the tree at every width. Two
   * nodes with the same accessible name is the accessibility bug it removes.
   */
  it("keeps one composer at every width", async () => {
    renderThread();

    await screen.findByLabelText(en.brand.typeHere);
    expect(screen.getAllByRole("button", { name: en.brand.send })).toHaveLength(
      1
    );
    expect(
      screen
        .getByLabelText(en.brand.typeHere)
        .closest('[data-slot="mobile-action-bar"]')
    ).toHaveAttribute("data-hide-at", "never");
  });

  it("says attachments cannot be sent from here yet", async () => {
    renderThread();

    await screen.findByLabelText(en.brand.typeHere);
    expect(
      screen.getByText(en.brand.attachSendUnavailable)
    ).toBeInTheDocument();
  });
});

describe("/chat/[threadId] — the states", () => {
  it("draws the empty state for a thread with nothing in it", async () => {
    get.mockImplementation(() => answer([]));

    renderThread();

    expect(
      await screen.findByText(en.brand.threadEmptyTitle)
    ).toBeInTheDocument();
  });

  /**
   * The API answers 404 rather than 403 for another shop's thread so the route
   * is not an enumeration oracle. The screen must not undo that by wording the
   * two differently.
   */
  it("draws notFound, with a way back, on a 404", async () => {
    get.mockImplementation(() => answer(new ApiError(404, "Nope", "NotFound")));

    renderThread();

    expect(
      await screen.findByText(en.brand.threadNotFoundTitle)
    ).toBeInTheDocument();
    // Exactly ONE way out, not two anchors with the same accessible name.
    const back = screen.getAllByRole("link", { name: en.brand.threadBack });
    expect(back).toHaveLength(1);
    expect(back[0]).toHaveAttribute("href", "/chat");
    // No composer on a thread that is not yours.
    expect(screen.queryByLabelText(en.brand.typeHere)).toBeNull();
  });

  it("draws the error state with a retry", async () => {
    get.mockImplementation(() =>
      answer(new ApiError(500, "boom", "InternalServerError"))
    );

    renderThread();

    expect(
      await screen.findByText(en.brand.threadErrorTitle)
    ).toBeInTheDocument();
  });

  it("draws the denied state on a 403", async () => {
    get.mockImplementation(() =>
      answer(new ApiError(403, "Forbidden", "Forbidden"))
    );

    renderThread();

    expect(await screen.findByText(en.brand.chatOnlyTitle)).toBeInTheDocument();
  });
});

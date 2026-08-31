"use client";

/**
 * What the two chat screens read and write.
 *
 * Built on `useResource` from @/lib/resource — not on `useCursorFeed`, because
 * neither chat endpoint paginates. `GET /v1/dashboard/chat/threads` answers a
 * BARE ARRAY of every thread the shop has ever had, and
 * `GET .../threads/:id/messages` answers a bare array of every message in it.
 * Both are gaps worth naming: the inbox of a shop that has been trading a year
 * is one response, on a phone, on mobile data.
 *
 * One behaviour here is deliberately NOT what the other list screens do. Every
 * shipped screen currently maps any error to a full-page panel, which throws
 * away rows already on screen when a REFRESH fails — the shop owner loses the
 * list they were reading because the connection blinked. `useCursorFeed` goes
 * out of its way to keep rows on a failed later page; this does the same for a
 * failed refresh, and the screen renders an inline retry above the list it
 * still has. See `isStale`.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";

import { ApiError, api } from "@/lib/api";
import { useResource } from "@/lib/resource";

import {
  brandThreadListSchema,
  chatMessageListSchema,
  chatMessageSchema,
  type BrandThread,
  type ChatMessage,
} from "./chat-wire";

/** The read receipt answers `{ ok: true }` and nothing reads it. */
const unparsed = z.unknown();

/**
 * The open thread re-reads every 10s, the inbox every 30s.
 *
 * Polling, because the socket cannot connect: the chat gateway lives on the
 * API origin and authenticates from a session cookie the browser will never
 * send there — src/lib/chat-socket.ts's header carries the full blocker and
 * the backend work that would lift it. Until then this clock is the only
 * thing that makes a shopper's message appear without navigating away, which
 * on a screen kept open behind a counter means the only thing that makes it
 * appear at all. Ten seconds inside one conversation because that is where
 * somebody is actively waiting; thirty for the inbox, whose own copy measures
 * waits in minutes.
 */
const MESSAGES_POLL_MS = 10_000;
const THREADS_POLL_MS = 30_000;

/**
 * `reload` on a clock. The tick is skipped while the tab is hidden — a shop's
 * dashboard is exactly the tab that sits open all day, and the first visible
 * tick catches it up. `useResource`'s `reload` is a stable callback, so this
 * effect runs once per mount rather than once per render.
 */
function usePollingReload(reload: () => void, everyMs: number) {
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "hidden") return;
      reload();
    }, everyMs);
    return () => clearInterval(timer);
  }, [reload, everyMs]);
}

export type ThreadFeed = {
  rows: readonly BrandThread[];
  error: unknown;
  /** The FIRST load only. A refresh over rows already on screen is not this. */
  isLoading: boolean;
  /**
   * The rows are the last good answer and the newest read failed.
   *
   * This is the state that must NOT become a full-page error: a shop owner
   * mid-conversation does not lose the inbox because one request timed out.
   */
  isStale: boolean;
  reload: () => void;
};

export function useBrandThreads(): ThreadFeed {
  const resource = useResource("chat:threads", true, (signal) =>
    api.get(brandThreadListSchema, "/v1/dashboard/chat/threads", { signal })
  );

  // A new conversation shows up on its own. `isStale` below is what makes
  // this safe to do on a clock: a refresh that fails keeps the rows.
  usePollingReload(resource.reload, THREADS_POLL_MS);

  const kept = useRef<readonly BrandThread[]>([]);
  if (resource.data) kept.current = resource.data;

  /*
    A 403 is the one error that must clear the list rather than keep it. The
    others mean "could not ask"; this one means "you may not have this", and
    leaving a shop's conversations on screen after the API said no is the wrong
    way round.
  */
  const denied =
    resource.error instanceof ApiError && resource.error.isPermissionDenied;

  const rows = resource.data ?? (denied ? [] : kept.current);

  return {
    rows,
    error: resource.error,
    isLoading: resource.isLoading && rows.length === 0,
    isStale: Boolean(resource.error) && !denied && rows.length > 0,
    reload: resource.reload,
  };
}

export type ThreadMessages = {
  messages: readonly ChatMessage[];
  error: unknown;
  isLoading: boolean;
  reload: () => void;
  /** Put a just-sent message on screen without refetching the whole thread. */
  append: (message: ChatMessage) => void;
};

export function useThreadMessages(threadId: string): ThreadMessages {
  const resource = useResource(
    `chat:messages:${threadId}`,
    Boolean(threadId),
    (signal) =>
      api.get(
        chatMessageListSchema,
        `/v1/dashboard/chat/threads/${threadId}/messages`,
        { signal }
      )
  );

  // The shopper's reply appears while the screen is open. See the constant's
  // header for why this is a clock and not the socket.
  usePollingReload(resource.reload, MESSAGES_POLL_MS);

  /*
    Same rule as `useBrandThreads` above: a conversation already on screen
    survives a failed refresh. The poll makes refreshes constant, so without
    this one blinked request would swap a live thread for an error panel on a
    ten-second timer. A 403 or a 404 still clears and surfaces — "not yours"
    and "no such thread" are answers about the thread, not about the network.
  */
  const kept = useRef<readonly ChatMessage[] | null>(null);
  if (resource.data) kept.current = resource.data;

  const refused =
    resource.error instanceof ApiError &&
    (resource.error.isPermissionDenied || resource.error.isNotFound);

  const server = resource.data ?? (refused ? null : kept.current);

  const [sent, setSent] = useState<readonly ChatMessage[]>([]);

  /*
    Deduped by id rather than cleared on refetch: the next read will contain
    the message that was just posted, and dropping the local copy at that
    moment would make it flicker out and back in.
  */
  const messages = useMemo(() => {
    const base = server ?? [];
    const known = new Set(base.map((message) => message.id));
    return [...base, ...sent.filter((message) => !known.has(message.id))];
  }, [server, sent]);

  const append = useCallback((message: ChatMessage) => {
    setSent((current) =>
      current.some((existing) => existing.id === message.id)
        ? current
        : [...current, message]
    );
  }, []);

  return {
    messages,
    /*
      A failed BACKGROUND refresh is not surfaced — the kept conversation
      stays up and the next tick retries in seconds, which is a better answer
      than an error panel over messages the screen still has. A failed FIRST
      load, a 403 and a 404 all still reach the screen: with nothing kept
      there is nothing kinder to show.
    */
    error: server !== null && !refused ? null : resource.error,
    isLoading: resource.isLoading && server === null,
    reload: resource.reload,
    append,
  };
}

export function useSendMessage(threadId: string) {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  /**
   * Text only.
   *
   * `sendMessageSchema` accepts `attachmentMediaIds`, and uploading one needs
   * the signed-URL media flow that today lives inside the products route
   * folder. Sending an attachment from here is a gap, said out loud on the
   * screen rather than implemented by reaching across route folders.
   */
  const send = useCallback(
    async (body: string): Promise<ChatMessage | null> => {
      const trimmed = body.trim();
      if (!trimmed) return null;

      setPending(true);
      setFailed(false);
      try {
        return await api.post(
          chatMessageSchema,
          `/v1/dashboard/chat/threads/${threadId}/messages`,
          { body: trimmed, attachmentMediaIds: [] }
        );
      } catch {
        if (alive.current) setFailed(true);
        return null;
      } finally {
        if (alive.current) setPending(false);
      }
    },
    [threadId]
  );

  return { send, pending, failed };
}

/**
 * Mark the thread read up to `upToMessageId`, once per id.
 *
 * Fire and forget: a failed read receipt is not something to put in front of
 * somebody mid-conversation, and the next open retries it.
 */
export function useMarkRead(threadId: string, upToMessageId: string | null) {
  const done = useRef<string | null>(null);

  useEffect(() => {
    if (!threadId || !upToMessageId) return;
    if (done.current === upToMessageId) return;
    done.current = upToMessageId;

    void api
      .post(unparsed, `/v1/dashboard/chat/threads/${threadId}/read`, {
        upToMessageId,
      })
      .catch(() => {});
  }, [threadId, upToMessageId]);
}

"use client";

import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";

/**
 * The live half of chat.
 *
 * The backend has had a Socket.IO gateway on the `/chat` namespace for a while
 * and nothing in this app ever connected to it, so a message from a shopper
 * appeared only when somebody refetched — which on this screen means when they
 * navigated away and back. The gateway's Redis adapter was also never wired
 * into `main.ts`; that is fixed alongside this, and without it two API replicas
 * each hold half the sockets and half the messages never arrive at all.
 *
 * WHAT THIS DOES NOT DO: carry the message list. The socket says "this thread
 * moved" and the screen re-reads through the REST call it already uses, so
 * there stays exactly one way a thread is read. Two paths into the same list is
 * two places for ordering, dedupe and read-state to disagree — and this file
 * would have to own a copy of all three.
 *
 * WHY NOT SSE, since minirue's chat uses it: chat here is bidirectional. The
 * gateway already accepts `thread:join`, `thread:message` and `thread:typing`
 * FROM the client, and presence depends on knowing when a socket leaves. A
 * one-directional stream would need a parallel POST path for sending plus a
 * second transport to keep alive. minirue's support stream only ever pushed,
 * which is exactly why SSE was right there and is not right here.
 */

/** Socket.IO namespace, same-origin — the session cookie is first-party. */
const NAMESPACE = "/chat";

export type ThreadSocketHandlers = {
  /** A message landed in this thread. Re-read the list. */
  onMessage: () => void;
  /** Somebody on the other side is typing. Optional — presence is a nicety. */
  onTyping?: () => void;
};

/**
 * Join one thread's room for as long as the screen is open.
 *
 * One socket per mounted thread rather than a shared app-wide connection: a
 * brand employee has one chat screen open at a time, and a shared socket would
 * need its own room bookkeeping to know when the last subscriber left.
 *
 * The handlers are held in a ref so a caller may pass inline closures without
 * tearing the socket down and rebuilding it on every render — reconnecting on
 * each keystroke would drop presence and re-join the room continuously.
 */
export function useThreadSocket(
  threadId: string | null,
  handlers: ThreadSocketHandlers
) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!threadId) return;

    const socket: Socket = io(NAMESPACE, {
      // Sends the session cookie on the handshake. The gateway answers an
      // unauthenticated socket with `auth:error` rather than dropping it
      // silently, so the client can tell the two apart.
      withCredentials: true,
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      socket.emit("thread:join", { threadId });
    });

    socket.on("thread:message", () => handlersRef.current.onMessage());
    socket.on("thread:typing", () => handlersRef.current.onTyping?.());

    socket.on("auth:error", () => {
      // Not thrown. An expired session is an ordinary event on a screen left
      // open behind a counter all day; the REST calls will answer 401 and the
      // shell handles that. The socket simply stops being useful.
      socket.disconnect();
    });

    return () => {
      // Leave explicitly rather than relying on the disconnect: the gateway
      // clears presence on `thread:leave`, and a socket that vanishes without
      // it leaves the thread marked occupied until the store's TTL expires.
      socket.emit("thread:leave", { threadId });
      socket.disconnect();
    };
  }, [threadId]);
}

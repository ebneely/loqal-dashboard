"use client";

import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";

/**
 * The live half of chat.
 *
 * NOT CONNECTED TODAY, AND WHY — read this before debugging a silent socket.
 * The gateway lives on the API ORIGIN (loqal-backend `ChatGateway`, namespace
 * /chat) and authenticates a dashboard user from the Better Auth session
 * cookie on the handshake headers (`auth.api.getSession(fromNodeHeaders(...))`
 * in its `resolveCaller`). That cookie is first-party to THIS app's origin —
 * set through the BFF proxy, host-only, SameSite=Lax — so a browser will not
 * attach it to a handshake against the API host, and the gateway's
 * `cors: true` answers `Access-Control-Allow-Origin: *` with no credentials,
 * which a credentialed poll refuses anyway. Same-origin is no better: Next
 * cannot proxy a WebSocket, and the middleware matcher 307s /socket.io polls
 * to /sign-in. So `io("/chat")` below connects nowhere outside a localhost
 * setup where both apps share the "localhost" cookie host.
 *
 * WHAT WOULD FIX IT is backend work, in one of two shapes: a short-lived
 * socket token for brand staff, minted by an authenticated REST route and
 * verified in the handshake the way `handshake.auth.guestToken` already is —
 * or the dashboard and API served as one site so the cookie is same-site,
 * plus real per-origin CORS with credentials on the gateway. Until one lands,
 * the chat screens POLL — `usePollingReload` in
 * src/app/(brand)/chat/chat-data.ts is what actually makes a shopper's
 * message appear — and this hook stays as the upgrade path: it fails silently
 * (`auth:error` → disconnect) and costs only its retry loop.
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

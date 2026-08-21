"use client";

/**
 * What /returns reads and writes.
 *
 * A return is per BRAND ORDER and never per parent order — one brand's items
 * may come back while another's stay delivered. `returnPageSchema` carries no
 * sibling and no basket figure, and nothing here widens it.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";

import {
  returnPageSchema,
  type ReturnListItem,
} from "@loqal/contracts/return.contract";
import type { ReturnStatus } from "@loqal/contracts/enums";

import { api } from "@/lib/api";

export const RETURNS_PAGE_SIZE = 20;

/**
 * The decision endpoints answer with a return row that @loqal/contracts has no
 * schema for — `returnListItemSchema` is the LIST shape and carries fields
 * (itemCount, brandOrderId) the decision response does not.
 *
 * So the body is deliberately left unparsed. Declaring a shape here would put a
 * second, unreviewed definition of a return in the codebase, and the screen
 * does not need one: it reloads the list, which IS contract-backed.
 */
const unparsed = z.unknown();

type Request = { status: ReturnStatus | null; cursor: string | null };

export type ReturnsFeed = {
  rows: readonly ReturnListItem[];
  nextCursor: string | null;
  error: unknown;
  isLoading: boolean;
  isLoadingMore: boolean;
  reload: () => void;
  loadMore: () => void;
};

export function useReturns(status: ReturnStatus | null): ReturnsFeed {
  const [request, setRequest] = useState<Request>({ status, cursor: null });
  const [rows, setRows] = useState<readonly ReturnListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [isLoading, setLoading] = useState(true);
  const [isLoadingMore, setLoadingMore] = useState(false);
  const [nonce, setNonce] = useState(0);

  // A new filter is a new list, not a longer one.
  if (request.status !== status) setRequest({ status, cursor: null });

  useEffect(() => {
    const controller = new AbortController();
    const first = request.cursor === null;
    let live = true;

    if (first) {
      setLoading(true);
      setError(null);
    } else {
      setLoadingMore(true);
    }

    api
      .get(returnPageSchema, "/v1/dashboard/returns", {
        query: {
          status: request.status ?? undefined,
          cursor: request.cursor ?? undefined,
          limit: RETURNS_PAGE_SIZE,
        },
        signal: controller.signal,
      })
      .then((page) => {
        if (!live) return;
        setRows((previous) => (first ? page.items : [...previous, ...page.items]));
        setNextCursor(page.nextCursor);
        setError(null);
      })
      .catch((thrown: unknown) => {
        if (!live || controller.signal.aborted) return;
        if (first) setRows([]);
        setError(thrown);
      })
      .finally(() => {
        if (!live) return;
        setLoading(false);
        setLoadingMore(false);
      });

    return () => {
      live = false;
      controller.abort();
    };
  }, [request, nonce]);

  const reload = useCallback(() => {
    setRequest((current) => ({ status: current.status, cursor: null }));
    setNonce((n) => n + 1);
  }, []);

  const loadMore = useCallback(() => {
    setNextCursor((cursor) => {
      if (cursor) setRequest((current) => ({ ...current, cursor }));
      return cursor;
    });
  }, []);

  return { rows, nextCursor, error, isLoading, isLoadingMore, reload, loadMore };
}

/**
 * Approve and reject.
 *
 * A rejection carries a reason because a shopper will ask about it —
 * `rejectReturnBodySchema` requires a non-empty one and this is the screen that
 * has to collect it.
 */
export function useReturnDecision() {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const decide = useCallback(
    async (
      returnId: string,
      decision: "approve" | "reject",
      body: unknown
    ): Promise<boolean> => {
      setPendingId(returnId);
      setFailed(false);
      try {
        // The decision is NOT interpolated into the path. It reads the same
        // either way, but a path built from a variable is invisible to a grep
        // for the routes this app calls — and an endpoint nobody can find is
        // how /v1/dashboard/returns went a long time without existing at all.
        await api.post(
          unparsed,
          decision === "approve"
            ? `/v1/dashboard/returns/${returnId}/approve`
            : `/v1/dashboard/returns/${returnId}/reject`,
          body
        );
        return true;
      } catch {
        if (alive.current) setFailed(true);
        return false;
      } finally {
        if (alive.current) setPendingId(null);
      }
    },
    []
  );

  return { decide, pendingId, failed };
}

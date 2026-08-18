"use client";

/**
 * Everything the two order screens read and write.
 *
 * One rule runs through the whole file: the shapes come from
 * @loqal/contracts/order.contract and nothing here declares a new one. There is
 * no parentTotal and no sibling brand in those schemas — deliberately — so a
 * screen cannot render one even by mistake, and this module never widens them.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import {
  brandOrderDetailSchema,
  brandOrderPageSchema,
  type BrandOrderDetail,
  type BrandOrderListItem,
} from "@loqal/contracts/order.contract";
import type { BrandOrderStatus } from "@loqal/contracts/enums";

import { api } from "@/lib/api";

/**
 * Cursor pagination, never offset. A brand works this list by confirming rows
 * off the top of it, so the list shrinks underneath the reader — an offset
 * would silently skip whoever moved up into the gap.
 */
export const ORDERS_PAGE_SIZE = 20;

type Request = {
  status: BrandOrderStatus | null;
  cursor: string | null;
};

export type OrdersFeed = {
  rows: readonly BrandOrderListItem[];
  nextCursor: string | null;
  error: unknown;
  /** The first page. A later page in flight is `isLoadingMore`. */
  isLoading: boolean;
  isLoadingMore: boolean;
  reload: () => void;
  loadMore: () => void;
};

export function useBrandOrders(status: BrandOrderStatus | null): OrdersFeed {
  const [request, setRequest] = useState<Request>({ status, cursor: null });
  const [rows, setRows] = useState<readonly BrandOrderListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [isLoading, setLoading] = useState(true);
  const [isLoadingMore, setLoadingMore] = useState(false);
  const [nonce, setNonce] = useState(0);

  /**
   * Changing the filter starts a new list, not a longer one. Adjusting state
   * during render rather than in an effect means the stale page is never
   * committed — a shopper who is not in PACKED must not flash into it.
   */
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
      .get(brandOrderPageSchema, "/v1/dashboard/orders", {
        query: {
          status: request.status ?? undefined,
          cursor: request.cursor ?? undefined,
          limit: ORDERS_PAGE_SIZE,
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
        // A failed first page has no rows to keep; a failed "load more" keeps
        // the ones already on screen, because throwing them away would be a
        // worse answer than a short list.
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

  return {
    rows,
    nextCursor,
    error,
    isLoading,
    isLoadingMore,
    reload,
    loadMore,
  };
}

export type OrderDetailResource = {
  order: BrandOrderDetail | null;
  error: unknown;
  isLoading: boolean;
  reload: () => void;
  /** Replaces the order with what the transition endpoint answered. */
  apply: (order: BrandOrderDetail) => void;
};

export function useBrandOrder(id: string): OrderDetailResource {
  const [order, setOrder] = useState<BrandOrderDetail | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [isLoading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let live = true;

    setLoading(true);
    setError(null);

    api
      .get(brandOrderDetailSchema, `/v1/dashboard/orders/${id}`, {
        signal: controller.signal,
      })
      .then((value) => {
        if (!live) return;
        setOrder(value);
        setError(null);
      })
      .catch((thrown: unknown) => {
        if (!live || controller.signal.aborted) return;
        setOrder(null);
        setError(thrown);
      })
      .finally(() => {
        if (live) setLoading(false);
      });

    return () => {
      live = false;
      controller.abort();
    };
  }, [id, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const apply = useCallback((next: BrandOrderDetail) => {
    setOrder(next);
    setError(null);
  }, []);

  return { order, error, isLoading, reload, apply };
}

/**
 * The single write.
 *
 * One endpoint for the whole lifecycle rather than a verb per move, because the
 * legal moves live in one table on the server and a second copy of them spread
 * across route names is a second thing to keep in sync. The endpoint answers
 * with the order as it now stands, which is what the screen re-renders from —
 * refetching would race the write it just made.
 */
export function useTransition(id: string) {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const run = useCallback(
    async (body: unknown): Promise<BrandOrderDetail | null> => {
      setPending(true);
      setFailed(false);
      try {
        const next = await api.post(
          brandOrderDetailSchema,
          `/v1/dashboard/orders/${id}/transition`,
          body
        );
        return next;
      } catch {
        // An illegal move is a 409 from the server's table and a dead
        // connection is a transport error; to the person holding the phone with
        // a customer at the counter they are the same sentence.
        if (alive.current) setFailed(true);
        return null;
      } finally {
        if (alive.current) setPending(false);
      }
    },
    [id]
  );

  return { run, pending, failed };
}

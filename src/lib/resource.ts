"use client";

/**
 * The two shapes a list screen fetches in. Both of them, in one place.
 *
 * PROMOTED from src/app/(brand)/today/today-data.ts (`useResource`) and from the
 * cursor-paginating variants that orders and returns each wrote for themselves
 * (`useBrandOrders`, `useReturns`). Those two are the same hook twice, differing
 * only in which schema and which path they pass, and products, money and reviews
 * were each about to write a third and a fourth.
 *
 * This is the UNION of the three, not the intersection:
 *
 *  `useResource`   one fetch, one value. The ergonomic case, and still the right
 *                  one for a balance, a detail row or a category list. Its
 *                  signature is unchanged from the route copy on purpose, so the
 *                  four screens already calling it move by changing an import.
 *
 *  `useCursorFeed` a list that grows. Cursor pagination, never offset: a brand
 *                  works its list by confirming rows off the top of it, so the
 *                  list shrinks underneath the reader and an offset would
 *                  silently skip whoever moved up into the gap.
 *
 * Neither knows anything about a schema or an endpoint. The caller passes a
 * loader that already went through `@/lib/api`, which is where parsing lives.
 */
import { useCallback, useEffect, useRef, useState } from "react";

export type Resource<T> = {
  data: T | null;
  error: unknown;
  isLoading: boolean;
  reload: () => void;
};

/**
 * The smallest fetch hook that covers a screen.
 *
 * `key` is what re-runs it, `enabled` is what suppresses it entirely — a
 * balance call must not be made at all for an employee, not made and discarded.
 * The loader is held in a ref so an inline arrow in a component body does not
 * refetch on every render.
 */
export function useResource<T>(
  key: string,
  enabled: boolean,
  loader: (signal: AbortSignal) => Promise<T>
): Resource<T> {
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [isLoading, setLoading] = useState(enabled);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      setData(null);
      setError(null);
      return;
    }

    const controller = new AbortController();
    let live = true;

    setLoading(true);
    setError(null);

    loaderRef
      .current(controller.signal)
      .then((value) => {
        if (!live) return;
        setData(value);
        setError(null);
      })
      .catch((thrown: unknown) => {
        if (!live || controller.signal.aborted) return;
        setData(null);
        setError(thrown);
      })
      .finally(() => {
        if (live) setLoading(false);
      });

    return () => {
      live = false;
      controller.abort();
    };
  }, [key, enabled, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return { data, error, isLoading, reload };
}

/**
 * What every cursor-paginated list endpoint answers with. `brandOrderPageSchema`
 * and `returnPageSchema` are both already this shape, so a caller passes its
 * parsed page straight through.
 */
export type CursorPage<T> = {
  items: readonly T[];
  nextCursor: string | null;
};

export type CursorFeed<T> = {
  rows: readonly T[];
  nextCursor: string | null;
  error: unknown;
  /** The FIRST page. A later page in flight is `isLoadingMore`. */
  isLoading: boolean;
  isLoadingMore: boolean;
  /** Back to the first page, dropping everything paged in. */
  reload: () => void;
  loadMore: () => void;
};

type Request = { key: string; cursor: string | null };

/**
 * A list that grows a page at a time.
 *
 * `key` is the filter's identity — its own status, its own search term, whatever
 * decides WHICH list this is. Changing it starts a NEW list, not a longer one.
 * That reset is done during render rather than in an effect so the stale page is
 * never committed: a shopper who is not in PACKED must not flash into it.
 *
 * `enabled` suppresses the fetch entirely, the same way `useResource` does, for
 * a list a role may not read at all.
 */
export function useCursorFeed<T>(
  key: string,
  enabled: boolean,
  loader: (
    cursor: string | null,
    signal: AbortSignal
  ) => Promise<CursorPage<T>>
): CursorFeed<T> {
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const [request, setRequest] = useState<Request>({ key, cursor: null });
  const [rows, setRows] = useState<readonly T[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [isLoading, setLoading] = useState(enabled);
  const [isLoadingMore, setLoadingMore] = useState(false);
  const [nonce, setNonce] = useState(0);

  if (request.key !== key) setRequest({ key, cursor: null });

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      setLoadingMore(false);
      setRows([]);
      setNextCursor(null);
      setError(null);
      return;
    }

    const controller = new AbortController();
    const first = request.cursor === null;
    let live = true;

    if (first) {
      setLoading(true);
      setError(null);
    } else {
      setLoadingMore(true);
    }

    loaderRef
      .current(request.cursor, controller.signal)
      .then((page) => {
        if (!live) return;
        setRows((previous) =>
          first ? page.items : [...previous, ...page.items]
        );
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
  }, [request, enabled, nonce]);

  const reload = useCallback(() => {
    setRequest((current) => ({ key: current.key, cursor: null }));
    setNonce((n) => n + 1);
  }, []);

  const loadMore = useCallback(() => {
    // Read through the setter so a stale closure cannot page from a cursor two
    // pages ago, and so pressing it with nothing left is a no-op rather than a
    // repeat of the last request.
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

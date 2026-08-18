import { describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

import {
  useCursorFeed,
  useResource,
  type CursorPage,
} from "@/lib/resource";

/** A page the way every cursor-paginated list endpoint answers. */
const page = <T,>(items: T[], nextCursor: string | null): CursorPage<T> => ({
  items,
  nextCursor,
});

describe("useResource — the one-fetch case, kept ergonomic", () => {
  it("loads once and hands back the value", async () => {
    const { result } = renderHook(() =>
      useResource("balance", true, async () => ({ payable: "540.00" }))
    );

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual({ payable: "540.00" });
    expect(result.current.error).toBeNull();
  });

  it("does not call the loader at all when disabled", async () => {
    // The balance endpoint answers 403 to an employee. A request made only to
    // throw the answer away still puts a refusal in the API's logs.
    const loader = vi.fn(async () => "never");
    const { result } = renderHook(() => useResource("balance", false, loader));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(loader).not.toHaveBeenCalled();
    expect(result.current.data).toBeNull();
  });

  it("keeps the error and drops the data when the fetch fails", async () => {
    const boom = new Error("network");
    const { result } = renderHook(() =>
      useResource("orders", true, async () => {
        throw boom;
      })
    );

    await waitFor(() => expect(result.current.error).toBe(boom));
    expect(result.current.data).toBeNull();
  });

  it("does not refetch because the caller passed a fresh arrow", async () => {
    // The loader is held in a ref precisely so an inline arrow in a component
    // body is not a new dependency on every render.
    // The signal is asserted here rather than in its own case: an unmounted
    // screen's fetch has to be abortable, and this is where one is handed over.
    const loader = vi.fn(async (signal: AbortSignal) => {
      expect(signal).toBeInstanceOf(AbortSignal);
      return "value";
    });
    const { result, rerender } = renderHook(() =>
      useResource("k", true, (signal) => loader(signal))
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    rerender();
    rerender();

    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("refetches on reload", async () => {
    const loader = vi.fn(async () => "value");
    const { result } = renderHook(() => useResource("k", true, loader));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.reload());
    await waitFor(() => expect(loader).toHaveBeenCalledTimes(2));
  });
});

describe("useCursorFeed — the paginating case, which five screens need", () => {
  it("appends the next page rather than replacing the list", async () => {
    const loader = vi.fn(async (cursor: string | null) =>
      cursor === null
        ? page([{ id: "1" }, { id: "2" }], "c2")
        : page([{ id: "3" }], null)
    );

    const { result } = renderHook(() => useCursorFeed("orders", true, loader));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.rows.map((r) => r.id)).toEqual(["1", "2"]);
    expect(result.current.nextCursor).toBe("c2");

    act(() => result.current.loadMore());

    await waitFor(() => expect(result.current.nextCursor).toBeNull());
    expect(result.current.rows.map((r) => r.id)).toEqual(["1", "2", "3"]);
    expect(loader).toHaveBeenNthCalledWith(2, "c2", expect.anything());
  });

  it("does nothing on loadMore when there is no next cursor", async () => {
    const loader = vi.fn(async () => page([{ id: "1" }], null));
    const { result } = renderHook(() => useCursorFeed("orders", true, loader));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.loadMore());
    act(() => result.current.loadMore());

    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("starts a NEW list when the key changes, never a longer one", async () => {
    // Changing the filter must not leave a row from the old filter on screen —
    // a shopper who is not in PACKED must not flash into it.
    const loader = vi.fn(async (cursor: string | null) =>
      cursor === null ? page([{ id: "1" }], "c2") : page([{ id: "2" }], null)
    );

    const { result, rerender } = renderHook(
      ({ key }: { key: string }) => useCursorFeed(key, true, loader),
      { initialProps: { key: "orders:ALL" } }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.rows).toHaveLength(2));

    rerender({ key: "orders:PACKED" });

    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    expect(result.current.rows.map((r) => r.id)).toEqual(["1"]);
  });

  it("separates the first page from a later one", async () => {
    let release: (() => void) | null = null;
    const loader = async (cursor: string | null) => {
      if (cursor === null) return page([{ id: "1" }], "c2");
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return page([{ id: "2" }], null);
    };

    const { result } = renderHook(() => useCursorFeed("k", true, loader));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.loadMore());

    await waitFor(() => expect(result.current.isLoadingMore).toBe(true));
    // The rows already on screen stay put while the next page is in flight.
    expect(result.current.isLoading).toBe(false);
    expect(result.current.rows).toHaveLength(1);

    await act(async () => {
      release?.();
    });
    await waitFor(() => expect(result.current.isLoadingMore).toBe(false));
  });

  it("keeps the rows already on screen when a later page fails", async () => {
    const loader = async (cursor: string | null) => {
      if (cursor === null) return page([{ id: "1" }], "c2");
      throw new Error("network");
    };

    const { result } = renderHook(() => useCursorFeed("k", true, loader));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.loadMore());

    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
    // A short list is a better answer than throwing away what was fetched.
    expect(result.current.rows).toHaveLength(1);
  });

  it("empties the rows when the FIRST page fails", async () => {
    const { result } = renderHook(() =>
      useCursorFeed("k", true, async () => {
        throw new Error("boom");
      })
    );

    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
    expect(result.current.rows).toHaveLength(0);
  });

  it("does not fetch at all when disabled", async () => {
    const loader = vi.fn(async () => page([{ id: "1" }], null));
    const { result } = renderHook(() => useCursorFeed("k", false, loader));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(loader).not.toHaveBeenCalled();
  });

  it("reloads from the first page, dropping everything paged in", async () => {
    const loader = vi.fn(async (cursor: string | null) =>
      cursor === null ? page([{ id: "1" }], "c2") : page([{ id: "2" }], null)
    );

    const { result } = renderHook(() => useCursorFeed("k", true, loader));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.rows).toHaveLength(2));

    act(() => result.current.reload());

    await waitFor(() => expect(result.current.rows).toHaveLength(1));
  });

  it("does not refetch because the caller passed a fresh arrow", async () => {
    const loader = vi.fn(async (cursor: string | null, signal: AbortSignal) => {
      expect(signal).toBeInstanceOf(AbortSignal);
      return page([{ id: cursor ?? "1" }], null);
    });
    const { result, rerender } = renderHook(() =>
      useCursorFeed("k", true, (cursor, signal) => loader(cursor, signal))
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    rerender();
    rerender();

    expect(loader).toHaveBeenCalledTimes(1);
  });
});

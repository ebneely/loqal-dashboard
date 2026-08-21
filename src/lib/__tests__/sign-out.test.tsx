import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The sign-out race.
 *
 * Every console used to do this inline:
 *
 *     void signOut();
 *     router.replace("/sign-in");
 *
 * `signOut()` is a request whose response carries a Set-Cookie that DELETES
 * the session. Not awaiting it means the response is still in flight while the
 * sign-in form is already on screen — so a user who types fast enough gets
 * their brand-new session cookie deleted by the tail of the sign-out they
 * triggered a second earlier. The sign-in appears to do nothing, tapping it
 * again works, and nothing in the console explains why.
 *
 * The tests below pin the ordering, not the implementation: the navigation
 * must not happen until the request has settled.
 */

const signOut = vi.fn();
const replace = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
}));

vi.mock("better-auth/react", () => ({
  createAuthClient: () => ({
    signIn: {},
    signOut: (...args: unknown[]) => signOut(...args),
    signUp: {},
    changePassword: vi.fn(),
    getSession: vi.fn(),
    useSession: vi.fn(),
    $Infer: {},
  }),
}));

vi.mock("better-auth/client/plugins", () => ({
  inferAdditionalFields: () => ({}),
}));

const { useConsoleSignOut } = await import("../auth-client");

beforeEach(() => {
  signOut.mockReset();
  replace.mockReset();
  refresh.mockReset();
});

describe("useConsoleSignOut", () => {
  it("does not navigate until the request has settled", async () => {
    let settle!: () => void;
    signOut.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          settle = resolve;
        })
    );

    const { result } = renderHook(() => useConsoleSignOut());

    let done!: Promise<void>;
    act(() => {
      done = result.current.signOut();
    });

    // The whole bug in one assertion: with `void signOut()` the navigation had
    // already happened by this point, while the cookie deletion was still on
    // the wire.
    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
    expect(replace).not.toHaveBeenCalled();

    await act(async () => {
      settle();
      await done;
    });

    expect(replace).toHaveBeenCalledWith("/sign-in");
  });

  it("refuses to fire twice while one is in flight", async () => {
    let settle!: () => void;
    signOut.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          settle = resolve;
        })
    );

    const { result } = renderHook(() => useConsoleSignOut());

    act(() => {
      void result.current.signOut();
    });
    await waitFor(() => expect(result.current.pending).toBe(true));

    // A second tap would queue a second deletion that lands even later than
    // the first — the same race, one step further out.
    await act(async () => {
      await result.current.signOut();
    });
    expect(signOut).toHaveBeenCalledTimes(1);

    await act(async () => {
      settle();
    });
  });

  it("still leaves the console when the request fails", async () => {
    // A failed sign-out leaves a valid cookie, which the sign-in page will
    // replace. Stranding somebody on a console they asked to leave is worse.
    signOut.mockRejectedValue(new Error("offline"));

    const { result } = renderHook(() => useConsoleSignOut());
    await act(async () => {
      await result.current.signOut();
    });

    expect(replace).toHaveBeenCalledWith("/sign-in");
  });

  it("refreshes so the server re-reads the cleared cookie", async () => {
    signOut.mockResolvedValue(undefined);

    const { result } = renderHook(() => useConsoleSignOut());
    await act(async () => {
      await result.current.signOut();
    });

    expect(refresh).toHaveBeenCalled();
  });
});

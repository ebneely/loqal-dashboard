import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Signing out, and the two things that made signing back in fail.
 *
 * FIRST: the request was not awaited.
 *
 *     void signOut();
 *     router.replace("/sign-in");
 *
 * `signOut()` is a request whose response carries a Set-Cookie that DELETES
 * the session. Not awaiting it means the response is still in flight while the
 * sign-in form is already on screen — so a user who types fast enough gets
 * their brand-new session cookie deleted by the tail of the sign-out they
 * triggered a second earlier.
 *
 * SECOND, and the one that actually reproduced on every account switch: the
 * navigation was soft. `router.replace` keeps the React tree, Better Auth's
 * session store and Next's router cache alive, all of them still holding the
 * person who just left. Signing in as somebody else then landed on a console
 * whose `useSession()` still answered with the PREVIOUS user, its role guard
 * bounced straight back out, and it read as a sign-in that did nothing.
 *
 * The tests below pin the ordering and the hardness of the navigation, not the
 * implementation.
 */

const signOut = vi.fn();
const assign = vi.fn();

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
  assign.mockReset();
  // jsdom's location is not writable, so the one call this hook makes into the
  // platform is stubbed rather than the whole object replaced.
  vi.stubGlobal("location", { assign, href: "http://localhost/" });
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

    // The first bug in one assertion: with `void signOut()` the navigation had
    // already happened by this point, while the cookie deletion was still on
    // the wire.
    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
    expect(assign).not.toHaveBeenCalled();

    await act(async () => {
      settle();
      await done;
    });

    expect(assign).toHaveBeenCalledWith("/sign-in");
  });

  it("leaves the SPA rather than navigating inside it", async () => {
    // The second bug. A soft navigation carries the previous user's session
    // store into the next console, so the guard there bounces the new user
    // straight back out. Only a document load discards it.
    signOut.mockResolvedValue(undefined);

    const { result } = renderHook(() => useConsoleSignOut());
    await act(async () => {
      await result.current.signOut();
    });

    expect(assign).toHaveBeenCalledWith("/sign-in");
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

    expect(assign).toHaveBeenCalledWith("/sign-in");
  });
});

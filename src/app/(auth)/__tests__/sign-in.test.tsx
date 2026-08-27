import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { en } from "@/messages/en";
import { ar } from "@/messages/ar";
import { LocaleProvider } from "@/lib/locale-context";

const replace = vi.fn();
const assign = vi.fn();
const searchParams = { current: new URLSearchParams() };
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn() }),
  usePathname: () => "/sign-in",
  useSearchParams: () => searchParams.current,
}));

const email = vi.fn();
const useSession = vi.fn();
const signOut = vi.fn();
vi.mock("@/lib/auth-client", () => ({
  authClient: { signIn: { email: (...args: unknown[]) => email(...args) } },
  signIn: { email: (...args: unknown[]) => email(...args) },
  signOut: (...args: unknown[]) => signOut(...args),
  useSession: () => useSession(),
}));

const SignInPage = (await import("../sign-in/page")).default;
const { safeNext } = await import("../auth-rules");

const renderSignIn = (locale: "en" | "ar" = "en") =>
  render(
    <LocaleProvider locale={locale}>
      <SignInPage />
    </LocaleProvider>
  );

const signedOut = { data: null, isPending: false, error: null };

/** No user-event in this project, so the keyboard is simulated by hand. */
const fill = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

const submit = () =>
  fireEvent.click(screen.getByRole("button", { name: en.brand.signInAction }));

beforeEach(() => {
  assign.mockReset();
  signOut.mockReset();
  signOut.mockResolvedValue(undefined);
  // jsdom's location is not writable, so the one call the page makes into the
  // platform is stubbed rather than the whole object replaced.
  vi.stubGlobal("location", { assign, href: "http://localhost/" });
  searchParams.current = new URLSearchParams();
  useSession.mockReturnValue(signedOut);
  email.mockResolvedValue({
    // A role is required now: sign-in routes on the role in this response
    // rather than a useSession read, which has not refreshed yet.
    data: { user: { role: "BRAND_OWNER", mustChangePassword: false } },
    error: null,
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("safeNext", () => {
  it("honours a rooted, same-origin path within the role's own console", () => {
    expect(safeNext("/orders/0199a000", "BRAND_OWNER")).toBe("/orders/0199a000");
  });

  it("falls back to the role's home when there is nothing to resume", () => {
    expect(safeNext(null, "BRAND_OWNER")).toBe("/today");
    expect(safeNext("", "BRAND_OWNER")).toBe("/today");
  });

  it("refuses an absolute URL", () => {
    expect(safeNext("https://evil.test/steal", "BRAND_OWNER")).toBe("/today");
  });

  it("refuses a protocol-relative URL", () => {
    // "//evil.test" passes a bare startsWith("/") check and lands off-site.
    expect(safeNext("//evil.test/steal", "BRAND_OWNER")).toBe("/today");
  });

  it("refuses a backslash-prefixed path, which some parsers normalise off-site", () => {
    expect(safeNext(String.raw`/\evil.test/steal`, "BRAND_OWNER")).toBe(
      "/today"
    );
  });

  it("sends each role to its own home rather than everyone to /today", () => {
    expect(safeNext(null, "SUPER_ADMIN")).toBe("/admin/applications");
    expect(safeNext(null, "SALES")).toBe("/sales/pack");
    expect(safeNext(null, "BRAND_EMPLOYEE")).toBe("/today");
  });

  it("refuses a same-origin path belonging to another console", () => {
    // A rep resuming a brand screen would land on a page that 403s every call,
    // which is both broken and a confirmation that the route exists.
    expect(safeNext("/settings", "SALES")).toBe("/sales/pack");
    expect(safeNext("/admin/brands", "SALES")).toBe("/sales/pack");
    expect(safeNext("/sales/pack", "BRAND_OWNER")).toBe("/today");
    expect(safeNext("/admin/applications", "BRAND_OWNER")).toBe("/today");
  });

  it("gives a shopper no console at all", () => {
    // A shopper account is not for this app; /today would 403 everywhere and
    // read as a broken dashboard rather than as the wrong kind of account.
    expect(safeNext("/today", "SHOPPER")).toBe("/sign-in?denied=no-console");
    expect(safeNext(null, "SHOPPER")).toBe("/sign-in?denied=no-console");
  });
});

describe("/sign-in", () => {
  it("asks for an email and a password and nothing else", () => {
    renderSignIn();

    expect(screen.getByLabelText(en.brand.email)).toBeInTheDocument();
    expect(screen.getByLabelText(en.brand.password)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: en.brand.signInAction })
    ).toBeInTheDocument();
    expect(screen.getAllByRole("textbox")).toHaveLength(1); // email; password is not a textbox
  });

  it("offers no sign-up and no social login", () => {
    // Brand accounts are issued by an admin and are never self-created, so a
    // sign-up link would be a promise the system cannot keep.
    const { container } = renderSignIn();

    expect(screen.queryByRole("link", { name: /sign ?up|register|create/i })).toBeNull();
    expect(
      screen.queryByRole("button", { name: /google|apple|facebook|github/i })
    ).toBeNull();
    expect(container.textContent).not.toMatch(/forgot|sign ?up/i);
    expect(screen.getByText(en.brand.issuedByAdmin)).toBeInTheDocument();
  });

  it("sends the credentials to Better Auth and resumes where the user was headed", async () => {
    searchParams.current = new URLSearchParams("next=/orders");
    renderSignIn();

    fill(en.brand.email, "salma@example.test");
    fill(en.brand.password, "correct horse");
    submit();

    await waitFor(() =>
      expect(email).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "salma@example.test",
          password: "correct horse",
        })
      )
    );
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/orders"));
  });

  it("refuses an off-site `next` and falls back to /today", async () => {
    searchParams.current = new URLSearchParams("next=https://evil.test/steal");
    renderSignIn();

    fill(en.brand.email, "salma@example.test");
    fill(en.brand.password, "correct horse");
    submit();

    await waitFor(() => expect(assign).toHaveBeenCalledWith("/today"));
  });

  it("shows the invalid-credentials state without leaking whether the email exists", async () => {
    // Better Auth answers a wrong password and an unknown address identically.
    // The screen must not widen that: one message, one wording, both times.
    email.mockResolvedValue({
      data: null,
      error: {
        message: "Invalid email or password",
        status: 401,
        code: "INVALID_EMAIL_OR_PASSWORD",
      },
    });
    renderSignIn();

    fill(en.brand.email, "nobody@example.test");
    fill(en.brand.password, "wrong wrong");
    submit();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(en.brand.authFailTitle);
    expect(alert).toHaveTextContent(en.brand.authFailBody);

    // Nothing on the screen names the account, the field at fault, or the
    // upstream code.
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/no such|not found|unknown|does not exist|unregistered/i);
    expect(text).not.toMatch(/INVALID_EMAIL_OR_PASSWORD/);
    expect(text).not.toContain("nobody@example.test");
    expect(assign).not.toHaveBeenCalled();
  });

  /**
   * A SHOPPER is refused HERE, not at the Better Auth level, and the
   * distinction matters: this is the same auth server the storefront signs in
   * against, so a server-side block on the role would lock every shopper out
   * of the shop they were trying to buy from.
   *
   * What this app can do is refuse to KEEP the session. The previous version
   * redirected to `/sign-in?denied=no-console` and nothing ever read that
   * parameter, so a shopper was left holding a valid dashboard cookie —
   * middleware waved them into any route and every API call answered 403,
   * which reads as a broken dashboard rather than as a refusal.
   */
  it("signs a shopper straight back out rather than leaving them a session", async () => {
    email.mockResolvedValue({
      data: {
        user: {
          id: "u-9",
          email: "buyer@example.test",
          role: "SHOPPER",
          mustChangePassword: false,
        },
      },
      error: null,
    });

    renderSignIn();
    fill(en.brand.email, "buyer@example.test");
    fill(en.brand.password, "LoqalTest123!");
    submit();

    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
    // No console to send them to, so nothing navigates anywhere.
    expect(assign).not.toHaveBeenCalled();
  });

  it("tells a shopper why, instead of blaming their password", async () => {
    email.mockResolvedValue({
      data: {
        user: {
          id: "u-9",
          email: "buyer@example.test",
          role: "SHOPPER",
          mustChangePassword: false,
        },
      },
      error: null,
    });

    renderSignIn();
    fill(en.brand.email, "buyer@example.test");
    fill(en.brand.password, "LoqalTest123!");
    submit();

    expect(
      await screen.findByText(en.brand.noConsoleTitle)
    ).toBeInTheDocument();
    // Their credentials were correct. "Check your email and password" would
    // send them round a loop they cannot win.
    expect(screen.queryByText(en.brand.authFailBody)).not.toBeInTheDocument();
  });

  it("uses the same wording when the address is real and only the password is wrong", async () => {
    email.mockResolvedValue({
      data: null,
      error: { message: "Invalid email or password", status: 401 },
    });
    renderSignIn();

    fill(en.brand.email, "salma@example.test");
    fill(en.brand.password, "wrong wrong");
    submit();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(en.brand.authFailTitle);
    // `authHintBad` is "Wrong password." — saying that confirms the address.
    expect(screen.queryByText(en.brand.authHintBad)).toBeNull();
  });

  it("says the service was unreachable when the transport throws", async () => {
    email.mockRejectedValue(new Error("network down"));
    renderSignIn();

    fill(en.brand.email, "salma@example.test");
    fill(en.brand.password, "correct horse");
    submit();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(en.brand.authDownTitle);
    // The password was never read, so telling them to check it is a wild goose
    // chase.
    expect(screen.queryByText(en.brand.authFailBody)).toBeNull();
    expect(document.body.textContent).not.toContain("network down");
  });

  it("does not blame the password for a refusal that never checked it", async () => {
    // 403 INVALID_ORIGIN: Better Auth rejects the request before reading the
    // credentials. Reported as a bad password it is indistinguishable from a
    // typo, which is exactly how it cost an afternoon.
    email.mockResolvedValue({
      data: null,
      error: { message: "Invalid origin", status: 403, code: "INVALID_ORIGIN" },
    });
    renderSignIn();

    fill(en.brand.email, "salma@example.test");
    fill(en.brand.password, "correct horse");
    submit();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(en.brand.authDownTitle);
    expect(screen.queryByText(en.brand.authFailBody)).toBeNull();
    expect(document.body.textContent).not.toContain("INVALID_ORIGIN");
  });

  it("puts the primary action last and in thumb reach, never in a top bar", () => {
    // MobileActionBar is deliberately not used here. It is `fixed ... md:hidden`,
    // so it would need a second, duplicate submit button for md and up — two
    // controls with the same accessible name on a three-field form. Instead the
    // card is bottom-anchored below md and the one submit button sits last,
    // full width, with a 56px target.
    renderSignIn();

    const action = screen.getByRole("button", { name: en.brand.signInAction });
    const focusable = Array.from(
      document.querySelectorAll<HTMLElement>("button, input, a[href]")
    );
    expect(focusable[focusable.length - 1]).toBe(action);
    expect(action).toHaveAttribute("type", "submit");
    expect(action.className).toMatch(/min-h-14/);
    expect(screen.queryByRole("banner")).toBeNull();
  });

  it("takes its copy from ar.ts under the Arabic locale", () => {
    renderSignIn("ar");

    expect(screen.getByText(ar.brand.signInTitle)).toBeInTheDocument();
    expect(screen.getByText(ar.brand.issuedByAdmin)).toBeInTheDocument();
  });
});

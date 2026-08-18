import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { en } from "@/messages/en";
import { LocaleProvider } from "@/lib/locale-context";

const replace = vi.fn();
const searchParams = { current: new URLSearchParams() };
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn() }),
  usePathname: () => "/set-password",
  useSearchParams: () => searchParams.current,
}));

const changePassword = vi.fn();
const resetPassword = vi.fn();
const useSession = vi.fn();
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    changePassword: (...a: unknown[]) => changePassword(...a),
    resetPassword: (...a: unknown[]) => resetPassword(...a),
  },
  changePassword: (...a: unknown[]) => changePassword(...a),
  useSession: () => useSession(),
}));

const SetPasswordPage = (await import("../set-password/page")).default;

const renderPage = (locale: "en" | "ar" = "en") =>
  render(
    <LocaleProvider locale={locale}>
      <SetPasswordPage />
    </LocaleProvider>
  );

const firstLoginSession = {
  data: {
    user: {
      id: "u-1",
      email: "salma@example.test",
      name: "Salma",
      role: "BRAND_OWNER",
      brandId: "b-1",
      mustChangePassword: true,
    },
    session: { id: "s-1" },
  },
  isPending: false,
  error: null,
};

const signedOut = { data: null, isPending: false, error: null };

const fill = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

const submit = () =>
  fireEvent.click(screen.getByRole("button", { name: en.brand.setPwAction }));

beforeEach(() => {
  searchParams.current = new URLSearchParams();
  useSession.mockReturnValue(firstLoginSession);
  changePassword.mockResolvedValue({ data: {}, error: null });
  resetPassword.mockResolvedValue({ data: {}, error: null });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("/set-password — first login, with a session", () => {
  it("names the screen and says why it exists", () => {
    renderPage();

    expect(screen.getByText(en.brand.setPwTitle)).toBeInTheDocument();
    expect(screen.getByText(en.brand.setPwSub)).toBeInTheDocument();
  });

  it("gives the user no way to navigate away from it", () => {
    // The account is unusable until the password is set, so the screen carries
    // no nav, no skip and no link out. `(brand)/layout.tsx` bounces anyone with
    // mustChangePassword back here if they type a URL.
    renderPage();

    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(screen.queryByRole("button", { name: /skip|later|cancel/i })).toBeNull();
    expect(screen.getByText(en.brand.setPwLocked)).toBeInTheDocument();
  });

  it("surfaces the 9-character minimum before submit, not after", () => {
    renderPage();

    // The rule is on screen from the start.
    expect(screen.getByText(en.brand.pwRule)).toBeInTheDocument();
    expect(en.brand.pwRule).toContain("9");

    fill(en.brand.newPassword, "short");
    fill(en.brand.repeatPassword, "short");

    expect(screen.getByText(en.brand.pwTooShort)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: en.brand.setPwAction })).toBeDisabled();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it("refuses two passwords that differ, before submit", () => {
    renderPage();

    fill(en.brand.newPassword, "nine chars ok");
    fill(en.brand.repeatPassword, "nine chars no");

    expect(screen.getByText(en.brand.pwMismatch)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: en.brand.setPwAction })).toBeDisabled();
  });

  it("changes the password through Better Auth and lands on /today", async () => {
    renderPage();

    fill(en.brand.password, "issued by loqal");
    fill(en.brand.newPassword, "a longer one");
    fill(en.brand.repeatPassword, "a longer one");
    submit();

    await waitFor(() =>
      expect(changePassword).toHaveBeenCalledWith(
        expect.objectContaining({
          currentPassword: "issued by loqal",
          newPassword: "a longer one",
          revokeOtherSessions: true,
        })
      )
    );
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/today"));
  });

  it("shows a failure without leaking the upstream message", async () => {
    changePassword.mockResolvedValue({
      data: null,
      error: { message: "PASSWORD_TOO_SHORT at row 4", status: 400 },
    });
    renderPage();

    fill(en.brand.password, "issued by loqal");
    fill(en.brand.newPassword, "a longer one");
    fill(en.brand.repeatPassword, "a longer one");
    submit();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(en.brand.setPwFailed);
    expect(document.body.textContent).not.toContain("PASSWORD_TOO_SHORT at row 4");
    expect(replace).not.toHaveBeenCalled();
  });
});

describe("/set-password — the emailed invite, with no session", () => {
  beforeEach(() => {
    useSession.mockReturnValue(signedOut);
    searchParams.current = new URLSearchParams("token=invite-token-1");
  });

  it("asks only for the new password — there is no current one to know", () => {
    renderPage();

    expect(screen.getByLabelText(en.brand.newPassword)).toBeInTheDocument();
    expect(screen.getByLabelText(en.brand.repeatPassword)).toBeInTheDocument();
    expect(screen.queryByLabelText(en.brand.password)).toBeNull();
  });

  it("redeems the token through Better Auth's reset flow", async () => {
    renderPage();

    fill(en.brand.newPassword, "a longer one");
    fill(en.brand.repeatPassword, "a longer one");
    submit();

    await waitFor(() =>
      expect(resetPassword).toHaveBeenCalledWith(
        expect.objectContaining({
          newPassword: "a longer one",
          token: "invite-token-1",
        })
      )
    );
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/sign-in"));
  });

  it("draws the expired state when the token is refused at submit", async () => {
    resetPassword.mockResolvedValue({
      data: null,
      error: { message: "invalid token", status: 400, code: "INVALID_TOKEN" },
    });
    renderPage();

    fill(en.brand.newPassword, "a longer one");
    fill(en.brand.repeatPassword, "a longer one");
    submit();

    expect(await screen.findByText(en.brand.expiredTitle)).toBeInTheDocument();
    expect(screen.getByText(en.brand.expiredBody)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: en.brand.expiredAction })
    ).toHaveAttribute("href", "/sign-in");
  });

  it("draws the expired state straight away when Better Auth bounced the link", () => {
    // Better Auth redirects a dead reset link to `?error=INVALID_TOKEN`. There
    // is nothing to type, so the form is not drawn at all.
    searchParams.current = new URLSearchParams("error=INVALID_TOKEN");
    renderPage();

    expect(screen.getByText(en.brand.expiredTitle)).toBeInTheDocument();
    expect(screen.queryByLabelText(en.brand.newPassword)).toBeNull();
  });

  it("names no mailbox it cannot know", () => {
    searchParams.current = new URLSearchParams("error=INVALID_TOKEN");
    const { container } = renderPage();

    expect(container.textContent).not.toMatch(/@/);
  });

  it("sends a visitor with neither a session nor a token back to sign in", async () => {
    searchParams.current = new URLSearchParams();
    renderPage();

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/sign-in"));
  });
});

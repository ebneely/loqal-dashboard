import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

import { en } from "@/messages/en";
import { ar } from "@/messages/ar";
import { LocaleProvider } from "@/lib/locale-context";

const replace = vi.fn();
const pathname = { current: "/today" };
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn() }),
  usePathname: () => pathname.current,
  useSearchParams: () => new URLSearchParams(),
}));

const useSession = vi.fn();
const signOut = vi.fn();
vi.mock("@/lib/auth-client", () => ({
  useSession: () => useSession(),
  signOut: (...a: unknown[]) => signOut(...a),
  useConsoleSignOut: () => ({
    signOut: (...a: unknown[]) => signOut(...a),
    pending: false,
  }),
  authClient: { signOut: (...a: unknown[]) => signOut(...a) },
}));

const BrandLayout = (await import("../layout")).default;
const { activeNavId, shellRoleFor } = await import("../shell-rules");

const session = (
  role: string,
  extra: Record<string, unknown> = {}
) => ({
  data: {
    user: {
      id: "u-1",
      email: "salma@example.test",
      name: "Salma Fouad",
      role,
      brandId: "b-1",
      mustChangePassword: false,
      ...extra,
    },
    session: { id: "s-1" },
  },
  isPending: false,
  error: null,
});

const renderShell = (locale: "en" | "ar" = "en") =>
  render(
    <LocaleProvider locale={locale}>
      <BrandLayout>
        <p>screen body</p>
      </BrandLayout>
    </LocaleProvider>
  );

beforeEach(() => {
  pathname.current = "/today";
  useSession.mockReturnValue(session("BRAND_OWNER"));
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("shellRoleFor", () => {
  it("opens the owner nav for exactly one string", () => {
    expect(shellRoleFor("BRAND_OWNER")).toBe("BRAND_OWNER");
  });

  it("treats everything else as an employee", () => {
    // Least privilege. The failure mode of guessing wrong the other way is
    // showing a shop's balance to somebody who was never meant to see it.
    for (const role of ["BRAND_EMPLOYEE", "SALES", "SUPER_ADMIN", "SHOPPER", "", undefined]) {
      expect(shellRoleFor(role)).toBe("BRAND_EMPLOYEE");
    }
  });

  it("treats a role this build has never heard of as an employee", () => {
    expect(shellRoleFor("BRAND_ACCOUNTANT")).toBe("BRAND_EMPLOYEE");
  });
});

describe("activeNavId", () => {
  it("keeps a detail route on its list's nav entry", () => {
    expect(activeNavId("/orders/0199a000-0000-7000-8000-000000000001")).toBe("orders");
  });

  it("reads the top-level route", () => {
    expect(activeNavId("/today")).toBe("today");
    expect(activeNavId("/money")).toBe("money");
  });

  it("falls back to today at the root", () => {
    expect(activeNavId("/")).toBe("today");
  });
});

describe("(brand) shell", () => {
  it("draws the eight brand nav entries for an owner", () => {
    renderShell();

    for (const label of Object.values(en.brand.nav)) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  it("omits Money entirely for an employee — absent, not disabled", () => {
    useSession.mockReturnValue(session("BRAND_EMPLOYEE"));

    const { container } = renderShell();

    expect(screen.queryByText(en.brand.nav.money)).toBeNull();
    expect(screen.queryByRole("link", { name: en.brand.nav.money })).toBeNull();
    expect(container.querySelector('a[href="/money"]')).toBeNull();
    // Nothing disabled standing in for it either.
    expect(
      container.querySelector("[aria-disabled='true'], [data-disabled]")
    ).toBeNull();
    // The rest of the nav is untouched.
    expect(screen.getAllByText(en.brand.nav.orders).length).toBeGreaterThan(0);
  });

  it("treats an unknown or non-brand role as the least privileged one", () => {
    // The nav is cosmetic; the API is the boundary. If a role arrives that this
    // console does not model, it must not be the one that reveals Money.
    useSession.mockReturnValue(session("SALES"));

    renderShell();

    expect(screen.queryByText(en.brand.nav.money)).toBeNull();
  });

  it("renders dir=rtl and Arabic nav labels under ar", () => {
    const { container } = renderShell("ar");

    expect(container.querySelector('[dir="rtl"]')).not.toBeNull();
    expect(container.querySelector('[lang="ar"]')).not.toBeNull();
    for (const label of Object.values(ar.brand.nav)) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    // And none of the English ones leaked through.
    expect(screen.queryByText(en.brand.nav.inventory)).toBeNull();
  });

  it("marks the current route active from the pathname", () => {
    pathname.current = "/orders/0199a000-0000-7000-8000-000000000001";

    const { container } = renderShell();

    const active = container.querySelector('[data-active="true"]');
    expect(active).not.toBeNull();
    expect(active).toHaveTextContent(en.brand.nav.orders);
  });

  it("titles the screen from the nav entry, so the top bar is never blank", () => {
    renderShell();

    expect(
      screen.getByRole("heading", { name: en.brand.nav.today })
    ).toBeInTheDocument();
  });

  it("holds a first-login user on /set-password and draws no shell around it", async () => {
    useSession.mockReturnValue(
      session("BRAND_OWNER", { mustChangePassword: true })
    );

    renderShell();

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/set-password"));
    // No nav is painted on the way out — an employee must never glimpse Money.
    expect(screen.queryByText(en.brand.nav.money)).toBeNull();
    expect(screen.queryByText("screen body")).toBeNull();
  });

  it("paints no nav while the session is still unknown", () => {
    useSession.mockReturnValue({ data: null, isPending: true, error: null });

    renderShell();

    expect(screen.queryByText(en.brand.nav.money)).toBeNull();
    expect(screen.queryByText(en.brand.nav.orders)).toBeNull();
  });

  it("offers a sign out and names who is signed in", () => {
    renderShell();

    expect(screen.getByText("salma@example.test")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: en.brand.signOut })
    ).toBeInTheDocument();
  });

  it("shows no customer list and no export anywhere in the nav", () => {
    const { container } = renderShell();

    expect(container.textContent).not.toMatch(/customers|shoppers|export/i);
  });
});

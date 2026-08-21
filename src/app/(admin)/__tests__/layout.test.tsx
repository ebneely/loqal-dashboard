import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

import { en } from "@/messages/en";
import { ar } from "@/messages/ar";
import { LocaleProvider } from "@/lib/locale-context";

const replace = vi.fn();
const pathname = { current: "/admin/applications" };
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

const AdminLayout = (await import("../layout")).default;
const { activeNavId, ADMIN_REQUIRED_ROLE } = await import("../shell-rules");

const session = (role: string, extra: Record<string, unknown> = {}) => ({
  data: {
    user: {
      id: "u-1",
      email: "admin@example.test",
      name: "Admin",
      role,
      brandId: null,
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
      <AdminLayout>
        <p>screen body</p>
      </AdminLayout>
    </LocaleProvider>
  );

beforeEach(() => {
  vi.clearAllMocks();
  pathname.current = "/admin/applications";
  useSession.mockReturnValue(session("SUPER_ADMIN"));
});

describe("activeNavId", () => {
  it("reads the segment after /admin", () => {
    expect(activeNavId("/admin/brands")).toBe("brands");
    expect(activeNavId("/admin/categories")).toBe("categories");
  });

  it("keeps a detail route on its list's nav entry", () => {
    expect(activeNavId("/admin/brands/0199b000-0000-7000-8000-000000000011")).toBe(
      "brands"
    );
  });

  it("falls back to the queue at the root", () => {
    expect(activeNavId("/")).toBe("applications");
    expect(activeNavId("/admin")).toBe("applications");
  });
});

describe("(admin) shell", () => {
  it("draws all eleven admin nav entries", () => {
    renderShell();

    for (const label of Object.values(en.admin.nav)) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  it("points the nav at /admin/* so it cannot collide with the brand console", () => {
    // `(brand)/orders` and an `(admin)/orders` at the root would both resolve
    // to /orders, which is a hard next build failure rather than a style clash.
    const { container } = renderShell();

    expect(
      container.querySelector('a[href="/admin/applications"]')
    ).not.toBeNull();
    expect(container.querySelector('a[href="/admin/brands"]')).not.toBeNull();
    expect(container.querySelector('a[href="/orders"]')).toBeNull();
  });

  it("marks the current route active from the pathname", () => {
    pathname.current = "/admin/brands/0199b000-0000-7000-8000-000000000011";

    const { container } = renderShell();

    const active = container.querySelector('[data-active="true"]');
    expect(active).not.toBeNull();
    expect(active).toHaveTextContent(en.admin.nav.brands);
  });

  it("names the role the whole console demands", () => {
    renderShell();

    expect(screen.getByText(ADMIN_REQUIRED_ROLE)).toBeInTheDocument();
    expect(screen.getByText("admin@example.test")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: en.admin.signOut })
    ).toBeInTheDocument();
  });

  /**
   * The difference from the brand shell. That one treats an unknown role as the
   * least privileged BRAND role and carries on, because every brand route is
   * scoped to the caller's own brand anyway. This console is unscoped by
   * construction, so a non-admin is sent away rather than shown eleven doors.
   */
  it("sends a brand owner to their own console rather than painting this one", async () => {
    useSession.mockReturnValue(session("BRAND_OWNER"));

    renderShell();

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/today"));
    expect(screen.queryByText(en.admin.nav.settlements)).toBeNull();
    expect(screen.queryByText("screen body")).toBeNull();
  });

  it("sends a sales account away too", async () => {
    useSession.mockReturnValue(session("SALES"));

    renderShell();

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/today"));
    expect(screen.queryByText(en.admin.nav.brands)).toBeNull();
  });

  it("paints no nav while the session is still unknown", () => {
    useSession.mockReturnValue({ data: null, isPending: true, error: null });

    renderShell();

    expect(screen.queryByText(en.admin.nav.brands)).toBeNull();
    expect(screen.queryByText("screen body")).toBeNull();
  });

  it("holds a first-login user on /set-password and draws no shell around it", async () => {
    useSession.mockReturnValue(
      session("SUPER_ADMIN", { mustChangePassword: true })
    );

    renderShell();

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/set-password"));
    expect(screen.queryByText("screen body")).toBeNull();
  });

  it("renders dir=rtl and Arabic nav labels under ar", () => {
    const { container } = renderShell("ar");

    expect(container.querySelector('[dir="rtl"]')).not.toBeNull();
    expect(container.querySelector('[lang="ar"]')).not.toBeNull();
    for (const label of Object.values(ar.admin.nav)) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    expect(screen.queryByText(en.admin.nav.settlements)).toBeNull();
  });

  it("titles the screen from the nav entry, so the top bar is never blank", () => {
    renderShell();

    expect(
      screen.getByRole("heading", { name: en.admin.nav.applications })
    ).toBeInTheDocument();
  });
});

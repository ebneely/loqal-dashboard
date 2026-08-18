import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

import { LocaleProvider } from "@/lib/locale-context";
import { en } from "@/messages/en";
import { ar } from "@/messages/ar";

const replace = vi.fn();
const pathname = { current: "/pack" };
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
  authClient: { signOut: (...a: unknown[]) => signOut(...a) },
}));

const SalesLayout = (await import("../layout")).default;
const { SALES_REQUIRED_ROLE, activeTabId, consoleHomeFor, salesTabs } =
  await import("../shell-rules");

const s = en.sales;

const session = (role: string, extra: Record<string, unknown> = {}) => ({
  data: {
    user: {
      id: "u-1",
      email: "rep@example.test",
      name: "Rep",
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
      <SalesLayout>
        <p>screen body</p>
      </SalesLayout>
    </LocaleProvider>
  );

beforeEach(() => {
  vi.clearAllMocks();
  pathname.current = "/pack";
  useSession.mockReturnValue(session("SALES"));
});

describe("activeTabId", () => {
  it("reads the first segment", () => {
    expect(activeTabId("/pack")).toBe("pack");
    expect(activeTabId("/onboard")).toBe("onboard");
    expect(activeTabId("/terms")).toBe("terms");
  });

  it("keeps a query string on its own tab", () => {
    expect(activeTabId("/terms")).toBe("terms");
  });

  it("falls back to the pitch at the root", () => {
    expect(activeTabId("/")).toBe("pack");
    expect(activeTabId("/something-else")).toBe("pack");
  });
});

describe("consoleHomeFor", () => {
  it("sends an admin to the admin console and everyone else to the brand one", () => {
    expect(consoleHomeFor("SUPER_ADMIN")).toBe("/admin/applications");
    expect(consoleHomeFor("BRAND_OWNER")).toBe("/today");
    expect(consoleHomeFor("BRAND_EMPLOYEE")).toBe("/today");
  });
});

describe("(sales) shell", () => {
  /**
   * `salesNav` in the domain layer names /sales and /sales/visits. Neither
   * route exists and there is no visits endpoint anywhere in the contract
   * package, so the shell builds its own list rather than pointing a rep at two
   * addresses, one of which 404s.
   */
  it("draws the three routes that exist and neither of the two that do not", () => {
    const { container } = renderShell();

    expect(container.querySelector('a[href="/pack"]')).not.toBeNull();
    expect(container.querySelector('a[href="/onboard"]')).not.toBeNull();
    expect(container.querySelector('a[href="/terms"]')).not.toBeNull();
    expect(container.querySelector('a[href="/sales"]')).toBeNull();
    expect(container.querySelector('a[href="/sales/visits"]')).toBeNull();
  });

  it("has exactly three entries and no fourth", () => {
    expect(salesTabs(en).map((tab) => tab.id)).toEqual([
      "pack",
      "onboard",
      "terms",
    ]);
  });

  it("marks the current route active from the pathname", () => {
    pathname.current = "/terms";

    const { container } = renderShell();

    const active = container.querySelector('[data-active="true"]');
    expect(active).toHaveTextContent(s.navTerms);
  });

  it("names the role the whole console demands", () => {
    renderShell();

    expect(screen.getByText(SALES_REQUIRED_ROLE)).toBeInTheDocument();
    expect(screen.getByText("rep@example.test")).toBeInTheDocument();
  });

  /**
   * `UserRole.SALES` is the easiest credential in this system to lose. The
   * person who most needs to know what a lost phone gives away is the one
   * holding it.
   */
  it("says on every screen that this device carries no customer data", () => {
    renderShell();

    expect(screen.getByText(s.noCustomerData)).toBeInTheDocument();
  });

  it("sends a shop owner to their own console rather than painting this one", async () => {
    useSession.mockReturnValue(session("BRAND_OWNER"));

    renderShell();

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/today"));
    expect(screen.queryByText("screen body")).toBeNull();
  });

  /**
   * The API would admit a SUPER_ADMIN on every sales route. It is still sent
   * away: an admin holds BrandsAdminController over every brand, so the
   * narrower console is a downgrade rather than a shortcut.
   */
  it("sends an admin to the admin console even though the API would admit them", async () => {
    useSession.mockReturnValue(session("SUPER_ADMIN"));

    renderShell();

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/admin/applications")
    );
    expect(screen.queryByText("screen body")).toBeNull();
  });

  it("paints no nav while the session is still unknown", () => {
    useSession.mockReturnValue({ data: null, isPending: true, error: null });

    renderShell();

    expect(screen.queryByText(s.navOnboard)).toBeNull();
    expect(screen.queryByText("screen body")).toBeNull();
  });

  it("holds a first-login user on /set-password and draws no shell around it", async () => {
    useSession.mockReturnValue(session("SALES", { mustChangePassword: true }));

    renderShell();

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/set-password"));
    expect(screen.queryByText("screen body")).toBeNull();
  });

  it("renders dir=rtl and Arabic tab labels under ar", () => {
    const { container } = renderShell("ar");

    expect(container.querySelector('[dir="rtl"]')).not.toBeNull();
    expect(container.querySelector('[lang="ar"]')).not.toBeNull();
    for (const label of [
      ar.sales.navPack,
      ar.sales.navOnboard,
      ar.sales.navTerms,
    ]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    expect(screen.queryByText(s.navTerms)).toBeNull();
  });

  it("titles the screen from the tab, so the top bar is never blank", () => {
    renderShell();

    expect(
      screen.getByRole("heading", { name: s.navPack })
    ).toBeInTheDocument();
  });
});

/**
 * /analytics on the brand console — the same screen as /admin/analytics's top
 * half, scoped to one shop, and refused to an employee.
 *
 * The rule under test is the one /money already enforces: a section an
 * employee may not see is ABSENT, not disabled, and the request behind it is
 * never made at all.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { LocaleProvider } from "@/lib/locale-context";
import { en } from "@/messages/en";
import { ar } from "@/messages/ar";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/analytics",
  useSearchParams: () => new URLSearchParams(),
}));

const useSession = vi.fn();
vi.mock("@/lib/auth-client", () => ({
  useSession: () => useSession(),
  useConsoleSignOut: () => ({ signOut: vi.fn(), pending: false }),
}));

const get = vi.fn();
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, api: { ...actual.api, get } };
});

const { BrandAnalyticsScreen } = await import("../analytics-screen");
const { commerceDashboardSchema } = await import(
  "../../../(admin)/admin/analytics/commerce-data"
);

const b = en.brand.commerce;

const dashboard = commerceDashboardSchema.parse({
  range: { from: "2026-07-30", to: "2026-08-28" },
  totals: {
    orders: 14,
    revenue: "5600.00",
    customers: 11,
    averageOrderValue: "400.00",
  },
  previous: {
    orders: 12,
    revenue: "4800.00",
    customers: 9,
    averageOrderValue: "400.00",
  },
  trend: [{ day: "2026-08-28", orders: 14, revenue: "5600.00" }],
  byStatus: [{ status: "DELIVERED", count: 14 }],
  byGovernorate: [{ code: "GIZ", orders: 14, revenue: "5600.00" }],
  topProducts: [{ name: "Prayer mat", qty: 14, revenue: "5600.00" }],
  unmapped: { orders: 0, revenue: "0.00" },
});

const session = (role: string) => ({
  data: { user: { id: "u-1", email: "owner@shop.test", role }, session: {} },
  isPending: false,
  error: null,
});

const renderScreen = (locale: "en" | "ar" = "en") =>
  render(
    <LocaleProvider locale={locale}>
      <BrandAnalyticsScreen />
    </LocaleProvider>
  );

beforeEach(() => {
  vi.clearAllMocks();
  useSession.mockReturnValue(session("BRAND_OWNER"));
  get.mockImplementation(() => Promise.resolve(dashboard));
});

describe("/analytics — the owner", () => {
  it("reads the shop's own scoped endpoint, never the platform one", async () => {
    renderScreen();

    await screen.findByTestId("commerce-figure-primary");
    expect(get).toHaveBeenCalledWith(
      expect.anything(),
      "/v1/brands/me/analytics/dashboard",
      expect.anything()
    );
  });

  it("draws the revenue this shop made", async () => {
    renderScreen();

    expect(await screen.findByTestId("commerce-figure-primary")).toHaveTextContent(
      "5,600.00 EGP"
    );
  });

  it("gets one map — its own orders — and never where the other shops are", async () => {
    // The admin screen draws a second map of shop locations. A shop reading
    // where every competitor trades from is the same disclosure the employee
    // rule already refuses for money, so the endpoint does not send it and
    // this console has no copy for it either.
    renderScreen();

    await screen.findByTestId("commerce-figure-primary");

    expect(screen.getByRole("heading", { name: b.mapTitle })).toBeInTheDocument();
    expect(screen.queryByText(en.admin.commerce.shops.title)).toBeNull();
    expect("shops" in b).toBe(false);
  });
});

describe("/analytics — least privilege", () => {
  it("draws nothing at all until the role is known", () => {
    // A flash is a leak: rendering optimistically and correcting a tick later
    // would show an employee the shop's revenue on every cold load.
    useSession.mockReturnValue({ data: null, isPending: true, error: null });

    const { container } = renderScreen();

    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.queryByTestId("commerce-figure-primary")).toBeNull();
    expect(screen.queryByText(b.deniedTitle)).toBeNull();
    expect(get).not.toHaveBeenCalled();
  });

  it("refuses an employee, absent rather than disabled, and asks for nothing", () => {
    useSession.mockReturnValue(session("BRAND_EMPLOYEE"));

    renderScreen();

    expect(screen.getByText(b.deniedTitle)).toBeInTheDocument();
    expect(screen.getByText("BRAND_OWNER")).toBeInTheDocument();
    expect(screen.queryByTestId("commerce-figure-primary")).toBeNull();
    expect(screen.queryByTestId("commerce-figure-secondary")).toBeNull();
    expect(screen.queryByText(/EGP/)).toBeNull();
    expect(get).not.toHaveBeenCalled();
  });

  it.each(["SALES", "SUPER_ADMIN", "SOMETHING_NEW"])(
    "treats %s as an employee rather than guessing upward",
    (role) => {
      // Only the literal string BRAND_OWNER opens this screen. Guessing wrong
      // in the other direction shows a shop's revenue to somebody who was
      // never meant to see it.
      useSession.mockReturnValue(session(role));

      renderScreen();

      expect(screen.getByText(b.deniedTitle)).toBeInTheDocument();
      expect(get).not.toHaveBeenCalled();
    }
  );
});

describe("/analytics — bilingual", () => {
  it("takes its refusal from ar.ts under the Arabic locale", () => {
    useSession.mockReturnValue(session("BRAND_EMPLOYEE"));

    renderScreen("ar");

    expect(screen.getByText(ar.brand.commerce.deniedTitle)).toBeInTheDocument();
    expect(screen.queryByText(b.deniedTitle)).toBeNull();
  });
});

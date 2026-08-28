import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

/**
 * The shell now carries the language switch, which calls `useRouter()` to
 * refresh after writing the cookie — the language is resolved on the server, so
 * a context flip alone would leave `dir` stale. Without this mock every render
 * here throws "invariant expected app router to be mounted".
 */
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

import { AppShell, visibleNavItems } from "../app-shell";
import { brandNav } from "../nav";
import { en } from "@/messages/en";
import { ar } from "@/messages/ar";

const shell = (props: Partial<Parameters<typeof AppShell>[0]> = {}) =>
  render(
    <AppShell
      role="BRAND_OWNER"
      title="Today"
      consoleLabel={en.brand.consoleLabel}
      nav={brandNav(en)}
      activeId="today"
      {...props}
    >
      <p>body</p>
    </AppShell>
  );

describe("AppShell", () => {
  it("renders dir=rtl under ar", () => {
    const { container } = shell({
      locale: "ar",
      consoleLabel: ar.brand.consoleLabel,
      nav: brandNav(ar),
    });

    expect(container.querySelector('[dir="rtl"]')).not.toBeNull();
    expect(container.querySelector('[lang="ar"]')).not.toBeNull();
  });

  it("renders dir=ltr under en", () => {
    const { container } = shell();

    expect(container.querySelector('[dir="ltr"]')).not.toBeNull();
  });

  /**
   * The sidebar has no physical side to assert any more, and that IS the
   * assertion. It used to be a shadcn `Sidebar`, which takes `side="left"`
   * or `side="right"` and so had to be flipped by hand under Arabic.
   * `.lq-sidebar` sits at the inline start by construction —
   * `border-inline-end`, no `left`/`right` anywhere — so the same markup
   * mirrors on `dir` alone.
   */
  it("puts the sidebar at the inline start on dir alone, with no physical side", () => {
    const { container: ltr } = shell();
    expect(ltr.querySelector(".lq-sidebar")).not.toBeNull();
    expect(ltr.querySelector('[dir="ltr"]')).not.toBeNull();

    const { container: rtl } = shell({ locale: "ar", nav: brandNav(ar) });
    expect(rtl.querySelector(".lq-sidebar")).not.toBeNull();
    expect(rtl.querySelector('[dir="rtl"]')).not.toBeNull();

    // No per-direction mirroring: the two renderings differ only by `dir`.
    for (const root of [ltr, rtl]) {
      expect(root.querySelector('[data-side="left"]')).toBeNull();
      expect(root.querySelector('[data-side="right"]')).toBeNull();
    }
  });

  it("omits Money entirely for an employee — absent, not disabled", () => {
    // A greyed-out entry still tells a counter assistant that a payout account
    // exists and where it lives. The item is not rendered at all.
    shell({ role: "BRAND_EMPLOYEE" });

    expect(screen.queryByText(en.brand.nav.money)).toBeNull();
    expect(
      screen.queryByRole("link", { name: en.brand.nav.money })
    ).toBeNull();
    expect(screen.getAllByText(en.brand.nav.orders).length).toBeGreaterThan(0);
  });

  it("shows Money to the owner", () => {
    shell({ role: "BRAND_OWNER" });

    expect(screen.getAllByText(en.brand.nav.money).length).toBeGreaterThan(0);
  });

  it("filters owner-only items without mutating the caller's array", () => {
    const groups = brandNav(en);
    const before = groups[0].items.length;

    expect(visibleNavItems(groups[0].items, "BRAND_EMPLOYEE")).toHaveLength(
      before - 1
    );
    expect(groups[0].items).toHaveLength(before);
  });

  it("names the console so a user never has to guess which one they are in", () => {
    shell();

    expect(screen.getByText(en.brand.consoleLabel)).toBeInTheDocument();
  });
});

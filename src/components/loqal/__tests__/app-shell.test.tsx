import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

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

  it("puts the sidebar at the inline start in both directions", () => {
    const { container: ltr } = shell();
    expect(ltr.querySelector('[data-side="left"]')).not.toBeNull();

    const { container: rtl } = shell({ locale: "ar", nav: brandNav(ar) });
    expect(rtl.querySelector('[data-side="right"]')).not.toBeNull();
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

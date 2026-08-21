"use client";

/**
 * The design system's own shell, in the design system's own class layer:
 * `.lq-shell` > `.lq-topbar` + (`.lq-sidebar` | `.lq-main` > `.lq-content`
 * + `.lq-tabbar`). Those rules are copied verbatim into
 * loqal-components.css, so the geometry here is the reference geometry.
 *
 * This replaces a shadcn `Sidebar`/`SidebarProvider` composition that
 * differed from the design in four structural ways, not four cosmetic ones:
 *
 *   1. The sidebar appeared at md (768px). The design puts it at lg (1024px)
 *      and it is a CONTAINER query, so a phone frame embedded in a desktop
 *      page still gets phone chrome.
 *   2. It was collapsible to an icon rail. The design says never — "the
 *      labels are the navigation" — so there is no rail and no tooltips.
 *   3. The top bar was always visible. In the design it is phone and tablet
 *      only; at lg the sidebar replaces it.
 *   4. There was no bottom tab bar at all. It is the primary navigation on a
 *      phone for the brand and sales consoles, and absent from admin — which
 *      is why `tabs` is a prop rather than derived from `nav`.
 *
 * The nav is driven by the signed-in role, and for an employee the Money
 * entry is ABSENT — not disabled, not greyed out. A disabled field still
 * announces that a payout account exists and roughly where it lives; a shop
 * that gives a counter assistant an account has not agreed to tell them what
 * the shop earns. So the item is never rendered, and the API refuses the
 * route anyway if the URL is typed by hand. Two independent refusals, no
 * shared assumption.
 *
 * Direction: the shell sets `dir` from the locale. Everything below uses
 * logical properties, so nothing here mirrors by hand; the one physical
 * value is the Sheet's `side`, because shadcn's Sheet takes a physical side.
 */
import Link from "next/link";
import * as React from "react";
import type { ComponentType, ReactNode } from "react";
import { MenuIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { defaultLocale, localeDir, type Locale } from "@/lib/locale";
import { LocaleProvider } from "@/lib/locale-context";

/**
 * The two roles this shell draws for. SALES and SUPER_ADMIN have their own
 * consoles and their own nav; they pass `items` explicitly.
 */
export type AppShellRole = "BRAND_OWNER" | "BRAND_EMPLOYEE";

export type AppShellNavItem = {
  /** Stable id, matched against `activeId`. */
  id: string;
  href: string;
  /** Already translated. */
  label: string;
  icon?: ComponentType<{ className?: string }>;
  /** A count beside the entry — orders waiting, returns open. */
  count?: number;
  /**
   * Draw the count as a `--destructive` badge rather than as a quiet
   * monospace figure. For a count somebody has to act on today.
   */
  urgent?: boolean;
  /**
   * Owner-only screens: money, payouts, settlement details. Removed outright
   * for BRAND_EMPLOYEE rather than disabled.
   */
  ownerOnly?: boolean;
};

export type AppShellNavGroup = {
  /** Optional heading. Already translated. */
  label?: string;
  items: readonly AppShellNavItem[];
};

export type AppShellProps = {
  role: AppShellRole;
  /** The screen's own title, shown in the top bar on a phone. */
  title: string;
  /** Which console this is. Three consoles share the shell. */
  consoleLabel: string;
  nav: readonly AppShellNavGroup[];
  /**
   * The phone bottom tab bar — brand and sales only. Admin passes nothing
   * and gets no tab bar, which is the design system's rule, not an omission.
   * Ids are matched against `activeId` like nav items are.
   */
  tabs?: readonly AppShellNavItem[];
  activeId?: string;
  locale?: Locale;
  /** Actions for the top bar — a search button, a notification bell. */
  topbarActions?: ReactNode;
  /** Rendered outside the scroll area, e.g. a MobileActionBar. */
  actionBar?: ReactNode;
  /** The signed-in user block at the foot of the sidebar. */
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Accessible name for the phone menu button. Already translated. */
  menuLabel?: string;
};

/**
 * Drop what this role may not see. Exported because a screen sometimes has to
 * ask the same question about a section of its own body.
 */
export function visibleNavItems(
  items: readonly AppShellNavItem[],
  role: AppShellRole
): AppShellNavItem[] {
  return items.filter((item) => !(item.ownerOnly && role === "BRAND_EMPLOYEE"));
}

/** `.lq-nav` — the same list in the sidebar and in the phone nav sheet. */
function Nav({
  groups,
  activeId,
  onNavigate,
}: {
  groups: readonly AppShellNavGroup[];
  activeId?: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="lq-nav">
      {groups.map((group, index) => (
        <React.Fragment key={group.label ?? `group-${index}`}>
          {group.label ? (
            <div className="lq-nav-group">{group.label}</div>
          ) : null}
          {group.items.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.id}
                href={item.href}
                className="lq-nav-item"
                data-active={activeId === item.id}
                aria-current={activeId === item.id ? "page" : undefined}
                onClick={onNavigate}
              >
                {Icon ? <Icon className="lq-nav-icon" /> : null}
                <span>{item.label}</span>
                {item.count ? (
                  item.urgent ? (
                    <Badge variant="count" className="ms-auto">
                      {item.count}
                    </Badge>
                  ) : (
                    <span className="lq-nav-count">{item.count}</span>
                  )
                ) : null}
              </Link>
            );
          })}
        </React.Fragment>
      ))}
    </nav>
  );
}

export function AppShell({
  role,
  title,
  consoleLabel,
  nav,
  tabs,
  activeId,
  locale = defaultLocale,
  topbarActions,
  actionBar,
  footer,
  children,
  className,
  menuLabel = "Menu",
}: AppShellProps) {
  const dir = localeDir(locale);
  const [navOpen, setNavOpen] = React.useState(false);

  const groups = nav
    .map((group) => ({ ...group, items: visibleNavItems(group.items, role) }))
    .filter((group) => group.items.length > 0);
  const tabItems = visibleNavItems(tabs ?? [], role);

  /**
   * `.lq-brandmark` — there is no logo. None was provided and none has been
   * drawn, so the wordmark is the word, set beside the console label. The
   * label is always visible because three consoles share this shell and a
   * user must never have to guess which one they are in.
   */
  const brandmark = (
    <div className="lq-brandmark">
      <span>Loqal</span>
      <span className="lq-brandmark-console">{consoleLabel}</span>
    </div>
  );

  return (
    <LocaleProvider locale={locale}>
      <div
        dir={dir}
        lang={locale}
        data-role={role}
        className={cn("lq-shell", className)}
      >
        <header className="lq-topbar">
          <Button
            variant="ghost"
            size="icon"
            aria-label={menuLabel}
            onClick={() => setNavOpen(true)}
          >
            <MenuIcon className="size-5" />
          </Button>
          {/* `.lq-topbar-title` is a div in the design system's own shell.
              It is an h1 here because it is the screen's only heading, and
              dropping it would leave every phone screen without one. The
              class carries all of the styling either way. */}
          <h1 className="lq-topbar-title">{title}</h1>
          {topbarActions}
        </header>

        <div className="lq-shell-body">
          <aside className="lq-sidebar">
            {brandmark}
            <Nav groups={groups} activeId={activeId} />
            {footer ? (
              <div className="lq-nav-item--foot pt-3">{footer}</div>
            ) : null}
          </aside>

          <div className="lq-main">
            <div className="lq-content">{children}</div>
            {actionBar}
            {tabItems.length > 0 ? (
              <nav className="lq-tabbar">
                {tabItems.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <Link
                      key={tab.id}
                      href={tab.href}
                      className="lq-tabbar-item"
                      data-active={activeId === tab.id}
                      aria-current={activeId === tab.id ? "page" : undefined}
                    >
                      {Icon ? <Icon className="lq-icon size-5" /> : null}
                      <span>{tab.label}</span>
                      {tab.count ? (
                        <Badge
                          variant="count"
                          className="absolute top-1 end-[22%]"
                        >
                          {tab.count}
                        </Badge>
                      ) : null}
                    </Link>
                  );
                })}
              </nav>
            ) : null}
          </div>
        </div>

        {/* The phone nav. `side` is the one physical value in this file:
            shadcn's Sheet takes left/right, so the locale picks it. */}
        <Sheet open={navOpen} onOpenChange={setNavOpen}>
          <SheetContent
            side={dir === "rtl" ? "right" : "left"}
            className="w-[min(88%,320px)] p-4"
          >
            <SheetTitle className="sr-only">{consoleLabel}</SheetTitle>
            <SheetDescription className="sr-only">{title}</SheetDescription>
            {brandmark}
            <Nav
              groups={groups}
              activeId={activeId}
              onNavigate={() => setNavOpen(false)}
            />
            {footer}
          </SheetContent>
        </Sheet>
      </div>
    </LocaleProvider>
  );
}

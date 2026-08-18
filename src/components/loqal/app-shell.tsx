"use client";

/**
 * Composed from shadcn primitives: SidebarProvider, Sidebar (which itself
 * becomes a Sheet below md), SidebarHeader/Content/Footer/Group/GroupLabel/
 * Menu/MenuItem/MenuButton/MenuBadge/Inset/Trigger, Separator, Button.
 *
 * The nav is driven by the signed-in role, and for an employee the Money entry
 * is ABSENT — not disabled, not greyed out. A disabled field still announces
 * that a payout account exists and roughly where it lives; a shop that gives a
 * counter assistant an account has not agreed to tell them what the shop earns.
 * So the item is never rendered, and the API refuses the route anyway if the
 * URL is typed by hand. Two independent refusals, no shared assumption.
 *
 * Direction: the shell sets `dir` from the locale and puts the sidebar on the
 * inline start in both directions — side="right" under Arabic — because
 * shadcn's Sidebar takes a physical side.
 */
import Link from "next/link";
import type { ComponentType, ReactNode } from "react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { TooltipProvider } from "@/components/ui/tooltip";
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

export function AppShell({
  role,
  title,
  consoleLabel,
  nav,
  activeId,
  locale = defaultLocale,
  topbarActions,
  actionBar,
  footer,
  children,
  className,
}: AppShellProps) {
  const dir = localeDir(locale);
  const groups = nav
    .map((group) => ({ ...group, items: visibleNavItems(group.items, role) }))
    .filter((group) => group.items.length > 0);

  return (
    <LocaleProvider locale={locale}>
      <div dir={dir} lang={locale} data-role={role} className={className}>
        {/* The sidebar's collapsed rail shows tooltips, so the shell carries
            its own provider rather than assuming an ancestor has one. */}
        <TooltipProvider>
        <SidebarProvider>
          <Sidebar side={dir === "rtl" ? "right" : "left"} collapsible="offcanvas">
            <SidebarHeader>
              <div className="flex items-baseline gap-2 px-2 py-1.5">
                <span className="text-base font-semibold tracking-tight">
                  Loqal
                </span>
                <span className="text-xs font-medium uppercase tracking-caps text-muted-foreground">
                  {consoleLabel}
                </span>
              </div>
            </SidebarHeader>

            <SidebarContent>
              {groups.map((group, index) => (
                <SidebarGroup key={group.label ?? `group-${index}`}>
                  {group.label ? (
                    <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
                  ) : null}
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        return (
                          <SidebarMenuItem key={item.id}>
                            <SidebarMenuButton
                              asChild
                              isActive={activeId === item.id}
                              tooltip={item.label}
                            >
                              <Link href={item.href}>
                                {Icon ? <Icon className="size-4" /> : null}
                                <span>{item.label}</span>
                              </Link>
                            </SidebarMenuButton>
                            {item.count ? (
                              <SidebarMenuBadge>{item.count}</SidebarMenuBadge>
                            ) : null}
                          </SidebarMenuItem>
                        );
                      })}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              ))}
            </SidebarContent>

            {footer ? <SidebarFooter>{footer}</SidebarFooter> : null}
          </Sidebar>

          <SidebarInset>
            <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/95 px-gutter-phone backdrop-blur md:px-gutter-md lg:px-gutter-lg">
              <SidebarTrigger className="-ms-1" />
              <Separator
                orientation="vertical"
                className="me-1 data-[orientation=vertical]:h-4"
              />
              <h1 className="min-w-0 flex-1 truncate text-base font-semibold text-foreground">
                {title}
              </h1>
              {topbarActions ? (
                <div className="flex items-center gap-1">{topbarActions}</div>
              ) : null}
            </header>

            <div
              className={cn(
                "flex-1 px-gutter-phone py-4 md:px-gutter-md lg:px-gutter-lg"
              )}
            >
              {children}
            </div>

            {actionBar}
          </SidebarInset>
        </SidebarProvider>
        </TooltipProvider>
      </div>
    </LocaleProvider>
  );
}

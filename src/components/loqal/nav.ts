/**
 * The canonical nav for each console, built from the message catalogue.
 *
 * The routes are named here once so nine screens do not each invent their own
 * spelling of /orders. Labels come from the catalogue lifted out of the design
 * system, so the nav is bilingual for free.
 */
import {
  BoxIcon,
  BuildingIcon,
  ClipboardListIcon,
  CoinsIcon,
  FileTextIcon,
  ImageIcon,
  LayersIcon,
  type LucideIcon,
  MessageSquareIcon,
  PackageIcon,
  ScaleIcon,
  SettingsIcon,
  ShoppingBagIcon,
  StarIcon,
  SunIcon,
  TrendingUpIcon,
  UploadIcon,
  UsersIcon,
} from "lucide-react";

import type { AppShellNavGroup, AppShellNavItem, AppShellRole } from "./app-shell";
import type { Messages } from "@/messages";

const item = (
  id: string,
  href: string,
  label: string,
  icon: LucideIcon,
  extra: { count?: number; ownerOnly?: boolean; urgent?: boolean } = {}
) => ({ id, href, label, icon, ...extra });

export type NavCounts = Record<string, number | undefined>;

/**
 * The brand console. `money` is marked ownerOnly, which is what makes it
 * disappear entirely for a BRAND_EMPLOYEE rather than appear greyed out.
 */
export function brandNav(t: Messages, counts: NavCounts = {}): AppShellNavGroup[] {
  const nav = t.brand.nav;
  return [
    {
      items: [
        item("today", "/today", nav.today, SunIcon, { count: counts.today }),
        item("orders", "/orders", nav.orders, ShoppingBagIcon, {
          count: counts.orders,
          urgent: true,
        }),
        item("products", "/products", nav.products, PackageIcon),
        item("inventory", "/inventory", nav.inventory, BoxIcon),
        item("chat", "/chat", nav.chat, MessageSquareIcon, {
          count: counts.chat,
          urgent: true,
        }),
        item("reviews", "/reviews", nav.reviews, StarIcon),
        item("money", "/money", nav.money, CoinsIcon, { ownerOnly: true }),
        item("settings", "/settings", nav.settings, SettingsIcon),
      ],
    },
  ];
}

export function adminNav(t: Messages, counts: NavCounts = {}): AppShellNavGroup[] {
  const nav = t.admin.nav;
  return [
    {
      items: [
        item("applications", "/admin/applications", nav.applications, ClipboardListIcon, {
          count: counts.applications,
          urgent: true,
        }),
        item("brands", "/admin/brands", nav.brands, BuildingIcon),
        item("categories", "/admin/categories", nav.categories, LayersIcon),
        item("products", "/admin/products", nav.products, PackageIcon),
        item("orders", "/admin/orders", nav.orders, ShoppingBagIcon),
        item("settlements", "/admin/settlements", nav.settlements, ScaleIcon, {
          count: counts.settlements,
          urgent: true,
        }),
        item("reviews", "/admin/reviews", nav.reviews, StarIcon),
        item("tryon", "/admin/try-on", nav.tryon, ImageIcon),
        item("imports", "/admin/imports", nav.imports, UploadIcon),
        item("analytics", "/admin/analytics", nav.analytics, TrendingUpIcon),
        item("settings", "/admin/settings", nav.settings, SettingsIcon),
      ],
    },
  ];
}

/**
 * The sales console has no nav object in the design system — it is a single
 * pitch flow — so its entries are named here and translated from the keys the
 * catalogue does carry.
 */
export function salesNav(t: Messages): AppShellNavGroup[] {
  return [
    {
      /**
       * Every entry is a route that exists. This used to name "/sales" and
       * "/sales/visits": the first was the route group, which serves nothing,
       * and the second has no page and no endpoint behind it — two nav links
       * that both 404.
       */
      items: [
        item("pack", "/sales/pack", t.sales.packTitle, FileTextIcon),
        item("onboard", "/sales/onboard", t.sales.onboardTitle, UsersIcon),
        item("terms", "/sales/terms", t.sales.termsTitle, FileTextIcon),
      ],
    },
  ];
}

// ---------------------------------------------------------------------------
// The phone bottom tab bars.
//
// Five entries at most, because a tab bar with six is a row of unreadable
// 11px labels on a 390px screen — so this is a DELIBERATE subset of the nav
// above, not a copy of it. The design system's own tab defs are the source:
// today / orders / products / chat, then money for an owner and settings for
// an employee in the fifth slot. Inventory, reviews and the rest stay in the
// sidebar and the phone nav sheet.
//
// The admin console has no tab bar at all. It is not defined here and not
// passed by its layout — the design system's rule is that admin is a desktop
// console that must survive a phone, not a phone console.
// ---------------------------------------------------------------------------

/**
 * `role` picks the fifth tab rather than `ownerOnly` dropping it, because a
 * four-item bar beside a five-item one reads as a broken layout. An employee
 * gets Settings in that slot; the Money route stays refused by the API and
 * absent from every other surface.
 */
export function brandTabs(
  t: Messages,
  role: AppShellRole,
  counts: NavCounts = {}
): AppShellNavItem[] {
  const nav = t.brand.nav;
  return [
    item("today", "/today", nav.today, SunIcon, { count: counts.today }),
    item("orders", "/orders", nav.orders, ShoppingBagIcon, {
      count: counts.orders,
      urgent: true,
    }),
    item("products", "/products", nav.products, PackageIcon),
    item("chat", "/chat", nav.chat, MessageSquareIcon, {
      count: counts.chat,
      urgent: true,
    }),
    role === "BRAND_OWNER"
      ? item("money", "/money", nav.money, CoinsIcon)
      : item("settings", "/settings", nav.settings, SettingsIcon),
  ];
}

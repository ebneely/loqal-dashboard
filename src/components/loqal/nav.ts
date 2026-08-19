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

import type { AppShellNavGroup } from "./app-shell";
import type { Messages } from "@/messages";

const item = (
  id: string,
  href: string,
  label: string,
  icon: LucideIcon,
  extra: { count?: number; ownerOnly?: boolean } = {}
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
        }),
        item("products", "/products", nav.products, PackageIcon),
        item("inventory", "/inventory", nav.inventory, BoxIcon),
        item("chat", "/chat", nav.chat, MessageSquareIcon, {
          count: counts.chat,
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
        }),
        item("brands", "/admin/brands", nav.brands, BuildingIcon),
        item("categories", "/admin/categories", nav.categories, LayersIcon),
        item("products", "/admin/products", nav.products, PackageIcon),
        item("orders", "/admin/orders", nav.orders, ShoppingBagIcon),
        item("settlements", "/admin/settlements", nav.settlements, ScaleIcon),
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

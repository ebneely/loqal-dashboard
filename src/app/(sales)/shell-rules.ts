/**
 * The decisions the sales shell makes, kept out of `layout.tsx`.
 *
 * A Next `layout.tsx` may export a default and a fixed set of route options and
 * NOTHING else; an extra named export fails `next build` with a type error about
 * an index signature that never mentions exports. Same rule as
 * `(brand)/shell-rules.ts` and `(admin)/shell-rules.ts`, same reason.
 */
import {
  ChartNoAxesColumnIcon,
  FilePenIcon,
  StoreIcon,
  type LucideIcon,
} from "lucide-react";

import type { AppShellRole } from "@/components/loqal";
import type { Messages } from "@/messages";

/** The role the API demands of every route in this console. */
export const SALES_REQUIRED_ROLE = "SALES";

/**
 * `AppShell`'s `role` is `BRAND_OWNER | BRAND_EMPLOYEE` — the two roles whose
 * navs differ from one another — and the only thing the shell does with it is
 * drop `ownerOnly` entries. This console marks none, so either value draws the
 * same three tabs. `BRAND_OWNER` is passed because it hides nothing.
 *
 * SAME GAP THE ADMIN CONSOLE REPORTS: `AppShellRole` has no `SALES` member, so
 * this console cannot say what it is in the one prop that asks. Reported rather
 * than patched — `src/components/loqal/app-shell.tsx` is not this task's to
 * edit, and every screen underneath still draws its own denied panel from the
 * API's own 403, which is the boundary that actually holds.
 */
export const SALES_SHELL_ROLE: AppShellRole = "BRAND_OWNER";

export type SalesTabId = "pack" | "onboard" | "terms";

export type SalesTab = {
  id: SalesTabId;
  href: string;
  label: string;
  icon: LucideIcon;
};

/**
 * Three tabs, and the console has no fourth.
 *
 * `salesNav` in the domain layer names `/sales` and `/sales/visits`, which are
 * not the routes that exist — there is no visits endpoint anywhere in the
 * contract package — so the sales console builds its own list here rather than
 * pointing a rep at two addresses, one of which 404s. Reported rather than
 * patched: `src/components/loqal/nav.ts` is not this task's to edit.
 */
export function salesTabs(t: Messages): SalesTab[] {
  return [
    {
      id: "pack",
      href: "/sales/pack",
      label: t.sales.navPack,
      icon: ChartNoAxesColumnIcon,
    },
    { id: "onboard", href: "/sales/onboard", label: t.sales.navOnboard, icon: StoreIcon },
    { id: "terms", href: "/sales/terms", label: t.sales.navTerms, icon: FilePenIcon },
  ];
}

const TAB_IDS: SalesTabId[] = ["pack", "onboard", "terms"];

export function activeTabId(pathname: string): SalesTabId {
  // The tab id is the segment AFTER "sales", not the first one — the console is
  // namespaced at /sales/* so the first segment is always "sales". Reading the
  // first segment made every route report "pack", which lit the wrong tab on
  // every screen. Matching on the segment rather than the raw string keeps a
  // query or a trailing path from confusing it.
  const segments = pathname.split("/").filter(Boolean);
  const afterConsole = segments[0] === "sales" ? segments[1] : segments[0];

  return TAB_IDS.find((id) => id === afterConsole) ?? "pack";
}

/**
 * Where a session that is not SALES belongs.
 *
 * Not a security boundary — the Nest RolesGuard is, and every screen underneath
 * still draws its own denied panel from the API's own 403. This only stops the
 * wrong console being painted around someone.
 */
export function consoleHomeFor(role: string): string {
  return role === "SUPER_ADMIN" ? "/admin/applications" : "/today";
}

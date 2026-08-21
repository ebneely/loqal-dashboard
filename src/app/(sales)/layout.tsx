"use client";

/**
 * The sales console shell.
 *
 * Composed from the domain layer: AppShell, plus the tab list in
 * `shell-rules.ts`. Nothing here reimplements a nav rule and nothing here
 * decides a permission.
 *
 * HOW IT DIFFERS FROM THE OTHER TWO SHELLS, AND WHY
 *
 *  1. PHONE FIRST, and not as an aspiration. A rep is standing inside a
 *     prospect's shop holding one phone, often with a folder in the other hand.
 *     `AppShell` already collapses its sidebar into a Sheet below md, so the
 *     three entries are one tap from anywhere, and every screen underneath is
 *     a single column that never needs a horizontal scroll.
 *
 *  2. It refuses a non-SALES session in the shell as well as in every screen —
 *     same reasoning as the admin shell. A shop owner who lands here would see
 *     three doors, all of which the RolesGuard closes. SUPER_ADMIN is sent to
 *     the admin console rather than admitted, even though the API would admit
 *     it on every sales route: an admin has `BrandsAdminController` for all of
 *     this and more, so pointing them at the narrower console would be a
 *     downgrade, not a shortcut.
 *
 *  3. The sign-out block names the role and says, in one line, that this device
 *     carries no customer data. That is not decoration. `UserRole.SALES`'s own
 *     doc comment in prisma/schema.prisma calls it the easiest credential in
 *     the system to lose, and the person who most needs to know what a lost
 *     phone gives away is the person holding it.
 *
 * THE NAV IS NOT `salesNav`. `src/components/loqal/nav.ts` names `/sales` and
 * `/sales/visits`; neither route exists and there is no visits endpoint
 * anywhere in `@loqal/contracts`. `salesTabs` in `shell-rules.ts` names the
 * three that do. Reported rather than patched — `nav.ts` is shared and not this
 * task's to edit.
 */
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { AppShell } from "@/components/loqal";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { signOut, useSession } from "@/lib/auth-client";
import { useLocale, useMessages } from "@/lib/locale-context";

import {
  SALES_REQUIRED_ROLE,
  SALES_SHELL_ROLE,
  activeTabId,
  consoleHomeFor,
  salesTabs,
} from "./shell-rules";

export default function SalesLayout({ children }: { children: ReactNode }) {
  const t = useMessages();
  const s = t.sales;
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, isPending } = useSession();

  const user = session?.user;
  const mustChangePassword = user?.mustChangePassword === true;
  const isRep = user?.role === SALES_REQUIRED_ROLE;

  useEffect(() => {
    if (isPending) return;
    if (!user) {
      // Middleware normally catches this first; this covers a session that
      // expired while the tab sat open in a shop.
      router.replace("/sign-in");
      return;
    }
    if (mustChangePassword) {
      router.replace("/set-password");
      return;
    }
    if (!isRep) router.replace(consoleHomeFor(String(user.role ?? "")));
  }, [isPending, user, mustChangePassword, isRep, router]);

  /**
   * Until the role is known, nothing is drawn. Painting three sales tabs
   * optimistically and correcting a tick later would flash a pitch deck at a
   * shop owner on every cold load.
   */
  if (isPending || !user || mustChangePassword || !isRep) {
    return (
      <div className="flex min-h-svh flex-col gap-4 px-gutter-phone py-6 md:px-gutter-md lg:px-gutter-lg">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const activeId = activeTabId(pathname);
  const tabs = salesTabs(t);
  const title = tabs.find((tab) => tab.id === activeId)?.label ?? s.navPack;

  return (
    <AppShell
      role={SALES_SHELL_ROLE}
      title={title}
      consoleLabel={s.consoleLabel}
      nav={[{ items: tabs }]}
      tabs={tabs}
      activeId={activeId}
      locale={locale}
      footer={
        <div className="grid gap-2 px-2 py-1.5">
          <div className="grid gap-0.5">
            <span className="truncate text-sm font-medium text-foreground">
              {user.email}
            </span>
            <span className="font-mono text-2xs uppercase tracking-caps text-muted-foreground">
              {SALES_REQUIRED_ROLE}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{s.noCustomerData}</p>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => {
              void signOut();
              router.replace("/sign-in");
            }}
          >
            {s.signOut}
          </Button>
        </div>
      }
    >
      {children}
    </AppShell>
  );
}

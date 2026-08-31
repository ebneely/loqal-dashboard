"use client";

/**
 * The brand console shell.
 *
 * Composed from the domain layer: AppShell + brandNav. Nothing here
 * reimplements the nav rules — `brandNav` marks Money `ownerOnly` and AppShell
 * runs `visibleNavItems` over every group, which is what makes the entry ABSENT
 * for an employee rather than greyed out. A disabled row still tells a counter
 * assistant that a payout account exists and roughly what the screen says; a
 * shop that hands someone an account has not agreed to that.
 *
 * The nav is cosmetic and is treated as such. Better Auth is the only thing
 * this app can check, the Nest RolesGuard is the actual boundary, and every
 * screen underneath still has to survive a 403 on its own — see the balance
 * section on /today, which draws a denied panel rather than trusting that it
 * would never have been rendered.
 *
 * It still refuses a non-brand session, the way the admin and sales shells
 * do. Not as a security check — `mayEnter`'s own header forbids it becoming
 * one — but because a SUPER_ADMIN or SALES session that types /orders used to
 * get the brand console painted around a screen of 403s, which reads as a
 * broken product rather than as "wrong console". `homeFor` sends each role to
 * its own front door, and a role this build has never heard of lands back on
 * sign-in with an explanation, exactly as `safeNext` would have routed it.
 */
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import type { UserRole } from "@loqal/contracts/enums";

import { AppShell, brandNav, brandTabs, ConsoleOpening } from "@/components/loqal";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useConsoleSignOut, useSession } from "@/lib/auth-client";
import { useLocale, useMessages } from "@/lib/locale-context";

import { homeFor, mayEnter } from "../(auth)/auth-rules";
import { activeNavId, shellRoleFor } from "./shell-rules";

export default function BrandLayout({ children }: { children: ReactNode }) {
  const t = useMessages();
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const leaving = useConsoleSignOut();

  const user = session?.user;
  const mustChangePassword = user?.mustChangePassword === true;
  /**
   * `mayEnter` rather than a role list of this file's own: it is the ONE
   * statement of which roles the brand console belongs to, already read by
   * sign-in's `safeNext`, so the resume path and this gate cannot disagree.
   */
  const sessionRole = String(user?.role ?? "") as UserRole;
  const belongs = user !== undefined && mayEnter(pathname, sessionRole);

  useEffect(() => {
    if (isPending) return;
    if (!user) {
      // Middleware normally catches this first; this covers a session that
      // expired while the tab sat open.
      router.replace("/sign-in");
      return;
    }
    if (mustChangePassword) {
      router.replace("/set-password");
      return;
    }
    if (!belongs) router.replace(homeFor(sessionRole));
  }, [isPending, user, mustChangePassword, belongs, sessionRole, router]);

  /**
   * Until the role is known, nothing is drawn.
   *
   * Rendering the shell optimistically and correcting it a tick later would
   * mean an employee's screen flashes a Money entry on every cold load. The
   * skeleton is cheap; the flash is a leak.
   */
  if (isPending || !user || mustChangePassword || !belongs) {
    return (
      <ConsoleOpening label={t.brand.consoleLabel} />
    );
  }

  const role = shellRoleFor(user.role);
  const activeId = activeNavId(pathname);
  const nav = brandNav(t);
  const tabs = brandTabs(t, role);
  const title =
    nav[0]?.items.find((item) => item.id === activeId)?.label ?? t.brand.nav.today;

  return (
    <AppShell
      role={role}
      title={title}
      consoleLabel={t.brand.consoleLabel}
      nav={nav}
      tabs={tabs}
      activeId={activeId}
      locale={locale}
      footer={
        <div className="grid gap-2 px-2 py-1.5">
          <div className="grid gap-0.5">
            <span className="text-xs text-muted-foreground">
              {t.brand.signedInAs}
            </span>
            <span className="truncate text-sm font-medium text-foreground">
              {user.email}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            disabled={leaving.pending}
            onClick={() => void leaving.signOut()}
          >
            {t.brand.signOut}
          </Button>
        </div>
      }
    >
      {children}
    </AppShell>
  );
}

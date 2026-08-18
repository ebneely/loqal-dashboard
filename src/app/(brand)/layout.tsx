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
 */
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { AppShell, brandNav } from "@/components/loqal";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { signOut, useSession } from "@/lib/auth-client";
import { useLocale, useMessages } from "@/lib/locale-context";

import { activeNavId, shellRoleFor } from "./shell-rules";

export default function BrandLayout({ children }: { children: ReactNode }) {
  const t = useMessages();
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, isPending } = useSession();

  const user = session?.user;
  const mustChangePassword = user?.mustChangePassword === true;

  useEffect(() => {
    if (isPending) return;
    if (!user) {
      // Middleware normally catches this first; this covers a session that
      // expired while the tab sat open.
      router.replace("/sign-in");
      return;
    }
    if (mustChangePassword) router.replace("/set-password");
  }, [isPending, user, mustChangePassword, router]);

  /**
   * Until the role is known, nothing is drawn.
   *
   * Rendering the shell optimistically and correcting it a tick later would
   * mean an employee's screen flashes a Money entry on every cold load. The
   * skeleton is cheap; the flash is a leak.
   */
  if (isPending || !user || mustChangePassword) {
    return (
      <div className="flex min-h-svh flex-col gap-4 px-gutter-phone py-6 md:px-gutter-md lg:px-gutter-lg">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const role = shellRoleFor(user.role);
  const activeId = activeNavId(pathname);
  const nav = brandNav(t);
  const title =
    nav[0]?.items.find((item) => item.id === activeId)?.label ?? t.brand.nav.today;

  return (
    <AppShell
      role={role}
      title={title}
      consoleLabel={t.brand.consoleLabel}
      nav={nav}
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
            onClick={() => {
              void signOut();
              router.replace("/sign-in");
            }}
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

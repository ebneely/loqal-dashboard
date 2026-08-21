"use client";

/**
 * The admin console shell.
 *
 * Composed from the domain layer: AppShell + adminNav, exactly as the brand
 * shell is composed from AppShell + brandNav. Nothing here reimplements a nav
 * rule and nothing here decides a permission.
 *
 * HOW IT DIFFERS FROM THE BRAND SHELL, AND WHY
 *
 *  1. There is no `ownerOnly` split. The brand shell exists partly to make the
 *     Money entry ABSENT for an employee; this console has exactly one role, so
 *     every entry is drawn for everyone who gets this far and the interesting
 *     question moves entirely to the API.
 *
 *  2. Desktop-first, not phone-first. A shop owner is standing behind a
 *     counter; an admin is at a desk approving applications and checking
 *     settlement — but does both from a phone on the way somewhere, so nothing
 *     here may break below md. That is the opposite EMPHASIS with the same
 *     floor: `AppShell` already collapses its sidebar into a Sheet below md,
 *     and every screen underneath uses `ResponsiveList`, so the phone rendering
 *     is a first-class output rather than a squeezed table.
 *
 *  3. It refuses a non-admin session in the shell as well as in every screen.
 *     The brand shell can afford to treat an unexpected role as "least
 *     privileged" and carry on, because every brand route is scoped to the
 *     caller's own brand anyway. This console is unscoped by construction — its
 *     screens act on ANY brand — so a session that is not SUPER_ADMIN is sent
 *     to the brand console rather than shown a nav full of doors it cannot
 *     open. The Nest RolesGuard is still the boundary; this only stops the
 *     wrong console being painted around someone.
 */
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { AppShell, adminNav } from "@/components/loqal";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { signOut, useSession } from "@/lib/auth-client";
import { useLocale, useMessages } from "@/lib/locale-context";

import { ADMIN_REQUIRED_ROLE, ADMIN_SHELL_ROLE, activeNavId } from "./shell-rules";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const t = useMessages();
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, isPending } = useSession();

  const user = session?.user;
  const mustChangePassword = user?.mustChangePassword === true;
  const isAdmin = user?.role === ADMIN_REQUIRED_ROLE;

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
    if (!isAdmin) router.replace("/today");
  }, [isPending, user, mustChangePassword, isAdmin, router]);

  /**
   * Until the role is known, nothing is drawn. Rendering the eleven admin
   * entries optimistically and correcting them a tick later would flash a
   * settlement screen at a shop owner on every cold load.
   */
  if (isPending || !user || mustChangePassword || !isAdmin) {
    return (
      <div className="flex min-h-svh flex-col gap-4 px-gutter-phone py-6 md:px-gutter-md lg:px-gutter-lg">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const activeId = activeNavId(pathname);
  const nav = adminNav(t);
  const title =
    nav[0]?.items.find((item) => item.id === activeId)?.label ??
    t.admin.nav.applications;

  return (
    <AppShell
      role={ADMIN_SHELL_ROLE}
      title={title}
      consoleLabel={t.admin.consoleLabel}
      nav={nav}
      activeId={activeId}
      locale={locale}
      footer={
        <div className="grid gap-2 px-2 py-1.5">
          <div className="grid gap-0.5">
            <span className="text-xs text-muted-foreground">
              {t.admin.signedInAs}
            </span>
            <span className="truncate text-sm font-medium text-foreground">
              {user.email}
            </span>
            <span className="font-mono text-2xs uppercase tracking-caps text-muted-foreground">
              {ADMIN_REQUIRED_ROLE}
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
            {t.admin.signOut}
          </Button>
        </div>
      }
    >
      {children}
    </AppShell>
  );
}

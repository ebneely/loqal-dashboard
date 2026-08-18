"use client";

/**
 * Composed from shadcn primitives: Skeleton, Empty (+EmptyHeader/EmptyMedia/
 * EmptyTitle/EmptyDescription/EmptyContent), Card (+CardContent), Button.
 * The link action is next/link, which is the platform's anchor.
 *
 * The five states a list can be in, including the one that usually gets
 * demoted to a toast: PERMISSION DENIED.
 *
 * It is first-class here because the three consoles differ mostly by what a
 * user may NOT see. An employee opening Money, a sales account opening a
 * brand's ledger and an admin opening another admin's audit trail are ordinary
 * daily events, not errors — and a toast that fades after four seconds leaves
 * someone staring at an empty screen wondering whether the data is missing or
 * they are. A panel that stays put and names the role required answers that.
 *
 * The states are also deliberately NOT interchangeable with "empty": empty
 * means there is nothing; denied means there is something and it is not yours;
 * NOT FOUND means there is no such row at this address at all.
 *
 * `notFound` earns its own state for the same reason `denied` does. It is
 * first-class on every detail route, and on this backend it doubles as "this
 * belongs to another shop" — the API answers 404 rather than 403 precisely so
 * the route is not an enumeration oracle, and the screen must not undo that by
 * wording the two differently. Screens were rendering `state="empty"` with a
 * 404 title, which tells a shop owner the list is empty when the truth is that
 * the address is wrong.
 */
import {
  LockIcon,
  InboxIcon,
  RefreshCwIcon,
  SearchXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api";

export type ListStateKind =
  | "loading"
  | "empty"
  | "error"
  | "denied"
  | "notFound";

export type ListStateProps = {
  state: ListStateKind;
  /** Already translated; this component never looks copy up. */
  title?: string;
  body?: string;
  /** Skeleton cards drawn while loading. */
  rows?: number;
  actionLabel?: string;
  onAction?: () => void;
  /**
   * The action as an ADDRESS rather than a handler.
   *
   * A dead end needs a way out, and the way out of a 404 is "back to the list",
   * which is navigation — so it has to be an anchor: keyboard-reachable,
   * middle-clickable, copyable. `onAction` is a button and cannot be any of
   * those, which is why every screen composed a `Button asChild + Link` beside
   * the panel instead. Takes precedence over `onAction` when both are given.
   */
  actionHref?: string;
  /** Shown on `denied` — the role that would have been allowed. */
  requiredRole?: string;
  className?: string;
};

/**
 * Turn whatever a fetch threw into the state a list should draw. Keeps the
 * 403-is-not-an-error decision in one place instead of in nine screens.
 *
 * `notFound` is OPT-IN. A list screen has no detail address to be wrong about,
 * and every screen shipping today branches on "error" for a 404 — mapping it
 * automatically would leave those screens rendering nothing at all. A detail
 * route asks for it; a list route does not.
 */
export function listStateFor(
  error: unknown,
  options: {
    isLoading?: boolean;
    isEmpty?: boolean;
    /** Treat a 404 as its own state rather than as an error. */
    notFound?: boolean;
  } = {}
): ListStateKind | null {
  if (options.isLoading) return "loading";
  if (error instanceof ApiError && error.isPermissionDenied) return "denied";
  if (options.notFound && error instanceof ApiError && error.isNotFound) {
    return "notFound";
  }
  if (error) return "error";
  if (options.isEmpty) return "empty";
  return null;
}

function LoadingCards({ rows }: { rows: number }) {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }).map((_, index) => (
        <Card key={index} className="shadow-none">
          <CardContent className="flex flex-col gap-3 px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

const ICON = {
  empty: InboxIcon,
  error: TriangleAlertIcon,
  denied: LockIcon,
  notFound: SearchXIcon,
} as const;

export function ListState({
  state,
  title,
  body,
  rows = 3,
  actionLabel,
  onAction,
  actionHref,
  requiredRole,
  className,
}: ListStateProps) {
  if (state === "loading") {
    return <LoadingCards rows={rows} />;
  }

  const Icon = ICON[state];

  return (
    <Empty
      data-state={state}
      role={state === "error" ? "alert" : undefined}
      className={cn(
        "border border-dashed",
        state === "denied" && "border-state-bad-border bg-state-bad-bg/40",
        className
      )}
    >
      <EmptyHeader>
        <EmptyMedia
          variant="icon"
          className={cn(
            state === "error" && "text-state-bad-fg",
            state === "denied" && "text-state-bad-fg"
          )}
        >
          <Icon />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        {body ? <EmptyDescription>{body}</EmptyDescription> : null}
      </EmptyHeader>
      {requiredRole || actionLabel ? (
        <EmptyContent>
          {state === "denied" && requiredRole ? (
            <span className="rounded-md border border-border bg-muted px-2 py-1 font-mono text-xs text-muted-foreground">
              {requiredRole}
            </span>
          ) : null}
          {actionLabel ? (
            actionHref ? (
              /* An address, so it is an anchor. No retry icon: this does not
                 retry anything, it goes somewhere. */
              <Button
                asChild
                variant={state === "error" ? "outline" : "default"}
                size="sm"
              >
                <Link href={actionHref}>{actionLabel}</Link>
              </Button>
            ) : (
              <Button
                variant={state === "error" ? "outline" : "default"}
                size="sm"
                onClick={onAction}
              >
                {state === "error" ? <RefreshCwIcon /> : null}
                {actionLabel}
              </Button>
            )
          ) : null}
        </EmptyContent>
      ) : null}
    </Empty>
  );
}

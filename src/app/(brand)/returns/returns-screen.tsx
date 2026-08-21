"use client";

/**
 * /returns — the returns this shop has to decide, walk-ins first.
 *
 * Composed from the domain layer: ResponsiveList, StatusPill, ListState,
 * DestructiveSheet — plus shadcn's Card, Button, NativeSelect, Field and
 * Textarea.
 *
 * Two things shape the whole screen:
 *
 *  a. A return is per BRAND ORDER, never per parent order. One brand's items
 *     may come back while another brand's half of the same basket stays
 *     delivered, and nothing here shows or implies the other half.
 *
 *  b. APPROVING IS A DECISION ABOUT ROUTE. `route` is null until the brand
 *     approves, and `approveReturnBodySchema` requires one with no default —
 *     because WALK_IN and COURIER are not interchangeable, and defaulting one
 *     would book a courier for a customer who lives round the corner. So there
 *     is no single "Approve" button on this screen; there are two, and each
 *     says which answer it is giving.
 *
 *  c. WALK_IN leads among the decided ones. Most of these brands have a shop,
 *     the customer often lives two streets away, and handing it back in person
 *     settles in minutes what a courier drags out for a week. The ordering
 *     itself lives in `groupByRoute` so it is a fact that can be tested rather
 *     than a layout accident.
 */
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { ReturnStatusSchema } from "@loqal/contracts/enums";
import type { ReturnRoute, ReturnStatus } from "@loqal/contracts/enums";
import type { ReturnListItem } from "@loqal/contracts/return.contract";

import {
  DestructiveSheet,
  ListState,
  ResponsiveList,
  StatusPill,
  listStateFor,
  statusLabel,
  type ResponsiveListColumn,
} from "@/components/loqal";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useLocale, useMessages } from "@/lib/locale-context";

import { waitedLabel } from "../today/waited";
import { useReturnDecision, useReturns } from "./returns-data";
import { groupByRoute, isDecidable } from "./return-window";

const STATUSES: readonly ReturnStatus[] = ReturnStatusSchema.options;

const isStatus = (value: string | null): value is ReturnStatus =>
  value !== null && (STATUSES as readonly string[]).includes(value);

export function ReturnsScreen() {
  const t = useMessages();
  const b = t.brand;
  const locale = useLocale();
  const router = useRouter();
  const params = useSearchParams();

  const raw = params.get("status");
  const status = isStatus(raw) ? raw : null;

  const feed = useReturns(status);
  const decision = useReturnDecision();

  const [rejecting, setRejecting] = useState<ReturnListItem | null>(null);
  const [reason, setReason] = useState("");

  /** One clock for the whole render, so two waits cannot disagree. */
  const now = useMemo(
    () => Date.now(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [feed.rows]
  );
  const groups = useMemo(() => groupByRoute(feed.rows), [feed.rows]);

  const state = listStateFor(feed.error, {
    isLoading: feed.isLoading,
    isEmpty: feed.rows.length === 0,
  });

  const onFilter = (value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set("status", value);
    else next.delete("status");
    const query = next.toString();
    router.replace(query ? `/returns?${query}` : "/returns");
  };

  /**
   * The route is REQUIRED and carries no default, so it is passed in by whoever
   * pressed the button rather than filled in here. `{}` used to be sent, which
   * is a guaranteed 400 on the one button on this screen that matters.
   *
   * `refundAmount` and `trackingRef` are optional and are not collected: the
   * figure is agreed in settlement, and a courier reference is something the
   * brand has only once the parcel is actually booked.
   */
  const approve = async (row: ReturnListItem, route: ReturnRoute) => {
    if (await decision.decide(row.id, "approve", { route })) feed.reload();
  };

  const confirmReject = async () => {
    if (!rejecting || reason.trim().length === 0) return;
    const ok = await decision.decide(rejecting.id, "reject", {
      reason: reason.trim(),
    });
    if (ok) {
      setRejecting(null);
      setReason("");
      feed.reload();
    }
  };

  const columns: readonly ResponsiveListColumn<ReturnListItem>[] = [
    {
      key: "orderNumber",
      header: b.order,
      /*
        The number is what a shop owner reads; `brandOrderId` is what it links
        to. The row used to print inert text because the contract carried no id
        and inventing one from the number would have been a guess at another
        screen's address. It carries one now, so the address is real —
        `getRowHref` turns this cell into an anchor at both breakpoints.
      */
      cell: (row) => (
        <span className="font-mono font-semibold text-foreground">
          #{row.orderNumber}
        </span>
      ),
      primary: true,
    },
    {
      key: "status",
      header: b.status,
      cell: (row) => (
        <StatusPill
          kind="ReturnStatus"
          value={row.status}
          size="sm"
          locale={locale}
        />
      ),
      meta: true,
    },
    {
      key: "items",
      header: b.items,
      cell: (row) => String(row.itemCount),
      numeric: true,
    },
    {
      key: "reason",
      header: b.returnReason,
      cell: (row) => row.reason,
    },
    {
      /*
        How long the shopper has been waiting on an answer. It is on the card as
        well as in the table now: the return-window countdown that used to carry
        the time pressure is gone, because the window is enforced at request
        time and every row here is already through it.
      */
      key: "asked",
      header: b.waiting,
      cell: (row) => b.askedAgo.replace("{t}", waitedLabel(row.requestedAt, t, now) ?? "—"),
    },
    {
      key: "decide",
      header: b.approve,
      cell: (row) =>
        isDecidable(row.status) ? (
          <span className="flex flex-wrap gap-2">
            {/*
              Two buttons, because approving IS the route decision and the
              contract gives it no default. One "Approve" would have to pick
              one silently, and picking COURIER for a customer standing at the
              counter is a week of shipping nobody asked for.
            */}
            <Button
              size="sm"
              className="min-h-11"
              disabled={decision.pendingId === row.id}
              onClick={() => void approve(row, "WALK_IN")}
            >
              {decision.pendingId === row.id ? b.saving : b.approveWalkIn}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="min-h-11"
              disabled={decision.pendingId === row.id}
              onClick={() => void approve(row, "COURIER")}
            >
              {b.approveCourier}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="min-h-11 text-destructive"
              disabled={decision.pendingId === row.id}
              onClick={() => {
                setRejecting(row);
                setReason("");
              }}
            >
              {b.reject}
            </Button>
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">
            {statusLabel({ kind: "ReturnStatus", value: row.status }, locale)}
          </span>
        ),
    },
  ];

  return (
    <div className="grid gap-6">
      {/*
        A control, not a landmark — labelling it as a region would put a stop
        between a screen-reader user and the returns, and collide with the
        select's own accessible name.
      */}
      <div className="grid gap-2">
        <label
          htmlFor="returns-status-filter"
          className="text-sm font-medium text-foreground"
        >
          {b.filterStatus}
        </label>
        <NativeSelect
          id="returns-status-filter"
          className="w-full max-w-xs"
          value={status ?? ""}
          onChange={(event) => onFilter(event.target.value)}
        >
          <NativeSelectOption value="">{b.filterAll}</NativeSelectOption>
          {STATUSES.map((value) => (
            <NativeSelectOption key={value} value={value}>
              {statusLabel({ kind: "ReturnStatus", value }, locale)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      {decision.failed ? (
        <p role="alert" className="text-sm text-destructive">
          {b.returnDecideFailed}
        </p>
      ) : null}

      {state === "loading" ? <ListState state="loading" rows={3} /> : null}

      {state === "error" ? (
        <ListState
          state="error"
          title={b.returnsErrorTitle}
          body={b.errorBody}
          actionLabel={b.retry}
          onAction={feed.reload}
        />
      ) : null}

      {state === "denied" ? (
        <ListState
          state="denied"
          title={b.brandOnlyTitle}
          body={b.brandOnlyBody}
          requiredRole="BRAND_OWNER"
        />
      ) : null}

      {state === "empty" ? (
        <ListState
          state="empty"
          title={b.returnsEmptyTitle}
          body={b.returnsEmptyBody}
        />
      ) : null}

      {state === null
        ? groups.map((group) => {
            /*
              Three headings, not two. A row whose route is null has not been
              decided yet, and the old `walkIn ? … : …` printed "Coming back by
              courier" over it — a route the brand had not chosen, stated as
              fact. The undecided group is the one that carries the act styling
              because it is the only one with work left in it.
            */
            const undecided = group.route === null;
            const title = undecided
              ? b.returnUndecided
              : group.route === "WALK_IN"
                ? b.returnWalkIn
                : b.returnCourier;
            const note = undecided
              ? b.returnUndecidedNote
              : group.route === "WALK_IN"
                ? b.returnWalkInNote
                : b.returnCourierNote;
            const testId = undecided
              ? "returns-undecided"
              : group.route === "WALK_IN"
                ? "returns-walk-in"
                : "returns-courier";

            return (
              <section
                key={group.route ?? "undecided"}
                aria-label={title}
                data-testid={testId}
                className="grid gap-3"
              >
                <Card
                  className={
                    undecided
                      ? "border-state-act-border bg-state-act-bg"
                      : undefined
                  }
                >
                  <CardHeader className="gap-1">
                    <CardTitle className="text-base">{title}</CardTitle>
                    <CardDescription>{note}</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3">
                    <ResponsiveList
                      rows={group.rows}
                      columns={columns}
                      getRowKey={(row) => row.id}
                      getRowHref={(row) => `/orders/${row.brandOrderId}`}
                      caption={title}
                    />
                    <p className="text-xs text-muted-foreground">
                      {b.approveConsequence}
                    </p>
                  </CardContent>
                </Card>
              </section>
            );
          })
        : null}

      {state === null ? (
        <div className="grid gap-3">
          {/* A return covers this shop's items only. The other shop's half of
              the same basket can stay delivered. */}
          <p className="text-xs text-muted-foreground">{b.returnNote}</p>
          {/* No note about the return window: it is enforced when a shopper
              files, so every row that reaches this screen is already inside it
              and there is no deadline here to explain. */}
          {feed.nextCursor ? (
            <Button
              variant="outline"
              className="min-h-11 justify-self-start"
              disabled={feed.isLoadingMore}
              onClick={feed.loadMore}
            >
              {feed.isLoadingMore ? b.saving : b.loadMore}
            </Button>
          ) : null}
        </div>
      ) : null}

      {/*
        Rejecting is the destructive half, and it is the one a shopper will ask
        about — so it says what happens in words and it cannot be confirmed
        without a reason, which is exactly what the shopper is shown.
      */}
      <DestructiveSheet
        open={rejecting !== null}
        onOpenChange={(open) => {
          if (!open) setRejecting(null);
        }}
        title={b.rejectTitle}
        description={rejecting ? `#${rejecting.orderNumber}` : b.rejectDesc}
        consequences={[
          b.conseqNoRestock,
          b.conseqReasonSent,
          b.conseqStaysDelivered,
        ]}
        confirmLabel={b.rejectConfirm}
        cancelLabel={b.cancel}
        onConfirm={confirmReject}
      >
        <Field>
          <FieldLabel htmlFor="return-reject-reason">{b.reason}</FieldLabel>
          <Textarea
            id="return-reject-reason"
            value={reason}
            placeholder={b.rejectPlaceholder}
            onChange={(event) => setReason(event.target.value)}
          />
          {reason.trim().length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {b.rejectReasonRequired}
            </p>
          ) : null}
        </Field>
      </DestructiveSheet>
    </div>
  );
}

"use client";

/**
 * /admin/settlements/[id] — the one screen in this console where pressing a
 * button moves money.
 *
 * Composed from the domain layer: ListState, MoneyRow, ResponsiveList,
 * StatusPill, DestructiveSheet — plus shadcn's Alert, Button, Card, Separator
 * and Textarea.
 *
 * EVERYTHING A PERSON NEEDS IN ORDER TO CHECK THE FIGURE IS ON ONE SCREEN, and
 * none of it is behind a tab. The period, the signed amount with the party
 * named in words, the direction the API decided, the destination account the
 * money would actually land in, and every ledger line the figure was computed
 * from. A tab would let somebody mark a run without having looked at the half
 * they did not open.
 *
 * THE SUM CHECK IS A REFUSAL, NOT A DECORATION. The ledger lines are paginated,
 * so until every page is loaded there is no verdict to give and the screen says
 * so rather than comparing a partial total and crying wolf. Once they are all
 * loaded, the lines either add up to the figure above or they do not, and the
 * second case is stated in capitals with the marking buttons still drawn —
 * because refusing to draw them would send the admin to a database console
 * instead of to a conversation. See `../run-rules.ts`.
 *
 * THERE IS NO WAY BACK TO PENDING. A run can be marked sent, received or
 * cancelled, and never back — marking one back would erase the record that a
 * person checked the figure, which is the only control between a mistake and a
 * payment. So an already-marked run draws no buttons at all and says why.
 *
 * WHICH BUTTON APPEARS IS DECIDED BY DIRECTION, not offered as a choice. See
 * `allowedMarks`.
 */
import Link from "next/link";
import { useState } from "react";

import type { SettlementLine } from "@loqal/contracts/settlement.contract";

import {
  DestructiveSheet,
  ListState,
  MoneyRow,
  ResponsiveList,
  StatusPill,
  listStateFor,
  type ResponsiveListColumn,
} from "@/components/loqal";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useLocale, useMessages } from "@/lib/locale-context";
import { formatMoney } from "@/lib/money";

import { ADMIN_REQUIRED_ROLE } from "../../../shell-rules";
import {
  fetchRunLines,
  isNoteAcceptable,
  markSettlementRun,
  useSettlementRun,
} from "../settlements-data";
import { allowedMarks, checkSum, type RunMark } from "../run-rules";

const ENTRY_KEY = {
  SALE: "entrySale",
  COMMISSION: "entryCommission",
  DISCOUNT: "entryDiscount",
  PAYOUT: "entryPayout",
  REFUND: "entryRefund",
  BRAND_PAYMENT: "entryBrandPayment",
} as const;

export function SettlementRunDetailScreen({ id }: { id: string }) {
  const t = useMessages();
  const a = t.admin;
  const locale = useLocale();

  const run = useSettlementRun(id);

  /**
   * The walk through the ledger lines, kept HERE rather than pushed into
   * `useCursorFeed`.
   *
   * The endpoint answers `{ run, entries: { items, nextCursor } }` — the run
   * comes back with every page — so this is not the shape `useCursorFeed`
   * takes, and bending it into one would refetch and rebind the run on every
   * page of lines.
   *
   * THE RESET IS DONE DURING RENDER, NOT IN AN EFFECT, and that is not a style
   * choice. An effect commits one paint too late, and on this screen that paint
   * has `cursor === null` while only the first page is loaded — so the sum
   * check briefly concludes "THE LINES DO NOT ADD UP", in red, on every load of
   * any run with more than one page of lines. Setting state during render makes
   * React re-run this component before committing anything, so the wrong
   * verdict is never painted. Same pattern, and same reason, as the key reset
   * inside `useCursorFeed`.
   */
  const firstPage = run.data?.entries;
  const [walk, setWalk] = useState<{
    of: typeof firstPage;
    extra: readonly SettlementLine[];
    cursor: string | null;
  }>({ of: firstPage, extra: [], cursor: firstPage?.nextCursor ?? null });
  const [loadingLines, setLoadingLines] = useState(false);
  const [lineError, setLineError] = useState<unknown>(null);

  if (walk.of !== firstPage) {
    // A fresh run response restarts the walk. Keeping the old tail would sum
    // lines from a period nobody is looking at any more.
    setWalk({ of: firstPage, extra: [], cursor: firstPage?.nextCursor ?? null });
  }

  const [mark, setMark] = useState<RunMark | null>(null);
  const [note, setNote] = useState("");
  const [markError, setMarkError] = useState<string | null>(null);

  const state = listStateFor(run.error, {
    isLoading: run.isLoading,
    notFound: true,
  });

  if (state === "loading") return <ListState state="loading" rows={4} />;

  if (state === "denied") {
    return (
      <ListState
        state="denied"
        title={a.deniedTitle}
        body={a.deniedBody}
        requiredRole={ADMIN_REQUIRED_ROLE}
      />
    );
  }

  if (state === "notFound") {
    return (
      <ListState
        state="notFound"
        title={a.runNotFoundTitle}
        body={a.runNotFoundBody}
        actionLabel={a.backToSettlements}
        actionHref="/admin/settlements"
      />
    );
  }

  if (state === "error" || !run.data) {
    return (
      <ListState
        state="error"
        title={a.errorTitle}
        body={a.errorBody}
        actionLabel={a.retry}
        onAction={run.reload}
      />
    );
  }

  const detail = run.data;
  const row = detail.run;
  const lines = [...detail.entries.items, ...walk.extra];
  const hasMore = walk.cursor !== null;
  const verdict = checkSum(row, lines, hasMore);
  const marks = allowedMarks(row);

  const loadMoreLines = async () => {
    const cursor = walk.cursor;
    if (!cursor) return;
    setLoadingLines(true);
    setLineError(null);
    try {
      const page = await fetchRunLines(id, cursor);
      setWalk((current) => ({
        ...current,
        extra: [...current.extra, ...page.items],
        cursor: page.nextCursor,
      }));
    } catch (thrown) {
      // The lines already on screen are still correct, so they stay. Throwing
      // them away because page four timed out would lose the reader's place in
      // the one list they are here to read line by line.
      setLineError(thrown);
    } finally {
      setLoadingLines(false);
    }
  };

  const confirmMark = async () => {
    if (!mark) return;
    setMarkError(null);
    try {
      await markSettlementRun(id, mark, note);
      setMark(null);
      setNote("");
      run.reload();
    } catch {
      setMarkError(a.actionFailed);
    }
  };

  const columns: readonly ResponsiveListColumn<SettlementLine>[] = [
    {
      key: "type",
      header: a.status,
      cell: (line) => a[ENTRY_KEY[line.type]],
      primary: true,
    },
    {
      key: "createdAt",
      header: a.raisedOn,
      cell: (line) => new Date(line.createdAt).toLocaleDateString(locale),
      meta: true,
    },
    {
      key: "note",
      header: a.noteLabel,
      cell: (line) => line.note ?? a.unset,
      tableOnly: true,
    },
    {
      key: "amount",
      header: a.netAmount,
      cell: (line) => (
        <MoneyRow
          amount={line.amount}
          perspective="platform"
          variant="inline"
          locale={locale}
        />
      ),
      numeric: true,
    },
  ];

  const markCopy: Record<
    RunMark,
    { title: string; description: string; consequences: readonly string[]; confirm: string }
  > = {
    SENT: {
      title: a.markSentTitle,
      description: a.markSentDesc,
      consequences: [a.markSentMoney, a.markSentNotATransfer, a.markSentIrreversible],
      confirm: a.markSent,
    },
    RECEIVED: {
      title: a.markReceivedTitle,
      description: a.markReceivedDesc,
      consequences: [a.markReceivedMoney, a.markReceivedCheck, a.markSentIrreversible],
      confirm: a.markReceived,
    },
    CANCELLED: {
      title: a.cancelRunTitle,
      description: a.cancelRunDesc,
      consequences: [a.cancelNoEntry, a.cancelIrreversible],
      confirm: a.cancelRun,
    },
  };

  const markLabel: Record<RunMark, string> = {
    SENT: a.markSent,
    RECEIVED: a.markReceived,
    CANCELLED: a.cancelRun,
  };

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-1">
          <h2 className="text-xl font-semibold text-foreground">
            {row.brandName}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill
              kind="SettlementStatus"
              value={row.status}
              locale={locale}
            />
            <span className="text-xs text-muted-foreground">
              {a.period}: {new Date(row.periodStart).toLocaleDateString(locale)} —{" "}
              {new Date(row.periodEnd).toLocaleDateString(locale)}
            </span>
          </div>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/settlements">{a.backToSettlements}</Link>
        </Button>
      </div>

      <Alert>
        <AlertTitle>{a.checkFirstTitle}</AlertTitle>
        <AlertDescription>{a.checkFirstBody}</AlertDescription>
      </Alert>

      <MoneyRow
        amount={row.netAmount}
        perspective="platform"
        variant="hero"
        locale={locale}
        note={
          row.direction === "WE_PAY" ? a.directionWePayBody : a.directionTheyPayBody
        }
      />

      <Card className="shadow-none">
        <CardContent className="grid gap-2 px-4 py-3">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-xs text-muted-foreground">{a.direction}</span>
            <span
              data-direction-decision={row.direction}
              className="text-sm font-medium text-foreground"
            >
              {row.direction === "WE_PAY" ? a.directionWePay : a.directionTheyPay}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-xs text-muted-foreground">{a.method}</span>
            <span className="text-sm text-foreground">
              {row.settlementMethod === "INSTAPAY"
                ? a.methodInstapay
                : row.settlementMethod === "MOBILE_WALLET"
                  ? a.methodWallet
                  : row.settlementMethod === "BANK_TRANSFER"
                    ? a.methodBank
                    : a.methodUnset}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-xs text-muted-foreground">{a.destination}</span>
            <span className="font-mono text-sm text-foreground">
              {row.settlementDetails ?? a.destinationUnset}
            </span>
          </div>
          <Separator />
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-xs text-muted-foreground">
              {a.markedByLabel}
            </span>
            <span className="font-mono text-xs text-foreground">
              {row.markedBy ?? a.notMarked}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-xs text-muted-foreground">{a.markedOn}</span>
            <span className="text-sm text-foreground">
              {row.markedAt
                ? new Date(row.markedAt).toLocaleString(locale)
                : a.notMarked}
            </span>
          </div>
          {row.note ? (
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-xs text-muted-foreground">{a.noteLabel}</span>
              <span className="text-sm text-foreground">{row.note}</span>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* ---------------------------------------------------------------- */}

      <section className="grid gap-3">
        <h3 className="text-base font-semibold text-foreground">
          {a.linesBehind}
        </h3>

        {lines.length === 0 ? (
          <ListState state="empty" title={a.noLines} />
        ) : (
          <ResponsiveList
            rows={lines}
            columns={columns}
            getRowKey={(line) => line.id}
          />
        )}

        <p className="text-sm text-muted-foreground">
          {hasMore
            ? a.linesLoaded.replace("{n}", String(lines.length))
            : a.linesAllLoaded}
        </p>

        {lineError ? (
          <div
            role="alert"
            data-testid="lines-inline-error"
            className="flex flex-wrap items-center gap-3 rounded-md border border-state-bad-border bg-state-bad-bg/40 px-3 py-2"
          >
            <span className="text-sm text-foreground">{a.pageFailedBody}</span>
            <Button variant="outline" size="sm" onClick={loadMoreLines}>
              {a.retry}
            </Button>
          </div>
        ) : null}

        {hasMore && !lineError ? (
          <Button
            variant="outline"
            className="min-h-11 justify-self-start"
            disabled={loadingLines}
            onClick={loadMoreLines}
          >
            {loadingLines ? a.saving : a.loadMore}
          </Button>
        ) : null}

        {/* The verdict. Four outcomes, and never a guess. */}
        {verdict.kind === "uncheckable" ? (
          <Alert data-sum="uncheckable">
            <AlertTitle>{a.cannotCheckSum}</AlertTitle>
          </Alert>
        ) : null}

        {verdict.kind === "incomplete" ? (
          <Alert data-sum="incomplete">
            <AlertTitle>{a.linesMoreToLoad}</AlertTitle>
            {verdict.total ? (
              <AlertDescription>
                {a.linesSumLabel}: {formatMoney(verdict.total, { withSign: true })}
              </AlertDescription>
            ) : null}
          </Alert>
        ) : null}

        {verdict.kind === "agrees" ? (
          <Alert data-sum="agrees">
            <AlertTitle>{a.linesAgree}</AlertTitle>
            <AlertDescription>
              {a.linesSumLabel}: {formatMoney(verdict.total, { withSign: true })}
            </AlertDescription>
          </Alert>
        ) : null}

        {verdict.kind === "disagrees" ? (
          <Alert
            data-sum="disagrees"
            role="alert"
            className="border-state-bad-border bg-state-bad-bg/40"
          >
            <AlertTitle>{a.linesDisagree}</AlertTitle>
            <AlertDescription>
              {a.linesSumLabel}: {formatMoney(verdict.total, { withSign: true })}
            </AlertDescription>
          </Alert>
        ) : null}
      </section>

      {/* ---------------------------------------------------------------- */}

      <section className="grid gap-3">
        <Alert>
          <AlertTitle>{a.noWayBackTitle}</AlertTitle>
          <AlertDescription>{a.noWayBackBody}</AlertDescription>
        </Alert>

        {marks.length === 0 ? (
          <p role="status" className="text-sm text-muted-foreground">
            {a.alreadyMarked}
          </p>
        ) : (
          <>
            <div className="grid gap-2">
              <label
                htmlFor="settlement-note"
                className="text-sm font-medium text-foreground"
              >
                {a.noteLabel}
              </label>
              <Textarea
                id="settlement-note"
                value={note}
                placeholder={a.notePlaceholder}
                onChange={(event) => setNote(event.target.value)}
              />
              {!isNoteAcceptable(note) ? (
                <p role="status" className="text-sm text-state-bad-fg">
                  {a.saveFailed}
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              {marks.map((value) => (
                <Button
                  key={value}
                  variant={value === "CANCELLED" ? "outline" : "default"}
                  className="min-h-11"
                  disabled={!isNoteAcceptable(note)}
                  onClick={() => setMark(value)}
                >
                  {markLabel[value]}
                </Button>
              ))}
            </div>
          </>
        )}

        {markError ? (
          <p role="alert" className="text-sm text-state-bad-fg">
            {markError}
          </p>
        ) : null}
      </section>

      {mark ? (
        <DestructiveSheet
          open
          onOpenChange={(open) => {
            if (!open) setMark(null);
          }}
          title={markCopy[mark].title}
          description={markCopy[mark].description}
          consequences={markCopy[mark].consequences}
          confirmLabel={markCopy[mark].confirm}
          cancelLabel={a.keepRun}
          onConfirm={confirmMark}
        >
          {/*
            The disagreement is repeated INSIDE the sheet. Somebody who scrolled
            past it on the way to the button has to see it again with their
            thumb already over the confirm.
          */}
          {verdict.kind === "disagrees" ? (
            <p role="alert" className="text-sm font-medium text-state-bad-fg">
              {a.linesDisagree}
            </p>
          ) : null}
          {verdict.kind !== "agrees" && verdict.kind !== "disagrees" ? (
            <p role="status" className="text-sm text-state-wait-fg">
              {verdict.kind === "uncheckable"
                ? a.cannotCheckSum
                : a.linesMoreToLoad}
            </p>
          ) : null}
        </DestructiveSheet>
      ) : null}
    </div>
  );
}

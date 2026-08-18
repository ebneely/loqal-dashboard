"use client";

/**
 * /money — the balance, the lines behind it, the runs that clear it, and the
 * invoices the shop files its own tax with.
 *
 * Composed from the domain layer: MoneyRow, ResponsiveList, StatusPill,
 * ListState — plus shadcn's Tabs, Card and Button. Nothing here is a new
 * primitive.
 *
 * THE RULE THIS SCREEN IS BUILT AROUND: money is BRAND_OWNER only, and for
 * anyone else the answer is ABSENT rather than empty, greyed or blurred. The
 * nav entry is already gone for an employee; this screen holds the same line
 * one level down, because the nav is cosmetic and a URL can be typed. An
 * employee who reaches /money directly gets a denied panel and NO tabs — not a
 * disabled Ledger tab, which would still tell a counter assistant that a
 * settlement account exists and roughly what it holds.
 *
 * The second rule is the one this screen exists to make readable: the balance
 * is SIGNED and it genuinely goes both ways. Card orders settle to Loqal and
 * cash orders settle to the brand, so the same shop is owed money one week and
 * owes it the next. MoneyRow names the party in words for exactly that reason —
 * "negative" is a fact about a number, "you owe Loqal" is what a shop owner
 * reads off a phone with a customer at the counter.
 *
 * The third is that nothing on this screen writes. The ledger is append-only,
 * so there is no edit and no delete anywhere — absent, not disabled. And a
 * brand cannot mark its own settlement: there is no such route, and a button
 * would be an offer the API refuses.
 */
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import type { LedgerEntry } from "@loqal/contracts/ledger.contract";
import type { InvoiceListItem } from "@loqal/contracts/invoice.contract";
import type { SettlementRun } from "@loqal/contracts/settlement.contract";

import {
  ListState,
  MoneyRow,
  ResponsiveList,
  StatusPill,
  listStateFor,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSession } from "@/lib/auth-client";
import { useLocale, useMessages } from "@/lib/locale-context";
import { formatMoney } from "@/lib/money";
import type { Messages } from "@/messages";

import {
  useBrandBalance,
  useInvoiceDocument,
  useInvoices,
  useLedger,
  useSettlements,
} from "./money-data";
import {
  formatDay,
  formatMoment,
  formatPeriod,
  invoiceIssueState,
  moneyTabFrom,
  reversedOrders,
  type MoneyTab,
} from "./money-rules";

/**
 * A page of rows that failed to grow.
 *
 * Every list screen shipped so far runs `listStateFor(feed.error)` and returns
 * a full-page error, which throws away rows already on screen when a LATER page
 * fails. `useCursorFeed` deliberately keeps them, so the failure is drawn
 * INLINE beside the rows that did load — a short list with a retry is a better
 * answer than an empty screen, and on a ledger it is the difference between
 * "here are 20 of your lines" and "your money is gone".
 */
function InlineRetry({ t, onRetry }: { t: Messages; onRetry: () => void }) {
  return (
    <div
      role="alert"
      data-testid="money-inline-retry"
      className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-state-bad-border bg-state-bad-bg/40 px-3 py-2"
    >
      <p className="text-sm text-foreground">{t.brand.errorBody}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        {t.brand.retry}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// a. Balance — the hero
// ---------------------------------------------------------------------------

function BalancePanel({ t, isOwner }: { t: Messages; isOwner: boolean }) {
  const b = t.brand;
  const balance = useBrandBalance(isOwner);
  const state = listStateFor(balance.error, { isLoading: balance.isLoading });

  if (state === "loading") return <ListState state="loading" rows={1} />;

  if (state === "denied") {
    return (
      <ListState
        state="denied"
        title={b.deniedTitle}
        body={b.deniedBody}
        requiredRole="BRAND_OWNER"
      />
    );
  }

  if (state === "error" || !balance.data) {
    return (
      <ListState
        state="error"
        title={b.balanceErrorTitle}
        body={b.errorBody}
        actionLabel={b.retry}
        onAction={balance.reload}
      />
    );
  }

  const asOf = formatMoment(balance.data.asOf);

  return (
    <div className="grid gap-3" data-testid="money-balance">
      {/*
        `variant="hero"` and `perspective="brand"`: this is the shop's own
        books, so the wording is "Loqal owes you" / "You owe Loqal" rather than
        the admin console's third person. The amount is passed as the STRING the
        contract sent — parsing it to a float here is how a ledger stops
        agreeing with a bank statement.
      */}
      <MoneyRow
        amount={balance.data.amount}
        perspective="brand"
        variant="hero"
        note={b.balanceSub}
      />

      <dl className="grid gap-1 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <dt>{b.balanceAsOf}</dt>
          <dd className="font-mono tabular-nums">{asOf ?? "—"}</dd>
        </div>
      </dl>

      {/*
        Said out loud rather than left to be noticed. The same shop flips
        between the two directions in consecutive weeks and a reader who thinks
        one of them is a fault will ring Loqal about a correct number.
      */}
      <p className="text-sm text-muted-foreground">{b.balanceBothWays}</p>
      <p className="text-xs text-muted-foreground">{b.shippingNote}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// b. Ledger — append-only
// ---------------------------------------------------------------------------

function LedgerPanel({
  t,
  enabled,
}: {
  t: Messages;
  enabled: boolean;
}) {
  const b = t.brand;
  const feed = useLedger(enabled);
  const rows = feed.rows;

  /** Which refund lines reverse a sale that is also on screen. */
  const reversals = reversedOrders(rows);

  const state = listStateFor(feed.error, {
    isLoading: feed.isLoading,
    isEmpty: rows.length === 0,
  });

  const columns: readonly ResponsiveListColumn<LedgerEntry>[] = [
    {
      key: "entry",
      header: b.entry,
      cell: (entry) => (
        <span>{entry.note ?? b.ledgerType[entry.type]}</span>
      ),
      primary: true,
    },
    {
      key: "reference",
      header: b.order,
      cell: (entry) =>
        entry.orderNumber ? (
          <span className="font-mono">#{entry.orderNumber}</span>
        ) : (
          /* A payout or a brand payment closes a period, not a sale. It has no
             order and must not borrow one. */
          <span>{b.ledgerNoOrder}</span>
        ),
      meta: true,
    },
    {
      key: "reversal",
      header: b.ledgerReversal,
      /*
        The one thing on this screen that reads as a mistake and is not: a sale
        and its refund side by side on the same order. Both lines stay, because
        a correction is a new entry rather than an edit, so the refund says so
        in words instead of leaving a shop owner to conclude they were charged
        twice.
      */
      cell: (entry) => {
        const reversed = reversals.get(entry.id);
        if (!reversed) return null;
        return (
          <span className="rounded-md border border-state-neutral-border bg-state-neutral-bg px-2 py-0.5 text-state-neutral-fg">
            {b.ledgerReversalOf.replace("{n}", reversed)}
          </span>
        );
      },
      meta: true,
    },
    {
      key: "type",
      header: b.type,
      cell: (entry) => b.ledgerType[entry.type],
    },
    {
      key: "when",
      header: b.placed,
      cell: (entry) => formatDay(entry.createdAt) ?? "—",
    },
    {
      key: "amount",
      header: b.amount,
      /*
        Signed, and the party is in the accessible name rather than in a minus
        sign alone — MoneyRow's inline variant carries "You owe Loqal: −20.00
        EGP" to a screen reader even where the column has no room to print it.
      */
      cell: (entry) => (
        <MoneyRow amount={entry.amount} variant="inline" perspective="brand" />
      ),
      numeric: true,
    },
  ];

  return (
    <div className="grid gap-3" data-testid="money-ledger">
      <p className="text-sm text-muted-foreground">{b.ledgerNote}</p>
      {/*
        There is no edit control, no delete control and no "fix this" anywhere
        below — not disabled, absent. This sentence is what stands in their
        place, because a shop owner who cannot find the edit button needs to be
        told that is deliberate.
      */}
      <p className="text-sm text-muted-foreground">{b.ledgerAppendOnly}</p>

      {state === "loading" ? <ListState state="loading" rows={4} /> : null}

      {state === "denied" ? (
        <ListState
          state="denied"
          title={b.deniedTitle}
          body={b.deniedBody}
          requiredRole="BRAND_OWNER"
        />
      ) : null}

      {state === "error" ? (
        <ListState
          state="error"
          title={b.ledgerErrorTitle}
          body={b.errorBody}
          actionLabel={b.retry}
          onAction={feed.reload}
        />
      ) : null}

      {state === "empty" ? (
        <ListState
          state="empty"
          title={b.ledgerEmptyTitle}
          body={b.ledgerEmptyBody}
        />
      ) : null}

      {rows.length > 0 ? (
        <>
          <ResponsiveList
            rows={rows}
            columns={columns}
            getRowKey={(entry) => entry.id}
            /* Navigation, never editing. A line that closes a period has no
               order behind it, so it gets no address rather than a guessed one. */
            getRowHref={(entry) =>
              entry.brandOrderId ? `/orders/${entry.brandOrderId}` : null
            }
            caption={b.ledgerTitle}
          />
          {/* A later page failing must not throw away the rows already read. */}
          {feed.error ? <InlineRetry t={t} onRetry={feed.reload} /> : null}
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
        </>
      ) : null}

      {/* Loqal runs no fulfilment and pays no courier. A delivery fee in this
          list would mean money we never collected. */}
      <p className="text-xs text-muted-foreground">{b.shippingNote}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// c. Settlements — read-only to the brand
// ---------------------------------------------------------------------------

function SettlementsPanel({ t, enabled }: { t: Messages; enabled: boolean }) {
  const b = t.brand;
  const locale = useLocale();
  const feed = useSettlements(enabled);
  const rows = feed.rows;

  const state = listStateFor(feed.error, {
    isLoading: feed.isLoading,
    isEmpty: rows.length === 0,
  });

  const columns: readonly ResponsiveListColumn<SettlementRun>[] = [
    {
      key: "period",
      header: b.period,
      cell: (run) => (
        <span className="font-mono">
          {formatPeriod(run.periodStart, run.periodEnd)}
        </span>
      ),
      primary: true,
    },
    {
      key: "direction",
      header: b.direction,
      /* The party, in words. WE_PAY and THEY_PAY are Loqal's vocabulary and
         mean nothing on a shop's phone. */
      cell: (run) =>
        run.direction === "WE_PAY" ? b.settlementWePay : b.settlementTheyPay,
      meta: true,
    },
    {
      key: "status",
      header: b.status,
      cell: (run) => (
        <StatusPill
          kind="SettlementStatus"
          value={run.status}
          size="sm"
          locale={locale}
        />
      ),
    },
    {
      key: "method",
      header: b.method,
      cell: (run) =>
        run.settlementMethod
          ? b.settlementMethodOpt[run.settlementMethod]
          : b.notSet,
      tableOnly: true,
    },
    {
      key: "marked",
      header: b.settlementMarked,
      cell: (run) => formatDay(run.markedAt) ?? "—",
      tableOnly: true,
    },
    {
      key: "net",
      header: b.net,
      cell: (run) => (
        <MoneyRow amount={run.netAmount} variant="inline" perspective="brand" />
      ),
      numeric: true,
    },
  ];

  return (
    <div className="grid gap-3" data-testid="money-settlements">
      <p className="text-sm text-muted-foreground">{b.settlementsNote}</p>
      {/*
        No control below marks anything, and that is the point rather than an
        omission: nothing in this business moves money on its own, a human at
        Loqal marks a run sent or received, and a brand marking its own would be
        a shop confirming it had been paid.
      */}
      <p className="text-sm text-muted-foreground">{b.settlementNoAction}</p>

      {state === "loading" ? <ListState state="loading" rows={3} /> : null}

      {state === "denied" ? (
        <ListState
          state="denied"
          title={b.deniedTitle}
          body={b.deniedBody}
          requiredRole="BRAND_OWNER"
        />
      ) : null}

      {state === "error" ? (
        <ListState
          state="error"
          title={b.settlementsErrorTitle}
          body={b.errorBody}
          actionLabel={b.retry}
          onAction={feed.reload}
        />
      ) : null}

      {state === "empty" ? (
        <ListState
          state="empty"
          title={b.settlementsEmptyTitle}
          body={b.settlementsEmptyBody}
        />
      ) : null}

      {rows.length > 0 ? (
        <>
          <ResponsiveList
            rows={rows}
            columns={columns}
            getRowKey={(run) => run.id}
            caption={b.settlementsTitle}
          />
          {feed.error ? <InlineRetry t={t} onRetry={feed.reload} /> : null}
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
        </>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// d. Invoices — raised is not issued
// ---------------------------------------------------------------------------

/**
 * The document cell.
 *
 * `raisedAt` and `issuedAt` are two different moments. The row is raised when
 * the brand order completes; the PDF is rendered afterwards by a worker, and
 * until that succeeds there is nothing to issue and nothing to download. So a
 * raised invoice is never described as issued and is offered no download —
 * absent, not disabled, because a greyed download button is a promise that the
 * file is nearly there.
 *
 * FAILED gets its own visible state rather than folding into "not yet": one is
 * a document that is coming and the other is a document that is not.
 */
function InvoiceDocument({
  invoice,
  t,
  doc,
}: {
  invoice: InvoiceListItem;
  t: Messages;
  doc: ReturnType<typeof useInvoiceDocument>;
}) {
  const b = t.brand;
  const issue = invoiceIssueState(invoice);

  if (issue === "failed") {
    return (
      <span className="text-state-bad-fg">{b.invoiceFailed}</span>
    );
  }

  if (issue === "awaitingDocument") {
    return <span className="text-muted-foreground">{b.invoiceNotIssued}</span>;
  }

  return (
    <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <span className="font-mono tabular-nums">
        {formatDay(invoice.issuedAt) ?? "—"}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={doc.pendingId === invoice.id}
        onClick={() => void doc.open(invoice.id)}
      >
        {b.invoiceDownload}
      </Button>
    </span>
  );
}

function InvoicesPanel({ t, enabled }: { t: Messages; enabled: boolean }) {
  const b = t.brand;
  const feed = useInvoices(enabled);
  const doc = useInvoiceDocument();
  const rows = feed.rows;

  const state = listStateFor(feed.error, {
    isLoading: feed.isLoading,
    isEmpty: rows.length === 0,
  });

  const columns: readonly ResponsiveListColumn<InvoiceListItem>[] = [
    {
      key: "reference",
      header: b.invoiceRef,
      cell: (invoice) => (
        <span className="font-mono">{invoice.reference}</span>
      ),
      primary: true,
    },
    {
      key: "order",
      header: b.order,
      cell: (invoice) => (
        <span className="font-mono">#{invoice.orderNumber}</span>
      ),
      meta: true,
    },
    {
      key: "raised",
      header: b.invoiceRaised,
      cell: (invoice) => formatDay(invoice.raisedAt) ?? "—",
    },
    {
      key: "issued",
      header: b.invoiceIssued,
      cell: (invoice) => (
        <InvoiceDocument invoice={invoice} t={t} doc={doc} />
      ),
    },
    {
      key: "net",
      header: b.net,
      cell: (invoice) => formatMoney(invoice.netAmount),
      numeric: true,
    },
  ];

  return (
    <div className="grid gap-3" data-testid="money-invoices">
      <p className="text-sm text-muted-foreground">{b.invoicesNote}</p>
      <p className="text-sm text-muted-foreground">{b.invoiceRaisedNote}</p>

      {state === "loading" ? <ListState state="loading" rows={3} /> : null}

      {state === "denied" ? (
        <ListState
          state="denied"
          title={b.deniedTitle}
          body={b.deniedBody}
          requiredRole="BRAND_OWNER"
        />
      ) : null}

      {/*
        KNOWN AND SHOWN. This endpoint answers 503 today — the `Invoice` model
        has not been added to the schema yet — so this is the state a shop owner
        will actually see. It says so in its own words rather than borrowing
        "check your connection", which would send someone to restart a router
        over a pending migration. No row is stubbed to fill the gap: a shop
        files tax against these.
      */}
      {state === "error" ? (
        <ListState
          state="error"
          title={b.invoicesUnavailableTitle}
          body={b.invoicesUnavailableBody}
          actionLabel={b.retry}
          onAction={feed.reload}
        />
      ) : null}

      {state === "empty" ? (
        <ListState
          state="empty"
          title={b.invoicesEmptyTitle}
          body={b.invoicesEmptyBody}
        />
      ) : null}

      {rows.length > 0 ? (
        <>
          <ResponsiveList
            rows={rows}
            columns={columns}
            getRowKey={(invoice) => invoice.id}
            getRowHref={(invoice) => `/orders/${invoice.brandOrderId}`}
            caption={b.invoicesTitle}
          />
          {doc.failed ? (
            <p role="alert" className="text-sm text-destructive">
              {b.invoiceDownloadFailed}
            </p>
          ) : null}
          {feed.error ? <InlineRetry t={t} onRetry={feed.reload} /> : null}
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
        </>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The screen
// ---------------------------------------------------------------------------

export function MoneyScreen() {
  const t = useMessages();
  const b = t.brand;
  const router = useRouter();
  const params = useSearchParams();
  const { data: session, isPending } = useSession();

  /**
   * Least privilege, the same rule the shell and /today use. Only the literal
   * string BRAND_OWNER opens this screen: SALES, SUPER_ADMIN and any role this
   * build has never heard of are treated as an employee, because the failure
   * mode of guessing wrong in the other direction is a shop's balance shown to
   * somebody who was never meant to see it.
   */
  const isOwner = session?.user?.role === "BRAND_OWNER";

  const [fallbackTab, setFallbackTab] = useState<MoneyTab>("balance");
  const tab = moneyTabFrom(params.get("tab") ?? fallbackTab);

  const onTab = (value: string) => {
    const next = moneyTabFrom(value);
    setFallbackTab(next);
    const query = new URLSearchParams(params.toString());
    if (next === "balance") query.delete("tab");
    else query.set("tab", next);
    const search = query.toString();
    router.replace(search ? `/money?${search}` : "/money");
  };

  /**
   * Nothing is drawn until the role is known. Rendering the tabs optimistically
   * and correcting them a tick later would flash "Ledger" and "Settlements" at
   * an employee on every cold load, and a flash is a leak.
   */
  if (isPending) return <ListState state="loading" rows={3} />;

  /**
   * ABSENT, NOT DISABLED.
   *
   * An employee gets the denied panel and nothing else: no tab list, no balance
   * card, no ledger, no settlements, no invoices. A greyed Ledger tab would
   * still be an answer to "does this shop have a settlement account", and a
   * shop that hands someone a counter login has not agreed to answer that.
   *
   * A toast would be wrong for a second reason: it fades, and whoever is left
   * looking at a blank screen cannot tell whether the data is missing or they
   * are. The panel stays and names the role that would have been allowed.
   */
  if (!isOwner) {
    return (
      <ListState
        state="denied"
        title={b.deniedTitle}
        body={b.deniedBody}
        requiredRole="BRAND_OWNER"
      />
    );
  }

  return (
    <div className="grid gap-4">
      <Card className="border-border/60 shadow-none">
        <CardHeader className="gap-1">
          <CardTitle className="text-base">{b.moneyTitle}</CardTitle>
          <CardDescription>{b.moneyOwnerNote}</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <Tabs value={tab} onValueChange={onTab}>
            <TabsList className="w-full">
              <TabsTrigger value="balance">{b.balance}</TabsTrigger>
              <TabsTrigger value="ledger">{b.ledgerTitle}</TabsTrigger>
              <TabsTrigger value="settlements">
                {b.settlementsTitle}
              </TabsTrigger>
              <TabsTrigger value="invoices">{b.invoicesTitle}</TabsTrigger>
            </TabsList>

            {/*
              Each list is fetched only while its own tab is open. Four lists
              pulled at once would put three refusals in the API's log for
              screens nobody looked at, and the balance — the one figure this
              screen is about — would queue behind them.
            */}
            <TabsContent value="balance" className="pt-4">
              <BalancePanel t={t} isOwner={isOwner} />
            </TabsContent>
            <TabsContent value="ledger" className="pt-4">
              <LedgerPanel t={t} enabled={tab === "ledger"} />
            </TabsContent>
            <TabsContent value="settlements" className="pt-4">
              <SettlementsPanel t={t} enabled={tab === "settlements"} />
            </TabsContent>
            <TabsContent value="invoices" className="pt-4">
              <InvoicesPanel t={t} enabled={tab === "invoices"} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

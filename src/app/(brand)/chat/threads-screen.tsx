"use client";

/**
 * /chat — every conversation this shop has, ranked by who has waited longest.
 *
 * Composed from the domain layer: ResponsiveList, ListState, MobileActionBar —
 * plus shadcn's Card, Badge, Progress, Alert and Button.
 *
 * The screen makes two decisions of its own, and both are about being honest
 * with a thinner API than the design mockup assumed:
 *
 *  a. THERE IS NO UNREAD COUNT. The thread row carries no `unreadCount` and no
 *     `lastSenderType`, so "3 unread" is not a number this screen can compute,
 *     and printing one would be a guess shown as a fact. What the API does
 *     carry is `oldestUnansweredMessageAt` — when the shopper's current wait
 *     started — so the list ranks and labels by WAIT, and says in as many words
 *     that the count is missing rather than quietly implying it is zero.
 *
 *  b. A FAILED REFRESH KEEPS THE LIST. Every other list screen maps any error
 *     to a full-page panel, which throws away rows already on screen. Here a
 *     refresh that fails over rows that loaded renders an inline retry above
 *     the list it still has; only a first load with nothing to show, or a 403,
 *     takes the whole screen.
 */
import Link from "next/link";
import { useMemo } from "react";

import {
  ListState,
  MobileActionBar,
  MobileActionBarSpacer,
  ResponsiveList,
  listStateFor,
  type ResponsiveListColumn,
} from "@/components/loqal";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useMessages } from "@/lib/locale-context";
import { waitedLabel } from "@/lib/waited";

import { useBrandThreads } from "./chat-data";
import {
  byLongestUnanswered,
  escalationFor,
  longestWaiting,
  partyOf,
  remainingLabel,
  type BrandThread,
} from "./chat-wire";

export function ThreadsScreen() {
  const t = useMessages();
  const b = t.brand;

  const feed = useBrandThreads();

  /**
   * One clock for the whole render, re-read when new rows arrive. Reading
   * Date.now() per row would let two conversations one second apart land on
   * opposite sides of a minute boundary.
   */
  const now = useMemo(
    () => Date.now(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [feed.rows]
  );

  const rows = useMemo(
    () => byLongestUnanswered(feed.rows, now),
    [feed.rows, now]
  );

  const oldest = useMemo(() => longestWaiting(rows, now), [rows, now]);

  /*
    `isEmpty` is answered from the rows actually on screen, and the inline case
    is subtracted from the full-page one below. A stale list is a list, not an
    error panel.
  */
  const state = listStateFor(feed.error, {
    isLoading: feed.isLoading,
    isEmpty: rows.length === 0,
  });
  const fullPageState = feed.isStale ? null : state;

  /** The threshold is the API's, per thread. Any row can tell us what it is. */
  const thresholdMinutes = rows[0]?.unansweredThresholdMinutes ?? null;

  const partyLabel = (thread: BrandThread) => {
    const party = partyOf(thread);
    if (party === "GUEST") return b.chatPartyGuest;
    if (party === "SHOPPER") return b.chatPartyShopper;
    return b.chatPartyUnknown;
  };

  const escalationCell = (thread: BrandThread) => {
    const escalation = escalationFor(thread, now);

    if (escalation.stage === "quiet") {
      return <span className="text-muted-foreground">{b.chatQuiet}</span>;
    }

    if (escalation.stage === "escalated") {
      return (
        <Badge variant="destructive" data-testid="chat-escalated">
          {b.chatEscalated}
        </Badge>
      );
    }

    const left = remainingLabel(escalation.minutesLeft, t);
    return (
      <span className="grid w-full min-w-24 gap-1" data-testid="chat-countdown">
        <span className="text-foreground">
          {b.chatEscalatesIn.replace("{t}", left ?? "")}
        </span>
        <Progress
          value={escalation.percent}
          aria-label={b.chatEscalationColumn}
        />
      </span>
    );
  };

  const columns: readonly ResponsiveListColumn<BrandThread>[] = [
    {
      key: "party",
      header: b.chatParty,
      // The row's own address, so it is a real anchor at both breakpoints —
      // ResponsiveList stretches it over the card and the cell.
      cell: (thread) => (
        <span className="font-semibold text-foreground">
          {partyLabel(thread)}
        </span>
      ),
      primary: true,
    },
    {
      key: "waitingFlag",
      header: b.status,
      cell: (thread) =>
        thread.oldestUnansweredMessageAt ? (
          <Badge variant="secondary">{b.chatWaitingOnYou}</Badge>
        ) : (
          <span className="text-muted-foreground">{b.chatQuiet}</span>
        ),
      meta: true,
    },
    {
      key: "waited",
      header: b.chatWaitColumn,
      cell: (thread) => {
        const label = waitedLabel(thread.oldestUnansweredMessageAt, t, now);
        return label ? b.chatWaitedFor.replace("{t}", label) : "—";
      },
    },
    {
      key: "escalation",
      header: b.chatEscalationColumn,
      cell: escalationCell,
    },
    {
      key: "lastMessage",
      header: b.chatLastMessageColumn,
      cell: (thread) => {
        const label = waitedLabel(thread.lastMessageAt, t, now);
        return label
          ? b.chatLastMessageAgo.replace("{t}", label)
          : b.chatNeverMessaged;
      },
      tableOnly: true,
    },
  ];

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <p className="text-sm text-muted-foreground">{b.chatInboxNote}</p>
        {/*
          The missing count, named. The design system's copy says "Unread chat"
          and "oldest 22 min"; neither is renderable from this payload, and a
          shop owner is better served by knowing that than by a number nobody
          computed.
        */}
        <p className="text-xs text-muted-foreground" data-testid="chat-no-count">
          {b.chatNoCount}
        </p>
        <p className="text-xs text-muted-foreground">{b.chatNoNames}</p>
        {thresholdMinutes !== null ? (
          <p
            className="text-xs text-muted-foreground"
            data-testid="chat-threshold-note"
          >
            {b.chatEscalationRule.replace("{n}", String(thresholdMinutes))}{" "}
            {b.chatThresholdSource.replace("{n}", String(thresholdMinutes))}
          </p>
        ) : null}
      </div>

      <section aria-label={b.chatInboxTitle} className="grid gap-3">
        {fullPageState === "loading" ? (
          <ListState state="loading" rows={4} />
        ) : null}

        {fullPageState === "error" ? (
          <ListState
            state="error"
            title={b.chatErrorTitle}
            body={b.errorBody}
            actionLabel={b.retry}
            onAction={feed.reload}
          />
        ) : null}

        {fullPageState === "denied" ? (
          <ListState
            state="denied"
            title={b.chatOnlyTitle}
            body={b.chatOnlyBody}
            requiredRole="BRAND_OWNER"
          />
        ) : null}

        {fullPageState === "empty" ? (
          <ListState
            state="empty"
            title={b.chatThreadsEmptyTitle}
            body={b.chatThreadsEmptyBody}
          />
        ) : null}

        {/*
          The inline retry. Rows survived the failed read, so the list is drawn
          below this and the failure is a strip above it rather than a panel
          instead of it.
        */}
        {feed.isStale ? (
          <Alert variant="destructive" data-testid="chat-stale">
            <AlertTitle>{b.chatStaleTitle}</AlertTitle>
            <AlertDescription>{b.chatStaleBody}</AlertDescription>
            <div className="mt-2">
              <Button
                variant="outline"
                size="sm"
                className="min-h-11"
                onClick={feed.reload}
              >
                {b.retry}
              </Button>
            </div>
          </Alert>
        ) : null}

        {rows.length > 0 ? (
          <>
            <ResponsiveList
              rows={rows}
              columns={columns}
              getRowKey={(thread) => thread.id}
              getRowHref={(thread) => `/chat/${thread.id}`}
              caption={b.chatInboxTitle}
            />
            <Button
              variant="outline"
              className="min-h-11 justify-self-start"
              onClick={feed.reload}
            >
              {b.chatRefresh}
            </Button>
          </>
        ) : null}
      </section>

      {oldest ? (
        <>
          <MobileActionBar hint={b.chatAnswerHint}>
            <span className="block" data-testid="chat-action-bar">
              <Button asChild className="min-h-14 w-full text-base">
                <Link href={`/chat/${oldest.id}`}>{b.chatAnswerOldest}</Link>
              </Button>
            </span>
          </MobileActionBar>
          <MobileActionBarSpacer />
        </>
      ) : null}
    </div>
  );
}

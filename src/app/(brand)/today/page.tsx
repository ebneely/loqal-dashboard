"use client";

/**
 * /today — a prioritised feed of what needs a human, not a metrics dashboard.
 *
 * Composed from the domain layer: ListState, MobileActionBar and the sections
 * beside this file. No shadcn primitive is used here directly.
 *
 * The order is the argument:
 *
 *  a. Orders awaiting a shelf check.  The hero, and the only thing on this
 *     screen where the shop is what stands between a shopper and their order.
 *     Stock in this business is held, never committed, because the platform's
 *     number is a copy of what the shop last told us — so nothing is promised
 *     until a person has looked at the shelf.
 *  b. Orders packed and waiting to be handed over. Already moving; the shop's
 *     part is done and somebody else's has not started.
 *  c. Low stock per variant. Worth knowing today, costs a sale next week.
 *  d. Customer chats. Answerable whenever; nobody is blocked on it.
 *  e. Balance. Owner only, and never urgent — money that is already earned.
 *
 * The whole feed's state comes from the hero's query, because a screen whose
 * headline failed to load has nothing useful to say underneath it. The balance
 * is deliberately outside that: it is a separate grant, it can be refused on
 * its own, and it must not take the feed down with it or be taken down by it.
 */
import Link from "next/link";
import { useMemo } from "react";

import {
  ListState,
  MobileActionBar,
  MobileActionBarSpacer,
  listStateFor,
} from "@/components/loqal";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/auth-client";
import { useLocale, useMessages } from "@/lib/locale-context";

import {
  BalanceSection,
  ChatSection,
  LowStockSection,
  PackedSection,
  ShelfCheckSection,
  oldestWaiting,
} from "./sections";
import {
  useBalance,
  useChatThreads,
  useLowStockVariants,
  usePackedOrders,
  useShelfCheckOrders,
} from "./today-data";

export default function TodayPage() {
  const t = useMessages();
  const b = t.brand;
  const locale = useLocale();
  const { data: session } = useSession();

  /**
   * Least privilege, the same rule the shell uses. Only the literal owner role
   * asks for money; SALES, SUPER_ADMIN and anything this build has not heard of
   * are treated as an employee.
   */
  const isOwner = session?.user?.role === "BRAND_OWNER";

  const shelf = useShelfCheckOrders();
  const packed = usePackedOrders();
  const lowStock = useLowStockVariants();
  const chat = useChatThreads();
  const balance = useBalance(isOwner);

  /**
   * One clock for the whole render. Reading Date.now() inside each row would
   * let two orders placed in the same second render "3 h" and "2 h" because the
   * hour boundary fell between them.
   */
  const now = useMemo(
    () => Date.now(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shelf.data, packed.data, chat.data]
  );

  const shelfRows = shelf.data ?? [];
  const packedRows = packed.data ?? [];
  const lowStockRows = lowStock.data ?? [];
  const chatRows = chat.data ?? [];

  const feedLoading =
    shelf.isLoading || packed.isLoading || lowStock.isLoading || chat.isLoading;

  /**
   * The hero's failure is the screen's failure. A 403 on the shelf-check list
   * means this is not a brand account at all, and drawing three cheerful
   * sections under a refusal would be worse than saying so once.
   */
  const feedError =
    shelf.error ?? packed.error ?? lowStock.error ?? chat.error ?? null;

  const feedEmpty =
    shelfRows.length === 0 &&
    packedRows.length === 0 &&
    lowStockRows.length === 0 &&
    chatRows.length === 0;

  const feedState = listStateFor(feedError, {
    isLoading: feedLoading,
    isEmpty: feedEmpty,
  });

  const balanceState = listStateFor(balance.error, {
    isLoading: balance.isLoading,
  });

  const reloadFeed = () => {
    shelf.reload();
    packed.reload();
    lowStock.reload();
    chat.reload();
  };

  const oldest = oldestWaiting(shelfRows, now);

  return (
    <div className="grid gap-6">
      {feedState === "loading" ? <ListState state="loading" rows={3} /> : null}

      {feedState === "error" ? (
        <ListState
          state="error"
          title={b.errorTitle}
          body={b.errorBody}
          actionLabel={b.retry}
          onAction={reloadFeed}
        />
      ) : null}

      {/*
        Denied gets no retry. Pressing it again changes nothing, and a button
        that cannot work is a worse answer than none.
      */}
      {feedState === "denied" ? (
        <ListState state="denied" title={b.deniedTitle} body={b.deniedBody} />
      ) : null}

      {feedState === "empty" ? (
        <ListState
          state="empty"
          title={b.emptyTodayTitle}
          body={b.emptyTodayBody}
        />
      ) : null}

      {feedState === null ? (
        <>
          {shelfRows.length > 0 ? (
            <ShelfCheckSection
              orders={shelfRows}
              t={t}
              locale={locale}
              now={now}
            />
          ) : null}

          {packedRows.length > 0 ? (
            <PackedSection orders={packedRows} t={t} locale={locale} />
          ) : null}

          {lowStockRows.length > 0 ? (
            <LowStockSection variants={lowStockRows} t={t} />
          ) : null}

          {chatRows.length > 0 ? (
            <ChatSection threads={chatRows} t={t} now={now} />
          ) : null}
        </>
      ) : null}

      {/*
        Owner only, and ABSENT for anyone else — not disabled, not blurred, not
        a locked card. A greyed-out balance still tells a counter assistant that
        a payout account exists and roughly what the screen behind it says.
      */}
      {isOwner ? (
        <BalanceSection
          balance={balance}
          state={balanceState}
          t={t}
          locale={locale}
        />
      ) : null}

      {/*
        Thumb reach. The one action worth taking from this screen goes to the
        shopper who has waited longest, and it lives at the bottom of the
        viewport on a phone rather than in the top right of a header that a
        one-handed user has to shuffle the phone down their palm to reach.
      */}
      {oldest ? (
        <>
          <MobileActionBar hint={b.hintConfirm}>
            <span className="block" data-testid="today-action-bar">
              <Button asChild className="min-h-14 w-full text-base">
                <Link href={`/orders/${oldest.id}`}>{b.shelfTitle}</Link>
              </Button>
            </span>
          </MobileActionBar>
          <MobileActionBarSpacer />
        </>
      ) : null}
    </div>
  );
}

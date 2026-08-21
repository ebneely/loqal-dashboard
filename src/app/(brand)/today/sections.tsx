"use client";

/**
 * The five sections of /today, in the order a shop owner needs them.
 *
 * Composed from shadcn primitives: Card (+CardContent/CardHeader/CardTitle/
 * CardDescription), Button, Skeleton — plus the domain layer's ResponsiveList,
 * StatusPill, MoneyRow and ListState. No new primitive is invented here.
 *
 * Every section is a landmark (`<section>` with an accessible name), so a
 * screen-reader user can jump between "orders waiting on a shelf check" and
 * "balance" without walking the whole feed.
 */
import Link from "next/link";
import type { ReactNode } from "react";

import type { BrandOrderListItem } from "@loqal/contracts/order.contract";
import type { BrandBalance } from "@loqal/contracts/ledger.contract";

import {
  ListState,
  MoneyRow,
  ResponsiveList,
  SectionHead,
  StatusPill,
  type ListStateKind,
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
import type { Locale } from "@/lib/locale";
import type { Messages } from "@/messages";

import type { ChatThread, LowStockVariant, Resource } from "./today-data";
import { byLongestWait, waitedFor, waitedLabel } from "./waited";

const orderHref = (order: BrandOrderListItem) => `/orders/${order.id}`;

function Section({
  id,
  label,
  children,
  className,
}: {
  id: string;
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-label={label}
      data-testid={id}
      className={className ?? "grid gap-3"}
    >
      {children}
    </section>
  );
}

/**
 * The order number as a link, used as the primary column of both order lists.
 *
 * A Link rather than a click handler on the whole row: a card that navigates
 * only on click has no keyboard target and no address a shop owner can copy to
 * a driver.
 */
const orderNumberCell = (order: BrandOrderListItem) => (
  <Link
    href={orderHref(order)}
    className="font-mono font-semibold text-foreground underline-offset-4 hover:underline"
  >
    #{order.orderNumber}
  </Link>
);

// ---------------------------------------------------------------------------
// a. The hero.
// ---------------------------------------------------------------------------

/**
 * Orders held against a shelf check.
 *
 * This is the hero because it is the only section where the shop is the thing
 * standing between a shopper and their order. Everything below it is either
 * already moving or merely worth knowing. It is ranked by how long each shopper
 * has waited, not by when the order was placed — those differ the moment an
 * order sits through a payment retry.
 */
export function ShelfCheckSection({
  orders,
  t,
  locale,
  now,
}: {
  orders: readonly BrandOrderListItem[];
  t: Messages;
  locale: Locale;
  now: number;
}) {
  const b = t.brand;
  const ranked = byLongestWait(orders, now);
  const title =
    ranked.length === 1
      ? b.heroTitleOne
      : b.heroTitleMany.replace("{n}", String(ranked.length));

  const columns: readonly ResponsiveListColumn<BrandOrderListItem>[] = [
    {
      key: "orderNumber",
      header: b.order,
      cell: orderNumberCell,
      primary: true,
    },
    {
      key: "itemCount",
      header: b.items,
      cell: (order) => String(order.itemCount),
      numeric: true,
    },
    {
      key: "waited",
      header: b.waiting,
      cell: (order) => waitedLabel(order.waitingSince, t, now) ?? "—",
    },
    {
      key: "action",
      header: b.shelfTitle,
      // The row's one action. Named, not an icon: "confirm against the shelf"
      // is not a thing anyone infers from a chevron.
      cell: (order) => (
        <Button asChild size="sm" className="min-h-11">
          <Link href={orderHref(order)}>{b.actConfirm}</Link>
        </Button>
      ),
    },
  ];

  return (
    <Section id="today-shelf-check" label={title}>
      <Card className="border-state-act-border bg-state-act-bg">
        <CardHeader className="gap-2">
          <div>
            <StatusPill
              kind="BrandOrderStatus"
              value="PENDING_BRAND"
              locale={locale}
            />
          </div>
          <CardTitle className="text-xl">{title}</CardTitle>
          <CardDescription>{b.heroDesc}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {/*
            The caption says what the table is for, not how many rows it has —
            the count is already the card's title right above it, and a screen
            reader reading it twice is noise.
          */}
          <ResponsiveList
            rows={ranked}
            columns={columns}
            getRowKey={(order) => order.id}
            caption={b.shelfTitle}
          />
          {/*
            Rule 1, said out loud on the busiest screen: a brand sees its slice
            and only its slice. There is no basket total in the contract to
            render even by accident.
          */}
          <p className="text-xs text-muted-foreground">{b.sliceOnly}</p>
        </CardContent>
      </Card>
    </Section>
  );
}

/** The oldest wait — what the bottom action bar points at. */
export function oldestWaiting(
  orders: readonly BrandOrderListItem[],
  now: number
): BrandOrderListItem | null {
  return byLongestWait(orders, now)[0] ?? null;
}

// ---------------------------------------------------------------------------
// b. Packed.
// ---------------------------------------------------------------------------

export function PackedSection({
  orders,
  t,
  locale,
}: {
  orders: readonly BrandOrderListItem[];
  t: Messages;
  locale: Locale;
}) {
  const b = t.brand;

  const columns: readonly ResponsiveListColumn<BrandOrderListItem>[] = [
    { key: "orderNumber", header: b.order, cell: orderNumberCell, primary: true },
    {
      key: "status",
      header: b.status,
      cell: (order) => (
        <StatusPill
          kind="BrandOrderStatus"
          value={order.status}
          size="sm"
          locale={locale}
        />
      ),
      meta: true,
    },
    {
      key: "itemCount",
      header: b.items,
      cell: (order) => String(order.itemCount),
      numeric: true,
    },
    {
      key: "route",
      header: b.route,
      cell: (order) =>
        order.deliveryMethod === "BRAND_OWN_DELIVERY" ? b.routeOwn : b.routeRider,
    },
  ];

  return (
    <Section id="today-packed" label={b.packedTitle}>
      <SectionHead title={b.packedTitle} sub={b.packedSub} />
      <ResponsiveList
        rows={orders}
        columns={columns}
        getRowKey={(order) => order.id}
        caption={b.packedTitle}
      />
    </Section>
  );
}

// ---------------------------------------------------------------------------
// c. Low stock.
// ---------------------------------------------------------------------------

export function LowStockSection({
  variants,
  t,
}: {
  variants: readonly LowStockVariant[];
  t: Messages;
}) {
  const b = t.brand;

  const columns: readonly ResponsiveListColumn<LowStockVariant>[] = [
    {
      key: "sku",
      header: b.sku,
      cell: (row) => <span className="font-mono">{row.sku}</span>,
      primary: true,
    },
    {
      key: "product",
      header: b.product,
      // One language may legitimately be absent — the catalog import rule is
      // "at least one of ar/en", never both.
      cell: (row) => row.productName.en ?? row.productName.ar ?? "—",
      meta: true,
    },
    {
      key: "stock",
      header: b.onHand,
      cell: (row) => String(row.stockOnHand),
      numeric: true,
    },
  ];

  return (
    <Section id="today-low-stock" label={b.lowStock}>
      <SectionHead title={b.lowStock} sub={b.lowStockNote} />
      <ResponsiveList
        rows={variants}
        columns={columns}
        getRowKey={(row) => row.variantId}
        caption={b.lowStock}
      />
      {/* On-hand, not available. Available subtracts live reservations and only
          the per-variant endpoint computes it. */}
      <p className="text-xs text-muted-foreground">{b.stockNote}</p>
      <Button asChild variant="outline" size="sm" className="min-h-11 justify-self-start">
        <Link href="/inventory">{b.nav.inventory}</Link>
      </Button>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// d. Customer chats.
// ---------------------------------------------------------------------------

/**
 * A count and the oldest wait, and no shopper names.
 *
 * Not because the names are unavailable — because there is no customer list
 * anywhere in this console. A shopper appears inside an order they placed, and
 * nowhere else.
 */
export function ChatSection({
  threads,
  t,
  now,
}: {
  threads: readonly ChatThread[];
  t: Messages;
  now: number;
}) {
  const b = t.brand;
  const oldest = threads.reduce<ChatThread | null>((worst, thread) => {
    if (!worst) return thread;
    return waitedFor(thread.lastMessageAt, now) > waitedFor(worst.lastMessageAt, now)
      ? thread
      : worst;
  }, null);

  const oldestLabel = oldest ? waitedLabel(oldest.lastMessageAt, t, now) : null;

  return (
    <Section id="today-chat" label={b.chatWaiting}>
      <Card className="">
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <div className="grid gap-0.5">
            <span className="text-sm font-medium text-foreground">
              {b.chatWaiting}
            </span>
            <span className="font-mono text-2xl font-semibold tabular-nums text-foreground">
              {threads.length}
            </span>
            {oldestLabel ? (
              <span className="text-xs text-muted-foreground">
                {b.oldestWaiting.replace("{t}", oldestLabel)}
              </span>
            ) : null}
          </div>
          <Button asChild variant="outline" size="sm" className="min-h-11">
            <Link href="/chat">{b.nav.chat}</Link>
          </Button>
        </CardContent>
      </Card>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// e. Balance. Owner only.
// ---------------------------------------------------------------------------

/**
 * Rendered only when the caller is an owner — the caller decides, and for an
 * employee this component is never mounted, so there is nothing to grey out.
 *
 * It still draws a denied panel, because the nav is cosmetic and the API is the
 * boundary. An owner whose grant was pulled mid-session gets a panel that names
 * the role required, not a red toast that fades before it is read and not a
 * crash.
 */
export function BalanceSection({
  balance,
  state,
  t,
  locale,
}: {
  balance: Resource<BrandBalance>;
  /**
   * Whatever `listStateFor` can answer, not a hand-copied list of it. The
   * hand-copied list went stale the moment `notFound` was added — a fourth kind
   * the caller could produce and this signature could not accept. Anything this
   * component has no branch for falls through to the skeleton, which is what an
   * unrecognised state honestly looks like.
   */
  state: ListStateKind | null;
  t: Messages;
  locale: Locale;
}) {
  const b = t.brand;

  return (
    <Section id="today-balance" label={b.balance}>
      <Card className="">
        <CardHeader>
          <CardTitle className="text-base">{b.balance}</CardTitle>
          <CardDescription>{b.balanceSub}</CardDescription>
        </CardHeader>
        <CardContent>
          {state === "denied" ? (
            <ListState
              state="denied"
              title={b.deniedTitle}
              body={b.deniedBody}
              requiredRole="BRAND_OWNER"
            />
          ) : state === "error" ? (
            <ListState
              state="error"
              title={b.errorTitle}
              body={b.errorBody}
              actionLabel={b.retry}
              onAction={balance.reload}
            />
          ) : state === "loading" || !balance.data ? (
            <ListState state="loading" rows={1} />
          ) : (
            <MoneyRow
              amount={balance.data.amount}
              perspective="brand"
              variant="hero"
              locale={locale}
            />
          )}
        </CardContent>
      </Card>
    </Section>
  );
}

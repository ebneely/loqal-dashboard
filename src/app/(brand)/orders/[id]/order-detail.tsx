"use client";

/**
 * /orders/[id] — one order, this brand's slice of it, and the buttons that move
 * it along.
 *
 * Composed from the domain layer: ListState, StatusPill, ResponsiveList,
 * DestructiveSheet, MobileActionBar — plus shadcn's Card, Button, Input, Field
 * and Alert.
 *
 * THE RULE THIS SCREEN EXISTS NOT TO BREAK: a brand sees its own slice. There
 * is no parent total in `brandOrderDetailSchema` and no sibling brand — that
 * absence is deliberate and it is the security boundary. Nothing below reaches
 * for a figure the contract does not carry, and the suite serialises this whole
 * DOM and scans it for a sibling brand's strings rather than trusting that.
 *
 * Every decision about WHICH action to draw comes from `fulfilmentFor` in
 * ../fulfilment.ts. This file renders a plan; it does not compute one.
 */
import Link from "next/link";
import { useMemo, useState } from "react";

import type {
  OrderItem,
  ShippingAddress,
} from "@loqal/contracts/order.contract";

import {
  DestructiveSheet,
  ListState,
  MobileActionBar,
  MobileActionBarSpacer,
  ResponsiveList,
  StatusPill,
  listStateFor,
  statusLabel,
  type ResponsiveListColumn,
} from "@/components/loqal";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { Locale } from "@/lib/locale";
import { useLocale, useMessages } from "@/lib/locale-context";
import { formatMoney } from "@/lib/money";

import { waitedLabel } from "../../today/waited";
import {
  fulfilmentFor,
  paymentLabelKey,
  routeLabelKey,
  transitionBody,
} from "../fulfilment";
import { useBrandOrder, useTransition } from "../orders-data";

/** One language may legitimately be absent — the rule is "at least one". */
const pick = (
  value: { ar?: string; en?: string },
  locale: Locale
): string | null =>
  (locale === "ar" ? value.ar ?? value.en : value.en ?? value.ar) ?? null;

/**
 * The variant, said in one line.
 *
 * There is no stored label to read: `productSnapshot.attributes` is the
 * variant's own key/value set and it differs per product — one shop's shirt
 * carries size and colour, another's candle carries scent alone. So the label
 * is composed from the values in the order the snapshot froze them, and a
 * variant with no attributes at all honestly has no label.
 */
const variantLabel = (attributes: Record<string, unknown>): string | null => {
  // `unknown`, not `string`, because the snapshot's attribute values are copied
  // verbatim from an unconstrained JSON column and frozen forever. The contract
  // deliberately refuses to type them — a strict schema would reject an order
  // permanently the day catalog writes `{ size: 42 }`, and no backfill can
  // repair a snapshot. So the coercion the contract promises lives here: a
  // wrong label on one row is recoverable, an unreadable order is not.
  const parts = Object.values(attributes)
    .filter((value) => value !== null && value !== undefined)
    .map((value) => String(value).trim())
    .filter((value) => value.length > 0);
  return parts.length > 0 ? parts.join(" · ") : null;
};

export function OrderDetail({ id }: { id: string }) {
  const t = useMessages();
  const b = t.brand;
  const locale = useLocale();

  const detail = useBrandOrder(id);
  const move = useTransition(id);

  const [courierName, setCourierName] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [riskOpen, setRiskOpen] = useState(false);

  const order = detail.order;
  const now = useMemo(
    () => Date.now(),
    // One clock per load of the order, not one per rendered timestamp.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [order]
  );

  /**
   * `notFound` is asked for, because this is a detail route with an address
   * that can be wrong. 404 and "belongs to another shop" are the same answer on
   * purpose — the API refuses to confirm that a row exists, because that is the
   * one fact somebody guessing ids is trying to learn. The screen must not undo
   * that by wording the two differently.
   */
  const state = listStateFor(detail.error, {
    isLoading: detail.isLoading,
    notFound: true,
  });

  if (state === "loading") return <ListState state="loading" rows={3} />;

  if (state === "notFound") {
    return (
      <NotHere
        title={b.orderNotFoundTitle}
        body={b.orderNotFoundBody}
        back={b.allOrders}
      />
    );
  }

  if (state === "denied") {
    return (
      <ListState
        state="denied"
        title={b.brandOnlyTitle}
        body={b.brandOnlyBody}
        requiredRole="BRAND_OWNER"
      />
    );
  }

  if (state === "error" || !order) {
    return (
      <ListState
        state="error"
        title={b.ordersErrorTitle}
        body={b.errorBody}
        actionLabel={b.retry}
        onAction={detail.reload}
      />
    );
  }

  const plan = fulfilmentFor(order);

  /**
   * SHIPPING_SERVICE is modelled and NOT LIVE — there is no courier contract,
   * so no brand carries it. If one arrives anyway, the screen draws a refusal
   * and stops: no items, no shopper, no address, no buttons. "It must never
   * render" is not the same as "it must render without an action".
   */
  if (!plan.routeIsLive) {
    return (
      <NotHere
        title={b.routeUnavailableTitle}
        body={b.routeUnavailableBody}
        back={b.allOrders}
      />
    );
  }

  const route = plan.route!;
  const needsCourier = plan.next?.asksForCourier ?? false;
  const courierReady =
    !needsCourier ||
    (courierName.trim().length > 0 && trackingNumber.trim().length > 0);

  const commit = async (body: unknown) => {
    const next = await move.run(body);
    if (next) {
      detail.apply(next);
      setCourierName("");
      setTrackingNumber("");
    }
  };

  const advance = () => {
    if (!plan.next || !courierReady) return;
    void commit(transitionBody(plan.next, { courierName, trackingNumber }));
  };

  const primaryButton = (
    <Button
      className="min-h-14 w-full text-base"
      disabled={move.pending || !courierReady}
      onClick={advance}
    >
      {move.pending ? b.saving : b[plan.next?.label ?? "actConfirm"]}
    </Button>
  );

  const itemColumns: readonly ResponsiveListColumn<OrderItem>[] = [
    {
      /*
        The frozen snapshot, not the catalogue. Editing a product must never
        alter a past order, which is why every field on this row is read from
        `productSnapshot` rather than from a variant that may since have been
        renamed or archived.
      */
      key: "product",
      header: b.product,
      cell: (item) =>
        pick(item.productSnapshot.name, locale) ?? item.productSnapshot.sku,
      primary: true,
    },
    {
      key: "variant",
      header: b.variant,
      cell: (item) => variantLabel(item.productSnapshot.attributes) ?? "—",
      meta: true,
    },
    {
      key: "sku",
      header: b.sku,
      cell: (item) => (
        <span className="font-mono text-xs">{item.productSnapshot.sku}</span>
      ),
    },
    {
      key: "qty",
      header: b.qty,
      cell: (item) => String(item.qty),
      numeric: true,
    },
    {
      key: "unitPrice",
      header: b.unitPrice,
      cell: (item) => formatMoney(item.unitPrice),
      numeric: true,
      tableOnly: true,
    },
    {
      key: "lineTotal",
      header: b.lineTotal,
      cell: (item) => formatMoney(item.lineTotal),
      numeric: true,
    },
  ];

  return (
    <div className="grid gap-6">
      <section aria-label={b.order} className="grid gap-3">
        <Button asChild variant="ghost" size="sm" className="justify-self-start">
          <Link href="/orders">{b.allOrders}</Link>
        </Button>

        <Card className="shadow-none">
          <CardHeader className="gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill
                kind="BrandOrderStatus"
                value={order.status}
                locale={locale}
              />
              <span className="text-xs text-muted-foreground">
                {b.placed} · {waitedLabel(order.placedAt, t, now) ?? "—"}
              </span>
            </div>
            <CardTitle className="font-mono text-xl">
              #{order.orderNumber}
            </CardTitle>
            <CardDescription>{b.sliceOnly}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <Pair label={b.route} value={b[routeLabelKey(route)]} />
              <Pair
                label={b.payment}
                value={b[paymentLabelKey(order.paymentMethod)]}
              />
              <Pair
                label={b.itemsTotal}
                value={formatMoney(order.itemsTotal)}
                mono
              />
              {/*
                Always drawn, never conditional. `shippingCost` defaults to 0
                rather than null — a shop that charges no delivery fee charges
                nothing, which is a number a shopper can be shown, not an
                absence to hide the row for.
              */}
              <Pair
                label={b.deliveryFee}
                value={formatMoney(order.shippingCost)}
                mono
              />
              {/*
                The brand's OWN margin on the brand's OWN order, already visible
                line by line in the ledger. What a brand may not see is a
                SIBLING brand's slice or the basket total — not what Loqal
                charged it, which it should not have to discover by subtracting
                two numbers.
              */}
              <Pair
                label={b.commissionAmount}
                value={formatMoney(order.commissionAmount)}
                mono
              />
              <Pair
                label={b.payoutAmount}
                value={formatMoney(order.payoutAmount)}
                mono
              />
              {order.courierName ? (
                <Pair label={b.courier} value={order.courierName} />
              ) : null}
              {order.trackingNumber ? (
                <Pair label={b.tracking} value={order.trackingNumber} mono />
              ) : null}
            </dl>
            <p className="text-xs text-muted-foreground">{b[plan.routeNote!]}</p>
            {/* Delivery money never touches the ledger: it settles between the
                shopper and whoever delivers. */}
            <p className="text-xs text-muted-foreground">{b.shippingNote}</p>
          </CardContent>
        </Card>
      </section>

      <section aria-label={b.delivery} className="grid gap-3">
        {move.failed ? (
          <Alert variant="destructive">
            <AlertTitle>{b.transitionFailed}</AlertTitle>
            <AlertDescription>{b.errorBody}</AlertDescription>
          </Alert>
        ) : null}

        {plan.returnOpen ? (
          <Card className="border-state-act-border bg-state-act-bg/30 shadow-none">
            <CardContent className="grid gap-3 px-4 py-3">
              <p className="text-sm text-foreground">{b.returnOpenNote}</p>
              <Button
                asChild
                variant="outline"
                className="min-h-11 justify-self-start"
              >
                <Link href="/returns">{b.returnsTitle}</Link>
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {plan.next ? (
          <Card
            className={
              order.status === "PENDING_BRAND"
                ? "border-state-act-border bg-state-act-bg/30 shadow-none"
                : "shadow-none"
            }
            data-testid="order-action"
          >
            <CardHeader className="gap-1">
              <CardTitle className="text-base">
                {order.status === "PENDING_BRAND"
                  ? b.shelfTitle
                  : b[plan.next.label]}
              </CardTitle>
              <CardDescription>
                {order.status === "PENDING_BRAND"
                  ? b.shelfDesc
                  : b[plan.next.hint]}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {order.status === "PENDING_BRAND" ? (
                <p className="text-sm text-muted-foreground">{b.shelfNote}</p>
              ) : null}

              {/*
                Cash is collectable on exactly one route. On the shopper's own
                rider there is nobody at the door who works for this shop, which
                is why that route is prepaid-only in the first place.
              */}
              <p className="text-sm text-muted-foreground">
                {plan.collectsCash ? b.collectCash : b.prepaid}
              </p>

              {/*
                The courier fields exist ONLY on BRAND_OWN_DELIVERY's handover.
                On RIDER_PER_BRAND the brand books nothing, so a tracking-number
                box would be a question with no answer.
              */}
              {needsCourier ? (
                <FieldGroup data-testid="courier-fields">
                  <Field>
                    <FieldLabel htmlFor="order-courier">{b.courier}</FieldLabel>
                    <Input
                      id="order-courier"
                      name="courierName"
                      value={courierName}
                      onChange={(event) => setCourierName(event.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="order-tracking">
                      {b.tracking}
                    </FieldLabel>
                    <Input
                      id="order-tracking"
                      name="trackingNumber"
                      inputMode="text"
                      autoCapitalize="characters"
                      spellCheck={false}
                      value={trackingNumber}
                      onChange={(event) =>
                        setTrackingNumber(event.target.value)
                      }
                    />
                  </Field>
                  {!courierReady ? (
                    <p className="text-xs text-muted-foreground">
                      {b.courierRequired}
                    </p>
                  ) : null}
                </FieldGroup>
              ) : null}

              {/*
                ONE control, at both widths. Below md the bar is fixed to the
                bottom of the viewport, under the thumb already holding the
                phone; at md it unwraps into this card, beside the thing it acts
                on. It used to be rendered twice inside a `hidden md:block` and
                again in the bar, which put two buttons with the same accessible
                name in the tree — a screen-reader user heard "Mark packed,
                button" twice with nothing to tell them apart.
              */}
              <MobileActionBar hideAt="never" hint={b[plan.next.hint]}>
                <span className="block" data-testid="order-action-bar">
                  {primaryButton}
                </span>
              </MobileActionBar>

              {plan.risk ? (
                <DestructiveSheet
                  open={riskOpen}
                  onOpenChange={setRiskOpen}
                  trigger={
                    <Button
                      variant="outline"
                      className="min-h-11 justify-self-start text-destructive"
                    >
                      {b[plan.risk.action]}
                    </Button>
                  }
                  title={b[plan.risk.title]}
                  description={`#${order.orderNumber}`}
                  consequences={plan.risk.consequences.map((key) => b[key])}
                  confirmLabel={b[plan.risk.confirm]}
                  cancelLabel={b.cancel}
                  onConfirm={async () => {
                    await commit({ to: plan.risk!.to });
                    setRiskOpen(false);
                  }}
                />
              ) : null}
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-none" data-testid="order-no-action">
            <CardHeader className="gap-1">
              <CardTitle className="text-base">{b.noActionTitle}</CardTitle>
              <CardDescription>{b.noActionBody}</CardDescription>
            </CardHeader>
          </Card>
        )}
      </section>

      <section aria-label={b.items} className="grid gap-3">
        <h2 className="text-base font-semibold tracking-tight text-foreground">
          {b.items}
        </h2>
        <ResponsiveList
          rows={order.items}
          columns={itemColumns}
          getRowKey={(item) => item.id}
          caption={b.items}
        />
      </section>

      {/*
        The shopper, visible here and nowhere else. There is no customer list
        and no export in this console — per-order visibility is the whole grant.
      */}
      <section aria-label={b.shopper} className="grid gap-3">
        <h2 className="text-base font-semibold tracking-tight text-foreground">
          {b.shopper}
        </h2>
        <Card className="shadow-none">
          <CardContent className="grid gap-2 px-4 py-3 text-sm">
            <dl className="grid gap-2">
              {/*
                Both nullable. A guest checkout may carry only a phone, and a
                shopper row with no name on it is a real state rather than a
                defect — "—" is honest, an empty string looks broken.
              */}
              <Pair label={b.shopper} value={order.shopper.name ?? "—"} />
              <Pair label={b.phone} value={order.shopper.phone ?? "—"} mono />
              <AddressPair label={b.address} address={order.shopper.address} />
              <Pair
                label={b.deliveryPhone}
                value={order.shopper.address.phone}
                mono
              />
            </dl>
            {order.shopper.isGuest ? (
              <p className="text-xs text-muted-foreground">{b.guest}</p>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <section aria-label={b.timeline} className="grid gap-3">
        <h2 className="text-base font-semibold tracking-tight text-foreground">
          {b.timeline}
        </h2>
        <ol className="grid gap-2">
          {order.statusHistory.map((entry, index) => (
            <li
              key={`${entry.at}-${entry.to}-${index}`}
              className="flex flex-wrap items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
            >
              <StatusPill
                kind="BrandOrderStatus"
                value={entry.to}
                size="sm"
                locale={locale}
              />
              {entry.from ? (
                <span className="text-xs text-muted-foreground">
                  {statusLabel(
                    { kind: "BrandOrderStatus", value: entry.from },
                    locale
                  )}
                </span>
              ) : null}
              <span className="text-xs text-muted-foreground">
                {waitedLabel(entry.at, t, now) ?? "—"}
              </span>
              {/*
                Null actor means Loqal did it. A non-null one is a person in
                this shop whose NAME this endpoint does not carry — so nothing
                is printed rather than a name that would be invented.
              */}
              {entry.byUserId === null ? (
                <span className="text-xs text-muted-foreground">
                  {b.bySystem}
                </span>
              ) : null}
              {entry.note ? (
                <span className="basis-full text-xs text-muted-foreground">
                  {entry.note}
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      </section>

      {/* The bar is still FIXED below md, so the last section still needs room
          underneath it. */}
      {plan.next ? <MobileActionBarSpacer hideAt="never" /> : null}
    </div>
  );
}

function Pair({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={
          mono
            ? "font-mono tabular-nums text-foreground"
            : "text-foreground"
        }
      >
        {value}
      </dd>
    </div>
  );
}

/**
 * The delivery address, in the parts a rider actually reads.
 *
 * A snapshot rather than a foreign key: the shopper may edit or delete the
 * address afterwards and this order must not change. It is structured for the
 * same reason it is validated that way at checkout — somebody has to find the
 * building, and one run-on line is what gets a parcel returned.
 */
function AddressPair({
  label,
  address,
}: {
  label: string;
  address: ShippingAddress;
}) {
  const street = [address.street, address.building]
    .filter((part) => part && part.trim().length > 0)
    .join(" · ");

  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="grid justify-items-end text-end text-foreground">
        {address.label ? (
          <span className="text-xs text-muted-foreground">{address.label}</span>
        ) : null}
        <span>{street}</span>
        <span>
          {address.city} · {address.governorate}
        </span>
      </dd>
    </div>
  );
}

/**
 * The one panel used for both "no such order" and "not a live route": a dead
 * end with a way back, and nothing about the order on it.
 *
 * `notFound` rather than `empty`. Empty means the list is empty; this means
 * there is nothing at this address, which is a different sentence and now has
 * its own state. The way out is an ADDRESS, so `actionHref` draws a real anchor
 * and the `Button asChild + Link` that used to sit beside the panel is gone.
 */
function NotHere({
  title,
  body,
  back,
}: {
  title: string;
  body: string;
  back: string;
}) {
  return (
    <ListState
      state="notFound"
      title={title}
      body={body}
      actionLabel={back}
      actionHref="/orders"
    />
  );
}

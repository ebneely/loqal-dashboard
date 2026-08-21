"use client";

/**
 * /admin/orders/[id] — the only screen in the system where a multi-brand order
 * is visible entire.
 *
 * Composed from the domain layer: ListState, ResponsiveList, StatusPill — plus
 * shadcn's Alert, Badge, Button, Card and Separator.
 *
 * WHAT THIS SCREEN IS FOR, AND WHY IT IS SHAPED THIS WAY
 *
 *  1. THE BASKET, THEN THE SHOPS. The grand total is the shopper's number and
 *     each child block is one shop's slice. They are stacked rather than
 *     tabbed: an admin opens this screen precisely when the two disagree — one
 *     shop delivered, the other has not looked at the shelf — and a tab would
 *     hide the disagreement behind a click.
 *
 *  2. PAYMENT IS PER PAYMENT, NOT PER ORDER. A basket can be split across
 *     rows: Paymob charges the whole basket once and gets one row with a null
 *     `brandOrderId`, while every other route pays each shop separately and
 *     gets a row each. Flattening that to one "payment method" on the order
 *     would misreport exactly the case somebody opens this screen for, so the
 *     payments are their own list and each says which shop it covers.
 *
 *  3. `amountCollected` IS SHOWN BESIDE `amount`, ALWAYS. Cash arrives per
 *     courier per brand, so what was collected can legitimately be less than
 *     what was charged, and that gap is the first thing a settlement dispute
 *     turns on.
 *
 *  4. NO PHOTOS. `productSnapshot.imageUrl` is in the contract, but this
 *     console has no route that turns a media id into a URL and the snapshot's
 *     own field is null on every row the importer wrote. A broken image is
 *     worse than none, so the screen says so once and draws text.
 *
 * Nothing here writes. There is no admin transition route; an admin who has to
 * move an order does it through the shop's own console.
 */
import Link from "next/link";

import {
  DataField,
  FieldGrid,
  ListState,
  ResponsiveList,
  StatusPill,
  listStateFor,
  type ResponsiveListColumn,
} from "@/components/loqal";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useLocale, useMessages } from "@/lib/locale-context";
import { formatMoney } from "@/lib/money";

import { ADMIN_REQUIRED_ROLE } from "../../../shell-rules";
import {
  attributeLabel,
  liveDeliveryMethod,
  snapshotName,
  sumMoney,
  useAdminOrder,
  type AdminOrderDetail,
} from "../orders-data";

type Item = AdminOrderDetail["brandOrders"][number]["items"][number];

/** `.lq-rl-field` with `data-num`, which is what makes the value tabular. */
function Figure({ label, value }: { label: string; value: string }) {
  return <DataField label={label} value={value} numeric />;
}

export function AdminOrderDetailScreen({ id }: { id: string }) {
  const t = useMessages();
  const a = t.admin;
  const locale = useLocale();

  const order = useAdminOrder(id);
  const state = listStateFor(order.error, {
    isLoading: order.isLoading,
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
        title={a.orderNotFoundTitle}
        body={a.orderNotFoundBody}
        actionLabel={a.backToOrders}
        actionHref="/admin/orders"
      />
    );
  }

  if (state === "error" || !order.data) {
    return (
      <ListState
        state="error"
        title={a.errorTitle}
        body={a.errorBody}
        actionLabel={a.retry}
        onAction={order.reload}
      />
    );
  }

  const row = order.data;
  const route = liveDeliveryMethod(row.deliveryMethod);
  const isGuest = row.shopperId === null;

  /**
   * The payment vocabulary is the SHOP's, not the design system's, so
   * `StatusPill` carries the tone and takes the words from here. CASH is what
   * the enum calls it; "cash on delivery" is what everybody says out loud, and
   * `payCod` is the catalogue key that already exists for it.
   */
  const payLabels = {
    CASH: t.brand.payCod,
    CARD: t.brand.payCard,
    WALLET: t.brand.payWallet,
    VALU: t.brand.payValu,
    INSTAPAY: t.brand.payInstapay,
  };

  const itemColumns: readonly ResponsiveListColumn<Item>[] = [
    {
      key: "name",
      header: a.product,
      cell: (item) =>
        snapshotName(item.productSnapshot, locale, a.unnamedProduct),
      primary: true,
    },
    {
      key: "attributes",
      header: a.sku,
      cell: (item) => {
        const label = attributeLabel(item.productSnapshot.attributes);
        return (
          <span className="font-mono text-xs text-muted-foreground">
            {label ? `${item.productSnapshot.sku} · ${label}` : item.productSnapshot.sku}
          </span>
        );
      },
      meta: true,
    },
    {
      key: "qty",
      header: a.qty,
      cell: (item) => String(item.qty),
      numeric: true,
    },
    {
      key: "unitPrice",
      header: a.unitPrice,
      cell: (item) => formatMoney(item.unitPrice),
      numeric: true,
      tableOnly: true,
    },
    {
      key: "lineTotal",
      header: a.lineTotal,
      cell: (item) => formatMoney(item.lineTotal),
      numeric: true,
    },
  ];

  /**
   * The shops' commission and payout, added up. Strings all the way down —
   * `sumMoney` refuses rather than rounds, and the screen prints the refusal.
   */
  const commissionTotal = sumMoney(row.brandOrders.map((child) => child.commissionAmount));
  const payoutTotal = sumMoney(row.brandOrders.map((child) => child.payoutAmount));

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-1">
          <h2 className="font-mono text-xl font-semibold text-foreground">
            {row.orderNumber}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill kind="OrderStatus" value={row.status} locale={locale} />
            {/*
              SHIPPING_SERVICE renders as NOTHING — not a greyed chip, not an
              em-dash. It is modelled and not live, and a greyed pill still
              reads as "this exists and is switched off today".
            */}
            {route ? (
              <Badge variant="outline" data-route={route}>
                {route === "RIDER_PER_BRAND" ? a.deliveryRider : a.deliveryOwn}
              </Badge>
            ) : null}
            <span className="text-xs text-muted-foreground">
              {a.placed}: {new Date(row.placedAt).toLocaleString(locale)}
            </span>
          </div>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/orders">{a.backToOrders}</Link>
        </Button>
      </div>

      <Card className="">
        <CardContent className="grid gap-3">
          <FieldGrid>
            <Figure label={a.itemsSubtotal} value={formatMoney(row.itemsSubtotal)} />
            <Figure label={a.shippingTotal} value={formatMoney(row.shippingTotal)} />
            <Figure label={a.discountTotal} value={formatMoney(row.discountTotal)} />
            <Separator />
            <Figure label={a.grandTotal} value={formatMoney(row.grandTotal)} />
          </FieldGrid>
          <p className="text-xs text-muted-foreground">{a.combinedTotalNote}</p>
        </CardContent>
      </Card>

      {/* ---------------------------------------------------------------- */}

      <section className="grid gap-3">
        <div className="grid gap-1">
          <h3 className="text-base font-semibold text-foreground">
            {a.perBrandTitle}
          </h3>
          <p className="text-sm text-muted-foreground">{a.perBrandNote}</p>
        </div>

        {row.brandOrders.map((child) => (
          <Card key={child.id} className="" data-brand-order={child.id}>
            <CardContent className="grid gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link
                  href={`/admin/brands/${child.brandId}`}
                  className="font-mono text-sm underline-offset-4 hover:underline"
                >
                  {child.brandId}
                </Link>
                <StatusPill
                  kind="BrandOrderStatus"
                  value={child.status}
                  size="sm"
                  locale={locale}
                />
              </div>

              <FieldGrid>
                <Figure label={a.subtotal} value={formatMoney(child.subtotal)} />
                <Figure
                  label={a.shippingTotal}
                  value={formatMoney(child.shippingCost)}
                />
                <Figure
                  label={a.discountTotal}
                  value={formatMoney(child.discountAmount)}
                />
                <Figure
                  label={a.commission}
                  value={formatMoney(child.commissionAmount)}
                />
                <Figure label={a.payout} value={formatMoney(child.payoutAmount)} />
              </FieldGrid>

              <p className="text-xs text-muted-foreground">
                {a.itemsCount.replace("{n}", String(child.items.length))}
              </p>

              {child.items.length > 0 ? (
                <ResponsiveList
                  rows={child.items}
                  columns={itemColumns}
                  getRowKey={(item) => item.id}
                />
              ) : null}
            </CardContent>
          </Card>
        ))}

        {/* The two figures that decide a settlement conversation, added up. */}
        <Card className="">
          <CardContent className="grid gap-1.5">
            <Figure
              label={a.commission}
              value={commissionTotal ? formatMoney(commissionTotal) : a.cannotCheckSum}
            />
            <Figure
              label={a.payout}
              value={payoutTotal ? formatMoney(payoutTotal) : a.cannotCheckSum}
            />
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">{a.noMediaRoute}</p>
      </section>

      {/* ---------------------------------------------------------------- */}

      <section className="grid gap-3">
        <div className="grid gap-1">
          <h3 className="text-base font-semibold text-foreground">
            {a.payments}
          </h3>
          <p className="text-sm text-muted-foreground">{a.paymentsNote}</p>
        </div>

        {row.payments.length === 0 ? (
          <Alert>
            <AlertTitle>{a.noPayments}</AlertTitle>
          </Alert>
        ) : (
          row.payments.map((payment) => (
            <Card key={payment.id} className="" data-payment={payment.id}>
              <CardContent className="grid gap-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill
                    kind="PaymentMethod"
                    value={payment.method}
                    size="sm"
                    locale={locale}
                    labels={payLabels}
                  />
                  <span className="text-xs text-muted-foreground">
                    {a.provider}: {payment.provider}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {a.settlesTo}:{" "}
                    {payment.settlesTo === "PLATFORM"
                      ? a.settlesToPlatform
                      : a.settlesToBrand}
                  </span>
                </div>
                <Figure label={a.amountCollected} value={formatMoney(payment.amountCollected)} />
                <Figure label={a.grandTotal} value={formatMoney(payment.amount)} />
                <Figure
                  label={a.paidAt}
                  value={
                    payment.paidAt
                      ? new Date(payment.paidAt).toLocaleString(locale)
                      : a.notPaid
                  }
                />
              </CardContent>
            </Card>
          ))
        )}
      </section>

      {/* ---------------------------------------------------------------- */}

      <section className="grid gap-3">
        <h3 className="text-base font-semibold text-foreground">{a.shopper}</h3>
        <Card className="">
          <CardContent className="grid gap-2">
            <p className="text-sm text-foreground">
              {isGuest ? a.guestCheckout : a.accountCheckout}
            </p>
            <p className="text-sm text-muted-foreground">
              {row.phoneVerifiedAt ? a.phoneVerified : a.phoneNotVerified}
            </p>
            <Separator />
            <p className="text-xs text-muted-foreground">{a.shipTo}</p>
            <p className="text-sm text-foreground">
              {[
                row.shippingAddress.building,
                row.shippingAddress.street,
                row.shippingAddress.city,
                row.shippingAddress.governorate,
              ]
                .filter(Boolean)
                .join(", ")}
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

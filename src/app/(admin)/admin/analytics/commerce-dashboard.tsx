"use client";

/**
 * The commerce dashboard — one component, two routes.
 *
 * Composed from the domain layer: SectionHead, Kpi, Sparkline, TrendChart,
 * StatusDonut, EgyptMap, ResponsiveList, ListState — plus shadcn's Tabs and
 * NativeSelect. Two routes rather than one because `(admin)/layout.tsx` sends
 * any non-admin to /today, so a shop owner's copy of this screen cannot live
 * under /admin at all.
 *
 * WHY THIS IS NOT FOUR IDENTICAL CARDS
 *
 * Four equal tiles in a row, each with an icon in a tinted circle, is the
 * single most reliable tell in product UI, and the reason it is a tell is that
 * it encodes no decision: every panel the same size because nothing worked out
 * which one mattered. The product register names that shape twice as the thing
 * to avoid.
 *
 * These four numbers are not equally important. Revenue is why the screen was
 * opened; orders is what produced it; customers and average order value are
 * context for both. So the row is ONE primary figure at the size this system
 * reserves for a signed balance, with the shape of its window under it, and
 * THREE secondary figures on a hairline strip with no card and no icon each.
 *
 * THREE THINGS ARE DELIBERATELY NOT DRAWN
 *
 *  1. A sparkline, unless seven days of the window actually traded. A line
 *     shows the SHAPE of a series and four orders have no shape; a flat line
 *     under a number is furniture that reads as information.
 *  2. A delta, unless the previous window held at least five orders. "+300%"
 *     from one order to four is true, useless, and the figure that gets
 *     quoted out loud.
 *  3. An average order value over an empty window. Zero orders is not an
 *     average of zero — the API sends null and this prints an em dash and the
 *     reason, because "0.00 EGP" reports a collapse where there was no trade.
 *
 * Empty is a state and it teaches. With one order in the database this screen
 * is mostly empty for a while, so the empty case says what will fill it rather
 * than drawing a wall of zeros with no explanation.
 */
import { useState, type ReactNode } from "react";

import {
  EgyptMap,
  Kpi,
  ListState,
  ResponsiveList,
  STATUS_MAP,
  SectionHead,
  Sparkline,
  StatusDonut,
  TrendChart,
  listStateFor,
  type ResponsiveListColumn,
} from "@/components/loqal";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { governorateName } from "@/lib/geo/governorates";
import type { Locale } from "@/lib/locale";
import { useLocale } from "@/lib/locale-context";
import { MINUS, formatCount, formatMoney } from "@/lib/money";

import {
  WINDOW_DAYS,
  dayLabel,
  drawsSparkline,
  isAdminDashboard,
  movement,
  toPiastres,
  useCommerceDashboard,
  windowDaysFrom,
  type CommerceScope,
  type CommerceTrendPoint,
  type Movement,
  type WindowDays,
} from "./commerce-data";

/**
 * Every string this screen draws, passed in rather than looked up.
 *
 * The two consoles word the same panel differently — "Orders by governorate"
 * for an admin watching every shop, "Where your orders went" for the shop —
 * and each console's copy belongs in its own catalogue. `shops` is admin-only
 * and optional for exactly that reason: only the admin route sends the series
 * it labels, so only the admin catalogue carries the words for it.
 */
export type CommerceCopy = {
  title: string;
  rangeLabel: string;
  range7: string;
  range30: string;
  range90: string;
  revenue: string;
  revenueNote: string;
  orders: string;
  customers: string;
  aov: string;
  aovNone: string;
  deltaVs: string;
  deltaThin: string;
  trendTitle: string;
  seriesRevenue: string;
  seriesOrders: string;
  trendEmpty: string;
  sparkLabel: string;
  statusTitle: string;
  statusTotal: string;
  statusEmpty: string;
  productsTitle: string;
  productsEmpty: string;
  productName: string;
  productQty: string;
  productRevenue: string;
  mapTitle: string;
  mapEmpty: string;
  mapValueLabel: string;
  mapUnmapped: string;
  /**
   * The SECOND map, and admin-only. Where the shops are is a different
   * question from where orders went, and it is one no shop may ask about the
   * others — so the brand catalogue has no `shops` block at all.
   */
  shops?: {
    title: string;
    /** Every shop, whatever the window control above says. */
    note: string;
    empty: string;
    valueLabel: string;
    /** Read after the count: "4 shops have no governorate set…" */
    unplaced: string;
  };
  emptyTitle: string;
  emptyBody: string;
  errorTitle: string;
  errorBody: string;
  retry: string;
  deniedTitle: string;
  deniedBody: string;
};

type TopProduct = { name: string; qty: number; revenue: string };

/** The em dash is not a number. A figure that cannot exist is not printed. */
const NO_FIGURE = "—";

/**
 * The status in the console's own words, or the raw enum name.
 *
 * A status this build has never heard of renders as `PENDING_SOMETHING`
 * rather than as an unlabelled slice — readable, and obvious which one needs
 * adding.
 */
const statusText = (status: string, locale: Locale): string =>
  (STATUS_MAP.BrandOrderStatus as Record<string, { en: string; ar: string }>)[
    status
  ]?.[locale] ?? status;

const percentText = (percent: number): string =>
  percent > 0
    ? `+${percent}%`
    : percent < 0
      ? `${MINUS}${Math.abs(percent)}%`
      : "0%";

/**
 * One secondary figure: a key, a figure, and nothing else.
 *
 * No card, no icon, no delta. These three are context for the primary figure
 * and are drawn as context — the hairlines between them come from the strip's
 * own background showing through a one-pixel gap, which needs no border on any
 * physical side and so mirrors for free.
 */
function SecondaryFigure({
  id,
  label,
  value,
  note,
}: {
  id: string;
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div
      data-testid="commerce-figure-secondary"
      data-key={id}
      className="grid content-start gap-1 bg-background px-4 py-3"
    >
      <dt className="lq-kpi-key">{label}</dt>
      <dd className="grid gap-1">
        <span className="lq-kpi-val" data-num="">
          {value}
        </span>
        {note ? (
          <span className="text-xs text-muted-foreground">{note}</span>
        ) : null}
      </dd>
    </div>
  );
}

export function CommerceDashboard({
  scope,
  copy,
  requiredRole,
}: {
  scope: CommerceScope;
  copy: CommerceCopy;
  /** Named on the denied panel — the role that would have been allowed. */
  requiredRole: string;
}) {
  const locale = useLocale();
  const [days, setDays] = useState<WindowDays>(30);
  const [series, setSeries] = useState<"revenue" | "orders">("revenue");

  const dash = useCommerceDashboard(scope, days);
  const state = listStateFor(dash.error, { isLoading: dash.isLoading });

  const rangeOption: Record<WindowDays, string> = {
    7: copy.range7,
    30: copy.range30,
    90: copy.range90,
  };

  /**
   * The head stays put through every state. A range control that disappears
   * while the next window loads makes the screen jump on every change, and the
   * reader has nothing left to press.
   */
  const head = (
    <SectionHead
      as="h2"
      title={copy.title}
      action={
        <NativeSelect
          size="sm"
          className="w-32"
          aria-label={copy.rangeLabel}
          value={String(days)}
          onChange={(event) => setDays(windowDaysFrom(event.target.value))}
        >
          {WINDOW_DAYS.map((option) => (
            <NativeSelectOption key={option} value={String(option)}>
              {rangeOption[option]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      }
    />
  );

  const framed = (body: ReactNode) => (
    <section className="grid gap-4" data-testid="commerce">
      {head}
      {body}
    </section>
  );

  if (state === "loading") return framed(<ListState state="loading" rows={2} />);

  if (state === "denied") {
    return framed(
      <ListState
        state="denied"
        title={copy.deniedTitle}
        body={copy.deniedBody}
        requiredRole={requiredRole}
      />
    );
  }

  if (state === "error" || !dash.data) {
    return framed(
      <ListState
        state="error"
        title={copy.errorTitle}
        body={copy.errorBody}
        actionLabel={copy.retry}
        onAction={dash.reload}
      />
    );
  }

  const data = dash.data;
  const { totals, previous, trend } = data;
  const traded = totals.orders > 0;

  /**
   * The series is a parameter rather than read off state, so the two tabs
   * cannot both draw whichever one happens to be active.
   *
   * `Number(item.revenue)` is the ONE place an amount becomes a JS number:
   * recharts plots numbers and nothing else. Every comparison and every
   * rendered figure goes through the string.
   */
  const points = (of: "revenue" | "orders") =>
    trend.map((item: CommerceTrendPoint) => ({
      label: dayLabel(item.day, locale),
      value: of === "revenue" ? Number(item.revenue) : item.orders,
    }));

  const revenueDelta: Movement | null = movement(
    toPiastres(totals.revenue),
    toPiastres(previous.revenue),
    previous.orders
  );

  const delta = revenueDelta
    ? {
        direction: revenueDelta.direction,
        label: `${percentText(revenueDelta.percent)} · ${copy.deltaVs}`,
      }
    : undefined;

  const spark = drawsSparkline(trend) ? (
    <Sparkline
      label={copy.sparkLabel}
      data={trend.map((item) => ({
        label: dayLabel(item.day, locale),
        value: Number(item.revenue),
      }))}
    />
  ) : undefined;

  const regions = data.byGovernorate.map((region) => ({
    code: region.code,
    label: governorateName(region.code, locale),
    value: region.orders,
    detail: formatMoney(region.revenue),
  }));

  /**
   * The shops map, drawn only when the API actually sent the series AND this
   * console has words for it. Gated on the payload rather than on `scope`, so
   * a brand response cannot be talked into drawing one.
   */
  const shopsCopy = copy.shops;
  const shops =
    shopsCopy && isAdminDashboard(data)
      ? {
          copy: shopsCopy,
          unplaced: data.unplacedBrands,
          regions: data.byBrandLocation.map((region) => ({
            code: region.code,
            label: governorateName(region.code, locale),
            value: region.brands,
          })),
        }
      : null;

  const productColumns: readonly ResponsiveListColumn<TopProduct>[] = [
    {
      key: "name",
      header: copy.productName,
      cell: (row) => row.name,
      primary: true,
    },
    {
      key: "qty",
      header: copy.productQty,
      cell: (row) => formatCount(row.qty),
      numeric: true,
    },
    {
      key: "revenue",
      header: copy.productRevenue,
      cell: (row) => formatMoney(row.revenue),
      numeric: true,
    },
  ];

  return framed(
    <>
      {/*
        Empty is a state, drawn deliberately. It says what will fill the screen
        instead of leaving a reader to work out whether four zeros mean no
        trade or a broken endpoint.
      */}
      {traded ? null : (
        <div className="grid gap-1 rounded-lg border border-dashed border-border px-4 py-3">
          <p className="text-base font-medium">{copy.emptyTitle}</p>
          <p className="text-sm text-muted-foreground">{copy.emptyBody}</p>
        </div>
      )}

      <div data-testid="commerce-figure-primary">
        <Kpi
          label={copy.revenue}
          value={
            <span className="text-3xl" data-num="">
              {formatMoney(totals.revenue)}
            </span>
          }
          chart={spark}
          delta={delta}
          note={copy.revenueNote}
        />
      </div>

      {/* Said once, quietly, and never as a headline percentage. */}
      {!delta && traded ? (
        <p className="text-xs text-muted-foreground">{copy.deltaThin}</p>
      ) : null}

      <dl className="grid gap-px bg-border sm:grid-cols-3">
        <SecondaryFigure
          id="orders"
          label={copy.orders}
          value={formatCount(totals.orders)}
        />
        <SecondaryFigure
          id="customers"
          label={copy.customers}
          value={formatCount(totals.customers)}
        />
        <SecondaryFigure
          id="aov"
          label={copy.aov}
          value={
            totals.averageOrderValue === null
              ? NO_FIGURE
              : formatMoney(totals.averageOrderValue)
          }
          note={totals.averageOrderValue === null ? copy.aovNone : undefined}
        />
      </dl>

      <section className="grid gap-3">
        <SectionHead as="h3" title={copy.trendTitle} />
        {/*
          Tabs, not two lines on one axis. Revenue and a count are different
          magnitudes in different units; drawing them together needs a second
          scale, and a chart with two scales is one whose crossings mean
          nothing.
        */}
        <Tabs
          value={series}
          onValueChange={(value) =>
            setSeries(value === "orders" ? "orders" : "revenue")
          }
        >
          <TabsList>
            <TabsTrigger value="revenue">{copy.seriesRevenue}</TabsTrigger>
            <TabsTrigger value="orders">{copy.seriesOrders}</TabsTrigger>
          </TabsList>
          <TabsContent value="revenue">
            <TrendChart
              data={points("revenue")}
              seriesLabel={copy.seriesRevenue}
              label={`${copy.trendTitle}: ${copy.seriesRevenue}`}
              emptyLabel={copy.trendEmpty}
              formatValue={(value) => formatMoney(value.toFixed(2))}
            />
          </TabsContent>
          <TabsContent value="orders">
            <TrendChart
              data={points("orders")}
              seriesLabel={copy.seriesOrders}
              label={`${copy.trendTitle}: ${copy.seriesOrders}`}
              emptyLabel={copy.trendEmpty}
              formatValue={formatCount}
            />
          </TabsContent>
        </Tabs>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="grid gap-3">
          <SectionHead as="h3" title={copy.statusTitle} />
          <StatusDonut
            label={copy.statusTitle}
            emptyLabel={copy.statusEmpty}
            formatValue={formatCount}
            data={data.byStatus.map((slice) => ({
              key: slice.status,
              label: statusText(slice.status, locale),
              value: slice.count,
            }))}
            centre={
              <span
                data-testid="commerce-status-total"
                className="grid justify-items-center gap-0.5"
              >
                <span className="lq-kpi-val" data-num="">
                  {formatCount(totals.orders)}
                </span>
                <span className="lq-kpi-key">{copy.statusTotal}</span>
              </span>
            }
          />
        </section>

        <section className="grid gap-3">
          <SectionHead as="h3" title={copy.productsTitle} />
          {data.topProducts.length === 0 ? (
            <ListState state="empty" title={copy.productsEmpty} />
          ) : (
            <ResponsiveList
              rows={data.topProducts}
              columns={productColumns}
              getRowKey={(row) => row.name}
              caption={copy.productsTitle}
            />
          )}
        </section>
      </div>

      <section className="grid gap-3">
        <SectionHead as="h3" title={copy.mapTitle} />
        <EgyptMap
          data={regions}
          emptyLabel={copy.mapEmpty}
          valueLabel={copy.mapValueLabel}
        />
        {/*
          Orders that reached a governorate nothing could canonicalise. Stated
          rather than dropped: an order missing from a map is a number nobody
          knows is missing.
        */}
        {data.unmapped.orders > 0 ? (
          <p className="text-xs text-muted-foreground">
            {formatCount(data.unmapped.orders)} {copy.mapUnmapped}
          </p>
        ) : null}
      </section>

      {/*
        TWO MAPS, STACKED AND NAMED — never side by side. They answer two
        questions in the same shape and the same colours, and a reader glancing
        between them reads whichever heading is nearer. Above: where orders
        WENT. Here: where the shops ARE.
      */}
      {shops ? (
        <section className="grid gap-3">
          <SectionHead as="h3" title={shops.copy.title} />
          <p className="text-xs text-muted-foreground">{shops.copy.note}</p>
          <EgyptMap
            data={shops.regions}
            emptyLabel={shops.copy.empty}
            valueLabel={shops.copy.valueLabel}
          />
          {/*
            A fact with a fix, not an error. Older shops predate the column,
            and a map that leaves them out shows fewer shops than the brand
            list with nothing on the screen to explain the gap.
          */}
          {shops.unplaced > 0 ? (
            <p className="text-xs text-muted-foreground">
              {formatCount(shops.unplaced)} {shops.copy.unplaced}
            </p>
          ) : null}
        </section>
      ) : null}
    </>
  );
}

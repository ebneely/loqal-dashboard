"use client";

/**
 * /admin/analytics — what Loqal can actually count.
 *
 * Composed from the domain layer: ResponsiveList, ListState — plus shadcn's
 * Alert, Card and Separator.
 *
 * THE MISSING HALF IS STATED IN WORDS, WHERE IT WOULD OTHERWISE BE GUESSED AT.
 *
 * The design calls for gross merchandise value, orders per brand and
 * conversion. This endpoint answers none of the three — it carries event
 * counts, a lifetime visitor total and the searches that came back empty, and
 * no money and no orders at all. So there is a panel saying that, pointing at
 * the two screens where money is real, instead of three tiles quietly filled
 * from whatever was to hand.
 *
 * TWO FIGURES ON THIS SCREEN COUNT DIFFERENT PERIODS. Events are the window;
 * visitors is every visitor since launch. They are not a matched pair and the
 * larger one is the one that gets quoted out loud, so each carries its own
 * period rather than sharing a header.
 *
 * "Views to checkout" is labelled as what it is — a ratio between two event
 * counters — and is deliberately not called conversion. See `analytics-data.ts`.
 */
import {
  Kpi,
  KpiGrid,
  ListState,
  ResponsiveList,
  SectionHead,
  listStateFor,
  type ResponsiveListColumn,
} from "@/components/loqal";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useMessages } from "@/lib/locale-context";
import { formatCount } from "@/lib/money";

import { ADMIN_REQUIRED_ROLE } from "../../shell-rules";
import {
  eventCount,
  formatBps,
  usePlatformOverview,
  viewsToCheckoutBps,
} from "./analytics-data";

type ZeroRow = { term: string; count: number };

/**
 * `Kpi` is the design system's `.lq-kpi`: an 11px uppercase key over a 26px
 * Source Code Pro figure, in a 12/16 card. This tile hand-rolled it with a
 * 12px sentence-case key and no `--tracking-caps`, which read as a caption
 * rather than as a column head.
 *
 * Every figure carries its own period. The two on this screen do not cover
 * the same one, and the larger is the one that gets quoted.
 */
function Tile({
  label,
  value,
  period,
}: {
  label: string;
  value: string;
  period: string;
}) {
  return <Kpi label={label} value={value} note={period} />;
}

export function AnalyticsScreen() {
  const t = useMessages();
  const a = t.admin;

  const overview = usePlatformOverview();
  const state = listStateFor(overview.error, { isLoading: overview.isLoading });

  if (state === "loading") return <ListState state="loading" rows={3} />;

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

  if (state === "error" || !overview.data) {
    return (
      <ListState
        state="error"
        title={a.errorTitle}
        body={a.errorBody}
        actionLabel={a.retry}
        onAction={overview.reload}
      />
    );
  }

  const data = overview.data;
  const number = formatCount;
  const ratio = viewsToCheckoutBps(data);

  const columns: readonly ResponsiveListColumn<ZeroRow>[] = [
    {
      key: "term",
      header: a.term,
      cell: (row) => row.term,
      primary: true,
    },
    {
      key: "count",
      header: a.times,
      cell: (row) => number(row.count),
      numeric: true,
    },
  ];

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">{a.analyticsNote}</p>

      <KpiGrid>
        <Tile
          label={a.totalEvents}
          value={number(data.totalEvents)}
          period={a.last30}
        />
        <Tile
          label={a.totalVisitors}
          value={number(data.totalVisitors)}
          period={a.visitorsAllTime}
        />
        <Tile
          label={a.productViews}
          value={number(eventCount(data, "PRODUCT_VIEW"))}
          period={a.last30}
        />
        <Tile
          label={a.brandViews}
          value={number(eventCount(data, "BRAND_VIEW"))}
          period={a.last30}
        />
        <Tile
          label={a.searchesLabel}
          value={number(eventCount(data, "SEARCH"))}
          period={a.last30}
        />
        <Tile
          label={a.cartAdds}
          value={number(eventCount(data, "CART_ADD"))}
          period={a.last30}
        />
        <Tile
          label={a.checkoutStarts}
          value={number(eventCount(data, "CHECKOUT_START"))}
          period={a.last30}
        />
        <Tile
          label={a.viewsToCheckout}
          /* Null when there were no views. 0/0 is not 0%, and "0%" over an
             empty window reports a broken funnel where there was no traffic. */
          value={ratio === null ? a.unset : formatBps(ratio)}
          period={a.last30}
        />
      </KpiGrid>

      <p className="text-xs text-muted-foreground">{a.viewsToCheckoutNote}</p>

      <Alert data-testid="gmv-missing">
        <AlertTitle>{a.gmvMissingTitle}</AlertTitle>
        <AlertDescription>{a.gmvMissingBody}</AlertDescription>
      </Alert>

      <section className="grid gap-3">
        <SectionHead as="h3" title={a.zeroResults} sub={a.zeroNote} />

        {data.topZeroResultSearches.length === 0 ? (
          <ListState state="empty" title={a.zeroEmpty} />
        ) : (
          <ResponsiveList
            rows={data.topZeroResultSearches}
            columns={columns}
            getRowKey={(row) => row.term}
          />
        )}
      </section>

      <p className="text-xs text-muted-foreground">{a.analyticsShapeGap}</p>
    </div>
  );
}

"use client";

/**
 * /admin/settlements — the runs, newest raised first.
 *
 * Composed from the domain layer: ResponsiveList, StatusPill, MoneyRow,
 * ListState — plus shadcn's Alert, Button, Input and NativeSelect.
 *
 * THERE ARE NO MARKING BUTTONS ON THIS LIST, and that is the point of the
 * screen. Marking a run sent or received writes a closing ledger entry and
 * cannot be undone; the only place it can be done is the detail screen, beside
 * the period, the direction, the destination account and every ledger line the
 * figure was computed from. A row in a list carries none of that, so a button
 * on a row would be a payment made from a summary.
 *
 * THE NET AMOUNT IS SIGNED AND THE SIGN IS NOT THE MESSAGE. `MoneyRow` with
 * `perspective="platform"` names the party in words, because a minus sign in a
 * column of right-aligned figures is not a sentence anybody reads correctly.
 * `direction` is shown beside it as its own column: the sign is derived from
 * the balance and the direction is what the API decided, and when those two
 * ever disagree an admin needs to see both rather than a reconciliation.
 */
import { useRouter, useSearchParams } from "next/navigation";

import {
  SettlementStatusSchema,
  type SettlementStatus,
} from "@loqal/contracts/enums";

import {
  ListState,
  MoneyRow,
  ResponsiveList,
  StatusPill,
  listStateFor,
  statusLabel,
  type ResponsiveListColumn,
} from "@/components/loqal";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { useLocale, useMessages } from "@/lib/locale-context";

import { ADMIN_REQUIRED_ROLE } from "../../shell-rules";
import {
  isSettlementStatus,
  useSettlementRuns,
  type SettlementRun,
} from "./settlements-data";

const STATUSES: readonly SettlementStatus[] = SettlementStatusSchema.options;

export function SettlementsScreen() {
  const t = useMessages();
  const a = t.admin;
  const locale = useLocale();
  const router = useRouter();
  const params = useSearchParams();

  const rawStatus = params.get("status");
  const status = isSettlementStatus(rawStatus) ? rawStatus : null;
  const brandId = params.get("brandId") ?? "";

  const feed = useSettlementRuns(status, brandId);
  const rows = feed.rows;

  const state = listStateFor(feed.error, {
    isLoading: feed.isLoading,
    isEmpty: rows.length === 0,
  });

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    const query = next.toString();
    router.replace(query ? `/admin/settlements?${query}` : "/admin/settlements");
  };

  const period = (row: SettlementRun) =>
    `${new Date(row.periodStart).toLocaleDateString(locale)} — ${new Date(
      row.periodEnd
    ).toLocaleDateString(locale)}`;

  const columns: readonly ResponsiveListColumn<SettlementRun>[] = [
    {
      key: "brandName",
      header: a.brand,
      cell: (row) => row.brandName,
      primary: true,
    },
    {
      key: "status",
      header: a.status,
      cell: (row) => (
        <StatusPill
          kind="SettlementStatus"
          value={row.status}
          size="sm"
          locale={locale}
        />
      ),
      meta: true,
    },
    {
      key: "period",
      header: a.period,
      cell: period,
      meta: true,
    },
    {
      key: "direction",
      header: a.direction,
      cell: (row) => (
        <span data-direction-decision={row.direction} className="text-sm text-foreground">
          {row.direction === "WE_PAY" ? a.directionWePay : a.directionTheyPay}
        </span>
      ),
    },
    {
      key: "netAmount",
      header: a.netAmount,
      cell: (row) => (
        <MoneyRow
          amount={row.netAmount}
          perspective="platform"
          variant="inline"
          locale={locale}
        />
      ),
      numeric: true,
    },
    {
      key: "createdAt",
      header: a.raisedOn,
      cell: (row) => new Date(row.createdAt).toLocaleDateString(locale),
      numeric: true,
      tableOnly: true,
    },
  ];

  return (
    <div className="grid gap-4">
      <Alert>
        <AlertTitle>{a.nothingAutomatic}</AlertTitle>
        <AlertDescription>{a.settlementsNote}</AlertDescription>
      </Alert>

      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-2">
          <label
            htmlFor="settlements-status"
            className="text-sm font-medium text-foreground"
          >
            {a.filterStatus}
          </label>
          <NativeSelect
            id="settlements-status"
            className="w-full max-w-xs"
            value={status ?? ""}
            onChange={(event) => setParam("status", event.target.value)}
          >
            <NativeSelectOption value="">{a.filterAll}</NativeSelectOption>
            {STATUSES.map((value) => (
              <NativeSelectOption key={value} value={value}>
                {statusLabel({ kind: "SettlementStatus", value }, locale)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>

        <div className="grid gap-2">
          <label
            htmlFor="settlements-brand"
            className="text-sm font-medium text-foreground"
          >
            {a.filterBrandId}
          </label>
          <Input
            id="settlements-brand"
            className="w-full max-w-xs"
            defaultValue={brandId}
            placeholder={a.filterBrandIdPlaceholder}
            onBlur={(event) => setParam("brandId", event.target.value.trim())}
          />
          <p className="max-w-xs text-xs text-muted-foreground">
            {a.brandFilterGap}
          </p>
        </div>
      </div>

      {state === "loading" && rows.length === 0 ? (
        <ListState state="loading" rows={4} />
      ) : null}

      {/* A failed later page keeps its rows; see the inline retry below. */}
      {state === "error" && rows.length === 0 ? (
        <ListState
          state="error"
          title={a.errorTitle}
          body={a.errorBody}
          actionLabel={a.retry}
          onAction={feed.reload}
        />
      ) : null}

      {state === "denied" ? (
        <ListState
          state="denied"
          title={a.deniedTitle}
          body={a.deniedBody}
          requiredRole={ADMIN_REQUIRED_ROLE}
        />
      ) : null}

      {state === "empty" ? (
        <ListState
          state="empty"
          title={a.settlementsEmptyTitle}
          body={a.settlementsEmptyBody}
        />
      ) : null}

      {rows.length > 0 ? (
        <>
          <ResponsiveList
            rows={rows}
            columns={columns}
            getRowKey={(row) => row.id}
            getRowHref={(row) => `/admin/settlements/${row.id}`}
            caption={a.settlementsCaption}
          />

          <p className="text-xs text-muted-foreground">{a.balanceNote}</p>

          {feed.error ? (
            <div
              role="alert"
              data-testid="settlements-inline-error"
              className="flex flex-wrap items-center gap-3 rounded-md border border-state-bad-border bg-state-bad-bg px-3 py-2"
            >
              <span className="text-sm text-foreground">{a.pageFailedBody}</span>
              <Button variant="outline" size="sm" onClick={feed.loadMore}>
                {a.retry}
              </Button>
            </div>
          ) : null}

          {feed.nextCursor && !feed.error ? (
            <Button
              variant="outline"
              className="min-h-11 justify-self-start"
              disabled={feed.isLoadingMore}
              onClick={feed.loadMore}
            >
              {feed.isLoadingMore ? a.saving : a.loadMore}
            </Button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

"use client";

/**
 * /admin/imports — the jobs, newest started first.
 *
 * Composed from the domain layer: ResponsiveList, ListState — plus shadcn's
 * Alert, Badge, Button, Input and NativeSelect.
 *
 * PER-STATUS COUNTS, NEVER ONE NUMBER. "412 items" hides the eleven that
 * failed, and the eleven are the entire reason somebody opens this screen. So
 * the five counts are five cells and the failed one is the only tinted cell in
 * the row.
 *
 * An import is started for a brand BY LOQAL. A shop cannot start one itself —
 * so the button that starts one lives here, on the admin plane, and the empty
 * state offers it too.
 */
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import {
  ImportJobStatusSchema,
  type ImportJobStatus,
} from "@loqal/contracts/enums";

import {
  ListState,
  ResponsiveList,
  listStateFor,
  type ResponsiveListColumn,
} from "@/components/loqal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { useLocale, useMessages } from "@/lib/locale-context";

import { ADMIN_REQUIRED_ROLE } from "../../shell-rules";
import { isJobStatus, useImportJobs, type ImportJob } from "./imports-data";
import { NewImportSheet, StartImportButton } from "./new-import-sheet";

const STATUSES: readonly ImportJobStatus[] = ImportJobStatusSchema.options;

const JOB_STATUS_KEY = {
  DETECTING: "jobDetecting",
  FETCHING: "jobFetching",
  AWAITING_REVIEW: "jobAwaitingReview",
  COMMITTING: "jobCommitting",
  COMPLETED: "jobCompleted",
  FAILED: "jobFailed",
} as const;

export function ImportsScreen() {
  const t = useMessages();
  const a = t.admin;
  const locale = useLocale();
  const router = useRouter();
  const params = useSearchParams();

  const rawStatus = params.get("status");
  const status = isJobStatus(rawStatus) ? rawStatus : null;
  const brandId = params.get("brandId") ?? "";

  const feed = useImportJobs(status, brandId);
  const rows = feed.rows;
  const [starting, setStarting] = useState(false);

  const state = listStateFor(feed.error, {
    isLoading: feed.isLoading,
    isEmpty: rows.length === 0,
  });

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    const query = next.toString();
    router.replace(query ? `/admin/imports?${query}` : "/admin/imports");
  };

  const columns: readonly ResponsiveListColumn<ImportJob>[] = [
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
        <Badge variant="outline" data-job-status={row.status}>
          {a[JOB_STATUS_KEY[row.status]]}
        </Badge>
      ),
      meta: true,
    },
    {
      key: "source",
      header: a.source,
      cell: (row) => (
        <span className="font-mono text-xs">
          {row.sourceRef ? `${row.sourceType} · ${row.sourceRef}` : row.sourceType}
        </span>
      ),
      meta: true,
    },
    {
      key: "staged",
      header: a.countStaged,
      cell: (row) => String(row.counts.staged),
      numeric: true,
      tableOnly: true,
    },
    {
      key: "mapped",
      header: a.countMapped,
      cell: (row) => String(row.counts.mapped),
      numeric: true,
      tableOnly: true,
    },
    {
      key: "imported",
      header: a.countImported,
      cell: (row) => String(row.counts.imported),
      numeric: true,
    },
    {
      key: "skipped",
      header: a.countSkipped,
      cell: (row) => String(row.counts.skipped),
      numeric: true,
      tableOnly: true,
    },
    {
      key: "failed",
      header: a.countFailed,
      // The one count that is never allowed to blend in.
      cell: (row) => (
        <span
          data-failed={row.counts.failed > 0}
          className={row.counts.failed > 0 ? "text-state-bad-fg" : undefined}
        >
          {row.counts.failed}
        </span>
      ),
      numeric: true,
    },
    {
      key: "raised",
      header: a.raised,
      cell: (row) => new Date(row.createdAt).toLocaleDateString(locale),
      numeric: true,
      tableOnly: true,
    },
  ];

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">{a.noAutoPublishBody}</p>

      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-2">
          <label
            htmlFor="imports-status"
            className="text-sm font-medium text-foreground"
          >
            {a.filterStatus}
          </label>
          <NativeSelect
            id="imports-status"
            className="w-full max-w-xs"
            value={status ?? ""}
            onChange={(event) => setParam("status", event.target.value)}
          >
            <NativeSelectOption value="">{a.filterAll}</NativeSelectOption>
            {STATUSES.map((value) => (
              <NativeSelectOption key={value} value={value}>
                {a[JOB_STATUS_KEY[value]]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>

        <div className="grid gap-2">
          <label
            htmlFor="imports-brand"
            className="text-sm font-medium text-foreground"
          >
            {a.filterBrandId}
          </label>
          <Input
            id="imports-brand"
            className="w-full max-w-xs"
            defaultValue={brandId}
            placeholder={a.filterBrandIdPlaceholder}
            onBlur={(event) => setParam("brandId", event.target.value.trim())}
          />
          <p className="max-w-xs text-xs text-muted-foreground">
            {a.filterBrandIdHint}
          </p>
        </div>

        {/*
          The door the review screens waited behind: nothing anywhere called
          POST /v1/admin/imports until this. Same placement as Add-a-shop on
          /admin/brands — the one create, at the end of the filter row.
        */}
        <div className="ms-auto">
          <StartImportButton onClick={() => setStarting(true)} />
        </div>
      </div>

      <NewImportSheet open={starting} onOpenChange={setStarting} />

      {state === "loading" && rows.length === 0 ? (
        <ListState state="loading" rows={4} />
      ) : null}

      {/* A failed later page keeps its rows; the inline retry is below. */}
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
          title={a.importsEmptyTitle}
          body={a.importsEmptyBody}
          actionLabel={a.startImport}
          onAction={() => setStarting(true)}
        />
      ) : null}

      {rows.length > 0 ? (
        <>
          <ResponsiveList
            rows={rows}
            columns={columns}
            getRowKey={(row) => row.id}
            getRowHref={(row) => `/admin/imports/${row.id}`}
            caption={a.importsCaption}
          />

          <p className="text-xs text-muted-foreground">{a.noPublishedStatus}</p>

          {feed.error ? (
            <div
              role="alert"
              data-testid="imports-inline-error"
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

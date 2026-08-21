"use client";

/**
 * /admin/imports/[id] — review before publishing.
 *
 * Composed from the domain layer: ListState, DestructiveSheet — plus shadcn's
 * Alert, Badge, Button, Card, Input and NativeSelect.
 *
 * NOTHING PUBLISHES AUTOMATICALLY, AND NOTHING GUESSES A PRICE. Real catalogs
 * carry "TEST PRODUCT" rows and prices from two seasons ago, so items land
 * staged, a human fixes them, and the products that come out the far side are
 * DRAFTS — nothing reaches a storefront without a second decision on the shop's
 * own screen.
 *
 * THE BLOCKERS ARE SHOWN BEFORE THE PUBLISH, NOT AFTER IT. A row with no name
 * or no price is refused by the publish step, and a refusal after the fact is a
 * worse experience than a flag while the reviewer is already looking at the
 * row. The API only pre-flags the price, so the name blocker is derived here —
 * see `blockersFor` in `../imports-data.ts`.
 *
 * THERE IS ONE NAME BOX, NOT TWO, AND THAT IS DELIBERATE. The backend stores a
 * flat `mappedName` and the publish step files whatever it is given as English.
 * A second Arabic box would accept text that silently never arrives, which is
 * worse than not offering it — so the gap is stated in words instead.
 */
import Link from "next/link";
import { useState } from "react";

import {
  DataField,
  DestructiveSheet,
  FieldGrid,
  ListState,
  listStateFor,
} from "@/components/loqal";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useMessages } from "@/lib/locale-context";

import { ADMIN_REQUIRED_ROLE } from "../../../shell-rules";
import {
  blockedItems,
  blockersFor,
  isPriceAcceptable,
  publishImportJob,
  updateImportItem,
  useImportItems,
  useImportJob,
  type WireImportItem,
} from "../imports-data";

const ITEM_STATUS_KEY = {
  STAGED: "itemStaged",
  MAPPED: "itemMapped",
  IMPORTED: "itemImported",
  SKIPPED: "itemSkipped",
  FAILED: "itemFailed",
} as const;

type Draft = { name: string; price: string };

export function ImportJobReview({ id }: { id: string }) {
  const t = useMessages();
  const a = t.admin;

  const job = useImportJob(id);
  const [needsAttention, setNeedsAttention] = useState(false);
  const feed = useImportItems(id, needsAttention);

  /** Per-row edits, keyed by item id. Absent means "as the API sent it". */
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState<string | null>(null);
  const [publishFailed, setPublishFailed] = useState(false);

  const jobState = listStateFor(job.error, {
    isLoading: job.isLoading,
    notFound: true,
  });

  if (jobState === "loading") return <ListState state="loading" rows={4} />;

  if (jobState === "denied") {
    return (
      <ListState
        state="denied"
        title={a.deniedTitle}
        body={a.deniedBody}
        requiredRole={ADMIN_REQUIRED_ROLE}
      />
    );
  }

  if (jobState === "notFound") {
    return (
      <ListState
        state="notFound"
        title={a.jobNotFoundTitle}
        body={a.jobNotFoundBody}
        actionLabel={a.backToImports}
        actionHref="/admin/imports"
      />
    );
  }

  if (jobState === "error" || !job.data) {
    return (
      <ListState
        state="error"
        title={a.errorTitle}
        body={a.errorBody}
        actionLabel={a.retry}
        onAction={job.reload}
      />
    );
  }

  const row = job.data;
  const items = feed.rows;
  const blocked = blockedItems(items);

  const draftFor = (item: WireImportItem): Draft =>
    drafts[item.id] ?? {
      name: item.mappedName ?? "",
      price: item.mappedPrice ?? "",
    };

  const setDraft = (item: WireImportItem, patch: Partial<Draft>) =>
    setDrafts((current) => ({
      ...current,
      [item.id]: { ...draftFor(item), ...patch },
    }));

  const saveItem = async (item: WireImportItem) => {
    const draft = draftFor(item);
    if (!isPriceAcceptable(draft.price)) return;

    setRowError(null);
    setSavingId(item.id);
    try {
      await updateImportItem(id, item.id, {
        // Empty clears the field. A missing price is a real state and never a
        // zero, so an empty box sends null rather than "0".
        mappedName: draft.name.trim() === "" ? null : draft.name.trim(),
        mappedPrice: draft.price.trim() === "" ? null : draft.price.trim(),
      });
      setDrafts((current) => {
        const next = { ...current };
        delete next[item.id];
        return next;
      });
      feed.reload();
      job.reload();
    } catch {
      setRowError(a.saveFailed);
    } finally {
      setSavingId(null);
    }
  };

  const setItemStatus = async (
    item: WireImportItem,
    status: "STAGED" | "SKIPPED"
  ) => {
    setRowError(null);
    setSavingId(item.id);
    try {
      await updateImportItem(id, item.id, { status });
      feed.reload();
      job.reload();
    } catch {
      setRowError(a.actionFailed);
    } finally {
      setSavingId(null);
    }
  };

  const publish = async () => {
    setPublishFailed(false);
    try {
      const result = await publishImportJob(id);
      setPublishing(false);
      setPublished(
        a.publishResult
          .replace("{imported}", String(result.imported))
          .replace("{failed}", String(result.failed))
      );
      feed.reload();
      job.reload();
    } catch {
      setPublishing(false);
      setPublishFailed(true);
    }
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-1">
          <h2 className="text-xl font-semibold text-foreground">
            {row.brandName}
          </h2>
          <span className="font-mono text-xs text-muted-foreground">
            {row.sourceRef ? `${row.sourceType} · ${row.sourceRef}` : row.sourceType}
          </span>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/imports">{a.backToImports}</Link>
        </Button>
      </div>

      <Card className="">
        <CardContent className="grid gap-3">
          <FieldGrid>
          {(
            [
              ["staged", a.countStaged],
              ["mapped", a.countMapped],
              ["imported", a.countImported],
              ["skipped", a.countSkipped],
              ["failed", a.countFailed],
            ] as const
          ).map(([key, label]) => (
            <DataField
              key={key}
              label={label}
              numeric
              className={
                key === "failed" && row.counts.failed > 0
                  ? "[&_dd]:text-state-bad-fg"
                  : undefined
              }
              value={<span data-count={key}>{row.counts[key]}</span>}
            />
          ))}
          </FieldGrid>
          {row.failureReason ? (
            <p role="alert" className="text-sm text-state-bad-fg">
              {row.failureReason}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Alert>
        <AlertTitle>{a.reviewTitle}</AlertTitle>
        <AlertDescription>{a.reviewNote}</AlertDescription>
      </Alert>

      <p className="text-sm text-muted-foreground">{a.neverGuessPrice}</p>
      <p className="text-xs text-muted-foreground">{a.mappedNameGap}</p>
      <p className="text-xs text-muted-foreground">{a.missingNameGap}</p>

      {/*
        The platform's own checkbox rather than shadcn's Switch.

        ENVIRONMENT ARTIFACT, reported rather than worked around silently:
        `radix-ui`'s Switch reaches `@radix-ui/react-primitive`, which resolves
        a SECOND copy of `@radix-ui/react-slot` from the monorepo root — bound
        to the root `react` rather than this app's. Rendering it throws
        "Objects are not valid as a React child" out of the wrong React's
        `Children.map`. `Button`'s Slot comes from the `radix-ui` bundle and is
        unaffected, which is why only this control was hit.

        A filter toggle is a checkbox semantically anyway, so nothing is lost:
        this is keyboard-reachable, announced correctly, and has no dependency.
      */}
      <label className="flex items-center gap-3 text-sm text-foreground">
        <input
          type="checkbox"
          className="size-4 accent-primary"
          checked={needsAttention}
          onChange={(event) => setNeedsAttention(event.target.checked)}
        />
        {a.needsAttentionOnly}
      </label>

      {blocked.length > 0 ? (
        <Alert
          data-testid="publish-blocked"
          className="border-state-wait-border bg-state-wait-bg"
        >
          <AlertTitle>
            {a.blockedBeforePublish.replace("{n}", String(blocked.length))}
          </AlertTitle>
          <AlertDescription>{a.blockedBeforePublishBody}</AlertDescription>
        </Alert>
      ) : items.length > 0 ? (
        <p role="status" className="text-sm text-state-good-fg">
          {a.nothingBlocked}
        </p>
      ) : null}

      {feed.isLoading && items.length === 0 ? (
        <ListState state="loading" rows={4} />
      ) : null}

      {/* A failed later page keeps its rows; the inline retry is below. */}
      {feed.error && items.length === 0 ? (
        <ListState
          state="error"
          title={a.errorTitle}
          body={a.errorBody}
          actionLabel={a.retry}
          onAction={feed.reload}
        />
      ) : null}

      {!feed.isLoading && !feed.error && items.length === 0 ? (
        <ListState state="empty" title={a.nothingBlocked} />
      ) : null}

      {items.map((item) => {
        const draft = draftFor(item);
        const blockers = blockersFor(item);
        const priceOk = isPriceAcceptable(draft.price);
        const busy = savingId === item.id;

        return (
          <Card key={item.id} className="" data-item={item.id}>
            <CardContent className="grid gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium text-foreground">
                  {item.sourceTitle}
                </span>
                <Badge variant="outline" data-item-status={item.status}>
                  {a[ITEM_STATUS_KEY[item.status]]}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{a.sourceTitle}</p>

              {blockers.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {blockers.includes("MISSING_NAME") ? (
                    <Badge
                      variant="outline"
                      data-blocker="MISSING_NAME"
                      className="border-state-wait-border bg-state-wait-bg text-state-wait-fg"
                    >
                      {a.missingNameFlag}
                    </Badge>
                  ) : null}
                  {blockers.includes("MISSING_PRICE") ? (
                    <Badge
                      variant="outline"
                      data-blocker="MISSING_PRICE"
                      className="border-state-wait-border bg-state-wait-bg text-state-wait-fg"
                    >
                      {a.missingPriceFlag}
                    </Badge>
                  ) : null}
                </div>
              ) : null}

              <div className="grid gap-1.5">
                <label
                  htmlFor={`item-name-${item.id}`}
                  className="text-sm font-medium text-foreground"
                >
                  {a.itemNameEn}
                </label>
                <Input
                  id={`item-name-${item.id}`}
                  value={draft.name}
                  onChange={(event) =>
                    setDraft(item, { name: event.target.value })
                  }
                />
              </div>

              <div className="grid gap-1.5">
                <label
                  htmlFor={`item-price-${item.id}`}
                  className="text-sm font-medium text-foreground"
                >
                  {a.price}
                </label>
                <Input
                  id={`item-price-${item.id}`}
                  inputMode="decimal"
                  value={draft.price}
                  aria-invalid={!priceOk}
                  onChange={(event) =>
                    setDraft(item, { price: event.target.value })
                  }
                />
                {!priceOk ? (
                  <p role="status" className="text-sm text-state-bad-fg">
                    {a.neverGuessPrice}
                  </p>
                ) : null}
              </div>

              {item.failureReason ? (
                <p role="alert" className="text-sm text-state-bad-fg">
                  {item.failureReason}
                </p>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={busy || !priceOk}
                  onClick={() => void saveItem(item)}
                >
                  {busy ? a.saving : a.saveItem}
                </Button>
                {item.status === "SKIPPED" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => void setItemStatus(item, "STAGED")}
                  >
                    {a.unskipItem}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => void setItemStatus(item, "SKIPPED")}
                  >
                    {a.skipItem}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {rowError ? (
        <p role="alert" className="text-sm text-state-bad-fg">
          {rowError}
        </p>
      ) : null}

      {feed.error && items.length > 0 ? (
        <div
          role="alert"
          data-testid="items-inline-error"
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

      {/*
        The publish button is REFUSED while anything is flagged, and the refusal
        names what to do. Publishing would reject those rows anyway; a refusal
        after the fact is worse than a flag before it. Note that the check runs
        over the rows LOADED so far — a later page can still carry a blocker,
        which is why the sheet repeats the count.
      */}
      {blocked.length > 0 ? (
        <Alert data-testid="publish-refused">
          <AlertTitle>{a.publishBlockedTitle}</AlertTitle>
          <AlertDescription>{a.publishBlockedBody}</AlertDescription>
        </Alert>
      ) : null}

      <Button
        className="min-h-11 justify-self-start"
        disabled={blocked.length > 0 || items.length === 0}
        onClick={() => setPublishing(true)}
      >
        {a.publishAction}
      </Button>

      {published ? (
        <p role="status" className="text-sm text-state-good-fg">
          {published}
        </p>
      ) : null}
      {publishFailed ? (
        <p role="alert" className="text-sm text-state-bad-fg">
          {a.actionFailed}
        </p>
      ) : null}

      <DestructiveSheet
        open={publishing}
        onOpenChange={setPublishing}
        title={a.publishTitle}
        description={a.publishDesc}
        consequences={[
          a.publishAsDraft,
          a.publishSkipsSkipped,
          a.publishRehosts,
        ]}
        confirmLabel={a.publishAction}
        cancelLabel={a.keepJob}
        onConfirm={publish}
      />
    </div>
  );
}

"use client";

/**
 * /admin/reviews — every review, newest first, with a Hide action per row.
 *
 * Composed from the domain layer: ResponsiveList, ListState, DestructiveSheet —
 * plus shadcn's Alert, Badge, Button, Input, NativeSelect and Textarea.
 *
 * THE REASON IS REQUIRED AND IS NOT A FORMALITY. A review is never deleted and
 * there is no lesser tier to have moved it to, so the reason IS the defence
 * against an accusation of censorship. The confirm stays disabled until one is
 * written, and the sheet says what the reason is for.
 *
 * An API without the list route (404) gets the older screen: hide one review by
 * its id. See `reviews-data.ts`.
 */
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import {
  DestructiveSheet,
  ListState,
  ResponsiveList,
  listStateFor,
  type ResponsiveListColumn,
} from "@/components/loqal";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api";
import { useMessages } from "@/lib/locale-context";

import { ADMIN_REQUIRED_ROLE } from "../../shell-rules";
import { BrandFilter } from "../brands/brand-filter";
import {
  hideReview,
  isHiddenFilter,
  isHideable,
  isReviewId,
  readRating,
  replyText,
  useAdminReviews,
  type AdminReview,
  type HiddenFilter,
} from "./reviews-data";

const dateOnly = (iso: string) => {
  const parsed = Date.parse(iso);
  return Number.isNaN(parsed) ? iso : new Date(parsed).toISOString().slice(0, 10);
};

export function ReviewsScreen() {
  const a = useMessages().admin;
  const router = useRouter();
  const params = useSearchParams();

  const rawHidden = params.get("hidden");
  const hidden: HiddenFilter = isHiddenFilter(rawHidden) ? rawHidden : "all";
  const brandId = params.get("brandId") ?? "";
  const rating = readRating(params.get("rating"));

  const feed = useAdminReviews(hidden, brandId, rating);
  const [target, setTarget] = useState<AdminReview | null>(null);
  const [reason, setReason] = useState("");
  const [outcome, setOutcome] = useState<"hidden" | "failed" | null>(null);

  // An older API has no list route; it can still hide by id.
  if (feed.error instanceof ApiError && feed.error.isNotFound) {
    return <HideById />;
  }

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
    router.replace(query ? `/admin/reviews?${query}` : "/admin/reviews");
  };

  const confirmHide = async () => {
    if (!target || !isHideable(reason)) return;
    setOutcome(null);
    try {
      await hideReview(target.id, reason);
      setOutcome("hidden");
      feed.reload();
    } catch {
      setOutcome("failed");
    } finally {
      setTarget(null);
      setReason("");
    }
  };

  const columns: readonly ResponsiveListColumn<AdminReview>[] = [
    {
      key: "body",
      header: a.reviewBody,
      cell: (row) => (
        <span className="grid gap-1">
          <span className="whitespace-pre-line text-sm text-foreground">
            {row.body || a.reviewNoText}
          </span>
          {replyText(row.brandReply) ? (
            <span className="text-xs text-muted-foreground">
              {a.reviewReply}: {replyText(row.brandReply)}
            </span>
          ) : null}
        </span>
      ),
      primary: true,
    },
    {
      key: "brand",
      header: a.brand,
      cell: (row) => row.brandName || row.brandId,
      meta: true,
    },
    {
      key: "rating",
      header: a.reviewRating,
      // The number is the fact; the stars are decoration.
      cell: (row) => (
        <span aria-label={a.reviewRatingOf.replace("{n}", String(row.rating))}>
          {`${row.rating}/5`}
        </span>
      ),
      numeric: true,
    },
    {
      key: "date",
      header: a.reviewDate,
      cell: (row) => dateOnly(row.createdAt),
      numeric: true,
    },
    {
      key: "status",
      header: a.status,
      cell: (row) =>
        row.hiddenAt ? (
          <span className="grid gap-0.5">
            <Badge variant="outline" data-hidden="true">
              {a.reviewHiddenBadge}
            </Badge>
            {row.hiddenReason ? (
              <span className="text-xs text-muted-foreground">{row.hiddenReason}</span>
            ) : null}
          </span>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setOutcome(null);
              setReason("");
              setTarget(row);
            }}
          >
            {a.hide}
          </Button>
        ),
    },
  ];

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">{a.reviewsNote}</p>

      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-2">
          <label htmlFor="reviews-hidden" className="text-sm font-medium text-foreground">
            {a.filterStatus}
          </label>
          <NativeSelect
            id="reviews-hidden"
            className="w-full max-w-xs"
            value={hidden}
            onChange={(event) =>
              setParam("hidden", event.target.value === "all" ? "" : event.target.value)
            }
          >
            <NativeSelectOption value="all">{a.filterAll}</NativeSelectOption>
            <NativeSelectOption value="visible">{a.reviewVisible}</NativeSelectOption>
            <NativeSelectOption value="hidden">{a.reviewHiddenBadge}</NativeSelectOption>
          </NativeSelect>
        </div>
        <div className="grid gap-2">
          <label htmlFor="reviews-rating" className="text-sm font-medium text-foreground">
            {a.reviewRating}
          </label>
          <NativeSelect
            id="reviews-rating"
            className="w-full max-w-xs"
            value={rating === null ? "" : String(rating)}
            onChange={(event) => setParam("rating", event.target.value)}
          >
            <NativeSelectOption value="">{a.filterAll}</NativeSelectOption>
            {[5, 4, 3, 2, 1].map((n) => (
              <NativeSelectOption key={n} value={String(n)}>
                {a.reviewRatingOf.replace("{n}", String(n))}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <BrandFilter
          id="reviews-brand"
          value={brandId}
          onChange={(value) => setParam("brandId", value)}
        />
      </div>

      {outcome === "hidden" ? (
        <p role="status" className="text-sm text-state-good-fg">
          {a.reviewHidden}
        </p>
      ) : null}
      {outcome === "failed" ? (
        <p role="alert" className="text-sm text-state-bad-fg">
          {a.actionFailed}
        </p>
      ) : null}

      {state === "loading" && rows.length === 0 ? <ListState state="loading" rows={4} /> : null}

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

      {state === "empty" ? <ListState state="empty" title={a.reviewsEmpty} /> : null}

      {rows.length > 0 ? (
        <>
          <ResponsiveList
            rows={rows}
            columns={columns}
            getRowKey={(row) => row.id}
            caption={a.reviewsCaption}
          />
          {feed.error ? (
            <div
              role="alert"
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

      <DestructiveSheet
        open={target !== null}
        onOpenChange={(open) => {
          if (!open) setTarget(null);
        }}
        title={a.hideTitle}
        description={target ? `${target.brandName || target.brandId} · ${target.rating}/5` : undefined}
        consequences={[a.hideNeverDeleted, a.hideReasonLogged, a.hideAffectsScore]}
        confirmLabel={isHideable(reason) ? a.hideTitle : a.reasonRequired}
        cancelLabel={a.keepReview}
        onConfirm={confirmHide}
      >
        <div className="grid gap-2">
          {target?.body ? (
            <p className="whitespace-pre-line text-sm text-foreground">{target.body}</p>
          ) : null}
          <label htmlFor="review-reason" className="text-sm font-medium text-foreground">
            {a.hideReason}
          </label>
          <Textarea
            id="review-reason"
            value={reason}
            placeholder={a.hideReasonPlaceholder}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>
      </DestructiveSheet>
    </div>
  );
}

/** The older API's only action: hide one review whose id somebody sent you. */
function HideById() {
  const a = useMessages().admin;

  const [id, setId] = useState("");
  const [reason, setReason] = useState("");
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState<"hidden" | "failed" | "denied" | null>(null);

  const idLooksRight = id.trim() === "" || isReviewId(id);
  const ready = isReviewId(id) && isHideable(reason);

  const confirm = async () => {
    setOutcome(null);
    try {
      await hideReview(id, reason);
      setOpen(false);
      setId("");
      setReason("");
      setOutcome("hidden");
    } catch (thrown) {
      setOpen(false);
      setOutcome(
        thrown instanceof ApiError && thrown.isPermissionDenied ? "denied" : "failed"
      );
    }
  };

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">{a.reviewsByIdNote}</p>

      <div className="grid max-w-xl gap-2">
        <label htmlFor="review-id" className="text-sm font-medium text-foreground">
          {a.reviewIdLabel}
        </label>
        <Input
          id="review-id"
          value={id}
          placeholder={a.reviewIdPlaceholder}
          aria-invalid={!idLooksRight}
          aria-describedby={!idLooksRight ? "review-id-problem" : undefined}
          onChange={(event) => setId(event.target.value)}
        />
        {!idLooksRight ? (
          <p id="review-id-problem" role="status" className="text-sm text-state-bad-fg">
            {a.reviewIdInvalid}
          </p>
        ) : null}
      </div>

      <div className="grid max-w-xl gap-2">
        <label htmlFor="review-reason" className="text-sm font-medium text-foreground">
          {a.hideReason}
        </label>
        <Textarea
          id="review-reason"
          value={reason}
          placeholder={a.hideReasonPlaceholder}
          onChange={(event) => setReason(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">{a.hideReasonLogged}</p>
      </div>

      <Button
        variant="destructive"
        className="min-h-11 justify-self-start"
        disabled={!ready}
        onClick={() => setOpen(true)}
      >
        {a.hideTitle}
      </Button>

      {outcome === "hidden" ? (
        <p role="status" className="text-sm text-state-good-fg">
          {a.reviewHidden}
        </p>
      ) : null}
      {outcome === "failed" ? (
        <p role="alert" className="text-sm text-state-bad-fg">
          {a.actionFailed}
        </p>
      ) : null}
      {outcome === "denied" ? (
        <Alert role="alert" className="border-state-bad-border bg-state-bad-bg">
          <AlertTitle>{a.deniedTitle}</AlertTitle>
          <AlertDescription>
            {a.deniedBody} {ADMIN_REQUIRED_ROLE}
          </AlertDescription>
        </Alert>
      ) : null}

      <DestructiveSheet
        open={open}
        onOpenChange={setOpen}
        title={a.hideTitle}
        description={a.hideDesc}
        consequences={[a.hideNeverDeleted, a.hideReasonLogged, a.hideAffectsScore]}
        confirmLabel={a.hideTitle}
        cancelLabel={a.keepReview}
        onConfirm={confirm}
      >
        <p className="font-mono text-xs text-muted-foreground">{id}</p>
      </DestructiveSheet>
    </div>
  );
}

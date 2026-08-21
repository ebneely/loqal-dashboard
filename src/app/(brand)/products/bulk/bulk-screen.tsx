"use client";

/**
 * /products/bulk — US-BRAND-005, the screen that wins brands.
 *
 * A shop with no website drops forty phone photos. Each becomes a DRAFT
 * product. Then names and prices are filled in A GRID, not a wizard, because a
 * wizard turns forty products into forty screens and a brand facing two weeks
 * of typing never finishes.
 *
 * Composed from the domain layer: ListState, MobileActionBar — plus shadcn's
 * Card, Button, Input, Progress and Field.
 *
 * Three decisions the screen is built around:
 *
 *  a. The photos go STRAIGHT TO R2 on a presigned PUT. Forty images pushed
 *     through a Nest process on Egyptian mobile data is not a viable upload
 *     path, so the API only ever sees a key. Progress is per file, because one
 *     bar across forty photos tells a shop owner nothing about the one that is
 *     stuck.
 *  b. A save answers ONE RESULT PER ROW. Thirty-nine good rows land even when
 *     the fortieth does not, and the failing row says why, next to itself.
 *  c. Publishing REFUSES a product with no price and says so. No default, no
 *     guess, no zero.
 */
import Link from "next/link";
import { useEffect, useState } from "react";

import type { BulkPublishResult } from "@loqal/contracts/catalog.contract";

import {
  ListState,
  MobileActionBar,
  MobileActionBarSpacer,
  StatusPill,
  listStateFor,
} from "@/components/loqal";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useLocale, useMessages } from "@/lib/locale-context";

import {
  createDrafts,
  publishBulk,
  saveBulkRows,
  uploadOne,
  useProducts,
} from "../catalog-data";
import {
  applyPublishResult,
  applySaveOutcomes,
  bulkSaveRequest,
  localBlockers,
  publishReasonLabel,
  rowFromProduct,
  rowPriceIsMalformed,
  runPool,
  saveTally,
  uploadTally,
  uploadedMediaIds,
  UPLOAD_CONCURRENCY,
  type GridRow,
  type UploadItem,
} from "./bulk-grid";

/** jsdom has no object URLs, and a missing preview is not a broken screen. */
const previewFor = (file: File): string | null => {
  if (typeof URL === "undefined" || typeof URL.createObjectURL !== "function") {
    return null;
  }
  try {
    return URL.createObjectURL(file);
  } catch {
    return null;
  }
};

export function BulkScreen() {
  const t = useMessages();
  const b = t.brand;
  const locale = useLocale();

  const drafts = useProducts({ status: "DRAFT", categoryId: null });

  const [rows, setRows] = useState<readonly GridRow[]>([]);
  const [seeded, setSeeded] = useState(false);
  const [uploads, setUploads] = useState<readonly UploadItem[]>([]);
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveNote, setSaveNote] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishNote, setPublishNote] = useState<string | null>(null);

  /**
   * Existing drafts open in the grid too.
   *
   * A brand that dropped photos yesterday and ran out of time must come back to
   * the same grid rather than a list of forty half-finished products it has to
   * open one at a time.
   */
  useEffect(() => {
    if (seeded || drafts.isLoading || drafts.error) return;
    setRows(drafts.rows.map((product) => rowFromProduct(product)));
    setSeeded(true);
  }, [drafts.rows, drafts.isLoading, drafts.error, seeded]);

  const patchUpload = (key: string, patch: Partial<UploadItem>) =>
    setUploads((current) =>
      current.map((item) => (item.key === key ? { ...item, ...patch } : item))
    );

  const onPick = (picked: FileList | null) => {
    if (!picked || picked.length === 0) return;
    const files = Array.from(picked);
    const stamp = Date.now();
    const items: UploadItem[] = files.map((file, index) => ({
      key: `${stamp}-${index}-${file.name}`,
      fileName: file.name,
      status: "queued",
      progress: 0,
      mediaId: null,
      error: null,
      previewUrl: previewFor(file),
    }));

    setUploads((current) => [...current, ...items]);

    void runPool(files, UPLOAD_CONCURRENCY, async (file, index) => {
      const item = items[index] as UploadItem;
      patchUpload(item.key, { status: "uploading", progress: 0.05 });
      try {
        const { mediaId } = await uploadOne(file, {
          onProgress: (fraction) => patchUpload(item.key, { progress: fraction }),
        });
        patchUpload(item.key, { status: "done", progress: 1, mediaId });
      } catch {
        patchUpload(item.key, { status: "failed", error: b.uploadFailed });
      }
    });
  };

  const tally = uploadTally(uploads);
  const readyMediaIds = uploadedMediaIds(uploads);

  const makeDrafts = async () => {
    if (readyMediaIds.length === 0) return;
    setDrafting(true);
    setDraftError(false);
    try {
      const created = await createDrafts(readyMediaIds);
      /*
        bulk-draft answers one product per media id, in the order the ids were
        sent — which is what lets each new row keep the photo the brand is
        looking at. The API serves no URL for an uploaded image, so this local
        blob is the only preview that exists.
      */
      const previews = uploads.filter(
        (item) => item.status === "done" && item.mediaId !== null
      );
      setRows((current) => [
        ...created.map((product, index) =>
          rowFromProduct(product, previews[index]?.previewUrl ?? null)
        ),
        ...current,
      ]);
      setUploads((current) => current.filter((item) => item.status !== "done"));
    } catch {
      setDraftError(true);
    } finally {
      setDrafting(false);
    }
  };

  const setRow = (productId: string, patch: Partial<GridRow>) =>
    setRows((current) =>
      current.map((row) =>
        row.productId === productId ? { ...row, ...patch } : row
      )
    );

  const saveAll = async () => {
    const request = bulkSaveRequest(rows);
    if (request.bodies.length === 0) {
      setSaveNote(b.bulkNothingToSave);
      return;
    }
    setSaving(true);
    setSaveNote(null);
    try {
      const outcomes = await saveBulkRows(request.bodies);
      setRows((current) => applySaveOutcomes(current, outcomes));
      const counted = saveTally(outcomes);
      /*
        The count is the headline and the row is the detail. "Something failed"
        over forty rows is useless; "39 of 40 saved" plus a named row is the
        whole point of a per-row result.
      */
      setSaveNote(
        counted.failed === 0
          ? b.bulkSavedAll.replace("{n}", String(counted.ok))
          : b.bulkSavedSome
              .replace("{ok}", String(counted.ok))
              .replace("{n}", String(counted.total))
      );
    } catch {
      setSaveNote(b.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  const publishAll = async () => {
    const ids = rows.filter((row) => row.status === "DRAFT").map((row) => row.productId);
    if (ids.length === 0) return;
    setPublishing(true);
    setPublishNote(null);
    try {
      const result: BulkPublishResult = await publishBulk(ids);
      setRows((current) => applyPublishResult(current, result));
      setPublishNote(
        result.failed.length === 0
          ? b.bulkPublishedAll.replace("{n}", String(result.published.length))
          : b.bulkPublishedSome
              .replace("{ok}", String(result.published.length))
              .replace("{n}", String(ids.length))
      );
    } catch {
      setPublishNote(b.saveFailed);
    } finally {
      setPublishing(false);
    }
  };

  const listState = listStateFor(drafts.error, { isLoading: drafts.isLoading });

  return (
    <div className="grid gap-6">
      <section aria-label={b.bulkTitle} className="grid gap-2">
        <h1 className="text-lg font-semibold text-foreground">{b.bulkTitle}</h1>
        <p className="text-sm text-muted-foreground">{b.bulkSub}</p>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 1. The drop                                                         */}
      {/* ------------------------------------------------------------------ */}
      <section aria-label={b.bulkStepDrop} className="grid gap-3">
        <Card className="">
          <CardHeader className="gap-1">
            <CardTitle className="text-base">{b.bulkStepDrop}</CardTitle>
            <CardDescription>{b.uploadPlaceholder}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <label
              htmlFor="bulk-photo-input"
              className="text-sm font-medium text-foreground"
            >
              {b.addPhotos}
            </label>
            <Input
              id="bulk-photo-input"
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              className="min-h-12"
              onChange={(event) => onPick(event.target.files)}
            />

            {uploads.length > 0 ? (
              <ul className="grid gap-2" data-testid="bulk-uploads">
                {uploads.map((item) => (
                  <li
                    key={item.key}
                    className="grid gap-1 rounded-md border border-border p-3"
                    data-testid={`bulk-upload-${item.fileName}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate text-sm text-foreground">
                        {item.fileName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {item.status === "failed"
                          ? b.uploadFailed
                          : item.status === "done"
                            ? b.bulkDone
                            : b.uploading}
                      </span>
                    </div>
                    {/* Per file, not per batch. */}
                    <Progress value={Math.round(item.progress * 100)} />
                    {item.error ? (
                      <p role="alert" className="text-xs text-destructive">
                        {item.error} · {b.uploadRetryHint}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <Button
                className="min-h-12"
                disabled={readyMediaIds.length === 0 || drafting || tally.busy}
                onClick={() => void makeDrafts()}
              >
                {drafting
                  ? b.saving
                  : b.createDrafts.replace("{n}", String(readyMediaIds.length))}
              </Button>
              {tally.failed > 0 ? (
                <span className="text-xs text-muted-foreground">
                  {b.uploadSomeFailed.replace("{n}", String(tally.failed))}
                </span>
              ) : null}
            </div>

            {draftError ? (
              <p role="alert" className="text-sm text-destructive">
                {b.draftsFailed}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 2. The grid                                                         */}
      {/* ------------------------------------------------------------------ */}
      <section aria-label={b.bulkStepFill} className="grid gap-3">
        <h2 className="text-base font-semibold text-foreground">
          {b.bulkStepFill}
        </h2>
        <p className="text-sm text-muted-foreground">{b.bulkGridNote}</p>

        {listState === "loading" ? <ListState state="loading" rows={3} /> : null}

        {listState === "denied" ? (
          <ListState
            state="denied"
            title={b.catalogOnlyTitle}
            body={b.catalogOnlyBody}
            requiredRole="BRAND_OWNER"
          />
        ) : null}

        {listState === "error" ? (
          <ListState
            state="error"
            title={b.productsErrorTitle}
            body={b.errorBody}
            actionLabel={b.retry}
            onAction={drafts.reload}
          />
        ) : null}

        {listState === null && rows.length === 0 ? (
          <ListState
            state="empty"
            title={b.bulkEmptyTitle}
            body={b.bulkEmptyBody}
          />
        ) : null}

        {saveNote ? (
          <p
            role="status"
            data-testid="bulk-save-note"
            className="text-sm font-medium text-foreground"
          >
            {saveNote}
          </p>
        ) : null}

        {publishNote ? (
          <p
            role="status"
            data-testid="bulk-publish-note"
            className="text-sm font-medium text-foreground"
          >
            {publishNote}
          </p>
        ) : null}

        {rows.length > 0 ? (
          <ul className="grid gap-3" data-testid="bulk-grid">
            {rows.map((row) => {
              const blockers = localBlockers(row);
              const malformed = rowPriceIsMalformed(row);
              return (
                <li
                  key={row.productId}
                  data-testid={`bulk-row-${row.productId}`}
                  className="grid gap-3 rounded-lg border border-border p-3 md:grid-cols-[auto_1fr_1fr_10rem] md:items-end"
                >
                  {/*
                    A plain <img>, deliberately. The source is a blob URL for a
                    file that is already on this device, so there is nothing for
                    next/image to fetch, optimise or cache — and the API serves
                    no URL for an uploaded photo at all.
                  */}
                  {row.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={row.previewUrl}
                      alt={b.bulkPhotoAlt}
                      className="size-16 rounded-md object-cover"
                    />
                  ) : (
                    <span className="flex size-16 items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
                      {b.file}
                    </span>
                  )}

                  <div className="grid gap-1">
                    <label
                      htmlFor={`bulk-name-${row.productId}`}
                      className="text-xs text-muted-foreground"
                    >
                      {locale === "ar" ? b.nameArabic : b.nameEn}
                    </label>
                    <Input
                      id={`bulk-name-${row.productId}`}
                      className="min-h-12"
                      dir={locale === "ar" ? "rtl" : undefined}
                      value={locale === "ar" ? row.nameAr : row.nameEn}
                      onChange={(event) =>
                        setRow(
                          row.productId,
                          locale === "ar"
                            ? { nameAr: event.target.value }
                            : { nameEn: event.target.value }
                        )
                      }
                    />
                  </div>

                  <div className="grid gap-1">
                    <label
                      htmlFor={`bulk-price-${row.productId}`}
                      className="text-xs text-muted-foreground"
                    >
                      {b.priceField}
                    </label>
                    <Input
                      id={`bulk-price-${row.productId}`}
                      className="min-h-12"
                      inputMode="decimal"
                      value={row.price}
                      onChange={(event) =>
                        setRow(row.productId, { price: event.target.value })
                      }
                    />
                  </div>

                  <div className="grid gap-1">
                    <StatusPill
                      kind="ProductStatus"
                      value={row.status}
                      size="sm"
                      locale={locale}
                    />

                    {/* What this row is still missing, before anything is sent. */}
                    {blockers.length > 0 ? (
                      <span
                        className="text-xs text-state-act-fg"
                        data-testid={`bulk-blocked-${row.productId}`}
                      >
                        {blockers.includes("price") ? b.needsPrice : b.needsName}
                      </span>
                    ) : null}

                    {malformed ? (
                      <span role="alert" className="text-xs text-destructive">
                        {b.priceMalformed}
                      </span>
                    ) : null}

                    {/* This row's own failure, named, next to this row. */}
                    {row.saveError ? (
                      <span
                        role="alert"
                        data-testid={`bulk-row-error-${row.productId}`}
                        className="text-xs text-destructive"
                      >
                        {b.bulkRowNotSaved} · {row.saveError}
                      </span>
                    ) : null}

                    {row.publishReasons.length > 0 ? (
                      <span
                        role="alert"
                        data-testid={`bulk-publish-error-${row.productId}`}
                        className="text-xs text-destructive"
                      >
                        {b.bulkRowNotPublished} ·{" "}
                        {row.publishReasons
                          .map((reason) =>
                            publishReasonLabel(reason, {
                              noPrice: b.publishNoPrice,
                              noName: b.publishNoName,
                            })
                          )
                          .join(" · ")}
                      </span>
                    ) : null}

                    {row.saved && !row.saveError ? (
                      <span className="text-xs text-muted-foreground">
                        {b.savedOk}
                      </span>
                    ) : null}

                    <Link
                      href={`/products/${row.productId}`}
                      className="text-xs underline-offset-4 hover:underline"
                    >
                      {b.openProduct}
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>

      {rows.length > 0 ? (
        <>
          <section
            aria-label={b.save}
            data-testid="bulk-desktop-actions"
            className="hidden gap-3 md:flex"
          >
            <Button
              className="min-h-12"
              disabled={saving}
              onClick={() => void saveAll()}
            >
              {saving
                ? b.saving
                : b.bulkSaveAction.replace("{n}", String(rows.length))}
            </Button>
            <Button
              variant="outline"
              className="min-h-12"
              disabled={publishing}
              onClick={() => void publishAll()}
            >
              {publishing ? b.saving : b.publish}
            </Button>
          </section>

          {/*
            Thumb reach. This whole screen is bulk data entry on a phone, so the
            save lives at the bottom of the viewport rather than the top of a
            header the reader has to shuffle the phone down their palm to reach.
          */}
          <MobileActionBar hint={b.bulkGridNote}>
            <span className="grid gap-2" data-testid="bulk-action-bar">
              <Button
                className="min-h-14 w-full text-base"
                disabled={saving}
                onClick={() => void saveAll()}
              >
                {saving
                  ? b.saving
                  : b.bulkSaveAction.replace("{n}", String(rows.length))}
              </Button>
              <Button
                variant="outline"
                className="min-h-12 w-full"
                disabled={publishing}
                onClick={() => void publishAll()}
              >
                {publishing ? b.saving : b.publish}
              </Button>
            </span>
          </MobileActionBar>
          <MobileActionBarSpacer />
        </>
      ) : null}
    </div>
  );
}

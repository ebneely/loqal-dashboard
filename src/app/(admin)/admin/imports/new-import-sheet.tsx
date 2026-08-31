"use client";

/**
 * Start an import — the only way to create a job from this console.
 *
 * Composed the way ../brands/new-shop-sheet.tsx is: shadcn's Dialog, Label,
 * Input, Textarea, NativeSelect, Button and Alert are the arrangement, the
 * pure rules live in `new-import-form.ts`, and the writes live in
 * `imports-data.ts`. Until this dialog the review screens sat behind a list
 * nothing could ever put a job into — the two endpoints that start one
 * (`POST /v1/admin/imports/uploads`, `POST /v1/admin/imports`) had no caller
 * anywhere in this repository.
 *
 * THE CSV TRAVELS AS TEXT. The upload route takes `{ content }` in a JSON
 * body — there is no multipart route on this plane — so the attached file is
 * read in the browser and lands in the same textarea a pasted price list
 * does. That is not a workaround wearing a feature's clothes: the admin sees
 * exactly the text the backend will stage, and can fix a stray header row
 * before the job exists rather than in the review grid after it.
 *
 * ON SUCCESS IT NAVIGATES to the new job's detail rather than staying open.
 * The create stages synchronously, so by the time it answers there is a
 * counted, reviewable job — and reviewing it is the entire next act. Nothing
 * here needs to survive the way the shop sheet's invite link does.
 */
import { PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useMessages } from "@/lib/locale-context";

import { useAdminBrands } from "../brands/brands-data";
import { createImportJob, uploadImportCsv } from "./imports-data";
import {
  OFFERED_SOURCES,
  emptyImportDraft,
  isOfferedSource,
  isSubmittable,
  needsCsv,
  type NewImportDraft,
  type OfferedSource,
} from "./new-import-form";

export type NewImportSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type Failure = "none" | "file" | "request";

/** Same rhythm as the shop sheet's slug check: one request per pause, not per key. */
const SEARCH_DEBOUNCE_MS = 400;

export function NewImportSheet({ open, onOpenChange }: NewImportSheetProps) {
  const t = useMessages();
  const a = t.admin;
  const router = useRouter();

  const [draft, setDraft] = useState<NewImportDraft>(emptyImportDraft);
  /**
   * The pick is kept as `{id, name}` rather than the id alone so it SURVIVES
   * the search changing underneath it: a narrowed list that no longer carries
   * the chosen shop must not silently unchoose it, so the select re-lists it
   * from here.
   */
  const [picked, setPicked] = useState<{ id: string; name: string } | null>(
    null
  );
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<Failure>("none");

  useEffect(() => {
    const timer = setTimeout(
      () => setDebounced(search.trim()),
      SEARCH_DEBOUNCE_MS
    );
    return () => clearTimeout(timer);
  }, [search]);

  /** Reuses /admin/brands' own read, gated so a closed dialog fetches nothing. */
  const brands = useAdminBrands(null, debounced, open);

  const sourceLabel: Record<OfferedSource, string> = {
    CSV: a.sourceCsv,
    FEED: a.sourceFeed,
    JSONLD: a.sourceJsonld,
  };

  const pickBrand = (id: string) => {
    const row =
      brands.rows.find((brand) => brand.id === id) ??
      (picked?.id === id ? picked : null);
    setPicked(row ? { id: row.id, name: row.name } : null);
    setDraft((current) => ({ ...current, brandId: row ? row.id : "" }));
  };

  const onFile = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    try {
      const content = await file.text();
      if (!content.trim()) throw new Error("The file is empty");
      setDraft((current) => ({ ...current, csv: content }));
      setFileName(file.name);
      setFailure((current) => (current === "file" ? "none" : current));
    } catch {
      setFileName(null);
      setFailure("file");
    }
  };

  const submit = async () => {
    setPending(true);
    setFailure("none");
    try {
      /*
        Two writes, in order. If the create fails after the upload succeeded,
        the draft is kept and a retry uploads again — an orphaned object in
        the uploads prefix is storage lint; a lost price list is an admin
        retyping a shop's catalogue.
      */
      const sourceRef = needsCsv(draft.sourceType)
        ? (await uploadImportCsv(draft.csv)).uploadId
        : draft.url.trim();
      const job = await createImportJob({
        brandId: draft.brandId,
        sourceType: draft.sourceType,
        sourceRef,
      });
      close(false);
      router.push(`/admin/imports/${job.id}`);
    } catch {
      setFailure("request");
    } finally {
      setPending(false);
    }
  };

  const close = (next: boolean) => {
    if (!next) {
      setDraft(emptyImportDraft);
      setPicked(null);
      setSearch("");
      setDebounced("");
      setFileName(null);
      setFailure("none");
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      {/* Same modal geometry as the shop sheet, same reasons: capped height,
          only the body scrolls, padding per region. */}
      <DialogContent className="grid max-h-[85svh] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="space-y-1.5 border-b border-border px-6 pt-6 pb-4 text-start">
          <DialogTitle className="text-lg">{a.startImport}</DialogTitle>
          <DialogDescription>{a.startImportDesc}</DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 gap-5 overflow-y-auto px-6 py-5">
          {failure === "request" ? (
            <Alert variant="destructive" role="alert">
              <AlertTitle>{a.saveFailed}</AlertTitle>
              <AlertDescription>{a.errorBody}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-2">
            <Label htmlFor="new-import-brand-search">
              {a.importBrandSearchLabel}
            </Label>
            <Input
              id="new-import-brand-search"
              value={search}
              placeholder={a.importBrandSearchPlaceholder}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="new-import-brand">{a.importBrandPickLabel}</Label>
            <NativeSelect
              id="new-import-brand"
              value={draft.brandId}
              onChange={(event) => pickBrand(event.target.value)}
            >
              <NativeSelectOption value="">
                {a.importBrandPick}
              </NativeSelectOption>
              {/* The chosen shop stays listed even when the search no longer
                  matches it — see `picked`'s comment. */}
              {picked && !brands.rows.some((row) => row.id === picked.id) ? (
                <NativeSelectOption value={picked.id}>
                  {picked.name}
                </NativeSelectOption>
              ) : null}
              {brands.rows.map((row) => (
                <NativeSelectOption key={row.id} value={row.id}>
                  {row.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            {brands.error ? (
              <div
                role="alert"
                className="flex flex-wrap items-center gap-3 rounded-md border border-state-bad-border bg-state-bad-bg px-3 py-2"
              >
                <span className="text-sm text-foreground">
                  {a.importBrandsFailed}
                </span>
                <Button variant="outline" size="sm" onClick={brands.reload}>
                  {a.retry}
                </Button>
              </div>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="new-import-source">{a.importSourceLabel}</Label>
            <NativeSelect
              id="new-import-source"
              value={draft.sourceType}
              aria-describedby="new-import-source-note"
              onChange={(event) => {
                const value = event.target.value;
                if (isOfferedSource(value)) {
                  setDraft((current) => ({ ...current, sourceType: value }));
                }
              }}
            >
              {OFFERED_SOURCES.map((value) => (
                <NativeSelectOption key={value} value={value}>
                  {sourceLabel[value]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <p
              id="new-import-source-note"
              className="text-xs text-muted-foreground"
            >
              {a.importSourceHint}
            </p>
          </div>

          {needsCsv(draft.sourceType) ? (
            <div className="grid gap-2">
              <Label htmlFor="new-import-file">{a.chooseCsvFile}</Label>
              <Input
                id="new-import-file"
                type="file"
                accept=".csv,text/csv,text/plain"
                className="min-h-12"
                onChange={(event) => void onFile(event.target.files)}
              />
              {failure === "file" ? (
                <p className="text-xs text-state-bad-fg" role="alert">
                  {a.csvReadFailed}
                </p>
              ) : fileName ? (
                <p className="text-xs text-muted-foreground" aria-live="polite">
                  {a.csvAttached.replace("{name}", fileName)}
                </p>
              ) : null}
              <Label htmlFor="new-import-csv">{a.csvLabel}</Label>
              <Textarea
                id="new-import-csv"
                rows={6}
                dir="ltr"
                className="font-mono text-xs"
                value={draft.csv}
                aria-describedby="new-import-csv-note"
                onChange={(event) => {
                  setDraft((current) => ({
                    ...current,
                    csv: event.target.value,
                  }));
                  // Edited by hand, so the text is no longer that file.
                  setFileName(null);
                }}
              />
              <p
                id="new-import-csv-note"
                className="text-xs text-muted-foreground"
              >
                {a.csvHint}
              </p>
            </div>
          ) : (
            <div className="grid gap-2">
              <Label htmlFor="new-import-url">{a.importUrlLabel}</Label>
              <Input
                id="new-import-url"
                type="url"
                inputMode="url"
                dir="ltr"
                className="font-mono"
                value={draft.url}
                aria-describedby="new-import-url-note"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    url: event.target.value,
                  }))
                }
              />
              <p
                id="new-import-url-note"
                className="text-xs text-muted-foreground"
              >
                {a.importUrlHint}
              </p>
            </div>
          )}
        </div>

        <div className="border-t border-border px-6 py-4">
          <Button
            className="min-h-12 w-full min-w-40"
            disabled={pending || !isSubmittable(draft)}
            onClick={() => void submit()}
          >
            {pending ? a.startingImport : a.startImportAction}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** The trigger, so the list screen holds one piece of state and not two. */
export function StartImportButton({ onClick }: { onClick: () => void }) {
  const a = useMessages().admin;

  return (
    <Button className="min-h-11" onClick={onClick}>
      <PlusIcon aria-hidden />
      {a.startImport}
    </Button>
  );
}

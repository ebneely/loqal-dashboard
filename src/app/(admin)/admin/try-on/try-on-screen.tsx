"use client";

/**
 * /admin/try-on — the budget governor.
 *
 * Composed from the domain layer: ListState, DestructiveSheet — plus shadcn's
 * Alert, Button, Card, Input, NativeSelect, Progress and Separator.
 *
 * NOTHING HERE CAN BE EXCEEDED BY A RUSH, and the whole screen is built to make
 * that legible before the invoice arrives. At 85% of the ceiling the next
 * render drops to the fallback model; at 100% nothing new is rendered at all
 * and the cache answers. Those two thresholds are drawn ON the gauge rather
 * than described under it, because the question an admin has is "how close are
 * we", and a percentage alone does not answer it.
 *
 * THE STATE IS THE SERVER'S. It is not recomputed from `percentUsed` here —
 * see `try-on-data.ts` for why that distinction is load-bearing.
 *
 * SWITCHING THE MODEL IS BEHIND A SHEET because it takes effect on the very
 * next render, with no deploy and no queue drain, and it changes the cost per
 * render — so the same ceiling buys a different number of images. Nothing
 * re-renders: images already produced keep the look of the model that made them.
 */
import { useEffect, useState } from "react";

import { DestructiveSheet, ListState, listStateFor } from "@/components/loqal";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useLocale, useMessages } from "@/lib/locale-context";

import { ADMIN_REQUIRED_ROLE } from "../../shell-rules";
import {
  ceilingIsZero,
  formFrom,
  formatUsd,
  tryOnDiff,
  updateTryOnSettings,
  useTryOnModels,
  useTryOnSettings,
  type BudgetState,
  type TryOnForm,
} from "./try-on-data";

export function TryOnScreen() {
  const t = useMessages();
  const a = t.admin;
  const locale = useLocale();

  const settings = useTryOnSettings();
  const models = useTryOnModels();

  const [form, setForm] = useState<TryOnForm | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [outcome, setOutcome] = useState<"saved" | "failed" | null>(null);

  // The form is seeded from the response and reseeded whenever it changes, so a
  // reload after a save does not leave stale text over fresh figures.
  useEffect(() => {
    if (settings.data) setForm(formFrom(settings.data));
  }, [settings.data]);

  const state = listStateFor(settings.error, { isLoading: settings.isLoading });

  /**
   * The failure states are checked BEFORE the `!form` guard, deliberately.
   *
   * `form` is seeded from the response, so it stays null on a 403 forever — and
   * a `!form` guard placed first would draw the loading skeleton over a
   * permission denial for the rest of the session, which reads as a hung screen
   * rather than as a refusal.
   */
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

  if (state === "error") {
    return (
      <ListState
        state="error"
        title={a.errorTitle}
        body={a.errorBody}
        actionLabel={a.retry}
        onAction={settings.reload}
      />
    );
  }

  if (state === "loading" || !form || !settings.data) {
    return <ListState state="loading" rows={3} />;
  }

  const data = settings.data;
  const diff = tryOnDiff(data, form);
  const modelChanges =
    diff !== null &&
    (diff.tryOnModelId !== undefined || diff.tryOnFallbackModelId !== undefined);

  const stateCopy: Record<BudgetState, string> = {
    OK: a.budgetOk,
    WARNING: a.budgetWarning,
    DOWNGRADED: a.budgetDowngraded,
    STOPPED: a.budgetStopped,
  };

  const modelOptions = models.data ?? [];

  const save = async () => {
    if (!diff) return;
    setOutcome(null);
    try {
      await updateTryOnSettings(diff);
      setConfirming(false);
      setOutcome("saved");
      settings.reload();
    } catch {
      setConfirming(false);
      setOutcome("failed");
    }
  };

  const set = (key: keyof TryOnForm, value: string) =>
    setForm((current) => (current ? { ...current, [key]: value } : current));

  const renders = Object.entries(data.rendersThisMonth);

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">{a.tryOnNote}</p>

      {ceilingIsZero(data) ? (
        <Alert data-testid="ceiling-zero">
          <AlertTitle>{a.budgetZeroTitle}</AlertTitle>
          <AlertDescription>{a.budgetZeroBody}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="shadow-none">
        <CardContent className="grid gap-3 px-4 py-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              {a.spentThisMonth}
            </span>
            <span className="font-mono text-2xl tabular-nums text-foreground">
              {formatUsd(data.monthSpendUsd)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {a.ofCeiling.replace("{n}", formatUsd(data.monthBudgetUsd))}
          </p>

          <Progress
            value={Math.min(100, data.percentUsed)}
            aria-label={a.gaugeLabel}
            data-budget-state={data.budgetState}
            data-percent-used={data.percentUsed}
          />
          <p className="text-sm text-foreground">
            {a.percentUsedLabel.replace("{n}", String(data.percentUsed))}
          </p>

          {/* The two thresholds, on the gauge rather than under it. */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>{a.threshold85}</span>
            <span>{a.threshold100}</span>
          </div>

          <Separator />

          <div className="flex items-baseline justify-between gap-3">
            <span className="text-xs text-muted-foreground">
              {a.budgetStateLabel}
            </span>
            <span
              data-budget-state={data.budgetState}
              className="text-sm font-medium text-foreground"
            >
              {stateCopy[data.budgetState]}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-xs text-muted-foreground">
              {a.activeModelNow}
            </span>
            <span className="font-mono text-sm text-foreground">
              {/* Null is not "unknown" — it means nothing would be rendered. */}
              {data.activeModelId ?? a.generationStopped}
            </span>
          </div>

          <p className="text-xs text-muted-foreground">{a.usdNotEgp}</p>
        </CardContent>
      </Card>

      <section className="grid gap-2">
        <h3 className="text-base font-semibold text-foreground">
          {a.rendersThisMonth}
        </h3>
        {renders.length === 0 ? (
          <p className="text-sm text-muted-foreground">{a.noRenders}</p>
        ) : (
          <dl className="grid max-w-sm gap-1">
            {renders.map(([status, count]) => (
              <div
                key={status}
                className="flex items-baseline justify-between gap-3"
              >
                <dt className="font-mono text-xs text-muted-foreground">
                  {status}
                </dt>
                <dd className="font-mono text-sm tabular-nums text-foreground">
                  {count.toLocaleString(locale)}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      <Separator />

      <section className="grid max-w-xl gap-4">
        <div className="grid gap-2">
          <label
            htmlFor="try-on-model"
            className="text-sm font-medium text-foreground"
          >
            {a.chooseModel}
          </label>
          <NativeSelect
            id="try-on-model"
            value={form.tryOnModelId}
            onChange={(event) => set("tryOnModelId", event.target.value)}
          >
            {/* The current value is always an option, even if the registry no
                longer offers it — otherwise the select would silently show a
                different model than the one in use. */}
            {!modelOptions.some((model) => model.id === form.tryOnModelId) ? (
              <NativeSelectOption value={form.tryOnModelId}>
                {form.tryOnModelId}
              </NativeSelectOption>
            ) : null}
            {modelOptions.map((model) => (
              <NativeSelectOption key={model.id} value={model.id}>
                {`${model.id} — ${formatUsd(model.costUsd)} ${a.perRender}`}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>

        <div className="grid gap-2">
          <label
            htmlFor="try-on-fallback"
            className="text-sm font-medium text-foreground"
          >
            {a.chooseFallback}
          </label>
          <NativeSelect
            id="try-on-fallback"
            value={form.tryOnFallbackModelId}
            onChange={(event) => set("tryOnFallbackModelId", event.target.value)}
          >
            {!modelOptions.some(
              (model) => model.id === form.tryOnFallbackModelId
            ) ? (
              <NativeSelectOption value={form.tryOnFallbackModelId}>
                {form.tryOnFallbackModelId}
              </NativeSelectOption>
            ) : null}
            {modelOptions.map((model) => (
              <NativeSelectOption key={model.id} value={model.id}>
                {`${model.id} — ${formatUsd(model.costUsd)} ${a.perRender}`}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>

        <div className="grid gap-2">
          <label
            htmlFor="try-on-budget"
            className="text-sm font-medium text-foreground"
          >
            {a.monthlyCeiling}
          </label>
          <Input
            id="try-on-budget"
            inputMode="numeric"
            value={form.tryOnMonthlyBudgetCents}
            onChange={(event) =>
              set("tryOnMonthlyBudgetCents", event.target.value)
            }
          />
          <p className="text-xs text-muted-foreground">{a.unitCents}</p>
        </div>

        <div className="grid gap-2">
          <label
            htmlFor="try-on-cap"
            className="text-sm font-medium text-foreground"
          >
            {a.lifetimeCap}
          </label>
          <Input
            id="try-on-cap"
            inputMode="numeric"
            value={form.tryOnAccountLifetimeCap}
            onChange={(event) =>
              set("tryOnAccountLifetimeCap", event.target.value)
            }
          />
          <p className="text-xs text-muted-foreground">{a.lifetimeCapNote}</p>
        </div>

        <p className="text-sm text-muted-foreground">
          {diff ? a.whatChanges : a.noChanges}
        </p>

        <Button
          className="min-h-11 justify-self-start"
          disabled={!diff}
          onClick={() => (modelChanges ? setConfirming(true) : void save())}
        >
          {a.saveTryOn}
        </Button>

        {outcome === "saved" ? (
          <p role="status" className="text-sm text-state-good-fg">
            {a.saved}
          </p>
        ) : null}
        {outcome === "failed" ? (
          <p role="alert" className="text-sm text-state-bad-fg">
            {a.saveFailed}
          </p>
        ) : null}
      </section>

      <p className="text-xs text-muted-foreground">{a.tryOnShapeGap}</p>

      {/* Only a MODEL change gets the sheet. Moving the ceiling is reversible
          and changes nothing about images already made; switching provider is
          neither. */}
      <DestructiveSheet
        open={confirming}
        onOpenChange={setConfirming}
        title={a.modelSwitchTitle}
        description={a.modelSwitchDesc}
        consequences={[
          a.modelSwitchImmediate,
          a.modelSwitchCost,
          a.modelSwitchNoRollback,
        ]}
        confirmLabel={a.modelSwitchAction}
        cancelLabel={a.keepModel}
        onConfirm={save}
      />
    </div>
  );
}

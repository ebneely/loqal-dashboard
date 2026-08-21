"use client";

/**
 * /pack — the numbers a rep reads out loud standing in a shop.
 *
 * Composed from the domain layer: ListState, MobileActionBar — plus shadcn's
 * Alert, Card, Label, NativeSelect and Button.
 *
 * THE WHOLE SCREEN IS ONE RULE: EVERY FIGURE CARRIES ITS OWN PERIOD.
 *
 * This is the only screen in the product whose output is spoken to a stranger
 * who cannot see it. A shop owner hears "Loqal had four hundred thousand
 * visitors" and has no way to ask "over what?" — so the period is rendered
 * beside the number, not in a footnote, and the two traffic figures carry an
 * explicit warning that they do not share one (see `TRAFFIC_SCOPES` and the
 * backend bug it documents).
 *
 * The same rule is why the withheld comparison gets a whole panel rather than
 * a dash. A blank cell in front of a prospect gets filled in by the rep from
 * memory; a panel that says "Loqal will not show this, and the same rule
 * protects your numbers the day you sign" is a better sentence than the one it
 * replaces.
 */
import Link from "next/link";
import { useState } from "react";

import { ListState, MobileActionBar, listStateFor } from "@/components/loqal";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { useLocale, useMessages } from "@/lib/locale-context";

import { SALES_REQUIRED_ROLE } from "../../shell-rules";
import {
  comparisonState,
  pickableCategories,
  useSalesCategories,
  useSalesPack,
} from "./pack-data";

/** One figure, its period, and nothing implied between them. */
function Figure({
  label,
  value,
  scope,
}: {
  label: string;
  value: string;
  scope: string;
}) {
  return (
    <Card className="">
      <CardContent className="grid gap-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="font-mono text-2xl tabular-nums text-foreground">
          {value}
        </span>
        <span className="text-xs text-state-wait-fg">{scope}</span>
      </CardContent>
    </Card>
  );
}

export function PackScreen() {
  const t = useMessages();
  const s = t.sales;
  const locale = useLocale();

  const [category, setCategory] = useState<string | null>(null);

  const categories = useSalesCategories();
  const pack = useSalesPack(category);

  const number = (value: number) =>
    new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US").format(value);

  const categoryState = listStateFor(categories.error, {
    isLoading: categories.isLoading,
  });

  if (categoryState === "loading") return <ListState state="loading" rows={3} />;

  if (categoryState === "denied") {
    return (
      <ListState
        state="denied"
        title={s.deniedTitle}
        body={s.deniedBody}
        requiredRole={SALES_REQUIRED_ROLE}
      />
    );
  }

  if (categoryState === "error") {
    return (
      <ListState
        state="error"
        title={s.errorTitle}
        body={s.errorBody}
        actionLabel={s.retry}
        onAction={categories.reload}
      />
    );
  }

  const options = pickableCategories(categories.data ?? [], locale);

  if (options.length === 0) {
    return (
      <ListState
        state="empty"
        title={s.categoryNoneTitle}
        body={s.categoryNoneBody}
        actionLabel={s.retry}
        onAction={categories.reload}
      />
    );
  }

  const packState = listStateFor(pack.error, { isLoading: pack.isLoading });

  return (
    <div className="grid gap-4">
      <p className="max-w-prose text-sm text-muted-foreground">{s.packLead}</p>

      <div className="grid max-w-sm gap-2">
        <Label htmlFor="pack-category">{s.chooseCategory}</Label>
        <NativeSelect
          id="pack-category"
          className="w-full"
          value={category ?? ""}
          onChange={(event) => setCategory(event.target.value || null)}
        >
          <NativeSelectOption value="">{s.category}</NativeSelectOption>
          {options.map((option) => (
            <NativeSelectOption key={option.slug} value={option.slug}>
              {option.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      {category === null ? (
        <ListState
          state="empty"
          title={s.categoryEmptyTitle}
          body={s.categoryEmptyBody}
        />
      ) : packState === "loading" ? (
        <ListState state="loading" rows={2} />
      ) : packState === "denied" ? (
        <ListState
          state="denied"
          title={s.deniedTitle}
          body={s.deniedBody}
          requiredRole={SALES_REQUIRED_ROLE}
        />
      ) : packState === "error" || !pack.data ? (
        <ListState
          state="error"
          title={s.errorTitle}
          body={s.errorBody}
          actionLabel={s.retry}
          onAction={pack.reload}
        />
      ) : (
        <div className="grid gap-4" data-testid="sales-pack">
          {/*
            THE "AS OF" THE RESPONSE DOES NOT CARRY. Rendered as a warning
            rather than as a date the browser invented: `new Date()` here would
            be the moment this tab opened, which is precisely the stale-
            screenshot problem wearing a timestamp.
          */}
          {pack.data.generatedAt ? (
            <p className="text-xs text-muted-foreground">
              {s.asOfLabel}{" "}
              <span className="font-mono">
                {pack.data.generatedAt.slice(0, 10)}
              </span>
            </p>
          ) : (
            <Alert data-testid="pack-no-as-of">
              <AlertTitle>{s.noAsOfTitle}</AlertTitle>
              <AlertDescription>{s.noAsOfBody}</AlertDescription>
            </Alert>
          )}

          <section className="grid gap-3">
            <h2 className="text-sm font-semibold text-foreground">
              {s.proofTitle}
            </h2>
            <div className="grid gap-3 md:grid-cols-2">
              <Figure
                label={s.eventsLabel}
                value={number(pack.data.trafficProof.totalEvents)}
                scope={s.last30}
              />
              <Figure
                label={s.visitorsLabel}
                value={number(pack.data.trafficProof.totalVisitors)}
                scope={s.allTime}
              />
            </div>
            {/*
              Not a footnote and not a tooltip. The larger of these two is the
              number that gets quoted, and it is the all-time one.
            */}
            <Alert data-testid="pack-scope-warning">
              <AlertTitle>{s.scopeWarnTitle}</AlertTitle>
              <AlertDescription>{s.scopeWarnBody}</AlertDescription>
            </Alert>
          </section>

          <section className="grid gap-3">
            <h2 className="text-sm font-semibold text-foreground">
              {s.comparisonTitle}
            </h2>
            {(() => {
              const state = comparisonState(pack.data.categoryComparison);

              if (state.kind === "withheld") {
                return (
                  <Card
                    className="border-state-wait-border bg-state-wait-bg"
                    data-testid="comparison-withheld"
                    data-reason={state.reason}
                  >
                    <CardHeader>
                      <CardTitle>{s.blockedTitle}</CardTitle>
                      <CardDescription>{s.blockedBody}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-foreground">
                        {s.blockedReassure}
                      </p>
                    </CardContent>
                  </Card>
                );
              }

              if (state.kind === "notMeasured") {
                return (
                  <Card className="" data-testid="comparison-not-measured">
                    <CardHeader>
                      <CardTitle>{s.notMeasuredTitle}</CardTitle>
                      <CardDescription>{s.notMeasuredBody}</CardDescription>
                    </CardHeader>
                  </Card>
                );
              }

              return (
                <Card className="" data-testid="comparison-reported">
                  <CardContent className="grid gap-1">
                    <span className="text-xs text-muted-foreground">
                      {s.medianLabel}
                    </span>
                    <span className="font-mono text-2xl tabular-nums text-foreground">
                      {number(state.medianMonthlyOrders)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {s.comparisonWith.replace("{n}", number(state.brandCount))}
                    </span>
                  </CardContent>
                </Card>
              );
            })()}
          </section>

          <Button
            variant="outline"
            className="min-h-11 justify-self-start"
            onClick={pack.reload}
          >
            {s.refresh}
          </Button>
        </div>
      )}

      <MobileActionBar hint={s.barHintPack}>
        <Button asChild className="min-h-11 w-full">
          <Link href="/onboard">{s.startOnboard}</Link>
        </Button>
      </MobileActionBar>
    </div>
  );
}

"use client";

/**
 * /terms — the offer, and the one screen on this console where authorization is
 * the subject rather than a background condition.
 *
 * Composed from the domain layer: ListState, MobileActionBar — plus shadcn's
 * Alert, Badge, Card, Input, Label, NativeSelect and Button.
 *
 * WHAT THIS SCREEN REFUSES TO DO
 *
 * It does not offer a "Set the offer" button for a shop the rep is not bound
 * to. `SalesService.setTerms` answers 404 — never 403 — for any brand whose
 * application was not approved by the calling rep, deliberately, so a lost
 * phone cannot enumerate the platform by pressing buttons. A control whose only
 * possible outcome is that refusal is not a control; it is a trap that reads as
 * "no such shop" to a rep standing inside that shop.
 *
 * So every row this screen draws is either ACTIONABLE, with the form under it,
 * or UN-ACTIONABLE, with a sentence saying which of the three things went
 * wrong. `bindingFor` in `../signed-brands.ts` is the whole of that decision and
 * it has no React in it.
 *
 * THE THREE WAYS A SHOP ENDS UP UN-ACTIONABLE, ALL OF THEM FAIL-CLOSED
 *
 *  1. Filed as a lead. No Brand row exists at all — there is nothing to price.
 *  2. Approved by an admin. `BrandApplication.reviewedBy` then carries the
 *     ADMIN's id, so the rep who captured the lead is refused permanently.
 *     There is no `Brand.signedByRepId` column to record the real answer.
 *  3. It existed before any rep registered it. The five seeded brands have no
 *     application at all, so no rep is bound to any of them.
 *
 * All three are correct behaviour, not bugs to route around, and the screen
 * says so in words a salesperson can repeat to an owner without phoning the
 * office.
 *
 * THE PAYOUT ACCOUNT IS NOT ON THIS SCREEN AND CANNOT BE PUT ON IT.
 * `settlementDetails` is absent from `setSalesTermsSchema`, which is
 * `.strict()` — a rep's request body cannot reach that column. It was reachable
 * once, bounded by nothing, and withheld from the brand's own dashboard, so the
 * victim could not have seen it change. The screen names the absence rather than
 * leaving a blank where a field used to be.
 */
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { ListState, MobileActionBar, listStateFor } from "@/components/loqal";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { ApiError } from "@/lib/api";
import { useMessages } from "@/lib/locale-context";

import { SALES_REQUIRED_ROLE } from "../shell-rules";
import { bindingFor, termsCandidates } from "../signed-brands";
import { useSalesLedger } from "../use-sales-ledger";
import {
  bpsToPercent,
  draftFrom,
  freeMonthOptions,
  offerProblems,
  type OfferDraft,
} from "./offer-form";
import {
  OUT_OF_BAND_STATUS,
  setSalesTerms,
  useSalesBand,
  type TermsConfirmation,
} from "./terms-data";

export function TermsScreen() {
  const t = useMessages();
  const s = t.sales;
  const params = useSearchParams();
  const { ledger } = useSalesLedger();

  const band = useSalesBand();

  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<OfferDraft | null>(null);
  const [pending, setPending] = useState(false);
  const [refused, setRefused] = useState(false);
  const [failed, setFailed] = useState<"notFound" | "denied" | "other" | null>(
    null
  );
  const [sent, setSent] = useState<TermsConfirmation | null>(null);

  /**
   * The id in the URL is a REQUEST, never a grant. `/onboard` links here with
   * the brand it just created, and a bookmark or a pasted link can carry any id
   * at all — both go through `bindingFor` unchanged.
   */
  const requested = params.get("brandId");
  const brandId = selected ?? requested;

  useEffect(() => {
    if (band.data) setDraft(draftFrom(band.data));
  }, [band.data]);

  const candidates = useMemo(() => termsCandidates(ledger), [ledger]);
  const binding = brandId ? bindingFor(brandId, ledger) : null;

  const state = listStateFor(band.error, { isLoading: band.isLoading });

  if (state === "loading") return <ListState state="loading" rows={3} />;

  if (state === "denied") {
    return (
      <ListState
        state="denied"
        title={s.deniedTitle}
        body={s.deniedBody}
        requiredRole={SALES_REQUIRED_ROLE}
      />
    );
  }

  if (state === "error" || !band.data || !draft) {
    return (
      <ListState
        state="error"
        title={s.errorTitle}
        body={s.errorBody}
        actionLabel={s.retry}
        onAction={band.reload}
      />
    );
  }

  const theBand = band.data;
  const problems = offerProblems(draft, theBand);
  const sendable = problems.length === 0;

  const send = async () => {
    if (!binding?.actionable || !sendable) return;
    setPending(true);
    setRefused(false);
    setFailed(null);
    try {
      setSent(await setSalesTerms(binding.brand.brandId, draft));
    } catch (thrown) {
      if (thrown instanceof ApiError && thrown.statusCode === OUT_OF_BAND_STATUS) {
        // The band moved under the screen. Reload it and make the rep choose
        // again rather than nudging the figure into the new one.
        setRefused(true);
        band.reload();
      } else if (thrown instanceof ApiError && thrown.isNotFound) {
        setFailed("notFound");
      } else if (thrown instanceof ApiError && thrown.isPermissionDenied) {
        setFailed("denied");
      } else {
        setFailed("other");
      }
    } finally {
      setPending(false);
    }
  };

  // -------------------------------------------------------------------------
  // Done
  // -------------------------------------------------------------------------
  if (sent) {
    return (
      <div className="grid max-w-xl gap-4" data-testid="terms-sent">
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>{s.sentTitle}</CardTitle>
            <CardDescription>{s.sentBody}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-1">
            {/* Only what the API confirmed it wrote. Nothing is echoed back
                from the draft. */}
            {sent.perOrderChargeValue ? (
              <p className="text-sm text-foreground">
                {s.commission}:{" "}
                <span className="font-mono">{sent.perOrderChargeValue}%</span>
              </p>
            ) : null}
            <p className="text-sm text-foreground">
              {s.freeUntilLabel}:{" "}
              <span className="font-mono">
                {sent.freeUntil ? sent.freeUntil.slice(0, 10) : s.noFreePeriod}
              </span>
            </p>
          </CardContent>
        </Card>
        <Button asChild variant="outline" className="min-h-11 justify-self-start">
          <Link href="/onboard">{s.registerAnother}</Link>
        </Button>
      </div>
    );
  }

  const bandRow = (label: string, value: string, note: string) => (
    <div className="grid gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-mono text-lg tabular-nums text-foreground">
        {value}
      </span>
      <span className="text-xs text-muted-foreground">{note}</span>
    </div>
  );

  return (
    <div className="grid max-w-xl gap-4">
      <div className="grid gap-1">
        <h2 className="text-lg font-semibold text-foreground">{s.termsTitle}</h2>
        <p className="text-sm text-muted-foreground">{s.termsSub}</p>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* The band                                                            */}
      {/* ------------------------------------------------------------------ */}
      <Card className="shadow-none" data-testid="sales-band">
        <CardHeader>
          <CardTitle>{s.bandTitle}</CardTitle>
          <CardDescription>{s.bandNote}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {bandRow(
            s.commissionFloor,
            theBand.commissionFloorBps === null
              ? "—"
              : `${bpsToPercent(theBand.commissionFloorBps)}%`,
            s.floorNote
          )}
          {bandRow(
            s.maxFree,
            theBand.maxFreeMonths === null
              ? "—"
              : `${theBand.maxFreeMonths} ${s.months}`,
            s.maxFreeNote
          )}
        </CardContent>
      </Card>

      {theBand.commissionFloorBps === null || theBand.maxFreeMonths === null ? (
        <Alert data-testid="band-unbounded">
          <AlertTitle>{s.unboundedTitle}</AlertTitle>
          <AlertDescription>{s.unboundedBody}</AlertDescription>
        </Alert>
      ) : null}

      {/* ------------------------------------------------------------------ */}
      {/* Which shop — and the gap that makes this list what it is            */}
      {/* ------------------------------------------------------------------ */}
      <Card className="shadow-none" data-testid="signed-here-only">
        <CardHeader>
          <CardTitle>{s.signedHereOnlyTitle}</CardTitle>
          <CardDescription>{s.signedHereOnlyBody}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {candidates.length === 0 ? (
            <ListState
              state="empty"
              title={s.noBrandTitle}
              body={s.noBrandBody}
              actionLabel={s.startOnboard}
              actionHref="/onboard"
            />
          ) : (
            <ul className="grid gap-2">
              {candidates.map((candidate) =>
                candidate.kind === "brand" ? (
                  <li key={candidate.brand.brandId}>
                    <button
                      type="button"
                      data-testid="candidate-brand"
                      data-brand-id={candidate.brand.brandId}
                      data-actionable="true"
                      aria-pressed={brandId === candidate.brand.brandId}
                      onClick={() => setSelected(candidate.brand.brandId)}
                      className="flex min-h-11 w-full flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-start aria-pressed:border-primary"
                    >
                      <span className="text-sm font-medium text-foreground">
                        {candidate.brand.name}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {candidate.brand.slug}
                      </span>
                    </button>
                  </li>
                ) : (
                  /*
                    A LEAD, RENDERED UN-ACTIONABLE. Not a button, not a disabled
                    button — there is no Brand row behind it, so there is
                    nothing for a control to act on.
                  */
                  <li
                    key={candidate.lead.applicationId}
                    data-testid="candidate-lead"
                    data-application-id={candidate.lead.applicationId}
                    data-actionable="false"
                    data-reason="LEAD_NOT_CLOSED"
                    className="grid gap-1 rounded-lg border border-dashed border-border px-3 py-2"
                  >
                    <span className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {candidate.lead.businessName}
                      </span>
                      <Badge
                        variant="outline"
                        className="border-state-wait-border bg-state-wait-bg text-state-wait-fg"
                      >
                        {s.cannotPriceChip}
                      </Badge>
                    </span>
                    <span className="text-xs font-medium text-foreground">
                      {s.leadNotClosedTitle}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {s.leadNotClosedBody}
                    </span>
                  </li>
                )
              )}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* A brand this console has no record of the rep signing               */}
      {/* ------------------------------------------------------------------ */}
      {binding && !binding.actionable ? (
        <Card
          className="border-state-bad-border bg-state-bad-bg/40 shadow-none"
          data-testid="brand-not-actionable"
          data-brand-id={brandId ?? ""}
          data-reason={binding.reason}
        >
          <CardHeader>
            <CardTitle>{s.notYoursTitle}</CardTitle>
            <CardDescription>{s.notYoursBody}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            <p className="text-sm text-foreground">{s.brandNotFoundBody}</p>
            <Button asChild variant="outline" className="min-h-11 justify-self-start">
              <Link href="/onboard">{s.startOnboard}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {/* ------------------------------------------------------------------ */}
      {/* The offer — drawn ONLY for a shop this rep is bound to              */}
      {/* ------------------------------------------------------------------ */}
      {binding?.actionable ? (
        <div className="grid gap-3" data-testid="offer-form">
          <h3 className="text-sm font-semibold text-foreground">
            {s.offerTitle} · {binding.brand.name}
          </h3>

          <div className="grid gap-2">
            <Label htmlFor="offer-commission">{s.commission}</Label>
            <Input
              id="offer-commission"
              inputMode="decimal"
              className="font-mono"
              value={draft.commissionPercent}
              onChange={(event) =>
                setDraft({ ...draft, commissionPercent: event.target.value })
              }
            />
            <p
              className="text-xs"
              data-testid="commission-state"
              data-outside={String(problems.includes("belowFloor"))}
            >
              <span
                className={
                  problems.includes("belowFloor")
                    ? "text-state-bad-fg"
                    : "text-state-good-fg"
                }
              >
                {problems.includes("belowFloor")
                  ? s.belowFloor
                  : theBand.commissionFloorBps === null
                    ? s.unboundedTitle
                    : s.insideBand}
              </span>
            </p>
            {/* A flat per-order fee is refused by the band checker outright
                once a floor exists, so it is not offered at all. */}
            <p className="text-xs text-muted-foreground">
              {s.fixedChargeNote}
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="offer-free-months">{s.freeMonths}</Label>
            <NativeSelect
              id="offer-free-months"
              className="w-full"
              value={String(draft.freeMonths)}
              onChange={(event) =>
                setDraft({ ...draft, freeMonths: Number(event.target.value) })
              }
            >
              {freeMonthOptions(theBand).map((option) => (
                /*
                  Out-of-band months are SHOWN and disabled, never hidden. A rep
                  asked "can you do six months?" needs to be able to say "not
                  without an admin" rather than shrug at a list that stops at
                  three.
                */
                <NativeSelectOption
                  key={option.months}
                  value={String(option.months)}
                  disabled={!option.allowed}
                >
                  {option.months === 0
                    ? s.noFreePeriod
                    : `${option.months} ${s.months}`}
                  {option.allowed ? "" : ` — ${s.outOfBandOption}`}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            {problems.includes("aboveMax") ? (
              <p className="text-xs text-state-bad-fg">{s.aboveMax}</p>
            ) : null}
          </div>

          <Alert data-testid="admin-only-note">
            <AlertTitle>{s.thenWhat}</AlertTitle>
            <AlertDescription>
              <span className="grid gap-1">
                <span>{s.thenWhatSales}</span>
                <span>{s.payoutNotHere}</span>
              </span>
            </AlertDescription>
          </Alert>

          {problems.includes("commissionMissing") ? (
            <p className="text-xs text-state-wait-fg">{s.pickBoth}</p>
          ) : null}

          {refused ? (
            <Alert role="alert" data-testid="terms-refused">
              <AlertTitle>{s.refusedTitle}</AlertTitle>
              <AlertDescription>
                <span className="grid gap-1">
                  <span>{s.refusedBody}</span>
                  <span>{s.violationsHiddenNote}</span>
                </span>
              </AlertDescription>
            </Alert>
          ) : null}

          {failed === "notFound" ? (
            <Alert role="alert" data-testid="terms-not-found">
              <AlertTitle>{s.brandNotFoundTitle}</AlertTitle>
              <AlertDescription>{s.brandNotFoundBody}</AlertDescription>
            </Alert>
          ) : null}

          {failed === "denied" ? (
            <ListState
              state="denied"
              title={s.deniedTitle}
              body={s.deniedBody}
              requiredRole={SALES_REQUIRED_ROLE}
            />
          ) : null}

          {failed === "other" ? (
            <p role="alert" className="text-sm text-state-bad-fg">
              {s.errorBody}
            </p>
          ) : null}

          <MobileActionBar hideAt="never" hint={s.barHintTerms}>
            <Button
              className="min-h-11 w-full"
              disabled={pending || !sendable}
              onClick={() => void send()}
            >
              {s.sendOffer}
            </Button>
          </MobileActionBar>
        </div>
      ) : null}
    </div>
  );
}

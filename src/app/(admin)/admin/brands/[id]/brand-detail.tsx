"use client";

/**
 * /admin/brands/[id] — one page holding everything about one brand.
 *
 * Composed from the domain layer: StatusPill, MoneyRow, ListState,
 * DestructiveSheet — plus shadcn's Tabs, Card, Alert, Badge, Button, Input,
 * Label, Textarea, NativeSelect and Switch.
 *
 * FIVE TABS, BECAUSE FIVE DIFFERENT PEOPLE ARE ASKING FIVE DIFFERENT QUESTIONS
 *
 *  Profile     what this shop is, what it promises shoppers, and who it
 *              invoices as. Read-mostly; the brand owns all of it.
 *  Terms       what the shop costs, and where its money goes. Loqal owns all of
 *              it and the brand may not touch any of it.
 *  Standing    Loqal's own judgement BESIDE the computed badges, never merged
 *              into them.
 *  Placement   what was sold, labelled as sold.
 *  Suspension  the one lever that takes a shop off the storefront.
 *
 * They are tabs rather than one long page because the page is genuinely long
 * and because the Terms tab is the only place in the product where somebody can
 * change what a brand pays — putting that three screens down from a profile
 * form invites editing it by accident.
 *
 * THE PAYOUT ACCOUNT IS AN AUDIT GAP, AND THE SCREEN SAYS SO.
 * `settlementDetails` is where a shop's money is sent. A SALES rep could
 * recently rewrite it through an unbound path parameter, and what made that so
 * dangerous is that nothing recorded WHO changed it or WHEN — there is no
 * `settlementDetailsSetBy`, no BrandStatusHistory-style table, and the suspend
 * route's own reason is written to a log line rather than a column. This screen
 * does not invent an audit trail out of nothing; it names the hole where one
 * should be, so nobody reads the field's presence here as evidence that it is
 * watched.
 */
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import {
  PerOrderChargeTypeSchema,
  SettlementCadenceSchema,
  SettlementMethodSchema,
  type SettlementCadence,
  type SettlementMethod,
} from "@loqal/contracts/enums";

import {
  DestructiveSheet,
  ListState,
  MoneyRow,
  StatusPill,
  listStateFor,
} from "@/components/loqal";
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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useLocale, useMessages } from "@/lib/locale-context";
import { formatMoney } from "@/lib/money";
import type { Messages } from "@/messages";
import { ADMIN_REQUIRED_ROLE } from "../../../shell-rules";

import {
  isSuspendable,
  reactivateBrand,
  setBrandPromotion,
  setReputationScore,
  suspendBrand,
  updateBrandTerms,
  useAdminBrand,
} from "./brand-detail-data";
import {
  asDateInput,
  asInstant,
  dealSummary,
  termsBodyFrom,
  termsChanges,
  termsFormFrom,
  type TermsForm,
} from "./terms-form";

/** The admin catalogue's own key set, for the diff's label lookup. */
type MessageKey = keyof Messages["admin"];

export function BrandDetail({ id }: { id: string }) {
  const t = useMessages();
  const a = t.admin;
  const locale = useLocale();

  const resource = useAdminBrand(id);
  const brand = resource.data;

  const [tab, setTab] = useState("profile");
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  // Terms
  const baseline = useMemo(
    () => (brand ? termsFormFrom(brand) : null),
    [brand]
  );
  const [form, setForm] = useState<TermsForm | null>(null);
  useEffect(() => setForm(baseline), [baseline]);

  // Placement
  const [promoted, setPromoted] = useState(false);
  const [featuredUntil, setFeaturedUntil] = useState("");
  useEffect(() => {
    setPromoted(brand?.isPromoted ?? false);
    setFeaturedUntil(asDateInput(brand?.featuredUntil));
  }, [brand]);

  // Reputation
  const [score, setScore] = useState("");
  const [scoreNote, setScoreNote] = useState("");
  useEffect(() => {
    setScore(
      brand?.reputationScore === null || brand?.reputationScore === undefined
        ? ""
        : String(brand.reputationScore)
    );
  }, [brand]);

  // Suspension
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [reason, setReason] = useState("");

  const state = listStateFor(resource.error, {
    isLoading: resource.isLoading,
    notFound: true,
  });

  if (state === "loading") return <ListState state="loading" rows={4} />;

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

  if (state === "notFound") {
    return (
      <ListState
        state="notFound"
        title={a.brandNotFoundTitle}
        body={a.brandNotFoundBody}
        actionLabel={a.backToBrands}
        actionHref="/admin/brands"
      />
    );
  }

  if (state === "error" || !brand || !form || !baseline) {
    return (
      <ListState
        state="error"
        title={a.errorTitle}
        body={a.errorBody}
        actionLabel={a.retry}
        onAction={resource.reload}
      />
    );
  }

  const changes = termsChanges(baseline, form);

  const run = async (key: string, work: () => Promise<unknown>) => {
    setPending(true);
    setFailed(false);
    setSaved(null);
    try {
      await work();
      setSaved(key);
      resource.reload();
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  };

  const CADENCE_LABEL: Record<SettlementCadence, string> = {
    WEEKLY: a.cadenceWeekly,
    TWICE_WEEKLY: a.cadenceTwiceWeekly,
    MONTHLY: a.cadenceMonthly,
  };

  const METHOD_LABEL: Record<SettlementMethod, string> = {
    INSTAPAY: a.methodInstapay,
    MOBILE_WALLET: a.methodWallet,
    BANK_TRANSFER: a.methodBank,
  };

  /** A value the API has not set. Said in words, never as an empty cell. */
  const orUnset = (value: string | null | undefined) =>
    value === null || value === undefined || value === "" ? a.unset : value;

  const field = (label: string, value: ReactNode) => (
    <div
      key={label}
      className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border/60 py-2 last:border-b-0"
    >
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{value}</dd>
    </div>
  );

  const set = <K extends keyof TermsForm>(key: K, value: TermsForm[K]) =>
    setForm((current) => (current ? { ...current, [key]: value } : current));

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/brands">{a.backToBrands}</Link>
        </Button>
        <h2 className="min-w-0 flex-1 truncate text-lg font-semibold text-foreground">
          {brand.name}
        </h2>
        <StatusPill kind="BrandStatus" value={brand.status} locale={locale} />
      </div>

      {/* The two computed figures, above the tabs, because they are the two
          numbers somebody opens this page to check. */}
      <div className="grid gap-3 md:grid-cols-2">
        <Card className="shadow-none">
          <CardContent className="grid gap-1 px-4 py-3">
            <span className="text-xs text-muted-foreground">{a.grossSales}</span>
            <span className="font-mono text-lg tabular-nums text-foreground">
              {brand.grossSales ? formatMoney(brand.grossSales) : a.unset}
            </span>
            <span className="text-xs text-muted-foreground">
              {a.grossSalesNote}
            </span>
          </CardContent>
        </Card>
        {brand.balance ? (
          <MoneyRow
            amount={brand.balance}
            perspective="platform"
            variant="row"
            locale={locale}
            note={a.balanceNote}
          />
        ) : null}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex w-full flex-wrap">
          <TabsTrigger value="profile">{a.tabProfile}</TabsTrigger>
          <TabsTrigger value="terms">{a.tabTerms}</TabsTrigger>
          <TabsTrigger value="standing">{a.tabStanding}</TabsTrigger>
          <TabsTrigger value="placement">{a.tabPlacement}</TabsTrigger>
          <TabsTrigger value="danger">{a.tabDanger}</TabsTrigger>
        </TabsList>

        {/* ---------------------------------------------------------------- */}
        <TabsContent value="profile" className="grid gap-3">
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle>{a.profileTitle}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid">
                {field(a.slug, <span className="font-mono">{brand.slug}</span>)}
                {field(a.notificationPhone, orUnset(brand.notificationPhone))}
                {field(
                  a.applicationRef,
                  <span className="font-mono text-xs">
                    {orUnset(brand.applicationId)}
                  </span>
                )}
                {field(a.updatedAt, orUnset(asDateInput(brand.updatedAt)))}
              </dl>
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader>
              <CardTitle>{a.tradingTerms}</CardTitle>
              <CardDescription>{a.tradingNote}</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid">
                {field(
                  a.deliveryFee,
                  brand.deliveryFee ? formatMoney(brand.deliveryFee) : a.unset
                )}
                {field(
                  a.minimumOrderValue,
                  brand.minimumOrderValue
                    ? formatMoney(brand.minimumOrderValue)
                    : a.unset
                )}
                {field(
                  a.returnWindowDays,
                  brand.returnWindowDays === undefined
                    ? a.unset
                    : String(brand.returnWindowDays)
                )}
                {field(
                  a.supportedDelivery,
                  (brand.supportedDelivery ?? [])
                    // SHIPPING_SERVICE is modelled and NOT live: no courier
                    // contract, no brand carries it, and nothing may render it
                    // as an option a shop has.
                    .filter((route) => route !== "SHIPPING_SERVICE")
                    .map((route) =>
                      route === "RIDER_PER_BRAND"
                        ? a.deliveryRider
                        : a.deliveryOwn
                    )
                    .join(" · ") || a.unset
                )}
                {field(a.stockSetup, orUnset(brand.stockSetup))}
              </dl>
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader>
              <CardTitle>{a.invoiceIdentity}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid">
                {field(a.legalName, orUnset(brand.legalName))}
                {field(a.taxNumber, orUnset(brand.taxNumber))}
                {field(a.invoiceAddress, orUnset(brand.invoiceAddress))}
                {field(a.invoiceTerms, orUnset(brand.invoiceTerms))}
              </dl>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------------------------------------------------------------- */}
        <TabsContent value="terms" className="grid gap-3">
          <Alert>
            <AlertTitle>{a.currentDeal}</AlertTitle>
            <AlertDescription>
              <span className="flex flex-wrap gap-x-4 gap-y-1">
                {dealSummary(baseline).map((part) => (
                  <span key={part.labelKey}>
                    {a[part.labelKey as MessageKey] as string}:{" "}
                    <strong className="font-mono">
                      {part.value === ""
                        ? a.unset
                        : part.labelKey === "cadence"
                          ? CADENCE_LABEL[part.value as SettlementCadence]
                          : part.labelKey === "settlementMethod"
                            ? METHOD_LABEL[part.value as SettlementMethod]
                            : part.value}
                    </strong>
                  </span>
                ))}
              </span>
            </AlertDescription>
          </Alert>

          <div className="grid max-w-xl gap-3">
            <div className="grid gap-2">
              <Label htmlFor="terms-free-until">{a.freeUntil}</Label>
              <Input
                id="terms-free-until"
                type="date"
                value={form.freeUntil}
                onChange={(event) => set("freeUntil", event.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="terms-monthly-fee">{a.monthlyFee}</Label>
              <Input
                id="terms-monthly-fee"
                inputMode="decimal"
                value={form.monthlyFee}
                onChange={(event) => set("monthlyFee", event.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="terms-charge-type">{a.perOrder}</Label>
              <NativeSelect
                id="terms-charge-type"
                className="w-full"
                value={form.perOrderChargeType}
                onChange={(event) =>
                  set(
                    "perOrderChargeType",
                    event.target.value as TermsForm["perOrderChargeType"]
                  )
                }
              >
                <NativeSelectOption value="">{a.chargeUnset}</NativeSelectOption>
                {PerOrderChargeTypeSchema.options.map((value) => (
                  <NativeSelectOption key={value} value={value}>
                    {value === "PERCENT" ? a.chargePercent : a.chargeFixed}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="terms-charge-value">
                {form.perOrderChargeType === "PERCENT"
                  ? a.perOrderPercentValue
                  : a.perOrderFixedValue}
              </Label>
              <Input
                id="terms-charge-value"
                inputMode="decimal"
                value={form.perOrderChargeValue}
                onChange={(event) =>
                  set("perOrderChargeValue", event.target.value)
                }
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="terms-cadence">{a.cadence}</Label>
              <NativeSelect
                id="terms-cadence"
                className="w-full"
                value={form.settlementCadence}
                onChange={(event) =>
                  set(
                    "settlementCadence",
                    event.target.value as SettlementCadence
                  )
                }
              >
                {SettlementCadenceSchema.options.map((value) => (
                  <NativeSelectOption key={value} value={value}>
                    {CADENCE_LABEL[value]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="terms-anchor">{a.anchorDay}</Label>
              <Input
                id="terms-anchor"
                inputMode="numeric"
                value={form.settlementAnchor}
                onChange={(event) =>
                  set("settlementAnchor", event.target.value)
                }
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="terms-method">{a.settlementMethod}</Label>
              <NativeSelect
                id="terms-method"
                className="w-full"
                value={form.settlementMethod}
                onChange={(event) =>
                  set(
                    "settlementMethod",
                    event.target.value as TermsForm["settlementMethod"]
                  )
                }
              >
                <NativeSelectOption value="">{a.methodUnset}</NativeSelectOption>
                {SettlementMethodSchema.options.map((value) => (
                  <NativeSelectOption key={value} value={value}>
                    {METHOD_LABEL[value]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="terms-account">{a.account}</Label>
              <Input
                id="terms-account"
                value={form.settlementDetails}
                onChange={(event) =>
                  set("settlementDetails", event.target.value)
                }
              />
              <p className="text-xs text-state-wait-fg">{a.accountAuditGap}</p>
            </div>

            {/* WHAT CHANGES, before it changes. */}
            <Card className="shadow-none" data-testid="terms-diff">
              <CardHeader>
                <CardTitle>{a.whatChanges}</CardTitle>
              </CardHeader>
              <CardContent>
                {changes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{a.noChanges}</p>
                ) : (
                  <ul className="grid gap-1.5">
                    {changes.map((change) => (
                      <li key={change.field} className="text-sm text-foreground">
                        {a[change.labelKey as MessageKey] as string}:{" "}
                        <span className="font-mono text-muted-foreground line-through">
                          {change.from === "" ? a.unset : change.from}
                        </span>{" "}
                        <span aria-hidden="true">→</span>{" "}
                        <span className="font-mono font-semibold">
                          {change.to === "" ? a.unset : change.to}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Button
              className="min-h-11 justify-self-start"
              disabled={pending || changes.length === 0}
              onClick={() =>
                void run("terms", () =>
                  updateBrandTerms(id, termsBodyFrom(baseline, form))
                )
              }
            >
              {pending ? a.saving : a.saveTerms}
            </Button>
            {saved === "terms" ? (
              <p role="status" className="text-sm text-state-good-fg">
                {a.saved}
              </p>
            ) : null}
            {failed ? (
              <p role="alert" className="text-sm text-state-bad-fg">
                {a.saveFailed}
              </p>
            ) : null}
          </div>
        </TabsContent>

        {/* ---------------------------------------------------------------- */}
        <TabsContent value="standing" className="grid gap-3">
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle>{a.reputationScore}</CardTitle>
              <CardDescription>{a.reputationNote}</CardDescription>
            </CardHeader>
            <CardContent className="grid max-w-md gap-3">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-3xl font-semibold tabular-nums text-foreground">
                  {brand.reputationScore ?? "—"}
                </span>
                <span className="text-sm text-muted-foreground">/ 100</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {brand.reputationSetAt
                  ? a.reputationSetBy
                      .replace("{who}", brand.reputationSetBy ?? "—")
                      .replace("{when}", asDateInput(brand.reputationSetAt))
                  : a.reputationNeverSet}
              </p>
              <div className="grid gap-2">
                <Label htmlFor="reputation-score">{a.scoreLabel}</Label>
                <Input
                  id="reputation-score"
                  inputMode="numeric"
                  value={score}
                  onChange={(event) => setScore(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="reputation-note">{a.scoreNoteLabel}</Label>
                <Textarea
                  id="reputation-note"
                  rows={2}
                  value={scoreNote}
                  onChange={(event) => setScoreNote(event.target.value)}
                />
              </div>
              <Button
                className="min-h-11 justify-self-start"
                disabled={pending || score === ""}
                onClick={() =>
                  void run("score", () =>
                    setReputationScore(
                      id,
                      Number(score),
                      scoreNote.trim() || undefined
                    )
                  )
                }
              >
                {pending ? a.saving : a.saveScore}
              </Button>
              {saved === "score" ? (
                <p role="status" className="text-sm text-state-good-fg">
                  {a.saved}
                </p>
              ) : null}
            </CardContent>
          </Card>

          {/*
            BESIDE the score, never merged into it. A brand can ship every order
            on time and argue with every customer who writes in, and no metric
            catches the second thing — which is exactly why one of these is
            computed and the other is a person's judgement, and why a single
            blended "brand score" would destroy both.
          */}
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle>{a.computedBadges}</CardTitle>
              <CardDescription>{a.computedNote}</CardDescription>
            </CardHeader>
            <CardContent>
              {(brand.badges?.computed ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">{a.noBadges}</p>
              ) : (
                <ul className="grid gap-2">
                  {(brand.badges?.computed ?? []).map((badge) => (
                    <li
                      key={badge.id}
                      className="flex flex-wrap items-center justify-between gap-2"
                    >
                      <Badge variant="outline">{badge.type}</Badge>
                      <span className="font-mono text-xs text-muted-foreground">
                        {a.badgeEarned} {asDateInput(badge.earnedAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader>
              <CardTitle>{a.verifiedBadges}</CardTitle>
              <CardDescription>{a.verifiedNote}</CardDescription>
            </CardHeader>
            <CardContent>
              {(brand.badges?.verified ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">{a.noBadges}</p>
              ) : (
                <ul className="grid gap-2">
                  {(brand.badges?.verified ?? []).map((badge) => (
                    <li key={badge.id} className="grid gap-0.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Badge variant="outline">{badge.type}</Badge>
                        <span className="font-mono text-xs text-muted-foreground">
                          {a.badgeExpires} {asDateInput(badge.expiresAt)}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {a.badgeCheckedAgainst}: {badge.checkedAgainst}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------------------------------------------------------------- */}
        <TabsContent value="placement" className="grid gap-3">
          <Alert>
            <AlertTitle>{a.promotedTitle}</AlertTitle>
            <AlertDescription>{a.promotedRule}</AlertDescription>
          </Alert>

          <div className="grid max-w-xl gap-3">
            <div className="flex items-center gap-3">
              <Switch
                id="placement-promoted"
                checked={promoted}
                onCheckedChange={(next) => setPromoted(next === true)}
              />
              <Label htmlFor="placement-promoted">{a.paidPromotion}</Label>
              {promoted ? (
                <Badge
                  variant="outline"
                  data-promoted="true"
                  className="border bg-state-wait-bg text-state-wait-fg border-state-wait-border font-medium"
                >
                  {a.promotedLabel}
                </Badge>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              {a.paidPromotionHint}
            </p>

            <div className="grid gap-2">
              <Label htmlFor="placement-featured-until">{a.featuredUntil}</Label>
              <Input
                id="placement-featured-until"
                type="date"
                value={featuredUntil}
                onChange={(event) => setFeaturedUntil(event.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="placement-sort-order">{a.sortOrder}</Label>
              <Input
                id="placement-sort-order"
                readOnly
                value={
                  brand.sortOrder === undefined ? "" : String(brand.sortOrder)
                }
              />
              <p className="text-xs text-state-wait-fg">{a.sortOrderReadOnly}</p>
            </div>

            <Button
              className="min-h-11 justify-self-start"
              disabled={pending}
              onClick={() =>
                void run("placement", () =>
                  setBrandPromotion(id, {
                    isPromoted: promoted,
                    featuredUntil: asInstant(featuredUntil),
                  })
                )
              }
            >
              {pending ? a.saving : a.savePlacement}
            </Button>
            {saved === "placement" ? (
              <p role="status" className="text-sm text-state-good-fg">
                {a.saved}
              </p>
            ) : null}
          </div>
        </TabsContent>

        {/* ---------------------------------------------------------------- */}
        <TabsContent value="danger" className="grid gap-3">
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle>{a.suspendTitle}</CardTitle>
              <CardDescription>{a.suspendBody}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {brand.status === "ACTIVE" ? (
                <Button
                  variant="destructive"
                  className="min-h-11 justify-self-start"
                  onClick={() => {
                    setReason("");
                    setFailed(false);
                    setSuspendOpen(true);
                  }}
                >
                  {a.suspendAction}
                </Button>
              ) : null}

              {brand.status === "SUSPENDED" ? (
                <>
                  <p className="text-sm text-foreground">{a.reactivateBody}</p>
                  <Button
                    className="min-h-11 justify-self-start"
                    disabled={pending}
                    onClick={() =>
                      void run("reactivate", () => reactivateBrand(id))
                    }
                  >
                    {pending ? a.saving : a.reactivateAction}
                  </Button>
                </>
              ) : null}

              {brand.status === "PENDING" ? (
                <p className="text-sm text-muted-foreground">
                  {a.suspendOnlyActive}
                </p>
              ) : null}

              {saved === "reactivate" ? (
                <p role="status" className="text-sm text-state-good-fg">
                  {a.saved}
                </p>
              ) : null}
              {failed ? (
                <p role="alert" className="text-sm text-state-bad-fg">
                  {a.saveFailed}
                </p>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/*
        BOTH consequences, in words, in the sheet — not one of them and a hint.
        A suspension is an accusation with a commercial effect (counterfeit
        goods, non-fulfilment, non-payment), and the two things an admin most
        needs to be certain of before pressing are that the shop disappears from
        the storefront NOW and that the orders already placed are NOT cancelled
        by this. `consequences` is a required prop for exactly this reason.
      */}
      <DestructiveSheet
        open={suspendOpen}
        onOpenChange={setSuspendOpen}
        title={a.suspendTitle}
        description={a.suspendBody}
        consequences={[
          a.suspendVanishes,
          a.suspendInFlight,
          a.suspendSettlements,
        ]}
        confirmLabel={isSuspendable(reason) ? a.suspendAction : a.reasonRequired}
        cancelLabel={a.keepActive}
        onConfirm={async () => {
          if (!isSuspendable(reason)) return;
          await run("suspend", () => suspendBrand(id, reason));
          setSuspendOpen(false);
        }}
      >
        <div className="grid gap-2">
          <Label htmlFor="suspend-reason">{a.suspendReason}</Label>
          <Textarea
            id="suspend-reason"
            rows={3}
            value={reason}
            placeholder={a.suspendReasonPlaceholder}
            onChange={(event) => setReason(event.target.value)}
          />
          {isSuspendable(reason) ? null : (
            <p className="text-xs text-state-bad-fg">{a.reasonRequiredBody}</p>
          )}
          <p className="text-xs text-state-wait-fg">{a.suspendReasonGap}</p>
        </div>
      </DestructiveSheet>
    </div>
  );
}

"use client";

/**
 * /settings — six blocks, grouped by WHO DECIDES rather than by what the field
 * looks like.
 *
 * Composed from the domain layer: ListState, MobileActionBar — plus shadcn's
 * Card, Field, Input, Textarea, NativeSelect, Checkbox and Button.
 *
 * The grouping is the argument:
 *
 *  a. Profile            the shop's own name and words. Editable.
 *  b. Trading            what the shop promises a shopper. Editable.
 *  c. Invoice identity   what is printed on the invoices the SHOP issues.
 *                        Editable, because Loqal is not the issuer.
 *  d. Notification line  where an unanswered chat reaches the shop. Editable,
 *                        and deliberately not any owner's personal number.
 *  e. Payout             owner only, and ABSENT for an employee — not blanked,
 *                        because a nulled field still says an account exists.
 *  f. Loqal's terms      owner only and READ-ONLY. Shown as FACTS, never as a
 *                        disabled form: a greyed input invites an argument
 *                        about editing it, and a sentence does not.
 *
 * The two owner-only blocks are drawn from the PRESENCE of their key in the
 * payload, not from the session's role. The server omits them for anyone who is
 * not the owner, so the screen is asking the boundary that actually enforces
 * this rather than the cosmetic copy of it in the browser.
 */
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import {
  DataField,
  FieldGrid,
  ListState,
  MobileActionBar,
  MobileActionBarSpacer,
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
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useMessages } from "@/lib/locale-context";
import { formatMoney } from "@/lib/money";

import { formatDay } from "../money/money-rules";
import { useBrandProfile, useBrandProfileWrite } from "./settings-data";
import {
  EMPTY_DRAFT,
  draftFrom,
  draftIssues,
  isLiveRoute,
  perOrderCharge,
  updateBodyFrom,
  type SettingsDraft,
  type SettingsIssue,
} from "./settings-rules";
import { LIVE_DELIVERY_METHODS } from "./settings-wire";

/**
 * A block of read-only facts.
 *
 * Deliberately a definition list and not a fieldset of disabled inputs. A
 * greyed-out input is still an input: it looks like something that could be
 * switched on, and it is what turns "Loqal sets this" into "why can't I change
 * this". A term and its value read as a statement, which is what these are.
 */
function Facts({
  rows,
  testId,
}: {
  rows: readonly { key: string; label: string; value: ReactNode }[];
  testId: string;
}) {
  return (
    <FieldGrid data-testid={testId}>
      {rows.map((row) => (
        <DataField key={row.key} label={row.label} value={row.value} />
      ))}
    </FieldGrid>
  );
}

function Block({
  label,
  title,
  description,
  testId,
  children,
}: {
  label: string;
  title: string;
  description?: string;
  testId: string;
  children: ReactNode;
}) {
  return (
    /*
      The landmark's name and the field names inside it are deliberately
      different words. Two elements answering to the same accessible name make
      "the tax number field" ambiguous to anything navigating by label.
    */
    <section aria-label={label} data-testid={testId}>
      <Card className="border-border">
        <CardHeader className="gap-1">
          <CardTitle className="text-base">{title}</CardTitle>
          {description ? (
            <CardDescription>{description}</CardDescription>
          ) : null}
        </CardHeader>
        <CardContent className="grid max-w-xl gap-4">{children}</CardContent>
      </Card>
    </section>
  );
}

export function SettingsScreen() {
  const t = useMessages();
  const b = t.brand;

  const resource = useBrandProfile();
  const write = useBrandProfileWrite();
  const profile = resource.data;

  const [draft, setDraft] = useState<SettingsDraft>(EMPTY_DRAFT);
  const [touched, setTouched] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setDraft(draftFrom(profile));
    setTouched(false);
  }, [profile]);

  const state = listStateFor(resource.error, { isLoading: resource.isLoading });

  const issues = draftIssues(draft);
  const has = (issue: SettingsIssue) => issues.includes(issue);
  const shows = (issue: SettingsIssue) => touched && has(issue);

  const set = <K extends keyof SettingsDraft>(
    key: K,
    value: SettingsDraft[K]
  ) => setDraft((current) => ({ ...current, [key]: value }));

  const toggleRoute = (route: string, on: boolean) => {
    if (!isLiveRoute(route)) return;
    setDraft((current) => ({
      ...current,
      supportedDelivery: on
        ? [...current.supportedDelivery.filter((r) => r !== route), route]
        : current.supportedDelivery.filter((r) => r !== route),
    }));
  };

  const save = async () => {
    setTouched(true);
    setSaved(false);
    if (issues.length > 0) return;
    const body = updateBodyFrom(draft);
    if (!body) return;
    const next = await write.save(body);
    if (next) setSaved(true);
  };

  if (state === "loading") return <ListState state="loading" rows={4} />;

  /**
   * The READ is open to an employee, so a 403 here means this is not a brand
   * account at all rather than "you are staff". Either way it is a panel that
   * stays put and names the role, not a toast that fades and leaves someone
   * looking at a blank screen unsure whether the data is missing or they are.
   */
  if (state === "denied") {
    return (
      <ListState
        state="denied"
        title={b.settingsDeniedTitle}
        body={b.settingsDeniedBody}
      />
    );
  }

  if (state === "error" || !profile) {
    return (
      <ListState
        state="error"
        title={b.settingsErrorTitle}
        body={b.errorBody}
        actionLabel={b.retry}
        onAction={resource.reload}
      />
    );
  }

  const payout = profile.payout;
  const terms = profile.loqalTerms;

  return (
    <div className="grid gap-4">
      {/* a. Profile ------------------------------------------------------- */}
      <Block
        label={b.settingsShopBlock}
        title={b.settingsShopTitle}
        description={b.settingsShopNote}
        testId="settings-profile"
      >
        <Field>
          <FieldLabel htmlFor="settings-name">{b.brandName}</FieldLabel>
          <Input
            id="settings-name"
            value={draft.name}
            onChange={(event) => set("name", event.target.value)}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="settings-desc-en">{b.descEn}</FieldLabel>
          <Textarea
            id="settings-desc-en"
            rows={3}
            value={draft.descriptionEn}
            onChange={(event) => set("descriptionEn", event.target.value)}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="settings-desc-ar">{b.descArabic}</FieldLabel>
          <Textarea
            id="settings-desc-ar"
            dir="rtl"
            rows={3}
            value={draft.descriptionAr}
            onChange={(event) => set("descriptionAr", event.target.value)}
          />
        </Field>

        {/* One language is enough. Both is better. Neither is not allowed. */}
        <p className="text-xs text-muted-foreground">{b.oneLangRequired}</p>
        {shows("noLanguage") ? (
          <p role="alert" className="text-sm text-destructive">
            {b.oneLangRequired}
          </p>
        ) : null}
        {shows("noName") ? (
          <p role="alert" className="text-sm text-destructive">
            {b.settingsNameRequired}
          </p>
        ) : null}

        {/*
          THE IMAGES ARE IDS AND NOTHING RESOLVES ONE TO A PICTURE.
          `logoMediaId` and `coverMediaId` are stored and returned; there is no
          route anywhere on this plane that turns one into a URL. So no image is
          drawn — a broken <img> would read as "your logo is gone" — and the
          screen says what is actually true instead.
        */}
        <div
          className="grid gap-1 rounded-md border border-dashed border-border px-3 py-2"
          data-testid="settings-media"
        >
          <p className="text-sm font-medium text-foreground">
            {b.mediaUnavailableTitle}
          </p>
          <p className="text-xs text-muted-foreground">
            {b.mediaUnavailableBody}
          </p>
          <Facts
            testId="settings-media-ids"
            rows={[
              {
                key: "logo",
                label: b.logo,
                value: profile.logoMediaId ? (
                  <span className="font-mono text-xs">
                    {profile.logoMediaId}
                  </span>
                ) : (
                  b.mediaNone
                ),
              },
              {
                key: "cover",
                label: b.cover,
                value: profile.coverMediaId ? (
                  <span className="font-mono text-xs">
                    {profile.coverMediaId}
                  </span>
                ) : (
                  b.mediaNone
                ),
              },
            ]}
          />
        </div>
      </Block>

      {/* b. Trading ------------------------------------------------------- */}
      <Block
        label={b.settingsTradingBlock}
        title={b.settingsTradingTitle}
        description={b.settingsTradingNote}
        testId="settings-trading"
      >
        <Field>
          <FieldLabel htmlFor="settings-delivery-fee">
            {b.deliveryFee}
          </FieldLabel>
          <Input
            id="settings-delivery-fee"
            inputMode="decimal"
            value={draft.deliveryFee}
            onChange={(event) => set("deliveryFee", event.target.value)}
          />
          {/* Charged to the shopper and collected by whoever delivers. Never
              Loqal's money, and never in the ledger. */}
          <p className="text-xs text-muted-foreground">{b.deliveryFeeNote}</p>
          {shows("feeMalformed") ? (
            <p role="alert" className="text-sm text-destructive">
              {b.priceMalformed}
            </p>
          ) : null}
        </Field>

        <Field>
          <FieldLabel htmlFor="settings-return-window">
            {b.returnWindow}
          </FieldLabel>
          <Input
            id="settings-return-window"
            inputMode="numeric"
            value={draft.returnWindowDays}
            onChange={(event) => set("returnWindowDays", event.target.value)}
          />
          <p className="text-xs text-muted-foreground">{b.windowPerBrand}</p>
          {shows("windowMalformed") ? (
            <p role="alert" className="text-sm text-destructive">
              {b.settingsWindowMalformed}
            </p>
          ) : null}
        </Field>

        <Field>
          <FieldLabel htmlFor="settings-min-order">{b.minOrder}</FieldLabel>
          <Input
            id="settings-min-order"
            inputMode="decimal"
            value={draft.minimumOrderValue}
            onChange={(event) => set("minimumOrderValue", event.target.value)}
          />
          <p className="text-xs text-muted-foreground">{b.minOrderNote}</p>
          {shows("minOrderMalformed") ? (
            <p role="alert" className="text-sm text-destructive">
              {b.priceMalformed}
            </p>
          ) : null}
        </Field>

        <Field>
          <FieldLabel htmlFor="settings-stock-setup">
            {b.stockSetupLabel}
          </FieldLabel>
          <NativeSelect
            id="settings-stock-setup"
            className="w-full"
            value={draft.stockSetup}
            onChange={(event) => {
              const value = event.target.value;
              if (
                value === "ONLINE_ONLY" ||
                value === "SHOP_SHARED_STOCK" ||
                value === "SHOP_LOQAL_SHELF"
              ) {
                set("stockSetup", value);
              }
            }}
          >
            {(["ONLINE_ONLY", "SHOP_SHARED_STOCK", "SHOP_LOQAL_SHELF"] as const).map(
              (value) => (
                <NativeSelectOption key={value} value={value}>
                  {b.stockSetupOpt[value]}
                </NativeSelectOption>
              )
            )}
          </NativeSelect>
        </Field>

        {/*
          ONLY THE LIVE ROUTES. SHIPPING_SERVICE is modelled end to end, has no
          courier contract behind it, and is unwritable server-side. An
          unchecked box is still an offer, so it is not drawn at all — a shop
          that ticked it would be promising a delivery nobody can make.
        */}
        <fieldset className="grid gap-2">
          <legend className="text-sm font-medium text-foreground">
            {b.routesOffered}
          </legend>
          {LIVE_DELIVERY_METHODS.map((route) => {
            const id = `settings-route-${route}`;
            const label =
              route === "RIDER_PER_BRAND" ? b.routeRiderOpt : b.routeOwnOpt;
            return (
              <div key={route} className="flex items-center gap-2">
                <Checkbox
                  id={id}
                  checked={draft.supportedDelivery.includes(route)}
                  onCheckedChange={(next) =>
                    toggleRoute(route, next === true)
                  }
                />
                <FieldLabel htmlFor={id} className="text-sm font-normal">
                  {label}
                </FieldLabel>
              </div>
            );
          })}
          <p className="text-xs text-muted-foreground">{b.routesLiveOnly}</p>
          {shows("noRoute") ? (
            <p role="alert" className="text-sm text-destructive">
              {b.routesRequired}
            </p>
          ) : null}
        </fieldset>
      </Block>

      {/* c. Invoice identity ---------------------------------------------- */}
      <Block
        label={b.settingsInvoiceBlock}
        title={b.settingsInvoiceTitle}
        description={b.settingsInvoiceNote}
        testId="settings-invoice-identity"
      >
        <Field>
          <FieldLabel htmlFor="settings-legal-name">{b.legalName}</FieldLabel>
          <Input
            id="settings-legal-name"
            value={draft.legalName}
            onChange={(event) => set("legalName", event.target.value)}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="settings-tax-number">{b.taxNumber}</FieldLabel>
          <Input
            id="settings-tax-number"
            value={draft.taxNumber}
            onChange={(event) => set("taxNumber", event.target.value)}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="settings-invoice-address">
            {b.invoiceAddress}
          </FieldLabel>
          <Textarea
            id="settings-invoice-address"
            rows={3}
            value={draft.invoiceAddress}
            onChange={(event) => set("invoiceAddress", event.target.value)}
          />
        </Field>

        {/*
          `invoiceTerms` is readable and is NOT in the update DTO, so it is a
          fact here rather than a disabled input. Same rule as Loqal's terms: a
          greyed box is a promise that a save would work.
        */}
        <Facts
          testId="settings-invoice-terms"
          rows={[
            {
              key: "invoiceTerms",
              label: b.invoiceTerms,
              value: profile.invoiceIdentity.invoiceTerms ?? b.notSet,
            },
          ]}
        />
        <p className="text-xs text-muted-foreground">{b.invoiceTermsNote}</p>
      </Block>

      {/* d. The shop's line ----------------------------------------------- */}
      <Block
        label={b.settingsNotifyBlock}
        title={b.settingsNotifyTitle}
        description={b.settingsNotifyNote}
        testId="settings-notification"
      >
        <Field>
          <FieldLabel htmlFor="settings-notification-phone">
            {b.notifyPhoneLabel}
          </FieldLabel>
          <Input
            id="settings-notification-phone"
            inputMode="tel"
            dir="ltr"
            value={draft.notificationPhone}
            onChange={(event) => set("notificationPhone", event.target.value)}
          />
          <p className="text-xs text-muted-foreground">{b.notifyPhoneNote}</p>
        </Field>
      </Block>

      {/* e. Payout — owner only, ABSENT for anyone else -------------------- */}
      {payout ? (
        <Block
          label={b.settingsPayoutBlock}
          title={b.settingsPayoutTitle}
          description={b.settingsPayoutNote}
          testId="settings-payout"
        >
          {/*
            The owner reads the account their own money is sent to, and that
            visibility is the FRAUD CONTROL rather than the exposure. A sales
            rep could recently rewrite this field through an unbound path
            parameter, and the reason that was dangerous is exactly that the
            shop could not see it and so could not notice it had changed.

            It is read-only because the shipped `PATCH /v1/brands/me` takes
            neither settlement field — an input here would be a save that 400s
            after the shop has typed its account number. Reported, not faked.
          */}
          <Facts
            testId="settings-payout-facts"
            rows={[
              {
                key: "method",
                label: b.payoutMethod,
                value: payout.settlementMethod
                  ? b.settlementMethodOpt[payout.settlementMethod]
                  : b.notSet,
              },
              {
                key: "account",
                label: b.payoutAccount,
                value: payout.settlementDetails ?? b.payoutAccountUnavailable,
              },
            ]}
          />
          <p className="text-xs text-muted-foreground">{b.payoutCheckNote}</p>
        </Block>
      ) : null}

      {/* f. Loqal's terms — owner only, and facts, never a form ------------ */}
      {terms ? (
        <Block
          label={b.settingsTermsBlock}
          title={b.loqalTerms}
          description={b.loqalTermsNote}
          testId="settings-loqal-terms"
        >
          <Facts
            testId="settings-loqal-terms-facts"
            rows={[
              {
                key: "freeUntil",
                label: b.freeUntil,
                value: formatDay(terms.freeUntil) ?? b.notSet,
              },
              {
                key: "monthlyFee",
                label: b.monthlyFee,
                value: terms.monthlyFee
                  ? formatMoney(terms.monthlyFee)
                  : b.notSet,
              },
              {
                key: "perOrder",
                label: b.perOrder,
                value:
                  perOrderCharge(
                    terms.perOrderChargeType,
                    terms.perOrderChargeValue,
                    {
                      amount: formatMoney,
                      /* A percentage and an EGP amount read identically as
                         bare numbers, and the difference on a 500 EGP order is
                         two hundredfold. */
                      percent: (value) => b.unitPercent.replace("{n}", value),
                    }
                  ) ?? b.notSet,
              },
              {
                key: "cadence",
                label: b.cadence,
                value: b.cadenceOpt[terms.settlementCadence],
              },
              {
                key: "anchor",
                label: b.settlementAnchorLabel,
                value:
                  terms.settlementAnchor === null
                    ? b.notSet
                    : String(terms.settlementAnchor),
              },
            ]}
          />
        </Block>
      ) : null}

      {/* Save ------------------------------------------------------------- */}
      <section aria-label={b.settingsSaveBlock} className="grid gap-2">
        {write.failed ? (
          <p role="alert" className="text-sm text-destructive">
            {b.saveFailed}
          </p>
        ) : null}
        {write.denied ? (
          <p role="alert" className="text-sm text-destructive">
            {b.settingsSaveDenied}
          </p>
        ) : null}
        {saved && !write.failed && !write.denied ? (
          <p className="text-sm text-muted-foreground">{b.savedOk}</p>
        ) : null}
        {touched && issues.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            {b.settingsBlockedHint}
          </p>
        ) : null}
      </section>

      {/*
        `hideAt="never"`: one control at every width. Rendering the button twice
        — once in a `hidden md:block` and once inside the bar — puts two
        elements with the same accessible name in the tree, and a screen-reader
        user hears "Save changes, button" twice with nothing telling them apart.
      */}
      <MobileActionBar hideAt="never" hint={b.settingsSaveHint}>
        <span className="block" data-testid="settings-action-bar">
          <Button
            className="min-h-12 w-full"
            disabled={write.pending}
            onClick={() => void save()}
          >
            {write.pending ? b.saving : b.save}
          </Button>
        </span>
      </MobileActionBar>
      <MobileActionBarSpacer hideAt="never" />
    </div>
  );
}

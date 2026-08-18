"use client";

/**
 * /onboard — registering a shop from inside it.
 *
 * Composed from the domain layer: ListState, MobileActionBar — plus shadcn's
 * Alert, Card, Input, Label, RadioGroup, Textarea and Button.
 *
 * THREE STEPS, BECAUSE THIS IS A CONVERSATION AND NOT A FORM.
 *
 * A rep is not filling this in at a desk. They are talking to an owner who is
 * also serving customers, and the order of the fields is the order the
 * conversation actually goes in: what the shop is, who runs it, and only then
 * how this closes. Putting the web address on the first screen makes the first
 * question of the meeting a technical one.
 *
 * THE LAST STEP IS THE ONLY ONE THAT MATTERS TO AUTHORIZATION.
 *
 * Filing a lead and closing a deal are the same endpoint with and without a
 * slug, and the difference decides whether this rep can ever price the shop —
 * `BrandApplication.reviewedBy` is stamped only on the closing path. So the
 * choice is a deliberate radio with both consequences written out, never a
 * checkbox tucked under the submit button, and the "file only" branch says
 * plainly that an admin approving it later takes the offer out of this rep's
 * hands for good.
 */
import Link from "next/link";
import { useState } from "react";

import { ListState, MobileActionBar } from "@/components/loqal";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api";
import { useMessages } from "@/lib/locale-context";

import { SALES_REQUIRED_ROLE } from "../shell-rules";
import { withFiledLead, withSignedBrand } from "../signed-brands";
import { useSalesLedger } from "../use-sales-ledger";
import { outcomeOfResult, registerShop, type RegisterShopResult } from "./onboard-data";
import {
  ONBOARD_STEPS,
  emptyDraft,
  fieldErrors,
  isStepComplete,
  isSubmittable,
  suggestSlug,
  type OnboardDraft,
  type OnboardField,
} from "./onboard-form";

export function OnboardScreen() {
  const t = useMessages();
  const s = t.sales;
  const { update } = useSalesLedger();

  const [draft, setDraft] = useState<OnboardDraft>(emptyDraft);
  const [step, setStep] = useState(0);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [result, setResult] = useState<RegisterShopResult | null>(null);

  const errors = fieldErrors(draft);
  const set = <K extends keyof OnboardDraft>(key: K, value: OnboardDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  /**
   * A field's error as a sentence. The map is explicit rather than derived
   * because "that is not an email address" and "required" are different things
   * to a person and the schema reports both as one issue list.
   */
  const messageFor = (field: OnboardField): string | null => {
    const error = errors[field];
    if (!error) return null;
    if (error === "required") return s.fieldRequired;
    if (error === "tooLong") return s.tooLong;
    if (field === "email") return s.badEmail;
    if (field === "phone") return s.badPhone;
    if (field === "instagramUrl" || field === "websiteUrl") return s.badUrl;
    if (field === "slug") return s.slugInvalid;
    return s.fieldRequired;
  };

  const Field = ({
    field,
    label,
    hint,
    children,
  }: {
    field: OnboardField;
    label: string;
    hint?: string;
    children: React.ReactNode;
  }) => {
    const error = messageFor(field);
    return (
      <div className="grid gap-2">
        <Label htmlFor={`onboard-${field}`}>{label}</Label>
        {children}
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        {/* Shown only once the field has been typed in — see `fieldErrors`. */}
        {error && draft[field] !== "" ? (
          <p
            role="alert"
            data-testid={`error-${field}`}
            className="text-xs text-state-bad-fg"
          >
            {error}
          </p>
        ) : null}
      </div>
    );
  };

  // -------------------------------------------------------------------------
  // What happened, once something has
  // -------------------------------------------------------------------------
  if (result) {
    const outcome = outcomeOfResult(result);

    return (
      <div className="grid gap-4" data-testid="onboard-outcome" data-outcome={outcome}>
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>
              {outcome === "created" ? s.createdTitle : s.filedTitle}
            </CardTitle>
            <CardDescription>
              {outcome === "created" ? s.createdBody : s.filedBody}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <p className="text-sm text-foreground">
              {result.brand?.name ?? result.application.businessName}
            </p>
            {outcome === "created" ? (
              <p className="text-sm text-muted-foreground">
                {s.createdBoundNote}
              </p>
            ) : (
              /*
                THE CORRECTION THE EARLIER COPY COULD NOT HAVE MADE. A lead an
                admin approves gets the ADMIN's id in `reviewedBy`, so this rep
                is refused on /terms for good. Saying "terms can be set once an
                admin approves it" would be false in the one direction that
                matters.
              */
              <Alert data-testid="lead-admin-warning">
                <AlertTitle>{s.leadNotClosedTitle}</AlertTitle>
                <AlertDescription>{s.fileOnlyRepNote}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2">
          {outcome === "created" ? (
            <Button asChild className="min-h-11">
              <Link href={`/terms?brandId=${result.brand?.id ?? ""}`}>
                {s.goToTerms}
              </Link>
            </Button>
          ) : null}
          <Button
            variant="outline"
            className="min-h-11"
            onClick={() => {
              setDraft(emptyDraft);
              setStep(0);
              setResult(null);
              setFailure(null);
            }}
          >
            {s.registerAnother}
          </Button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // The form
  // -------------------------------------------------------------------------
  const stepId = ONBOARD_STEPS[step]?.id ?? "business";
  const isReview = step === ONBOARD_STEPS.length;
  const stepName =
    stepId === "business"
      ? s.stepBusiness
      : stepId === "contact"
        ? s.stepContact
        : s.stepClose;

  const submit = async () => {
    setPending(true);
    setFailure(null);
    try {
      const answer = await registerShop(draft);
      setResult(answer);

      // The ledger records what the API DID, never what the draft asked for.
      const created = answer.brand;
      if (created) {
        update((current) =>
          withSignedBrand(current, {
            brandId: created.id,
            name: created.name,
            slug: created.slug,
            applicationId: answer.application.id,
            signedAt: new Date().toISOString(),
          })
        );
      } else {
        update((current) =>
          withFiledLead(current, {
            applicationId: answer.application.id,
            businessName: answer.application.businessName,
            filedAt: new Date().toISOString(),
          })
        );
      }
    } catch (thrown) {
      if (thrown instanceof ApiError && thrown.isPermissionDenied) {
        setFailure("denied");
      } else if (thrown instanceof ApiError) {
        setFailure(thrown.message);
      } else {
        setFailure(s.submitFailed);
      }
    } finally {
      setPending(false);
    }
  };

  if (failure === "denied") {
    return (
      <ListState
        state="denied"
        title={s.deniedTitle}
        body={s.deniedBody}
        requiredRole={SALES_REQUIRED_ROLE}
      />
    );
  }

  return (
    <div className="grid max-w-xl gap-4">
      <div className="grid gap-1">
        <h2 className="text-lg font-semibold text-foreground">{s.onboardTitle}</h2>
        <p className="text-xs text-muted-foreground">
          {isReview
            ? s.reviewTitle
            : s.stepOf
                .replace("{a}", String(step + 1))
                .replace("{b}", String(ONBOARD_STEPS.length))
                .replace("{name}", stepName)}
        </p>
      </div>

      <Alert>
        <AlertTitle>{s.resumableTitle}</AlertTitle>
        <AlertDescription>{s.draftNote}</AlertDescription>
      </Alert>

      {stepId === "business" && !isReview ? (
        <>
          <Field field="businessName" label={s.shopName}>
            <Input
              id="onboard-businessName"
              value={draft.businessName}
              onChange={(event) => set("businessName", event.target.value)}
            />
          </Field>
          <Field field="description" label={s.descriptionLabel} hint={s.optional}>
            <Textarea
              id="onboard-description"
              rows={3}
              value={draft.description}
              onChange={(event) => set("description", event.target.value)}
            />
          </Field>
        </>
      ) : null}

      {stepId === "contact" && !isReview ? (
        <>
          <Field field="ownerName" label={s.ownerName}>
            <Input
              id="onboard-ownerName"
              value={draft.ownerName}
              onChange={(event) => set("ownerName", event.target.value)}
            />
          </Field>
          <Field field="email" label={s.email} hint={s.inviteHint}>
            <Input
              id="onboard-email"
              type="email"
              inputMode="email"
              value={draft.email}
              onChange={(event) => set("email", event.target.value)}
            />
          </Field>
          <Field field="phone" label={s.phone}>
            <Input
              id="onboard-phone"
              inputMode="tel"
              value={draft.phone}
              onChange={(event) => set("phone", event.target.value)}
            />
          </Field>
        </>
      ) : null}

      {stepId === "close" && !isReview ? (
        <>
          <Field field="instagramUrl" label={s.instagram} hint={s.instagramHint}>
            <Input
              id="onboard-instagramUrl"
              inputMode="url"
              value={draft.instagramUrl}
              onChange={(event) => set("instagramUrl", event.target.value)}
            />
          </Field>
          <Field field="websiteUrl" label={s.website} hint={s.optional}>
            <Input
              id="onboard-websiteUrl"
              inputMode="url"
              value={draft.websiteUrl}
              onChange={(event) => set("websiteUrl", event.target.value)}
            />
          </Field>

          <fieldset className="grid gap-3">
            <legend className="pb-2 text-sm font-semibold text-foreground">
              {s.stepClose}
            </legend>
            <RadioGroup
              value={draft.closeNow ? "close" : "file"}
              onValueChange={(value) => set("closeNow", value === "close")}
              className="grid gap-3"
            >
              {/*
                The radio's own Label carries ONLY the choice, with the
                consequences attached through aria-describedby. Wrapping the
                whole card in a <label> would give the control an accessible
                name three sentences long, which is what a screen-reader user
                would have to sit through before hearing the other option.
              */}
              <div className="grid gap-1 rounded-lg border border-border p-3">
                <div className="flex items-center gap-2">
                  <RadioGroupItem
                    value="file"
                    id="close-file"
                    aria-describedby="close-file-note"
                  />
                  <Label htmlFor="close-file">{s.fileOnly}</Label>
                </div>
                <p className="ps-6 text-xs text-muted-foreground">
                  {s.filedBody}
                </p>
                {/*
                  Said HERE, before the choice, not after it. This is the branch
                  that hands the shop to whoever approves it later.
                */}
                <p
                  id="close-file-note"
                  className="ps-6 text-xs text-state-wait-fg"
                  data-testid="file-only-rep-note"
                >
                  {s.fileOnlyRepNote}
                </p>
              </div>

              <div className="grid gap-1 rounded-lg border border-border p-3">
                <div className="flex items-center gap-2">
                  <RadioGroupItem
                    value="close"
                    id="close-now"
                    aria-describedby="close-now-note"
                  />
                  <Label htmlFor="close-now">{s.closeNow}</Label>
                </div>
                <p id="close-now-note" className="ps-6 text-xs text-muted-foreground">
                  {s.closeNowBody}
                </p>
              </div>
            </RadioGroup>
          </fieldset>

          {draft.closeNow ? (
            <Field field="slug" label={s.slugLabel} hint={s.slugHint}>
              <div className="flex gap-2">
                <Input
                  id="onboard-slug"
                  className="font-mono"
                  value={draft.slug}
                  onChange={(event) => set("slug", event.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => set("slug", suggestSlug(draft.businessName))}
                >
                  {s.slugSuggest}
                </Button>
              </div>
            </Field>
          ) : null}
        </>
      ) : null}

      {isReview ? (
        <Card className="shadow-none" data-testid="onboard-review">
          <CardHeader>
            <CardTitle>{s.outcomeLabel}</CardTitle>
            <CardDescription>
              {draft.closeNow ? s.closeNowBody : s.fileOnlyBody}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            <dl className="grid">
              {(
                [
                  [s.shopName, draft.businessName],
                  [s.ownerName, draft.ownerName],
                  [s.email, draft.email],
                  [s.phone, draft.phone],
                  [s.instagram, draft.instagramUrl],
                  [s.website, draft.websiteUrl],
                  ...(draft.closeNow
                    ? ([[s.slugLabel, draft.slug]] as [string, string][])
                    : []),
                ] as [string, string][]
              )
                .filter(([, value]) => value !== "")
                .map(([label, value]) => (
                  <div
                    key={label}
                    className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border/60 py-2 last:border-b-0"
                  >
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="text-sm text-foreground">{value}</dd>
                  </div>
                ))}
            </dl>
            {!draft.closeNow ? (
              <p className="text-xs text-state-wait-fg">{s.fileOnlyRepNote}</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {failure && failure !== "denied" ? (
        <p
          role="alert"
          data-testid="submit-failed"
          className="text-sm text-state-bad-fg"
        >
          {s.submitFailed} {failure}
        </p>
      ) : null}

      <div className="hidden flex-wrap gap-2 md:flex">
        {step > 0 ? (
          <Button
            variant="ghost"
            className="min-h-11"
            onClick={() => setStep((n) => n - 1)}
          >
            {s.back}
          </Button>
        ) : null}
        <Button
          variant="ghost"
          className="min-h-11"
          onClick={() => {
            setDraft(emptyDraft);
            setStep(0);
          }}
        >
          {s.startOver}
        </Button>
      </div>

      <MobileActionBar
        hideAt="never"
        hint={isReview ? s.barHintTerms : s.barHintPack}
        secondary={
          step > 0 ? (
            <Button
              variant="outline"
              className="min-h-11"
              onClick={() => setStep((n) => n - 1)}
            >
              {s.back}
            </Button>
          ) : null
        }
      >
        {isReview ? (
          <Button
            className="min-h-11 w-full"
            disabled={pending || !isSubmittable(draft)}
            onClick={() => void submit()}
          >
            {draft.closeNow ? s.closeNow : s.fileOnly}
          </Button>
        ) : (
          <Button
            className="min-h-11 w-full"
            disabled={!isStepComplete(draft, stepId)}
            onClick={() => setStep((n) => n + 1)}
          >
            {step === ONBOARD_STEPS.length - 1 ? s.finishOnboard : s.nextStep}
          </Button>
        )}
      </MobileActionBar>
    </div>
  );
}

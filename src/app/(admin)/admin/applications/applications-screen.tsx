"use client";

/**
 * /admin/applications — the queue that decides which brands exist.
 *
 * Composed from the domain layer: ListState, DestructiveSheet — plus shadcn's
 * Card, Badge, Button, Sheet, Alert, Textarea, Label and NativeSelect.
 *
 * A CARD LIST AT EVERY WIDTH, and deliberately not a table.
 *
 * The rest of this console is desktop-first, and this screen is the exception
 * that proves the rule rather than a lapse from it: an application is not a row
 * of figures to scan, it is a paragraph of evidence to read before deciding
 * whether a business exists on Loqal. The design system's own admin file draws
 * this one screen as `lq-rl-cards` with no `lq-rl-table` beside it, for the
 * same reason. Two columns at lg give a desk the density it wants without
 * flattening the description into an ellipsis.
 *
 * THE INSTAGRAM LINK IS EVIDENCE, NOT A FOOTNOTE.
 *
 * For most of these shops the Instagram account IS the storefront — there is no
 * website, the catalog is a grid of posts and the price is in the comments. So
 * it is rendered as the first thing under the name, as a real anchor opening in
 * its own tab, and its ABSENCE is stated in words rather than left as a blank
 * field. "No Instagram given" is a fact a reviewer should weigh; an empty row
 * looks like a rendering bug.
 *
 * WHAT APPROVAL AND REJECTION ACTUALLY DO
 *
 *  Approve  creates the brand, creates its owner, and mints a ONE-TIME INVITE
 *           LINK. Never a plaintext password by email. The sheet says so before
 *           the button is pressed, because "Approve" on its own does not tell a
 *           reviewer that an account is about to be created for somebody.
 *
 *           THE SHEET DOES NOT CLOSE ON SUCCESS, and that is the opposite of
 *           what it used to do. The invite link exists in the approve response
 *           and nowhere else — no screen can fetch it back — so closing on a
 *           tick and refetching the queue would have destroyed the only copy of
 *           the credential the shop needs to be opened at all. The result panel
 *           replaces the form and the reviewer closes it when they are done.
 *
 *           IT ALSO ASKS FOR THE TWO THINGS THE APPLICATION CANNOT CARRY. The
 *           address, prefilled with whatever the rep proposed, because a
 *           suggestion may collide with a live brand. And an email, when the
 *           application has none — the public form does not ask for one, and
 *           Better Auth cannot create a user without one, so this is where that
 *           requirement lands rather than at the door where it would shut out
 *           every shop that has only a phone.
 *  Reject   records a reason and creates NOTHING. No brand, no user, no orphan
 *           row — which is why there is no `userId` and no `password` anywhere
 *           in `brandApplicationSchema`, and why `BrandStatus` has no REJECTED
 *           member. The reason is required by the contract and is enforced here
 *           before the request rather than after it.
 */
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import {
  BrandApplicationStatusSchema,
  type BrandApplicationStatus,
  type SettlementCadence,
  type SettlementMethod,
} from "@loqal/contracts/enums";

import {
  DestructiveSheet,
  DataField,
  FieldGrid,
  InviteResult,
  ListState,
  listStateFor,
  type InviteResultStep,
} from "@/components/loqal";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useMessages } from "@/lib/locale-context";
import { formatMoney } from "@/lib/money";
import { ADMIN_REQUIRED_ROLE } from "../../shell-rules";
import { slugify } from "../brands/new-shop-form";

import {
  approveApplication,
  countByStatus,
  filterApplications,
  isApprovable,
  isRejectable,
  rejectApplication,
  useBrandApplications,
  type AdminBrandApplication,
  type ApproveDraft,
  type ApproveResult,
} from "./applications-data";

const STATUSES: readonly BrandApplicationStatus[] =
  BrandApplicationStatusSchema.options;

const isStatus = (value: string | null): value is BrandApplicationStatus =>
  value !== null && (STATUSES as readonly string[]).includes(value);

/**
 * The same six state tokens `StatusPill` uses, applied by hand.
 *
 * DESIGN-SYSTEM GAP, reported rather than patched: `StatusPill` covers five
 * enums and `BrandApplicationStatus` is not one of them. The design file works
 * around that by drawing an application with a `BrandStatus` pill and mapping
 * REJECTED onto SUSPENDED — which would print "Suspended" beside an
 * application that never became a brand, describing a state the enum
 * deliberately does not have. Borrowing the tokens is honest; borrowing the
 * wrong enum's vocabulary is not.
 */
/**
 * Whether a rep agreed anything in the shop.
 *
 * The seven terms only; the slug is excluded on purpose, because it is the
 * prefill of an editable field two lines below and printing it twice would say
 * the same thing in two places that can disagree.
 */
const hasProposal = (row: AdminBrandApplication): boolean =>
  row.proposedFreeUntil !== null && row.proposedFreeUntil !== undefined
    ? true
    : [
        row.proposedMonthlyFee,
        row.proposedPerOrderChargeType,
        row.proposedPerOrderChargeValue,
        row.proposedSettlementCadence,
        row.proposedSettlementAnchor,
        row.proposedSettlementMethod,
      ].some((value) => value !== null && value !== undefined);

const STATUS_TONE: Record<BrandApplicationStatus, string> = {
  PENDING: "bg-state-wait-bg text-state-wait-fg border-state-wait-border",
  APPROVED: "bg-state-good-bg text-state-good-fg border-state-good-border",
  REJECTED: "bg-state-bad-bg text-state-bad-fg border-state-bad-border",
};

/**
 * A date, in Latin digits under both languages — the same rule the money
 * formatter follows. A column that mixes ٣ and 3 is how a 7 gets read as a 1,
 * and an application's date is compared against a bank statement and a
 * WhatsApp thread as often as it is read on its own.
 */
const dateOnly = (iso: string) => {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return iso;
  return new Date(parsed).toISOString().slice(0, 10);
};

export function ApplicationsScreen() {
  const t = useMessages();
  const a = t.admin;
  const router = useRouter();
  const params = useSearchParams();

  const raw = params.get("status");
  const status = isStatus(raw) ? raw : null;

  const [search, setSearch] = useState("");
  const [approving, setApproving] =
    useState<AdminBrandApplication | null>(null);
  const [rejecting, setRejecting] = useState<AdminBrandApplication | null>(null);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  /**
   * The two fields the reviewer may supply, and what came back.
   *
   * `result` outliving the request is the point: it holds the invite link, and
   * the link is in no other response on this screen or any other.
   */
  const [draft, setDraft] = useState<ApproveDraft>({ slug: "", ownerEmail: "" });
  const [result, setResult] = useState<ApproveResult | null>(null);

  const resource = useBrandApplications();
  const all = useMemo(() => resource.data ?? [], [resource.data]);
  const rows = useMemo(
    () => filterApplications(all, { status, search }),
    [all, status, search]
  );
  const counts = useMemo(() => countByStatus(all), [all]);

  const state = listStateFor(resource.error, {
    isLoading: resource.isLoading,
    isEmpty: rows.length === 0,
  });

  const onFilter = (value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set("status", value);
    else next.delete("status");
    const query = next.toString();
    router.replace(
      query ? `/admin/applications?${query}` : "/admin/applications"
    );
  };

  const statusLabel: Record<BrandApplicationStatus, string> = {
    PENDING: a.appStatusPending,
    APPROVED: a.appStatusApproved,
    REJECTED: a.appStatusRejected,
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

  /**
   * The shop and its owner are facts by the time this renders — the response
   * carrying them is what got us here — so both are `done`. The two channels
   * report whatever the API said they did, including the two outcomes that are
   * not failures: no number on file, and email not configured here.
   */
  const approvalSteps = (outcome: ApproveResult): InviteResultStep[] => [
    { key: "brand", label: a.stepBrand, outcome: "done" },
    ...(outcome.invite
      ? ([
          { key: "owner", label: a.stepOwner, outcome: "done" },
          {
            key: "whatsapp",
            label: a.stepWhatsApp,
            outcome: outcome.invite.delivery.whatsapp,
          },
          {
            key: "email",
            label: a.stepEmail,
            outcome: outcome.invite.delivery.email,
          },
        ] as InviteResultStep[])
      : []),
  ];

  const closeSheets = () => {
    setApproving(null);
    setRejecting(null);
    setReason("");
    setFailed(false);
    setResult(null);
    setDraft({ slug: "", ownerEmail: "" });
  };

  /**
   * The address is suggested, never imposed: the rep proposal first, and
   * failing that one derived from the shop name. `slugify` is Latin-only, so an
   * Arabic name derives to nothing and the reviewer types it — or leaves it
   * empty and lets the API name the shop.
   */
  const openApprove = (row: AdminBrandApplication) => {
    setFailed(false);
    setResult(null);
    setDraft({
      slug: row.proposedSlug ?? slugify(row.businessName),
      ownerEmail: "",
    });
    setApproving(row);
  };

  const runApprove = async () => {
    // Belt and braces, the same as reject: the button is disabled without an
    // email the API could use, and the call is refused without one anyway.
    if (!approving || !isApprovable(approving, draft)) return;
    setPending(true);
    setFailed(false);
    try {
      /*
        The result is KEPT and the sheet is left open. Everything else on this
        screen can be fetched again; the invite link cannot, and an admin shown
        a tick instead of the link would have to reissue it to recover.
      */
      setResult(await approveApplication(approving, draft));
      resource.reload();
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  };

  const runReject = async () => {
    // Belt and braces: the button is disabled without a reason, and the call is
    // refused without one anyway. A disabled button is a hint, not a rule.
    if (!rejecting || !isRejectable(reason)) return;
    setPending(true);
    setFailed(false);
    try {
      await rejectApplication(rejecting.id, reason);
      closeSheets();
      resource.reload();
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  };

  const card = (row: AdminBrandApplication) => (
    <Card key={row.id} className="">
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-semibold text-foreground">
              {row.businessName}
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {row.ownerName}
            </p>
          </div>
          <Badge
            variant="outline"
            data-status={row.status}
            className={`shrink-0 border font-medium ${STATUS_TONE[row.status]}`}
          >
            {statusLabel[row.status]}
          </Badge>
        </div>

        {/* Evidence, first. */}
        <div className="grid gap-1">
          <span className="text-xs font-medium uppercase tracking-caps text-muted-foreground">
            {a.evidence}
          </span>
          {row.instagramUrl ? (
            <a
              href={row.instagramUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="w-fit break-all text-sm font-medium text-foreground underline underline-offset-4"
            >
              {row.instagramUrl}
            </a>
          ) : (
            <span className="text-sm text-state-wait-fg">{a.noInstagram}</span>
          )}
          {row.websiteUrl ? (
            <a
              href={row.websiteUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="w-fit break-all text-sm text-muted-foreground underline underline-offset-4"
            >
              {row.websiteUrl}
            </a>
          ) : null}
        </div>

        {row.description ? (
          <p className="whitespace-pre-line text-sm text-foreground">
            {row.description}
          </p>
        ) : null}

        <FieldGrid>
          {/* An email is the one value that reliably overruns half a card. */}
          <DataField
            label={a.contact}
            value={row.email ?? a.unset}
            wide
            className="break-all"
          />
          <DataField label={a.phone} value={row.phone} numeric />
          <DataField label={a.applied} value={dateOnly(row.createdAt)} numeric />
        </FieldGrid>

        {row.status === "PENDING" ? (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              className="min-h-11"
              onClick={() => openApprove(row)}
            >
              {a.approveAndInvite}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="min-h-11"
              onClick={() => {
                setFailed(false);
                setReason("");
                setRejecting(row);
              }}
            >
              {a.reject}
            </Button>
          </div>
        ) : (
          <div className="grid gap-1 rounded-md border border-border bg-muted/40 px-3 py-2">
            <span className="text-xs text-muted-foreground">
              {row.reviewedAt
                ? `${a.reviewedOn} ${dateOnly(row.reviewedAt)}`
                : a.notReviewed}
            </span>
            {row.rejectionReason ? (
              <span className="text-sm text-foreground">
                {a.rejectionReason}: {row.rejectionReason}
              </span>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">{a.applicationsNote}</p>

      {/*
        The gap, stated rather than hidden. A reviewer who cannot see that the
        whole table arrived in one response has no way to know why the screen
        got slow, and no reason to ask for the envelope every other list has.
      */}
      <Alert>
        <AlertTitle>{a.unpagedTitle}</AlertTitle>
        <AlertDescription>{a.unpagedBody}</AlertDescription>
      </Alert>

      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-2">
          <label
            htmlFor="applications-status-filter"
            className="text-sm font-medium text-foreground"
          >
            {a.filterStatus}
          </label>
          <NativeSelect
            id="applications-status-filter"
            className="w-full max-w-xs"
            value={status ?? ""}
            onChange={(event) => onFilter(event.target.value)}
          >
            <NativeSelectOption value="">{a.filterAll}</NativeSelectOption>
            {STATUSES.map((value) => (
              <NativeSelectOption key={value} value={value}>
                {`${statusLabel[value]} (${counts[value]})`}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>

        <div className="grid gap-2">
          <label
            htmlFor="applications-search"
            className="text-sm font-medium text-foreground"
          >
            {a.searchLabel}
          </label>
          <Input
            id="applications-search"
            className="w-full max-w-xs"
            value={search}
            placeholder={a.searchPlaceholder}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>

      {state === "loading" ? <ListState state="loading" rows={3} /> : null}

      {state === "error" ? (
        <ListState
          state="error"
          title={a.errorTitle}
          body={a.errorBody}
          actionLabel={a.retry}
          onAction={resource.reload}
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

      {state === "empty" ? (
        <ListState
          state="empty"
          title={a.applicationsEmptyTitle}
          body={a.applicationsEmptyBody}
        />
      ) : null}

      {state === null ? (
        <>
          <p className="text-xs text-muted-foreground">
            {a.showingCount
              .replace("{n}", String(rows.length))
              .replace("{total}", String(all.length))}
          </p>
          <div className="grid gap-3 lg:grid-cols-2">{rows.map(card)}</div>
        </>
      ) : null}

      {/*
        Approval is not destructive, so it does not get the destructive sheet.
        It still gets its own sheet, because the thing a reviewer most needs to
        know — an email is about to leave, and it is a LINK rather than a
        password — is not visible on the button.
      */}
      <Sheet
        open={approving !== null}
        onOpenChange={(open) => {
          if (!open) closeSheets();
        }}
      >
        <SheetContent side="bottom" className="max-h-[85svh] overflow-y-auto">
          <SheetHeader className="text-start">
            <SheetTitle>{a.approveTitle}</SheetTitle>
            <SheetDescription>{a.approveDesc}</SheetDescription>
          </SheetHeader>
          <div className="grid gap-3 px-4 pb-4">
            {result ? (
              <InviteResult
                steps={approvalSteps(result)}
                inviteUrl={result.invite?.inviteUrl ?? null}
                labels={{
                  title: a.inviteResult,
                  copyLink: a.copyLink,
                  copyLinkHint: a.copyLinkHint,
                  copied: a.copied,
                  copyFailed: a.copyFailed,
                  outcomes: {
                    sent: a.outcomeSent,
                    skipped: a.outcomeSkipped,
                    failed: a.outcomeFailed,
                    "not-configured": a.outcomeNotConfigured,
                  },
                }}
              />
            ) : approving ? (
              <>
                <Alert>
                  <AlertTitle>{a.inviteTitle}</AlertTitle>
                  <AlertDescription>{a.inviteBody}</AlertDescription>
                </Alert>

                <p className="text-sm text-muted-foreground">
                  {approving.businessName} · {approving.email ?? approving.phone}
                </p>

                {/*
                  WHAT THE REP AGREED, LABELLED AS A PROPOSAL. None of it has
                  reached a Brand yet — approving is what applies it — so the
                  reviewer sees it before they decide rather than discovering it
                  on the terms tab afterwards. Its absence is stated in a
                  sentence, because an empty section reads as a rendering fault
                  where "nothing was proposed" is a fact about how the shop
                  arrived.
                */}
                <div className="grid gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
                  <span className="text-xs font-medium uppercase tracking-caps text-muted-foreground">
                    {a.proposedBy}
                  </span>
                  {hasProposal(approving) ? (
                    <FieldGrid>
                      {approving.proposedFreeUntil ? (
                        <DataField
                          label={a.freeUntil}
                          value={dateOnly(approving.proposedFreeUntil)}
                          numeric
                        />
                      ) : null}
                      {approving.proposedMonthlyFee ? (
                        <DataField
                          label={a.monthlyFee}
                          value={formatMoney(approving.proposedMonthlyFee)}
                          numeric
                        />
                      ) : null}
                      {approving.proposedPerOrderChargeValue ? (
                        <DataField
                          label={a.perOrder}
                          value={
                            approving.proposedPerOrderChargeType === "PERCENT"
                              ? `${approving.proposedPerOrderChargeValue}%`
                              : formatMoney(
                                  approving.proposedPerOrderChargeValue
                                )
                          }
                          numeric
                        />
                      ) : null}
                      {approving.proposedSettlementCadence ? (
                        <DataField
                          label={a.cadence}
                          value={
                            CADENCE_LABEL[approving.proposedSettlementCadence]
                          }
                        />
                      ) : null}
                      {approving.proposedSettlementAnchor === null ||
                      approving.proposedSettlementAnchor === undefined ? null : (
                        <DataField
                          label={a.anchorDay}
                          value={String(approving.proposedSettlementAnchor)}
                          numeric
                        />
                      )}
                      {approving.proposedSettlementMethod ? (
                        <DataField
                          label={a.settlementMethod}
                          value={METHOD_LABEL[approving.proposedSettlementMethod]}
                        />
                      ) : null}
                    </FieldGrid>
                  ) : (
                    <p className="text-sm text-foreground">{a.proposedNone}</p>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="approve-slug">{a.shopSlug}</Label>
                  <Input
                    id="approve-slug"
                    value={draft.slug}
                    aria-describedby="approve-slug-note"
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        slug: event.target.value,
                      }))
                    }
                  />
                  <p
                    id="approve-slug-note"
                    className="text-xs text-muted-foreground"
                  >
                    {a.shopSlugHint}
                  </p>
                </div>

                {approving.email ? null : (
                  <>
                    <Alert variant="wait">
                      <AlertDescription>{a.ownerEmailMissing}</AlertDescription>
                    </Alert>
                    <div className="grid gap-2">
                      <Label htmlFor="approve-owner-email">{a.ownerEmail}</Label>
                      <Input
                        id="approve-owner-email"
                        type="email"
                        inputMode="email"
                        value={draft.ownerEmail}
                        aria-describedby="approve-owner-email-note"
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            ownerEmail: event.target.value,
                          }))
                        }
                      />
                      <p
                        id="approve-owner-email-note"
                        className="text-xs text-muted-foreground"
                      >
                        {a.ownerEmailHint}
                      </p>
                    </div>
                  </>
                )}

                {failed ? (
                  <p role="alert" className="text-sm text-state-bad-fg">
                    {a.actionFailed}
                  </p>
                ) : null}

                <Button
                  className="min-h-13 w-full"
                  disabled={pending || !isApprovable(approving, draft)}
                  onClick={() => void runApprove()}
                >
                  {pending ? a.saving : a.approveAndInvite}
                </Button>
              </>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>

      {/*
        Rejection IS destructive — it ends an application permanently — so it
        uses the destructive sheet, whose `consequences` prop is required. The
        reason field lives in `children`, and the confirm button stays disabled
        until the contract would accept what has been typed.
      */}
      <DestructiveSheet
        open={rejecting !== null}
        onOpenChange={(open) => {
          if (!open) closeSheets();
        }}
        title={a.rejectTitle}
        description={a.rejectDesc}
        consequences={[a.rejectNoBrand, a.rejectNoUser, a.rejectReasonKept]}
        confirmLabel={isRejectable(reason) ? a.reject : a.reasonRequired}
        cancelLabel={a.keepApplication}
        onConfirm={() => void runReject()}
      >
        <div className="grid gap-2">
          <Label htmlFor="reject-reason">{a.rejectReason}</Label>
          <Textarea
            id="reject-reason"
            rows={3}
            value={reason}
            placeholder={a.rejectPlaceholder}
            onChange={(event) => setReason(event.target.value)}
          />
          {isRejectable(reason) ? null : (
            <p className="text-xs text-state-bad-fg">{a.reasonRequiredBody}</p>
          )}
          {failed ? (
            <p role="alert" className="text-sm text-state-bad-fg">
              {a.actionFailed}
            </p>
          ) : null}
        </div>
      </DestructiveSheet>
    </div>
  );
}

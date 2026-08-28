"use client";

/**
 * Who can sign in to this shop — the one question the brand page could not
 * answer.
 *
 * Composed from shadcn's Card, Alert, Label, Input and Button, plus the domain
 * layer's InviteResult, DataField and FieldGrid. No colour is introduced here;
 * the states borrow the tokens `globals.css` already defines.
 *
 * THREE STATES, DERIVED, NEVER STORED
 *
 *   No owner yet           no user carries this brandId
 *   Invited, not accepted  owner exists, `mustChangePassword` is true
 *   Active                 owner exists, `mustChangePassword` is false
 *
 * That is the existing meaning of `mustChangePassword` rather than a new one
 * bolted onto it, and it is why there is no invite table: the redemption
 * endpoint is Better Auth's, so an invite row would be a second copy of a fact
 * Better Auth already owns, and two records of one fact drift.
 *
 * "NO OWNER YET" IS ALSO WHAT AN OLDER BACKEND LOOKS LIKE, deliberately. The
 * `owner` field is being added to `GET /v1/admin/brands/:id` separately; until
 * it lands, every brand reads as ownerless. That is the state worth defaulting
 * to — a shop nobody can sign in to is a real and common condition of this
 * system today, and showing the block with an invite button is recoverable,
 * because the API refuses a duplicate owner with a 409 and that refusal is a
 * sentence an admin can read. Hiding the block would leave the condition
 * invisible instead.
 *
 * THE RESULT PANEL STAYS UNTIL THE ADMIN LEAVES THE PAGE. It carries the only
 * copy of the invite link anybody is ever shown, so it is not a toast and it
 * does not clear itself when the brand reloads underneath it.
 */
import { useState } from "react";

import {
  DataField,
  FieldGrid,
  InviteResult,
  type InviteResultStep,
} from "@/components/loqal";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { describeFailure, type Failure } from "@/lib/api";
import { useMessages } from "@/lib/locale-context";

import type { InviteResultPayload } from "../new-shop-data";
import {
  emptyOwnerDraft,
  isOwnerInvitable,
  type OwnerDraft,
} from "../new-shop-form";
import {
  inviteBrandOwner,
  resendBrandOwnerInvite,
  type AdminBrandDetail,
} from "./brand-detail-data";

export type OwnerState = "none" | "invited" | "active";

/**
 * Pure, and exported so the derivation can be read on one line rather than
 * inferred from a tree of ternaries in the middle of a card.
 */
export function ownerState(brand: AdminBrandDetail): OwnerState {
  if (!brand.owner) return "none";
  return brand.owner.mustChangePassword ? "invited" : "active";
}

export type OwnerBlockProps = {
  brand: AdminBrandDetail;
  /** `resource.reload` from the page. An owner who now exists must show up. */
  onChanged: () => void;
};

export function OwnerBlock({ brand, onChanged }: OwnerBlockProps) {
  const a = useMessages().admin;
  const state = ownerState(brand);

  const [inviting, setInviting] = useState(false);
  const [draft, setDraft] = useState<OwnerDraft>(emptyOwnerDraft);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [result, setResult] = useState<InviteResultPayload | null>(null);
  /** Which call produced `result`. The steps differ; the panel does not. */
  const [minted, setMinted] = useState<"invite" | "resend">("invite");

  const set = (key: keyof OwnerDraft, value: string) =>
    setDraft((current) => ({ ...current, [key]: value }));

  /**
   * The same shape as `run()` on the brand page — pending, call,
   * `resource.reload()`, then say what happened as `role="status"` or
   * `role="alert"`. It is written here rather than threaded down as a prop
   * because the value this one produces is the invite link, which has to live
   * beside the panel that renders it; a `run` handing its work's result back up
   * three levels would be a second pattern rather than the same one.
   *
   * The success side needs no `role="status"` of its own: the result panel IS
   * the statement of what happened, and it says four separate things where a
   * "Saved." would say one that is not always true.
   *
   * THE FAILURE SIDE IS NOT A BOOLEAN, and that was the bug: every refusal,
   * including the 409 naming the email that already has an account, printed
   * "That did not go through. Nothing was changed." `describeFailure` keeps
   * the claim inside what the status supports.
   */
  const run = async (
    kind: "invite" | "resend",
    work: () => Promise<InviteResultPayload>
  ) => {
    setPending(true);
    setFailure(null);
    try {
      const outcome = await work();
      setMinted(kind);
      setResult(outcome);
      setInviting(false);
      onChanged();
    } catch (error) {
      setFailure(
        describeFailure(error, {
          conflict: a.ownerExists,
          notFound: a.actionUnavailable,
          refused: a.actionRefused,
          generic: a.actionFailed,
        })
      );
    } finally {
      setPending(false);
    }
  };

  /**
   * An invite creates the account and then tries two channels; a resend creates
   * nothing and tries the same two. Printing "Owner account created" over a
   * resend would be false, so that row is simply absent from one of them.
   */
  const steps: InviteResultStep[] = result
    ? [
        ...(minted === "invite"
          ? [{ key: "owner", label: a.stepOwner, outcome: "done" as const }]
          : []),
        {
          key: "whatsapp",
          label: a.stepWhatsApp,
          outcome: result.delivery.whatsapp,
        },
        { key: "email", label: a.stepEmail, outcome: result.delivery.email },
      ]
    : [];

  return (
    <Card data-slot="owner-block" className="">
      <CardHeader>
        <CardTitle>{a.ownerSection}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {state === "none" ? (
          <Alert variant="wait">
            <AlertTitle>{a.ownerNone}</AlertTitle>
            <AlertDescription>{a.ownerNoneBody}</AlertDescription>
          </Alert>
        ) : null}

        {state === "invited" ? (
          <Alert variant="wait">
            <AlertTitle>{a.ownerInvited}</AlertTitle>
            <AlertDescription>{a.ownerInvitedBody}</AlertDescription>
          </Alert>
        ) : null}

        {brand.owner ? (
          <FieldGrid>
            <DataField label={a.ownerName} value={brand.owner.name} />
            <DataField
              label={a.ownerEmail}
              value={brand.owner.email}
              wide
              className="break-all"
            />
          </FieldGrid>
        ) : null}

        {state === "active" ? (
          <p className="text-sm text-state-good-fg">{a.ownerActive}</p>
        ) : null}

        {state === "none" && !inviting ? (
          <Button
            className="min-h-11 justify-self-start"
            onClick={() => {
              setFailure(null);
              setDraft(emptyOwnerDraft);
              setInviting(true);
            }}
          >
            {a.inviteOwner}
          </Button>
        ) : null}

        {state === "none" && inviting ? (
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="owner-invite-name">{a.ownerName}</Label>
              <Input
                id="owner-invite-name"
                value={draft.ownerName}
                onChange={(event) => set("ownerName", event.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="owner-invite-email">{a.ownerEmail}</Label>
              <Input
                id="owner-invite-email"
                type="email"
                inputMode="email"
                value={draft.ownerEmail}
                aria-describedby="owner-invite-email-note"
                onChange={(event) => set("ownerEmail", event.target.value)}
              />
              <p
                id="owner-invite-email-note"
                className="text-xs text-muted-foreground"
              >
                {a.ownerEmailHint}
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="owner-invite-phone">{a.ownerPhone}</Label>
              <Input
                id="owner-invite-phone"
                type="tel"
                inputMode="tel"
                value={draft.ownerPhone}
                aria-describedby="owner-invite-phone-note"
                onChange={(event) => set("ownerPhone", event.target.value)}
              />
              <p
                id="owner-invite-phone-note"
                className="text-xs text-muted-foreground"
              >
                {a.ownerPhoneHint}
              </p>
            </div>

            {/* min-w-40 so swapping the label for "Saving…" does not resize the
                button under the pointer. */}
            <Button
              className="min-h-11 min-w-40 justify-self-start"
              disabled={pending || !isOwnerInvitable(draft)}
              onClick={() =>
                void run("invite", () => inviteBrandOwner(brand.id, draft))
              }
            >
              {pending ? a.saving : a.createShop}
            </Button>
          </div>
        ) : null}

        {state === "invited" ? (
          <Button
            variant="outline"
            className="min-h-11 min-w-40 justify-self-start"
            disabled={pending}
            onClick={() =>
              void run("resend", () => resendBrandOwnerInvite(brand.id))
            }
          >
            {pending ? a.saving : a.resendInvite}
          </Button>
        ) : null}

        {/* `role="alert"` stays on the element that CARRIES the headline, so
            a screen reader announces the sentence rather than a container.
            The API's own words go underneath, quieter, because they are the
            server's phrasing and not the console's. */}
        {failure ? (
          <div className="grid gap-1">
            <p role="alert" className="text-sm text-state-bad-fg">
              {failure.title}
            </p>
            {failure.detail ? (
              <p className="text-xs text-muted-foreground">{failure.detail}</p>
            ) : null}
          </div>
        ) : null}

        {result ? (
          <InviteResult
            steps={steps}
            inviteUrl={result.inviteUrl}
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
        ) : null}
      </CardContent>
    </Card>
  );
}

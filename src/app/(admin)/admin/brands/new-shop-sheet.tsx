"use client";

/**
 * Add a shop — the only way to create one from this console.
 *
 * Composed from shadcn's Sheet, Label, Input, Button and Alert, plus the
 * domain layer's InviteResult. The pure rules are in `new-shop-form.ts` and
 * the write is in `new-shop-data.ts`; this file is the arrangement and nothing
 * else.
 *
 * THE RESULT REPLACES THE FORM AND THE SHEET STAYS OPEN. Creating a shop is
 * four things that can fail separately, so closing on success and showing a
 * tick would be a lie in the ordinary case — and it would take the invite link
 * with it, which is the only copy anybody is ever shown. Closing the sheet is
 * what reloads the list, and closing it is the admin's decision.
 */
import { useState } from "react";
import { PlusIcon } from "lucide-react";

import { InviteResult, type InviteResultStep } from "@/components/loqal";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ApiError } from "@/lib/api";
import { useMessages } from "@/lib/locale-context";

import { createShop, type CreateShopResult } from "./new-shop-data";
import {
  emptyDraft,
  isSubmittable,
  slugify,
  type NewShopDraft,
} from "./new-shop-form";

export type NewShopSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called when a sheet that created something is closed. The list reloads. */
  onCreated: () => void;
};

type Failure = "none" | "slug" | "request";

export function NewShopSheet({
  open,
  onOpenChange,
  onCreated,
}: NewShopSheetProps) {
  const t = useMessages();
  const a = t.admin;

  const [draft, setDraft] = useState<NewShopDraft>(emptyDraft);
  /**
   * The suggestion stops the moment the admin types an address of their own.
   * Without this the field would fight them on every further keystroke of the
   * name, which is the behaviour that makes derived slugs hated.
   */
  const [slugTouched, setSlugTouched] = useState(false);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<Failure>("none");
  const [result, setResult] = useState<CreateShopResult | null>(null);

  const set = (key: keyof NewShopDraft, value: string) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const setName = (value: string) =>
    setDraft((current) => ({
      ...current,
      name: value,
      slug: slugTouched ? current.slug : slugify(value),
    }));

  const setSlug = (value: string) => {
    setSlugTouched(true);
    set("slug", value);
  };

  const submit = async () => {
    setPending(true);
    setFailure("none");
    try {
      setResult(await createShop(draft));
    } catch (error) {
      /*
        A 409 is the address, not the request. Saying "that did not save" over a
        taken slug sends an admin looking for an outage when the fix is one
        word in one field — and the draft is kept for exactly the same reason.
      */
      setFailure(
        error instanceof ApiError && error.statusCode === 409 ? "slug" : "request"
      );
    } finally {
      setPending(false);
    }
  };

  const close = (next: boolean) => {
    if (!next && result) onCreated();
    if (!next) {
      setDraft(emptyDraft);
      setSlugTouched(false);
      setFailure("none");
      setResult(null);
    }
    onOpenChange(next);
  };

  /**
   * The shop and the owner are facts by the time this renders — the response
   * carrying them is what got us here — so they are `done`. WhatsApp and email
   * report whatever the API said they did, including the two outcomes that are
   * not failures: no number on file, and email not configured on this
   * deployment.
   */
  const steps: InviteResultStep[] = result
    ? [
        { key: "brand", label: a.stepBrand, outcome: "done" },
        ...(result.invite
          ? ([
              { key: "owner", label: a.stepOwner, outcome: "done" },
              {
                key: "whatsapp",
                label: a.stepWhatsApp,
                outcome: result.invite.delivery.whatsapp,
              },
              {
                key: "email",
                label: a.stepEmail,
                outcome: result.invite.delivery.email,
              },
            ] as InviteResultStep[])
          : []),
      ]
    : [];

  return (
    <Sheet open={open} onOpenChange={close}>
      <SheetContent side="bottom" className="max-h-[85svh] overflow-y-auto">
        <SheetHeader className="text-start">
          <SheetTitle>{a.addShop}</SheetTitle>
          <SheetDescription>{a.addShopDesc}</SheetDescription>
        </SheetHeader>

        <div className="grid gap-3 px-4 pb-4">
          {result ? (
            <InviteResult
              steps={steps}
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
          ) : (
            <>
              {failure === "request" ? (
                <Alert variant="destructive" role="alert">
                  <AlertTitle>{a.saveFailed}</AlertTitle>
                  <AlertDescription>{a.errorBody}</AlertDescription>
                </Alert>
              ) : null}

              <div className="grid gap-2">
                <Label htmlFor="new-shop-name">{a.shopName}</Label>
                <Input
                  id="new-shop-name"
                  value={draft.name}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="new-shop-slug">{a.shopSlug}</Label>
                <Input
                  id="new-shop-slug"
                  value={draft.slug}
                  aria-invalid={failure === "slug" || undefined}
                  aria-describedby="new-shop-slug-note"
                  onChange={(event) => setSlug(event.target.value)}
                />
                <p
                  id="new-shop-slug-note"
                  className={
                    failure === "slug"
                      ? "text-xs text-state-bad-fg"
                      : "text-xs text-muted-foreground"
                  }
                >
                  {failure === "slug" ? a.slugTaken : a.shopSlugHint}
                </p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="new-shop-owner-name">{a.ownerName}</Label>
                <Input
                  id="new-shop-owner-name"
                  value={draft.ownerName}
                  onChange={(event) => set("ownerName", event.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="new-shop-owner-email">{a.ownerEmail}</Label>
                <Input
                  id="new-shop-owner-email"
                  type="email"
                  inputMode="email"
                  value={draft.ownerEmail}
                  aria-describedby="new-shop-owner-email-note"
                  onChange={(event) => set("ownerEmail", event.target.value)}
                />
                <p
                  id="new-shop-owner-email-note"
                  className="text-xs text-muted-foreground"
                >
                  {a.ownerEmailHint}
                </p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="new-shop-owner-phone">{a.ownerPhone}</Label>
                <Input
                  id="new-shop-owner-phone"
                  type="tel"
                  inputMode="tel"
                  value={draft.ownerPhone}
                  aria-describedby="new-shop-owner-phone-note"
                  onChange={(event) => set("ownerPhone", event.target.value)}
                />
                <p
                  id="new-shop-owner-phone-note"
                  className="text-xs text-muted-foreground"
                >
                  {a.ownerPhoneHint}
                </p>
              </div>

              {/* min-w-40 so the label swapping to "Saving…" does not resize
                  the button and shift the sheet under the pointer. */}
              <Button
                className="min-h-13 w-full min-w-40"
                disabled={pending || !isSubmittable(draft)}
                onClick={() => void submit()}
              >
                {pending ? a.saving : a.createShop}
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** The trigger, so the list screen holds one piece of state and not two. */
export function NewShopButton({ onClick }: { onClick: () => void }) {
  const a = useMessages().admin;

  return (
    <Button className="min-h-11" onClick={onClick}>
      <PlusIcon aria-hidden />
      {a.addShop}
    </Button>
  );
}

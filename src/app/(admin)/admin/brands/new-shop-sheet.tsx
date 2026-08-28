"use client";

/**
 * Add a shop — the only way to create one from this console.
 *
 * Composed from shadcn's Dialog, Label, Input, Button and Alert, plus the
 * domain layer's InviteResult. The pure rules are in `new-shop-form.ts` and
 * the write is in `new-shop-data.ts`; this file is the arrangement and nothing
 * else.
 *
 * The file is still named `new-shop-sheet.tsx` and the export is still
 * `NewShopSheet`, which is now a misnomer — it renders a Dialog. Renaming both
 * touches three files while another agent is working in this repository, so it
 * is deliberately deferred rather than done badly.
 *
 * THE RESULT REPLACES THE FORM AND THE MODAL STAYS OPEN. Creating a shop is
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
    <Dialog open={open} onOpenChange={close}>
      {/* A CENTRED MODAL, not a bottom sheet. Five fields do not need the whole
          screen, and a sheet that fills a 1080px window turns a small,
          reversible act into something that looks like leaving the page. The
          sheet also stretched every input to the full width, which put a label
          and its own field far enough apart to stop reading as one thing.

          Height is capped at 85svh and only the BODY scrolls, so the title
          stays readable and the action stays reachable however long the form
          gets. `gap-0 p-0` because the padding is per-region here — a scrolling
          body cannot share the container's padding without the content
          disappearing under its own edges. */}
      <DialogContent className="grid max-h-[85svh] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="space-y-1.5 border-b border-border px-6 pt-6 pb-4 text-start">
          <DialogTitle className="text-lg">{a.addShop}</DialogTitle>
          <DialogDescription>{a.addShopDesc}</DialogDescription>
        </DialogHeader>

        {/* min-h-0 is what makes this scroll AT ALL.
            DialogContent is a grid, and a grid item defaults to
            `min-height: auto` — it refuses to shrink below its content. So the
            body grew past the 85svh cap, `overflow-hidden` clipped the whole
            modal, and the header and the submit button were pushed off-screen
            with no scrollbar anywhere to say so. The row is
            `minmax(0, 1fr)` for the same reason. */}
        <div className="grid min-h-0 gap-5 overflow-y-auto px-6 py-5">
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

              {/* TWO GROUPS, because these are two different objects: a shop,
                  and the person who will sign in to it. Run together as one
                  stack of five inputs they read as one form about one thing,
                  and the owner's email looks like a field of the shop. */}
              <p className="text-xs font-medium tracking-caps text-muted-foreground uppercase">
                {a.sectionShop}
              </p>

              <div className="grid gap-2">
                <Label htmlFor="new-shop-name">{a.shopName}</Label>
                <Input
                  id="new-shop-name"
                  value={draft.name}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>

              {/* The prefix sits INSIDE the field rather than in the hint, so
                  the thing being typed is visibly a URL segment. It was
                  labelled "Address" with a hint about letters and hyphens,
                  which in a product built on shops you can walk to is an
                  invitation to type a street. */}
              <div className="grid gap-2">
                <Label htmlFor="new-shop-slug">{a.shopSlug}</Label>
                <div
                  className="flex items-center gap-0 rounded-md border border-input bg-background focus-within:border-ring focus-within:shadow-[0_0_0_3px_color-mix(in_oklab,var(--ring)_22%,transparent)] data-invalid:border-destructive"
                  data-invalid={failure === "slug" || undefined}
                >
                  <span
                    aria-hidden
                    className="ps-3 font-mono text-sm text-muted-foreground"
                    dir="ltr"
                  >
                    {a.shopSlugPrefix}
                  </span>
                  <Input
                    id="new-shop-slug"
                    dir="ltr"
                    className="border-0 bg-transparent ps-1 font-mono focus:shadow-none"
                    value={draft.slug}
                    aria-invalid={failure === "slug" || undefined}
                    aria-describedby="new-shop-slug-note"
                    onChange={(event) => setSlug(event.target.value)}
                  />
                </div>
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

              <div className="mt-1 border-t border-border pt-5">
                <p className="text-xs font-medium tracking-caps text-muted-foreground uppercase">
                  {a.sectionOwner}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {a.sectionOwnerHint}
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
                <Label htmlFor="new-shop-owner-phone">
                  {a.ownerPhone}
                  {/* The only optional field. Saying so here is what makes the
                      other four legible as required without four asterisks. */}
                  <span className="ms-2 text-xs font-normal text-muted-foreground">
                    {a.optionalMark}
                  </span>
                </Label>
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

            </>
          )}
        </div>

        {/* OUTSIDE the scrolling body. The action is the one thing that must
            never be somewhere the admin has to hunt for, and in the sheet it
            sat below five fields where a short window pushed it off-screen
            entirely.

            min-w-40 so the label swapping to "Saving…" cannot resize the button
            under the pointer. Hidden once the result is showing: at that point
            the shop exists and the only remaining action is closing. */}
        {result ? null : (
          <div className="border-t border-border px-6 py-4">
            <Button
              className="min-h-12 w-full min-w-40"
              disabled={pending || !isSubmittable(draft)}
              onClick={() => void submit()}
            >
              {pending ? a.saving : a.createShop}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
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

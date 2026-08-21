"use client";

/**
 * /admin/reviews — hide one review, by id.
 *
 * Composed from the domain layer: DestructiveSheet, ListState — plus shadcn's
 * Alert, Button, Input and Textarea.
 *
 * THIS SCREEN IS MOSTLY AN EXPLANATION, and that is deliberate. There is no
 * admin route that lists reviews (see `reviews-data.ts`), so the honest screen
 * is a form over the one route that exists plus a paragraph saying why there is
 * no table above it. The alternative — a table assembled from the storefront's
 * public endpoints — would look like the admin console had a review inbox, and
 * would quietly become the thing people relied on.
 *
 * THE REASON IS REQUIRED AND IS NOT A FORMALITY. A review is never deleted and
 * there is no lesser tier to have moved it to, so the reason IS the defence
 * against an accusation of censorship. The button stays disabled until one is
 * written, and the sheet says what the reason is for.
 */
import { useState } from "react";

import { DestructiveSheet } from "@/components/loqal";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api";
import { useMessages } from "@/lib/locale-context";

import { ADMIN_REQUIRED_ROLE } from "../../shell-rules";
import { hideReview, isHideable, isReviewId } from "./reviews-data";

export function ReviewsScreen() {
  const t = useMessages();
  const a = t.admin;

  const [id, setId] = useState("");
  const [reason, setReason] = useState("");
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState<"hidden" | "failed" | "denied" | null>(
    null
  );

  const idLooksRight = id.trim() === "" || isReviewId(id);
  const ready = isReviewId(id) && isHideable(reason);

  const confirm = async () => {
    setOutcome(null);
    try {
      await hideReview(id, reason);
      setOpen(false);
      setId("");
      setReason("");
      setOutcome("hidden");
    } catch (thrown) {
      setOpen(false);
      setOutcome(
        thrown instanceof ApiError && thrown.isPermissionDenied
          ? "denied"
          : "failed"
      );
    }
  };

  return (
    <div className="grid gap-4">
      <Alert>
        <AlertTitle>{a.reviewsNoListTitle}</AlertTitle>
        <AlertDescription>{a.reviewsNoListBody}</AlertDescription>
      </Alert>

      <div className="grid max-w-xl gap-2">
        <label
          htmlFor="review-id"
          className="text-sm font-medium text-foreground"
        >
          {a.reviewIdLabel}
        </label>
        <Input
          id="review-id"
          value={id}
          placeholder={a.reviewIdPlaceholder}
          aria-invalid={!idLooksRight}
          onChange={(event) => setId(event.target.value)}
        />
        {!idLooksRight ? (
          <p role="status" className="text-sm text-state-bad-fg">
            {a.reviewIdInvalid}
          </p>
        ) : null}
      </div>

      <div className="grid max-w-xl gap-2">
        <label
          htmlFor="review-reason"
          className="text-sm font-medium text-foreground"
        >
          {a.hideReason}
        </label>
        <Textarea
          id="review-reason"
          value={reason}
          placeholder={a.hideReasonPlaceholder}
          onChange={(event) => setReason(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">{a.hideReasonLogged}</p>
      </div>

      <Button
        variant="destructive"
        className="min-h-11 justify-self-start"
        disabled={!ready}
        onClick={() => setOpen(true)}
      >
        {a.hideTitle}
      </Button>

      {outcome === "hidden" ? (
        <p role="status" className="text-sm text-state-good-fg">
          {a.reviewHidden}
        </p>
      ) : null}

      {outcome === "failed" ? (
        <p role="alert" className="text-sm text-state-bad-fg">
          {a.actionFailed}
        </p>
      ) : null}

      {outcome === "denied" ? (
        <Alert
          role="alert"
          className="border-state-bad-border bg-state-bad-bg"
        >
          <AlertTitle>{a.deniedTitle}</AlertTitle>
          <AlertDescription>
            {a.deniedBody} {ADMIN_REQUIRED_ROLE}
          </AlertDescription>
        </Alert>
      ) : null}

      <DestructiveSheet
        open={open}
        onOpenChange={setOpen}
        title={a.hideTitle}
        description={a.hideDesc}
        consequences={[
          a.hideNeverDeleted,
          a.hideReasonLogged,
          a.hideAffectsScore,
        ]}
        confirmLabel={a.hideTitle}
        cancelLabel={a.keepReview}
        onConfirm={confirm}
      >
        <p className="font-mono text-xs text-muted-foreground">{id}</p>
      </DestructiveSheet>
    </div>
  );
}

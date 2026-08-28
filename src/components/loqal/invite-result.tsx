"use client";

/**
 * Composed from shadcn primitives: Button — plus the state tokens globals.css
 * already defines. No new colour is introduced here.
 *
 * WHAT ACTUALLY HAPPENED, not "Done".
 *
 * Creating a shop and inviting its owner is four things that can fail
 * separately — the shop, the account, the WhatsApp message, the email — and
 * three of them can fail while the others succeed. A single success screen
 * would be a lie in the common case: email is not configured on this
 * deployment at all, and an owner with no number on file gets no WhatsApp
 * either. So each step states its own outcome, and the four outcomes are
 * worded as four different facts rather than as success and failure, because
 * the fix differs for each and only one of them is a fault.
 *
 * THE LINK IS ALWAYS ON SCREEN, as selectable text and behind a button. It is
 * the escape hatch that makes every delivery failure recoverable, and it is
 * present on total success too — an admin should not have to cause an error to
 * discover where the link lives.
 *
 * This panel is deliberately NOT a toast. A toast fades in four seconds, and
 * what would fade with it is the only copy of that link anybody will ever be
 * shown. Toasts here are for the confirmation that the copy worked.
 */
import { useEffect, useRef, useState } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type InviteStepOutcome =
  | "done"
  | "sent"
  | "skipped"
  | "failed"
  | "not-configured";

export type InviteResultStep = {
  key: string;
  /** Already translated; this component never looks copy up. */
  label: string;
  outcome: InviteStepOutcome;
};

/**
 * `done` carries no word of its own, and that is the design rather than a
 * missing string. "Shop created" is already a statement in the past tense —
 * printing "Sent" beside it would say something untrue, and any other word
 * would be copy invented at the component instead of translated in
 * `admin.ar.ts`. It gets the tick and the good tone.
 */
export type InviteResultLabels = {
  title: string;
  copyLink: string;
  copyLinkHint: string;
  copied: string;
  copyFailed: string;
  outcomes: Record<Exclude<InviteStepOutcome, "done">, string>;
};

export type InviteResultProps = {
  steps: readonly InviteResultStep[];
  /** Null when no invite was minted — the shop exists and nobody was invited. */
  inviteUrl: string | null;
  labels: InviteResultLabels;
  className?: string;
};

const TONE: Record<InviteStepOutcome, string> = {
  done: "text-state-good-fg",
  sent: "text-state-good-fg",
  skipped: "text-state-wait-fg",
  "not-configured": "text-state-wait-fg",
  failed: "text-state-bad-fg",
};

/**
 * The stagger is gated rather than merely shortened. globals.css already
 * clamps every animation duration under `prefers-reduced-motion`, but a
 * per-row `animation-delay` is not a duration and survives that clamp — the
 * rows would still arrive one after another, just instantly, which is the
 * flicker the setting exists to prevent.
 */
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!query) return;

    setReduced(query.matches);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener?.("change", onChange);
    return () => query.removeEventListener?.("change", onChange);
  }, []);

  return reduced;
}

type CopyState = "idle" | "copied" | "failed";

export function InviteResult({
  steps,
  inviteUrl,
  labels,
  className,
}: InviteResultProps) {
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const linkRef = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();

  /** Puts the link under the cursor so it can be copied with one keystroke. */
  const selectLinkText = () => {
    const node = linkRef.current;
    const selection = window.getSelection?.();
    if (!node || !selection) return;

    const range = document.createRange();
    range.selectNodeContents(node);
    selection.removeAllRanges();
    selection.addRange(range);
  };

  const copy = async () => {
    if (!inviteUrl) return;

    try {
      if (!navigator.clipboard?.writeText) throw new Error("unavailable");
      await navigator.clipboard.writeText(inviteUrl);
      setCopyState("copied");
      toast.success(labels.copied);
    } catch {
      /*
        `navigator.clipboard` is undefined on an insecure origin, which
        includes this dashboard served over plain HTTP on a local network —
        the normal case in the office, not an edge case. Select the text so it
        can be copied by hand, and say so. Reporting a success that did not
        happen would leave an admin pasting whatever was in the clipboard
        beforehand into a message to a shop owner.
      */
      selectLinkText();
      setCopyState("failed");
    }
  };

  return (
    <div
      data-slot="invite-result"
      className={cn(
        "grid gap-3 rounded-md border border-border bg-card p-4",
        className
      )}
    >
      <h3 className="text-sm font-medium text-foreground">{labels.title}</h3>

      <ul className="grid gap-2">
        {steps.map((step, index) => (
          <li
            key={step.key}
            data-step={step.key}
            data-outcome={step.outcome}
            className={cn(
              "flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm",
              TONE[step.outcome],
              !reduced && "animate-[loqal-rise_180ms_var(--ease-out)_both]"
            )}
            style={reduced ? undefined : { animationDelay: `${index * 45}ms` }}
          >
            <span className="flex items-center gap-x-2 text-foreground">
              {step.outcome === "done" || step.outcome === "sent" ? (
                <CheckIcon
                  aria-hidden
                  className={cn("size-4", TONE[step.outcome])}
                />
              ) : null}
              {step.label}
            </span>
            {step.outcome === "done" ? null : (
              <span className="font-medium">
                {labels.outcomes[step.outcome]}
              </span>
            )}
          </li>
        ))}
      </ul>

      {inviteUrl ? (
        <div className="grid gap-2">
          <code
            ref={linkRef}
            data-testid="invite-url"
            className="block overflow-x-auto rounded-md bg-muted px-3 py-2 text-start text-xs text-foreground select-all"
          >
            {inviteUrl}
          </code>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11"
              onClick={() => void copy()}
            >
              <CopyIcon aria-hidden />
              {labels.copyLink}
            </Button>
            {copyState === "copied" ? (
              <span role="status" className="text-sm text-state-good-fg">
                {labels.copied}
              </span>
            ) : null}
            {copyState === "failed" ? (
              <span role="status" className="text-sm text-state-bad-fg">
                {labels.copyFailed}
              </span>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">{labels.copyLinkHint}</p>
        </div>
      ) : null}
    </div>
  );
}

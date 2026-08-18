"use client";

/**
 * Composed from shadcn primitives: Field (+FieldGroup/FieldLabel/
 * FieldDescription), Input, Button, Alert (+AlertTitle/AlertDescription), plus
 * the domain layer's ListState for the expired-link panel.
 *
 * One screen, two ways in.
 *
 * FIRST LOGIN. The shop signed in with the password Loqal issued and the
 * session carries `mustChangePassword`. Better Auth's changePassword is the
 * only endpoint that exists for this, and it requires the current password —
 * so the form asks for it. The design system drew two fields; three is what the
 * API can actually honour, and a screen that submits and then fails is worse
 * than one that asks.
 *
 * EMAILED INVITE. No session at all: the shop was approved, an admin sent a
 * one-time link, and it arrives here as `?token=`. That redeems through
 * resetPassword and ends at /sign-in, because redeeming a reset token does not
 * create a session.
 *
 * Either way the user cannot leave. There is no nav, no skip and no link out —
 * and `(brand)/layout.tsx` sends anyone with `mustChangePassword` straight back
 * here if they type a URL. The account is not usable until this is done, so
 * every exit would lead somewhere the API refuses.
 *
 * The 9-character minimum is Better Auth's (`minPasswordLength: 9` in
 * loqal-backend/src/core/auth/auth.instance.ts) and it is enforced here BEFORE
 * submit. Typing a password twice, pressing the button and being told it was
 * too short is the worst version of this screen.
 */
import Link from "next/link";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { ListState } from "@/components/loqal";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { authClient, useSession } from "@/lib/auth-client";
import { useMessages } from "@/lib/locale-context";
import { cn } from "@/lib/utils";

import { MIN_PASSWORD_LENGTH } from "../auth-rules";

function SetPasswordForm() {
  const t = useMessages().brand;
  const router = useRouter();
  const params = useSearchParams();
  const { data: session, isPending: sessionPending } = useSession();

  const token = params.get("token");
  const bounced = params.get("error") === "INVALID_TOKEN";

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [expired, setExpired] = useState(bounced);

  const hasSession = Boolean(session?.user);
  const mode: "invite" | "first-login" | "none" = token
    ? "invite"
    : hasSession
      ? "first-login"
      : "none";

  // Nothing to set and nobody to set it for. Not an error screen — just the
  // wrong door.
  useEffect(() => {
    if (mode === "none" && !sessionPending && !expired) router.replace("/sign-in");
  }, [mode, sessionPending, expired, router]);

  if (expired) {
    return (
      <div className="grid gap-4">
        <ListState
          state="error"
          title={t.expiredTitle}
          // No mailbox is named. On this screen there is no session and the
          // token is dead, so the address is genuinely unknown — printing one
          // would be a guess shown as a fact.
          body={t.expiredBody}
        />
        <Button asChild variant="outline" className="min-h-14 w-full text-base">
          <Link href="/sign-in">{t.expiredAction}</Link>
        </Button>
      </div>
    );
  }

  if (mode === "none") return null;

  const tooShort = next.length > 0 && next.length < MIN_PASSWORD_LENGTH;
  const mismatched = repeat.length > 0 && repeat !== next;
  const ready =
    next.length >= MIN_PASSWORD_LENGTH &&
    repeat === next &&
    (mode === "invite" || current.length > 0);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready) return;

    setPending(true);
    setFailed(false);

    try {
      if (mode === "invite" && token) {
        const result = await authClient.resetPassword({
          newPassword: next,
          token,
        });
        if (result?.error) {
          // A dead or already-redeemed link is the expected failure here, and
          // it has its own screen rather than a red line under a field.
          setExpired(true);
          return;
        }
        // Redeeming a reset token does not open a session.
        router.replace("/sign-in");
        return;
      }

      const result = await authClient.changePassword({
        currentPassword: current,
        newPassword: next,
        // The issued password may have travelled by hand or over a chat app.
        // Anything already holding it loses its session the moment it is
        // replaced.
        revokeOtherSessions: true,
      });
      if (result?.error) {
        setFailed(true);
        return;
      }
      router.replace("/today");
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5" noValidate>
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {t.setPwTitle}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{t.setPwSub}</p>
      </div>

      {failed ? (
        <Alert variant="destructive">
          <AlertTitle>{t.setPwFailed}</AlertTitle>
          <AlertDescription>{t.authFailBody}</AlertDescription>
        </Alert>
      ) : null}

      <FieldGroup>
        {mode === "first-login" ? (
          <Field>
            <FieldLabel htmlFor="set-pw-current">{t.password}</FieldLabel>
            <Input
              id="set-pw-current"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
              value={current}
              onChange={(event) => setCurrent(event.target.value)}
            />
            <FieldDescription>{t.authHintOk}</FieldDescription>
          </Field>
        ) : null}

        <Field>
          <FieldLabel htmlFor="set-pw-new">{t.newPassword}</FieldLabel>
          <Input
            id="set-pw-new"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            required
            aria-invalid={tooShort || undefined}
            aria-describedby="set-pw-rule"
            value={next}
            onChange={(event) => setNext(event.target.value)}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="set-pw-repeat">{t.repeatPassword}</FieldLabel>
          <Input
            id="set-pw-repeat"
            name="repeatPassword"
            type="password"
            autoComplete="new-password"
            required
            aria-invalid={mismatched || undefined}
            value={repeat}
            onChange={(event) => setRepeat(event.target.value)}
          />
          {/*
            One live line, updated as they type. Deliberately not a FieldError:
            that carries role="alert", and a rule that is simply always true
            should not interrupt a screen reader on every keystroke.
          */}
          <FieldDescription
            id="set-pw-rule"
            aria-live="polite"
            className={cn((tooShort || mismatched) && "text-destructive")}
          >
            {mismatched ? t.pwMismatch : tooShort ? t.pwTooShort : t.pwRule}
          </FieldDescription>
        </Field>
      </FieldGroup>

      <Button
        type="submit"
        className="min-h-14 w-full text-base"
        disabled={!ready || pending}
      >
        {pending ? t.saving : t.setPwAction}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        {t.setPwLocked}
      </p>
    </form>
  );
}

function SetPasswordSkeleton() {
  return (
    <div className="grid gap-5" aria-busy="true">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-14 w-full" />
    </div>
  );
}

export default function SetPasswordPage() {
  return (
    <Suspense fallback={<SetPasswordSkeleton />}>
      <SetPasswordForm />
    </Suspense>
  );
}

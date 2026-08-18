"use client";

/**
 * Composed from shadcn primitives: Field (+FieldGroup/FieldLabel/
 * FieldDescription), Input, Button, Alert (+AlertTitle/AlertDescription).
 *
 * Email and password, and nothing else.
 *
 * No sign-up link, because a brand account is issued by an admin when a shop is
 * approved and cannot be self-created — a "create an account" link would be a
 * promise the system has no endpoint for. No social login, for the same reason:
 * the account has to already exist and already carry a brandId, and Google
 * cannot mint one. No "forgot password" either; a reissue is an admin action
 * that sends a fresh invite link, not something this form can trigger.
 *
 * The failure state says one thing for every kind of failure. Better Auth
 * answers a wrong password and an address it has never seen with the same
 * error, and this screen must not undo that: "no account with that email" turns
 * the form into an oracle that tells anyone which of a shop's staff addresses
 * are real.
 */
import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";

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
import { signIn } from "@/lib/auth-client";
import { useMessages } from "@/lib/locale-context";

import { safeNext } from "../auth-rules";

function SignInForm() {
  const t = useMessages().brand;
  const router = useRouter();
  const params = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setFailed(false);

    try {
      const result = await signIn.email({ email, password });
      if (result?.error) {
        setFailed(true);
        return;
      }
      router.replace(safeNext(params.get("next")));
    } catch {
      // A thrown transport error and a refused credential are the same sentence
      // to the person at the counter, and neither of them is a stack trace.
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5" noValidate>
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {t.signInTitle}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{t.signInSub}</p>
      </div>

      {failed ? (
        <Alert variant="destructive">
          <AlertTitle>{t.authFailTitle}</AlertTitle>
          <AlertDescription>{t.authFailBody}</AlertDescription>
        </Alert>
      ) : null}

      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="sign-in-email">{t.email}</FieldLabel>
          <Input
            id="sign-in-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            aria-invalid={failed || undefined}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="sign-in-password">{t.password}</FieldLabel>
          <Input
            id="sign-in-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            aria-invalid={failed || undefined}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {/*
            Always the neutral hint. The design system also carries `authHintBad`
            ("Wrong password."), which is precisely the string that turns a
            failure into confirmation that the address is real, so it is never
            rendered here.
          */}
          <FieldDescription>{t.authHintOk}</FieldDescription>
        </Field>
      </FieldGroup>

      <Button type="submit" className="min-h-14 w-full text-base" disabled={pending}>
        {pending ? t.signingIn : t.signInAction}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        {t.issuedByAdmin}
      </p>
    </form>
  );
}

function SignInSkeleton() {
  return (
    <div className="grid gap-5" aria-busy="true">
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-14 w-full" />
    </div>
  );
}

export default function SignInPage() {
  // useSearchParams needs a boundary or `next build` refuses to prerender this
  // route at all.
  return (
    <Suspense fallback={<SignInSkeleton />}>
      <SignInForm />
    </Suspense>
  );
}

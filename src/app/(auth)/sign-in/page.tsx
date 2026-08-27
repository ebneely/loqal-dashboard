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
import type { UserRole } from "@loqal/contracts/enums";
import { Suspense, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";

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
import { signIn, signOut } from "@/lib/auth-client";
import { useMessages } from "@/lib/locale-context";

import { safeNext } from "../auth-rules";

/**
 * Signing in is an IDENTITY CHANGE, so it leaves the SPA rather than navigating
 * inside it.
 *
 * `router.replace` is a soft navigation: the React tree, Better Auth's session
 * store and Next's router cache all survive it, every one of them still holding
 * the person who was signed in a moment ago. Switching from admin to sales
 * landed on the sales layout while `useSession()` still answered SUPER_ADMIN,
 * so its role guard bounced straight back out — which looks exactly like a
 * sign-in that silently did nothing. Tapping sign in again worked, because by
 * then the store had caught up.
 *
 * A document load is the only thing that reliably discards ALL of that state at
 * once, and it costs one navigation on an action that happens twice a day.
 * `safeNext` has already rejected anything that is not a same-origin path.
 */
function enter(path: string) {
  window.location.assign(path);
}

function SignInForm() {
  const t = useMessages().brand;
  const params = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [failed, setFailed] = useState(false);
  /**
   * A refused credential and an unreachable auth server are different answers.
   * Reporting both as "that email and password do not match" sends somebody to
   * check a password that was never read — 403 INVALID_ORIGIN reads exactly
   * like a typo.
   */
  const [unreachable, setUnreachable] = useState(false);
  /**
   * Separate from `failed` on purpose. A shopper's credentials were correct —
   * telling them "check your email and password" would send them round a loop
   * they cannot win, because the answer is that this account is for the shop,
   * not for this app.
   */
  const [noConsole, setNoConsole] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setFailed(false);
    setUnreachable(false);
    setNoConsole(false);

    try {
      const result = await signIn.email({ email, password });
      if (result?.error) {
        // 401 is the only status that means the credentials were checked and
        // rejected. Anything else never got that far.
        if (result.error.status === 401) setFailed(true);
        else setUnreachable(true);
        return;
      }

      // The role comes from the sign-in response rather than a follow-up
      // useSession read: the hook has not refreshed at this point, so routing
      // on it would send every role to the brand console for one navigation.
      const role = result?.data?.user?.role as UserRole | undefined;

      /**
       * A SHOPPER has no console here, and the refusal has to take the session
       * with it.
       *
       * It cannot be refused at the Better Auth level: this is the same auth
       * server the storefront signs in against, so a server-side block on the
       * role would lock every shopper out of the shop. What CAN be done is
       * refuse to keep the session in THIS app — otherwise a shopper is left
       * holding a valid cookie, middleware waves them into any route, and every
       * API call answers 403 at them, which reads as a broken dashboard rather
       * than as "this account is not for this app".
       *
       * The previous version redirected to `/sign-in?denied=no-console` and
       * nothing ever read that parameter, so the session survived and the
       * explanation never appeared.
       */
      if (role === "SHOPPER") {
        await signOut();
        setNoConsole(true);
        return;
      }

      // A user who must change their password goes there first whatever their
      // role — a console they cannot act in is not a useful landing.
      if (result?.data?.user?.mustChangePassword) {
        enter("/set-password");
        return;
      }

      enter(safeNext(params.get("next"), role ?? "SHOPPER"));
    } catch {
      // Nothing reached the server, so the password was never wrong.
      setUnreachable(true);
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

      {unreachable ? (
        <Alert variant="destructive">
          <AlertTitle>{t.authDownTitle}</AlertTitle>
          <AlertDescription>{t.authDownBody}</AlertDescription>
        </Alert>
      ) : null}

      {noConsole ? (
        <Alert variant="wait">
          <AlertTitle>{t.noConsoleTitle}</AlertTitle>
          <AlertDescription>{t.noConsoleBody}</AlertDescription>
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

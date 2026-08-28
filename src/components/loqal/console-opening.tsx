import { cn } from "@/lib/utils";

/**
 * What the console shows while it works out who you are.
 *
 * All three shells draw the same three grey rectangles here, which is a
 * skeleton of nothing: at this point the app does not yet know whether it is
 * about to render a brand console, an admin console or a redirect to sign-in,
 * so a shape-of-the-content placeholder would be a guess, and usually the wrong
 * one.
 *
 * So this is the ONE place the wordmark belongs. It is once per cold load —
 * navigating between screens never returns here, because the session is already
 * resolved by then. A shop owner opening this twenty times a day sees it twenty
 * times a day, which is why it is small, still and over in half a second rather
 * than a logo animation with a progress ring.
 *
 * The rule under the mark is the same one the placeholders draw. That is the
 * whole idea rather than a flourish: the console is made of hairlines, and this
 * is the first one.
 */
export function ConsoleOpening({
  label,
  className,
}: {
  /** The console's own name — "Admin", "Sales". Already translated. */
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid min-h-svh place-items-center px-gutter-phone",
        className
      )}
      /**
       * A live region, not a decoration. Somebody using a screen reader gets
       * told the console is opening; without it this is half a second of
       * silence followed by a fully-formed page.
       */
      role="status"
      aria-live="polite"
    >
      <div className="grid justify-items-center gap-3">
        <span className="font-heading text-2xl font-bold tracking-tight">
          loq<span className="lq-brandmark-a">aaa</span>l
        </span>

        {/* The hairline, drawing. `w-32` rather than the mark's own width so it
            reads as a rule under a name and not as an underline of it. */}
        <span
          aria-hidden="true"
          className="lq-draw block h-px w-32 rounded-none bg-border"
        />

        {label ? (
          <span className="font-mono text-2xs uppercase tracking-caps text-muted-foreground">
            {label}
          </span>
        ) : null}
      </div>
    </div>
  );
}

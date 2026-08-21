"use client";

/**
 * Composed from shadcn primitives: Sheet (+SheetContent/Header/Title/
 * Description/Footer/Close), Button (destructive and ghost), Spinner.
 *
 * A bottom sheet that says what will happen, in words, before it lets anyone
 * confirm.
 *
 * Cancelling an order, rejecting a return and suspending a brand are all
 * one-tap actions taken on a phone, in a shop, with someone waiting. "Are you
 * sure?" tells the reader nothing they did not already know; "the shopper is
 * refunded and the stock goes back on the shelf" tells them what they are
 * actually about to do. So the consequences are a required prop, not an
 * optional description, and the confirm button carries the verb rather than the
 * word "OK".
 *
 * Bottom, not centre: the confirm button has to be under the thumb that is
 * already holding the phone.
 */
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export type DestructiveSheetProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Optional: omit and drive `open` yourself. */
  trigger?: ReactNode;
  title: string;
  description?: string;
  /**
   * What will actually happen, one plain sentence each. Required, and empty is
   * not allowed — a sheet with nothing to say here has no reason to exist.
   */
  consequences: readonly string[];
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void | Promise<void>;
  /** Extra detail — an order number, a reason field. */
  children?: ReactNode;
  className?: string;
};

export function DestructiveSheet({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  consequences,
  confirmLabel,
  cancelLabel,
  onConfirm,
  children,
  className,
}: DestructiveSheetProps) {
  const [pending, setPending] = useState(false);

  const confirm = async () => {
    setPending(true);
    try {
      await onConfirm();
    } finally {
      setPending(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {trigger ? <SheetTrigger asChild>{trigger}</SheetTrigger> : null}
      <SheetContent
        side="bottom"
        className={cn("gap-0", className)}
      >
        <SheetHeader className="text-start">
          <SheetTitle>{title}</SheetTitle>
          {description ? (
            <SheetDescription>{description}</SheetDescription>
          ) : null}
        </SheetHeader>

        <div className="lq-sheet-body pb-4">
          <ul className="lq-sheet-consequences">
            {consequences.map((consequence) => (
              <li key={consequence}>{consequence}</li>
            ))}
          </ul>

          {children ? <div className="pt-4">{children}</div> : null}
        </div>

        <SheetFooter className="gap-2">
          <Button
            variant="destructive"
            size="tap"
            disabled={pending}
            onClick={confirm}
          >
            {pending ? <Spinner /> : null}
            {confirmLabel}
          </Button>
          <SheetClose asChild>
            <Button
              variant="ghost"
              size="tap"
              disabled={pending}
            >
              {cancelLabel}
            </Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

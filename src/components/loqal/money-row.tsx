"use client";

/**
 * Composed from shadcn primitives: Card (+CardContent).
 *
 * A SIGNED EGP balance. Positive means Loqal owes the brand; negative means the
 * brand owes Loqal. The same brand flips between the two in consecutive weeks —
 * card orders settle to Loqal, cash orders settle to the brand — so this is the
 * single most misreadable number in the product.
 *
 * Which is why the party is written out in words. A minus sign in front of a
 * figure on a phone in a busy shop is not a sentence anybody reads correctly;
 * "You owe Loqal" is. The sign is still shown, and it is still coloured, but
 * neither is load-bearing on its own.
 *
 * The amount never becomes a number. `balanceDirection` reads the sign off the
 * string and the formatter groups digits textually, so nothing here can round.
 */
import { balanceDirection, type BalanceDirection } from "@loqal/contracts/money";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/locale";
import { useLocale } from "@/lib/locale-context";
import { formatMoneyParts } from "@/lib/money";

/**
 * Whose books the reader is looking at.
 *
 * "brand" is the shop's own console — "Loqal owes you". "platform" is the admin
 * console, where the same row is about someone else — "Loqal owes this brand".
 * Getting this backwards inverts the meaning of the screen, so it is an
 * explicit prop with the safer default.
 */
export type MoneyRowPerspective = "brand" | "platform";

export type MoneyRowProps = {
  /** A signed money STRING, straight from the contract. Never a number. */
  amount: string;
  perspective?: MoneyRowPerspective;
  variant?: "hero" | "row" | "inline";
  locale?: Locale;
  /** Overrides the default party wording, e.g. with a brand's actual name. */
  creditLabel?: string;
  debitLabel?: string;
  zeroLabel?: string;
  note?: string;
  className?: string;
};

const PARTY: Record<
  MoneyRowPerspective,
  Record<Locale, Record<BalanceDirection, string>>
> = {
  brand: {
    en: {
      LOQAL_OWES_BRAND: "Loqal owes you",
      BRAND_OWES_LOQAL: "You owe Loqal",
      SETTLED: "Nothing owed either way",
    },
    ar: {
      LOQAL_OWES_BRAND: "لوكال مستحق عليها لك",
      BRAND_OWES_LOQAL: "أنت مستحق عليك لـلوكال",
      SETTLED: "لا مستحقات",
    },
  },
  platform: {
    en: {
      LOQAL_OWES_BRAND: "Loqal owes this brand",
      BRAND_OWES_LOQAL: "This brand owes Loqal",
      SETTLED: "Nothing owed either way",
    },
    ar: {
      LOQAL_OWES_BRAND: "لوكال مستحق عليها لهذه العلامة",
      BRAND_OWES_LOQAL: "هذه العلامة مستحق عليها للوكال",
      SETTLED: "لا مستحقات",
    },
  },
};

const FIGURE_CLASS: Record<BalanceDirection, string> = {
  LOQAL_OWES_BRAND: "text-money-credit",
  BRAND_OWES_LOQAL: "text-money-debit",
  SETTLED: "text-money-zero",
};

const SIZE_CLASS = {
  hero: "text-2xl md:text-3xl",
  row: "text-lg md:text-xl",
  inline: "text-sm",
} as const;

export function MoneyRow({
  amount,
  perspective = "brand",
  variant = "hero",
  locale,
  creditLabel,
  debitLabel,
  zeroLabel,
  note,
  className,
}: MoneyRowProps) {
  const contextLocale = useLocale();
  const resolved = locale ?? contextLocale;
  const direction = balanceDirection(amount);
  const { absolute, sign } = formatMoneyParts(amount);

  const overrides: Partial<Record<BalanceDirection, string | undefined>> = {
    LOQAL_OWES_BRAND: creditLabel,
    BRAND_OWES_LOQAL: debitLabel,
    SETTLED: zeroLabel,
  };
  const party = overrides[direction] ?? PARTY[perspective][resolved][direction];

  const figure = (
    <span
      className={cn(
        "font-mono tabular-nums tracking-tight",
        SIZE_CLASS[variant],
        FIGURE_CLASS[direction]
      )}
    >
      <span aria-hidden="true">{sign || "0"}</span>
      <span>{absolute}</span>
      <span className="ms-1 text-xs font-medium text-muted-foreground">
        EGP
      </span>
    </span>
  );

  if (variant === "inline") {
    return (
      <span
        className={cn("inline-flex items-baseline gap-1", className)}
        data-direction={direction}
        // The words go to a screen reader even when the layout has no room for
        // them, so an inline figure is never just a signed number.
        aria-label={`${party}: ${sign}${absolute} EGP`}
      >
        {figure}
      </span>
    );
  }

  return (
    <Card
      data-direction={direction}
      className={cn("border-border/60 shadow-none", className)}
    >
      <CardContent
        className={cn(
          "flex flex-col gap-1 px-4 py-3",
          variant === "row" && "md:flex-row md:items-center md:justify-between"
        )}
      >
        <p className="text-sm font-medium text-foreground">{party}</p>
        {figure}
        {note ? (
          <p className="text-xs text-muted-foreground">{note}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

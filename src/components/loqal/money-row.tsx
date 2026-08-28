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

/**
 * `.lq-money[data-dir]` drives every colour — figure, and the tint behind the
 * sign box — off this one attribute, so nothing here picks a class per part.
 */
const DATA_DIR: Record<BalanceDirection, "credit" | "debit" | "zero"> = {
  LOQAL_OWES_BRAND: "credit",
  BRAND_OWES_LOQAL: "debit",
  SETTLED: "zero",
};

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

  /*
    The design system's markup, not a Card. `.lq-money` is a bare block and
    the CALLER wraps it in a Card where a card is wanted — which is why the
    self-supplied `border-border/60 shadow-none` card is gone from here.

    The sign is a BOXED glyph, 26px, tinted with the direction's own colour —
    "the signed balance never appears as a bare number". It used to render
    inline in front of the figure, which for a settled balance printed the
    box's "0" placeholder straight into the number and read "00.00".

    Party wording and the note are dropped in the `inline` variant, as in the
    design system's own component; the aria-label still carries the sentence
    so an inline figure is never just a signed number to a screen reader.
  */
  return (
    <div
      className={cn(
        "lq-money",
        variant !== "hero" && `lq-money--${variant}`,
        className
      )}
      data-dir={DATA_DIR[direction]}
      data-direction={direction}
      aria-label={`${party}: ${sign}${absolute} EGP`}
    >
      {variant === "inline" ? null : (
        <div className="lq-money-party">{party}</div>
      )}
      <div className="lq-money-fig">
        {/* The "0" is the BOX's placeholder, not the figure's. The inline
            variant has no box — 16px, transparent — so it printed a bare
            leading zero and a settled cell read "0 0.00 EGP". */}
        {sign || variant !== "inline" ? (
          <span className="lq-money-sign" aria-hidden="true">
            {sign || "0"}
          </span>
        ) : null}
        <span className="lq-money-amount">{absolute}</span>
        <span className="lq-money-cur">EGP</span>
      </div>
      {note && variant !== "inline" ? (
        <div className="lq-money-note">{note}</div>
      ) : null}
    </div>
  );
}

"use client";

/**
 * Composed from shadcn primitives: Badge.
 *
 * One pill per backend enum value, typed against @loqal/contracts/enums so a
 * status the API can return and this file has no entry for is a type error at
 * build time rather than a blank cell in a shop's order list.
 *
 * The labels and tones are lifted from the design system's statusMap.js. Tones
 * map onto the --state-* token triplets in globals.css and each one means
 * something specific:
 *   wait    the system is waiting on someone else
 *   act     a human must do something now
 *   live    in flight and correct
 *   good    finished well
 *   bad     finished badly
 *   neutral closed, no money moving
 */
import type {
  BrandOrderStatus,
  BrandStatus,
  DeliveryMethod,
  OrderStatus,
  PaymentMethod,
  ProductStatus,
  ReturnStatus,
  SettlementStatus,
} from "@loqal/contracts/enums";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/locale";
import { useLocale } from "@/lib/locale-context";

export type StatusTone = "neutral" | "wait" | "act" | "live" | "good" | "bad";

type Entry = { tone: StatusTone; en: string; ar: string };

const brandOrder: Record<BrandOrderStatus, Entry> = {
  PENDING_VERIFICATION: { tone: "wait", en: "Awaiting verification", ar: "بانتظار التحقق" },
  PENDING_PAYMENT: { tone: "wait", en: "Awaiting payment", ar: "بانتظار الدفع" },
  PENDING_BRAND: { tone: "act", en: "Check the shelf", ar: "راجع الرف" },
  CONFIRMED: { tone: "live", en: "Confirmed", ar: "مؤكد" },
  PACKED: { tone: "live", en: "Packed", ar: "مُجهَّز" },
  HANDED_OVER: { tone: "live", en: "Handed over", ar: "تم التسليم للمندوب" },
  DELIVERED: { tone: "good", en: "Delivered", ar: "تم التوصيل" },
  DELIVERY_FAILED: { tone: "bad", en: "Delivery failed", ar: "فشل التوصيل" },
  RETURN_REQUESTED: { tone: "act", en: "Return requested", ar: "طلب إرجاع" },
  RETURNED: { tone: "neutral", en: "Returned", ar: "مُرجَع" },
  CANCELLED: { tone: "neutral", en: "Cancelled", ar: "ملغي" },
  REFUNDED: { tone: "neutral", en: "Refunded", ar: "تم الاسترداد" },
};

/**
 * The PARENT order's status, which only the admin console ever sees. Derived
 * from its child BrandOrder rows and never set by hand.
 *
 * Deliberately NOT the same table as `brandOrder` above, even where the member
 * names coincide. `PENDING_BRAND` on a brand order is an instruction to the
 * shop reading it — "check the shelf" — and on a parent order it is a report
 * about somebody else: at least one of the shops in this basket has not looked
 * yet. Reusing the brand wording here would tell an admin to go and pack it.
 *
 * PROCESSING and SHIPPED exist only at this level. They are what a basket looks
 * like when its shops disagree — one packed, one not — which is precisely the
 * state this console exists to make visible.
 */
const orderStatus: Record<OrderStatus, Entry> = {
  PENDING_VERIFICATION: {
    tone: "wait",
    en: "Awaiting verification",
    ar: "بانتظار التحقق",
  },
  PENDING_PAYMENT: { tone: "wait", en: "Awaiting payment", ar: "بانتظار الدفع" },
  PENDING_BRAND: {
    tone: "wait",
    en: "Waiting on a shop",
    ar: "بانتظار أحد المتاجر",
  },
  CONFIRMED: { tone: "live", en: "Confirmed", ar: "مؤكد" },
  PROCESSING: { tone: "live", en: "Being prepared", ar: "قيد التجهيز" },
  SHIPPED: { tone: "live", en: "On its way", ar: "في الطريق" },
  DELIVERED: { tone: "good", en: "Delivered", ar: "تم التوصيل" },
  CANCELLED: { tone: "neutral", en: "Cancelled", ar: "ملغي" },
  REFUNDED: { tone: "neutral", en: "Refunded", ar: "تم الاسترداد" },
};

const returnStatus: Record<ReturnStatus, Entry> = {
  REQUESTED: { tone: "act", en: "Requested", ar: "مطلوب" },
  APPROVED: { tone: "live", en: "Approved", ar: "مقبول" },
  REJECTED: { tone: "bad", en: "Rejected", ar: "مرفوض" },
  RESTOCKED: { tone: "good", en: "Restocked", ar: "أُعيد للمخزون" },
};

const settlementStatus: Record<SettlementStatus, Entry> = {
  PENDING: { tone: "wait", en: "Pending", ar: "معلق" },
  SENT: { tone: "live", en: "Sent", ar: "أُرسل" },
  RECEIVED: { tone: "good", en: "Received", ar: "تم الاستلام" },
  CANCELLED: { tone: "neutral", en: "Cancelled", ar: "ملغي" },
};

/**
 * The design system called the live value PUBLISHED; the Prisma enum and the
 * contract call it ACTIVE. The contract wins — this is the name the API sends.
 */
const productStatus: Record<ProductStatus, Entry> = {
  DRAFT: { tone: "neutral", en: "Draft", ar: "مسودة" },
  ACTIVE: { tone: "good", en: "Active", ar: "نشِط" },
  ARCHIVED: { tone: "neutral", en: "Archived", ar: "مؤرشف" },
};

const brandStatus: Record<BrandStatus, Entry> = {
  PENDING: { tone: "wait", en: "Pending", ar: "معلق" },
  ACTIVE: { tone: "good", en: "Active", ar: "نشِط" },
  SUSPENDED: { tone: "bad", en: "Suspended", ar: "موقوف" },
};

export const STATUS_MAP = {
  BrandOrderStatus: brandOrder,
  OrderStatus: orderStatus,
  ReturnStatus: returnStatus,
  SettlementStatus: settlementStatus,
  ProductStatus: productStatus,
  BrandStatus: brandStatus,
} as const;

export type StatusEnumName = keyof typeof STATUS_MAP;

// ---------------------------------------------------------------------------
// The two METHOD kinds. Tone here, copy from the caller.
// ---------------------------------------------------------------------------

/**
 * The five status maps above bake their own English and Arabic, because a
 * status is the design system's own vocabulary and it is the same sentence in
 * every console.
 *
 * Route and payment wording is not. It is the shop's vocabulary, it differs by
 * console, and it belongs in the message catalogues — which is exactly where
 * three screens have each been reinventing it. So these two kinds carry the
 * TONE (a design-system fact) and take their LABELS from the caller (a copy
 * fact). Nothing below hardcodes an English string.
 */

/** The two routes a brand can actually be looking at. See below for the third. */
export type LiveDeliveryMethod = Exclude<DeliveryMethod, "SHIPPING_SERVICE">;

/**
 * CASH is the one method where somebody at the door has to take money, so it is
 * the only one a person must act on. Everything else is already paid — the
 * money question is settled, which is what `good` means here.
 *
 * There is NO `COD`. The design mockups say COD throughout and the enum does
 * not have it; `CASH` is what the API sends and this is keyed off the contract.
 */
export const PAYMENT_TONE: Record<PaymentMethod, StatusTone> = {
  CASH: "act",
  CARD: "good",
  WALLET: "good",
  VALU: "good",
  INSTAPAY: "good",
};

/**
 * RIDER_PER_BRAND: the SHOPPER books and pays the rider once the brand marks
 * the parcel ready, so from the shop's side the parcel is waiting on somebody
 * else — `wait`.
 *
 * BRAND_OWN_DELIVERY: the shop's own driver or its own courier account. Moving
 * it is the shop's job — `act`.
 */
export const DELIVERY_TONE: Record<LiveDeliveryMethod, StatusTone> = {
  RIDER_PER_BRAND: "wait",
  BRAND_OWN_DELIVERY: "act",
};

/** Every value, so a method the API can send cannot render an empty pill. */
export type PaymentMethodLabels = Record<PaymentMethod, string>;

/**
 * Keyed on the LIVE routes only. SHIPPING_SERVICE is not merely absent from the
 * tone map — nobody is even asked to write copy for it, which is how the
 * refusal reaches the message catalogues too.
 */
export type DeliveryMethodLabels = Record<LiveDeliveryMethod, string>;

/** The value each enum name accepts, so `kind` and `value` cannot disagree. */
type StatusValue = {
  BrandOrderStatus: BrandOrderStatus;
  OrderStatus: OrderStatus;
  ReturnStatus: ReturnStatus;
  SettlementStatus: SettlementStatus;
  ProductStatus: ProductStatus;
  BrandStatus: BrandStatus;
};

type Common = {
  locale?: Locale;
  size?: "sm" | "default";
  className?: string;
};

/**
 * The two kinds whose copy the caller owns.
 *
 * `DeliveryMethod`'s `value` is `LiveDeliveryMethod`, so writing
 * `value="SHIPPING_SERVICE"` is a TYPE ERROR, not a styling decision. See the
 * refusal note on `renderedFor` for what happens when one arrives at runtime
 * anyway.
 */
export type MethodPillProps =
  | (Common & {
      kind: "PaymentMethod";
      value: PaymentMethod;
      labels: PaymentMethodLabels;
    })
  | (Common & {
      kind: "DeliveryMethod";
      value: LiveDeliveryMethod;
      labels: DeliveryMethodLabels;
    });

export type StatusPillProps =
  | {
      [K in StatusEnumName]: Common & { kind: K; value: StatusValue[K] };
    }[StatusEnumName]
  | MethodPillProps;

const TONE_CLASS: Record<StatusTone, string> = {
  neutral:
    "bg-state-neutral-bg text-state-neutral-fg border-state-neutral-border",
  wait: "bg-state-wait-bg text-state-wait-fg border-state-wait-border",
  act: "bg-state-act-bg text-state-act-fg border-state-act-border",
  live: "bg-state-live-bg text-state-live-fg border-state-live-border",
  good: "bg-state-good-bg text-state-good-fg border-state-good-border",
  bad: "bg-state-bad-bg text-state-bad-fg border-state-bad-border",
};

/** What a pill actually draws, once the kind has been resolved. */
type Rendered = { tone: StatusTone; label: string };

/**
 * HOW SHIPPING_SERVICE IS REFUSED, and why it is refused this way.
 *
 * It is modelled and NOT LIVE: there is no courier contract behind it, no brand
 * carries it, and it stays in the enum only so switching it on is a data change
 * rather than a migration. A pill is the shape this design system uses for "one
 * of the options" — drawing SHIPPING_SERVICE in the same shape as the two real
 * routes tells a shop owner it is something they can pick. A greyed-out pill,
 * an em-dash or the raw enum name would all still be a rendering, and all three
 * read as "this exists but is off today".
 *
 * So the component renders NOTHING — `null`, no element, no whitespace. That is
 * the only output that cannot be mistaken for an offer.
 *
 * The type already forbids it, so this branch is unreachable from typed code.
 * It exists because the type system is not what the API answers with: a value
 * cast at a boundary, a seeded row, or a brand setting flipped upstream would
 * arrive here regardless, and "must never render" has to survive that rather
 * than depend on it never happening.
 */
function renderedFor(props: StatusPillProps, locale: Locale): Rendered | null {
  if (props.kind === "PaymentMethod") {
    return {
      tone: PAYMENT_TONE[props.value],
      label: props.labels[props.value],
    };
  }

  if (props.kind === "DeliveryMethod") {
    const tone = DELIVERY_TONE[props.value];
    if (!tone) return null;
    return { tone, label: props.labels[props.value] };
  }

  const entry = (STATUS_MAP[props.kind] as Record<string, Entry>)[props.value];
  return { tone: entry.tone, label: entry[locale] };
}

/**
 * The tone alone, for a row that tints itself to match its pill.
 *
 * Tone does not depend on locale, so the lookup is done under "en".
 */
export const statusTone = (props: StatusPillProps): StatusTone =>
  renderedFor(props, "en")?.tone ?? "neutral";

/**
 * The label without rendering, for a table cell or an aria-label. Empty for a
 * value the component refuses to draw — a caller that concatenates it gets
 * nothing rather than a name for something that is not live.
 */
export const statusLabel = (
  props: StatusPillProps,
  locale: Locale = "en"
): string => renderedFor(props, locale)?.label ?? "";

export function StatusPill(props: StatusPillProps) {
  const { kind, value, size = "default", className } = props;
  const contextLocale = useLocale();
  const locale = props.locale ?? contextLocale;
  const entry = renderedFor(props, locale);

  if (!entry) return null;

  return (
    <Badge
      variant="outline"
      data-status={value}
      data-tone={entry.tone}
      title={`${kind}.${value}`}
      className={cn(
        "gap-1.5 border font-medium",
        size === "sm" ? "px-2 py-0 text-[11px]" : "px-2.5 py-0.5 text-xs",
        TONE_CLASS[entry.tone],
        className
      )}
    >
      <span
        aria-hidden="true"
        className="size-1.5 shrink-0 rounded-full bg-current"
      />
      {entry.label}
    </Badge>
  );
}

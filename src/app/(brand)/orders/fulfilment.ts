/**
 * WHERE THE THREE DELIVERY ROUTES BRANCH. All of it, in one pure function.
 *
 * The routes are not three styles of the same flow, they are three different
 * products, and the difference is invisible in the status alone — PACKED means
 * "tell the shopper to send their rider" on one route and "write down a courier
 * and a tracking number" on the other. Spreading that decision across a detail
 * screen and a sheet and a button label is how one of the three ends up half
 * right, so the screen renders whatever `fulfilmentFor` returns and decides
 * nothing itself.
 *
 * The three:
 *
 *  RIDER_PER_BRAND     The SHOPPER books and pays the rider. They are only
 *                      prompted once the brand marks the parcel ready, so the
 *                      brand's step here is a notification and nothing else:
 *                      no courier to name, no tracking number to type, nothing
 *                      booked. Prepaid only — nobody is at the door to take
 *                      cash, because the shopper hired that rider themselves.
 *
 *  BRAND_OWN_DELIVERY  The brand's own driver, or its own Bosta/Mylerz
 *                      account. It types the courier and the tracking number,
 *                      and it CAN collect cash.
 *
 *  SHIPPING_SERVICE    Modelled, not live. No courier contract exists, so no
 *                      brand carries it and it must never render. There is no
 *                      branch for it below; there is a refusal.
 *
 * WHICH EDGES EXIST IS NOT DECIDED HERE. It used to be: a switch over the
 * status returned the next move and the risk, which is a second copy of the
 * backend's TRANSITIONS table written from memory. That table is consulted
 * before every status write and answers 409 on a miss, and it is keyed by ACTOR
 * as well as by status — something this file cannot see at all, so the copy
 * hard-coded the BRAND column of a table whose other columns it did not know
 * existed. The two had already drifted: the backend lets a brand CANCEL a
 * refused parcel and the copy hid the button.
 *
 * So the edges come from `order.allowedTransitions`, which the server computes
 * from the same table it enforces. What stays here is PRESENTATION — that
 * HANDED_OVER reads "ready for pickup" on a rider route and "mark handed over"
 * on own-delivery, that RIDER_PER_BRAND asks for no tracking number, and that a
 * cash order is promised no refund. Which buttons are legal is the server's;
 * what they say is this file's.
 *
 * Nothing here imports React. The one file whose logic a leak or a wrong button
 * would live in is the one file that can be checked without a DOM.
 */
import { brandDrivableStatusSchema } from "@loqal/contracts/order.contract";
import type {
  BrandOrderStatus,
  DeliveryMethod,
  PaymentMethod,
} from "@loqal/contracts/enums";
import type { Messages } from "@/messages";

/** A key of `t.brand` whose value is a string — so a label cannot name `nav`. */
export type BrandCopyKey = {
  [K in keyof Messages["brand"]]: Messages["brand"][K] extends string
    ? K
    : never;
}[keyof Messages["brand"]];

/** The two routes a brand can actually be looking at today. */
export type LiveDeliveryMethod = Exclude<DeliveryMethod, "SHIPPING_SERVICE">;

export const isLiveRoute = (
  method: DeliveryMethod
): method is LiveDeliveryMethod => method !== "SHIPPING_SERVICE";

/**
 * Drop every row on a route that is not live.
 *
 * The API can answer with one — the enum still carries it and a seeded row or a
 * flipped brand setting would come straight down the wire — and "must never
 * render" has to survive that, not depend on it never happening.
 */
export const liveRoutesOnly = <T extends { deliveryMethod: DeliveryMethod }>(
  rows: readonly T[]
): T[] => rows.filter((row) => isLiveRoute(row.deliveryMethod));

/** The forward move, if there is one the brand may make. */
export type FulfilmentStep = {
  to: BrandOrderStatus;
  label: BrandCopyKey;
  hint: BrandCopyKey;
  /**
   * BRAND_OWN_DELIVERY's hand-over, and nothing else. On RIDER_PER_BRAND there
   * is no courier and no consignment, so an empty box asking for a tracking
   * number would be a question with no answer.
   */
  asksForCourier: boolean;
};

/** A move that loses something. Always drawn through DestructiveSheet. */
export type FulfilmentRisk = {
  to: BrandOrderStatus;
  /** The button on the screen. */
  action: BrandCopyKey;
  title: BrandCopyKey;
  confirm: BrandCopyKey;
  /** Said in words before anyone confirms. Never empty. */
  consequences: BrandCopyKey[];
};

export type FulfilmentPlan = {
  /** False for SHIPPING_SERVICE. The screen renders a refusal and stops. */
  routeIsLive: boolean;
  /** Which of the two live routes, once `routeIsLive`. */
  route: LiveDeliveryMethod | null;
  /** The route's one-line explanation, shown beside the action. */
  routeNote: BrandCopyKey | null;
  /** Whether cash is collected at the door, which only one route can do. */
  collectsCash: boolean;
  next: FulfilmentStep | null;
  risk: FulfilmentRisk | null;
  /**
   * True when a return is open. The order screen deliberately offers nothing:
   * RETURN_REQUESTED is decided on /returns, with a reason, and a second way to
   * do it would be a second set of rules.
   */
  returnOpen: boolean;
};

const REFUSED: FulfilmentPlan = {
  routeIsLive: false,
  route: null,
  routeNote: null,
  collectsCash: false,
  next: null,
  risk: null,
  returnOpen: false,
};

/**
 * A shopper refusing the parcel at the door.
 *
 * The consequences differ by what was paid, and the difference is the whole
 * point: a CASH order was never paid, so there is nothing to refund and the
 * screen must not offer one. Saying "the shopper is refunded" over a cash order
 * is a promise about money that does not exist.
 *
 * A NULL payment method is treated the same way. It means the Payment row has
 * not been written yet, so there is no captured money to give back — and a
 * refund promised against a payment that may not exist is the same lie in a
 * quieter voice.
 */
const deliveryFailed = (
  paymentMethod: PaymentMethod | null
): FulfilmentRisk => ({
  to: "DELIVERY_FAILED",
  action: "deliveryFailAction",
  title: "deliveryFailTitle",
  confirm: "deliveryFailConfirm",
  consequences: [
    "conseqRestock",
    paymentMethod === "CASH" || paymentMethod === null
      ? "conseqNoRefund"
      : "conseqRefund",
    "conseqClosed",
  ],
});

/** Nothing on the shelf matches the order. Releases the hold, cancels. */
const shelfReject: FulfilmentRisk = {
  to: "CANCELLED",
  action: "shelfReject",
  title: "shelfRejectTitle",
  confirm: "shelfRejectConfirm",
  consequences: ["conseqRelease", "conseqCancelled"],
};

/**
 * Giving up on a parcel that came back.
 *
 * The same edge as the shelf rejection — CANCELLED — reached from somewhere
 * else entirely, so it needs its own words: nothing is missing from the shelf,
 * the goods are back in the shop and the shopper is not getting them. The
 * refund, if there was one, was already said out loud when the delivery was
 * recorded as failed.
 */
const giveUp: FulfilmentRisk = {
  to: "CANCELLED",
  action: "cancelOrderAction",
  title: "cancelOrderTitle",
  confirm: "cancelOrderConfirm",
  consequences: ["conseqRestock", "conseqCancelled"],
};

export type FulfilmentInput = {
  status: BrandOrderStatus;
  deliveryMethod: DeliveryMethod;
  /** Null until the Payment row exists. Never assumed to be prepaid. */
  paymentMethod: PaymentMethod | null;
  /**
   * What the SERVER says this brand may do next, from
   * `OrderTransitionService.allowedNextStatuses`. The one source of truth for
   * which buttons may be drawn.
   */
  allowedTransitions: readonly BrandOrderStatus[];
};

/**
 * The forward moves, in the order an order passes through them.
 *
 * The ORDER is all this list carries. Whether an edge exists is answered by
 * `allowedTransitions`; this only decides which of several legal moves is the
 * one the primary button should offer — the nearest one forward.
 */
const FORWARD: readonly BrandOrderStatus[] = [
  "CONFIRMED",
  "PACKED",
  "HANDED_OVER",
  "DELIVERED",
];

/**
 * The transitions the dashboard's own endpoint accepts, straight from
 * `transitionBrandOrderBodySchema`.
 *
 * `allowedTransitions` is computed for the BRAND actor and can legitimately
 * carry a status this endpoint's body refuses — RETURNED is reachable by a
 * brand, and only from the returns flow. Drawing a button for it would post a
 * body that is a 400 at the edge, so the two are intersected rather than
 * trusted apart.
 */
const DRIVABLE: ReadonlySet<string> = new Set(
  brandDrivableStatusSchema.options
);

/**
 * What a move to `to` should SAY. Presentation, and the reason this file still
 * exists — the fork at HANDED_OVER is two different jobs wearing one status.
 *
 * RIDER_PER_BRAND: "ready for pickup". Loqal notifies the shopper, who then
 * books and pays their own rider. The brand books nothing, so there is nothing
 * to write down and no tracking box to leave empty.
 *
 * BRAND_OWN_DELIVERY: "handed to driver". The brand's own driver or its own
 * courier account, so the courier name and tracking number are its own to type.
 */
const stepFor = (
  to: BrandOrderStatus,
  own: boolean
): FulfilmentStep | null => {
  switch (to) {
    case "CONFIRMED":
      return {
        to,
        label: "actConfirm",
        hint: "hintConfirm",
        asksForCourier: false,
      };
    case "PACKED":
      return { to, label: "actPack", hint: "hintPack", asksForCourier: false };
    case "HANDED_OVER":
      return own
        ? { to, label: "actHand", hint: "hintHand", asksForCourier: true }
        : { to, label: "actReady", hint: "hintReady", asksForCourier: false };
    case "DELIVERED":
      return {
        to,
        label: "actDeliver",
        hint: "hintDeliver",
        asksForCourier: false,
      };
    default:
      return null;
  }
};

/**
 * What a move that loses something should SAY.
 *
 * CANCELLED is reachable from two places and means two different things, which
 * is why `from` is read here and nowhere else in this function: this is a
 * choice of words, not a choice of edge.
 */
const riskFor = (
  to: BrandOrderStatus,
  from: BrandOrderStatus,
  paymentMethod: PaymentMethod | null
): FulfilmentRisk | null => {
  if (to === "DELIVERY_FAILED") return deliveryFailed(paymentMethod);
  if (to === "CANCELLED") return from === "PENDING_BRAND" ? shelfReject : giveUp;
  return null;
};

export function fulfilmentFor(order: FulfilmentInput): FulfilmentPlan {
  if (!isLiveRoute(order.deliveryMethod)) return REFUSED;

  const route = order.deliveryMethod;
  const own = route === "BRAND_OWN_DELIVERY";

  const base = {
    routeIsLive: true as const,
    route,
    routeNote: (own ? "routeNoteOwn" : "routeNoteRider") as BrandCopyKey,
    // Only the brand's own delivery has anybody at the door who works for the
    // shop. On the shopper's own rider there is nobody to hand cash to, which
    // is why that route is prepaid-only in the first place.
    collectsCash: own && order.paymentMethod === "CASH",
    returnOpen: order.status === "RETURN_REQUESTED",
  };

  /**
   * An open return is decided on /returns, with a reason, and a second way to
   * do it would be a second set of rules. The server does list RETURNED and
   * DELIVERED as legal here — this is not a claim that they are not, it is a
   * decision about which SCREEN owns them.
   */
  if (base.returnOpen) return { ...base, next: null, risk: null };

  const allowed = order.allowedTransitions.filter((to) => DRIVABLE.has(to));

  // The nearest move forward the server will accept. On PENDING_BRAND that is
  // the shelf check — the one status that is a person waiting rather than a
  // state, because stock is HELD and never committed until somebody has looked.
  const forward = FORWARD.find((to) => allowed.includes(to)) ?? null;

  // A move that loses something. Never more than one is legal at a time in the
  // shipped table, and the first is taken rather than a list being drawn.
  const losing =
    allowed.find((to) => to === "DELIVERY_FAILED" || to === "CANCELLED") ?? null;

  return {
    ...base,
    next: forward ? stepFor(forward, own) : null,
    risk: losing ? riskFor(losing, order.status, order.paymentMethod) : null,
  };
}

/**
 * The payment method, said the way a shop owner would say it.
 *
 * CASH is the only method collected at the door. The design mockups call it COD
 * throughout and there is no COD value in the enum — `PaymentMethod.CASH` is
 * what the API sends, so that is what this maps.
 *
 * Null is its own answer rather than a guess. The Payment row is written per
 * order and a brand order can be read before one exists, so "not recorded yet"
 * is a real state — and printing "cash on delivery" over it would tell a driver
 * to collect money nobody agreed to.
 */
export const paymentLabelKey = (method: PaymentMethod | null): BrandCopyKey => {
  if (method === null) return "payUnknown";

  switch (method) {
    case "CASH":
      return "payCod";
    case "CARD":
      return "payCard";
    case "WALLET":
      return "payWallet";
    case "VALU":
      return "payValu";
    case "INSTAPAY":
      return "payInstapay";
  }
};

/** "Shopper's rider" / "Own delivery". Never a third answer. */
export const routeLabelKey = (method: LiveDeliveryMethod): BrandCopyKey =>
  method === "BRAND_OWN_DELIVERY" ? "routeOwn" : "routeRider";

/**
 * The body a transition PATCH carries.
 *
 * Courier and tracking are sent ONLY where they mean something. Sending an
 * empty tracking number on the shopper's-own-rider route would write a blank
 * consignment onto an order that never had one.
 */
export function transitionBody(
  step: FulfilmentStep,
  courier: { courierName: string; trackingNumber: string }
): {
  to: BrandOrderStatus;
  courierName?: string;
  trackingNumber?: string;
} {
  if (!step.asksForCourier) return { to: step.to };

  const courierName = courier.courierName.trim();
  const trackingNumber = courier.trackingNumber.trim();

  return {
    to: step.to,
    ...(courierName ? { courierName } : {}),
    ...(trackingNumber ? { trackingNumber } : {}),
  };
}

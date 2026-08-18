// @vitest-environment node
/**
 * The route branch, checked without a DOM.
 *
 * This is the file that decides which of three genuinely different products a
 * shop owner is looking at, so it is checked as arithmetic rather than through
 * a rendered screen — every case, including the ones a UI test would need a
 * fixture and a click to reach.
 *
 * Since the reconciliation it is also the file that must NOT decide which moves
 * are legal. `allowedTransitions` comes from the server, and several tests below
 * exist purely to prove this module obeys it rather than a table of its own —
 * including the case where the server allows something and the old client-side
 * switch hid it.
 */
import { describe, expect, it } from "vitest";

import { BrandOrderStatusSchema, PaymentMethodSchema } from "@loqal/contracts/enums";
import type { BrandOrderStatus } from "@loqal/contracts/enums";

import {
  fulfilmentFor,
  isLiveRoute,
  liveRoutesOnly,
  paymentLabelKey,
  routeLabelKey,
  transitionBody,
} from "../fulfilment";
import { brandAllowedFrom } from "./fixtures";

/** An order as the API answers it: the status AND what the server allows next. */
const order = (
  status: BrandOrderStatus,
  deliveryMethod: "RIDER_PER_BRAND" | "BRAND_OWN_DELIVERY" | "SHIPPING_SERVICE",
  paymentMethod: Parameters<typeof paymentLabelKey>[0],
  allowedTransitions: BrandOrderStatus[] = brandAllowedFrom(status)
) => ({ status, deliveryMethod, paymentMethod, allowedTransitions });

describe("SHIPPING_SERVICE never becomes a screen", () => {
  it("is not a live route", () => {
    expect(isLiveRoute("SHIPPING_SERVICE")).toBe(false);
    expect(isLiveRoute("RIDER_PER_BRAND")).toBe(true);
    expect(isLiveRoute("BRAND_OWN_DELIVERY")).toBe(true);
  });

  it("refuses the whole plan, rather than offering it without an action", () => {
    const plan = fulfilmentFor(order("PACKED", "SHIPPING_SERVICE", "CASH"));

    expect(plan.routeIsLive).toBe(false);
    expect(plan.route).toBeNull();
    expect(plan.next).toBeNull();
    expect(plan.risk).toBeNull();
    expect(plan.routeNote).toBeNull();
  });

  it("refuses it in EVERY status, not just the ones with a button", () => {
    for (const status of BrandOrderStatusSchema.options) {
      const plan = fulfilmentFor(order(status, "SHIPPING_SERVICE", "CARD"));
      expect(plan.routeIsLive, status).toBe(false);
    }
  });

  /**
   * Even if the server said the move were legal. The route refusal is the
   * screen's own rule and it outranks the transition table, because the answer
   * is "there is no such product yet", not "you may not press that".
   */
  it("refuses it even when the server offers a transition", () => {
    const plan = fulfilmentFor(
      order("PACKED", "SHIPPING_SERVICE", "CASH", ["HANDED_OVER"])
    );
    expect(plan.routeIsLive).toBe(false);
    expect(plan.next).toBeNull();
  });

  it("drops it from a list even when the API answers with one", () => {
    const rows = [
      { id: "a", deliveryMethod: "RIDER_PER_BRAND" as const },
      { id: "b", deliveryMethod: "SHIPPING_SERVICE" as const },
      { id: "c", deliveryMethod: "BRAND_OWN_DELIVERY" as const },
    ];
    expect(liveRoutesOnly(rows).map((r) => r.id)).toEqual(["a", "c"]);
  });
});

describe("the server owns which moves exist", () => {
  it("offers nothing at all when the server allows nothing", () => {
    const plan = fulfilmentFor(order("PACKED", "RIDER_PER_BRAND", "CARD", []));

    expect(plan.next).toBeNull();
    expect(plan.risk).toBeNull();
    // And the route is still described, because the order is still real.
    expect(plan.routeIsLive).toBe(true);
    expect(plan.routeNote).toBe("routeNoteRider");
  });

  it("offers a move the old client-side switch had never heard of", () => {
    // The screen used to hard-code "PACKED means hand over". If the server ever
    // says otherwise, the server wins.
    const plan = fulfilmentFor(
      order("PACKED", "RIDER_PER_BRAND", "CARD", ["DELIVERED"])
    );
    expect(plan.next?.to).toBe("DELIVERED");
    expect(plan.next?.label).toBe("actDeliver");
  });

  /**
   * The one the two tables had ALREADY drifted on. `TRANSITIONS` lets a brand
   * cancel a parcel that came back; the client copy did not, so a legal button
   * was missing from the screen for as long as it shipped.
   */
  it("offers the cancel a refused parcel is allowed, which the copy used to hide", () => {
    const plan = fulfilmentFor(
      order("DELIVERY_FAILED", "BRAND_OWN_DELIVERY", "CASH")
    );

    expect(plan.next).toMatchObject({ to: "HANDED_OVER", label: "actHand" });
    expect(plan.risk?.to).toBe("CANCELLED");
    // Its own words: nothing is missing from the shelf here.
    expect(plan.risk?.action).toBe("cancelOrderAction");
    expect(plan.risk?.title).toBe("cancelOrderTitle");
  });

  /**
   * `allowedTransitions` is computed for the BRAND ACTOR, not for this endpoint.
   * RETURNED is reachable by a brand and refused by the transition body with a
   * 400, so a button for it could never work.
   */
  it("draws no button for a status this endpoint's body would refuse", () => {
    const plan = fulfilmentFor(
      order("DELIVERED", "RIDER_PER_BRAND", "CARD", ["RETURNED", "REFUNDED"])
    );
    expect(plan.next).toBeNull();
    expect(plan.risk).toBeNull();
  });

  it("takes the NEAREST move forward when the server allows several", () => {
    const plan = fulfilmentFor(
      order("PENDING_BRAND", "RIDER_PER_BRAND", "CARD", [
        "DELIVERED",
        "PACKED",
        "CONFIRMED",
      ])
    );
    expect(plan.next?.to).toBe("CONFIRMED");
  });
});

describe("the hand-over is where the two live routes diverge", () => {
  it("RIDER_PER_BRAND asks for nothing — the shopper books their own rider", () => {
    const plan = fulfilmentFor(order("PACKED", "RIDER_PER_BRAND", "CARD"));

    expect(plan.next).toEqual({
      to: "HANDED_OVER",
      label: "actReady",
      hint: "hintReady",
      asksForCourier: false,
    });
    expect(plan.routeNote).toBe("routeNoteRider");
  });

  it("BRAND_OWN_DELIVERY asks for a courier and a tracking number", () => {
    const plan = fulfilmentFor(order("PACKED", "BRAND_OWN_DELIVERY", "CASH"));

    expect(plan.next).toEqual({
      to: "HANDED_OVER",
      label: "actHand",
      hint: "hintHand",
      asksForCourier: true,
    });
    expect(plan.routeNote).toBe("routeNoteOwn");
  });

  it("only the brand's own delivery ever collects cash", () => {
    expect(
      fulfilmentFor(order("PACKED", "BRAND_OWN_DELIVERY", "CASH")).collectsCash
    ).toBe(true);

    // Prepaid only: nobody is at the door who works for this shop.
    expect(
      fulfilmentFor(order("PACKED", "RIDER_PER_BRAND", "CASH")).collectsCash
    ).toBe(false);

    expect(
      fulfilmentFor(order("PACKED", "BRAND_OWN_DELIVERY", "CARD")).collectsCash
    ).toBe(false);

    // Null is not cash. A payment row that does not exist yet must not send a
    // driver to the door expecting money.
    expect(
      fulfilmentFor(order("PACKED", "BRAND_OWN_DELIVERY", null)).collectsCash
    ).toBe(false);
  });

  it("never asks for a tracking number on RIDER_PER_BRAND, in any status", () => {
    for (const status of BrandOrderStatusSchema.options) {
      const plan = fulfilmentFor(order(status, "RIDER_PER_BRAND", "CARD"));
      expect(plan.next?.asksForCourier ?? false, status).toBe(false);
    }
  });
});

describe("the progression", () => {
  const rider = (status: BrandOrderStatus) =>
    fulfilmentFor(order(status, "RIDER_PER_BRAND", "CARD"));

  it("runs shelf check -> packed -> handed over -> delivered", () => {
    expect(rider("PENDING_BRAND").next?.to).toBe("CONFIRMED");
    expect(rider("CONFIRMED").next?.to).toBe("PACKED");
    expect(rider("PACKED").next?.to).toBe("HANDED_OVER");
    expect(rider("HANDED_OVER").next?.to).toBe("DELIVERED");
  });

  it("offers nothing while the platform is still waiting on somebody else", () => {
    expect(rider("PENDING_PAYMENT").next).toBeNull();
    expect(rider("PENDING_VERIFICATION").next).toBeNull();
  });

  it("offers nothing once the order is finished", () => {
    for (const status of ["DELIVERED", "RETURNED", "CANCELLED", "REFUNDED"] as const) {
      expect(rider(status).next, status).toBeNull();
      expect(rider(status).risk, status).toBeNull();
    }
  });

  it("hands a RETURN_REQUESTED order to the returns screen rather than duplicating it", () => {
    // The server DOES allow RETURNED and DELIVERED from here. This is not a
    // claim that it does not — it is a decision about which screen owns them.
    const plan = rider("RETURN_REQUESTED");
    expect(plan.returnOpen).toBe(true);
    expect(plan.next).toBeNull();
    expect(plan.risk).toBeNull();
  });

  it("lets a refused parcel go back out on the same route's terms", () => {
    expect(rider("DELIVERY_FAILED").next).toMatchObject({
      to: "HANDED_OVER",
      label: "actReady",
      asksForCourier: false,
    });
    expect(
      fulfilmentFor(order("DELIVERY_FAILED", "BRAND_OWN_DELIVERY", "CASH")).next
    ).toMatchObject({ label: "actHand", asksForCourier: true });
  });
});

describe("a refused delivery says what it costs, and cash costs nothing", () => {
  it("offers NO refund on a cash order — nothing was paid", () => {
    const risk = fulfilmentFor(
      order("HANDED_OVER", "BRAND_OWN_DELIVERY", "CASH")
    ).risk;

    expect(risk?.to).toBe("DELIVERY_FAILED");
    expect(risk?.consequences).toContain("conseqNoRefund");
    expect(risk?.consequences).not.toContain("conseqRefund");
  });

  it("promises no refund either when the payment row does not exist yet", () => {
    const risk = fulfilmentFor(
      order("HANDED_OVER", "BRAND_OWN_DELIVERY", null)
    ).risk;

    expect(risk?.consequences).toContain("conseqNoRefund");
    expect(risk?.consequences).not.toContain("conseqRefund");
  });

  it("names the refund on a prepaid order", () => {
    const risk = fulfilmentFor(
      order("HANDED_OVER", "RIDER_PER_BRAND", "CARD")
    ).risk;

    expect(risk?.consequences).toContain("conseqRefund");
    expect(risk?.consequences).not.toContain("conseqNoRefund");
  });

  it("always says the stock comes back, whatever was paid", () => {
    for (const paymentMethod of PaymentMethodSchema.options) {
      const risk = fulfilmentFor(
        order("HANDED_OVER", "BRAND_OWN_DELIVERY", paymentMethod)
      ).risk;
      expect(risk?.consequences, paymentMethod).toContain("conseqRestock");
      expect(risk?.consequences.length, paymentMethod).toBeGreaterThan(0);
    }
  });

  it("makes a shelf rejection release the hold rather than refund anything", () => {
    const risk = fulfilmentFor(
      order("PENDING_BRAND", "BRAND_OWN_DELIVERY", "CASH")
    ).risk;

    expect(risk?.to).toBe("CANCELLED");
    expect(risk?.consequences).toEqual(["conseqRelease", "conseqCancelled"]);
  });
});

describe("the body a transition posts", () => {
  const step = {
    to: "HANDED_OVER" as const,
    label: "actHand" as const,
    hint: "hintHand" as const,
    asksForCourier: true,
  };

  it("carries the courier only where the brand actually books one", () => {
    expect(
      transitionBody(step, {
        courierName: " Bosta ",
        trackingNumber: " TRK-9 ",
      })
    ).toEqual({
      to: "HANDED_OVER",
      courierName: "Bosta",
      trackingNumber: "TRK-9",
    });
  });

  it("sends no empty consignment on the shopper's own rider", () => {
    expect(
      transitionBody(
        { ...step, asksForCourier: false, label: "actReady", hint: "hintReady" },
        { courierName: "typed then switched route", trackingNumber: "X" }
      )
    ).toEqual({ to: "HANDED_OVER" });
  });
});

describe("labels", () => {
  it("maps every payment method the API can send", () => {
    for (const method of PaymentMethodSchema.options) {
      expect(paymentLabelKey(method), method).toBeTruthy();
    }
  });

  /** The mockups say COD throughout. There is no COD value; CASH is the one. */
  it("calls CASH what the enum calls it", () => {
    expect(paymentLabelKey("CASH")).toBe("payCod");
    expect(PaymentMethodSchema.options).not.toContain("COD");
  });

  /** Nullable now, and a missing payment row is not silently a cash one. */
  it("says a missing payment method is missing rather than guessing", () => {
    expect(paymentLabelKey(null)).toBe("payUnknown");
  });

  it("has exactly two route labels, because there are two live routes", () => {
    expect(routeLabelKey("RIDER_PER_BRAND")).toBe("routeRider");
    expect(routeLabelKey("BRAND_OWN_DELIVERY")).toBe("routeOwn");
  });
});

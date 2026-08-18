import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  BrandOrderStatusSchema,
  DeliveryMethodSchema,
  PaymentMethodSchema,
  ProductStatusSchema,
  ReturnStatusSchema,
  SettlementStatusSchema,
} from "@loqal/contracts/enums";

import {
  DELIVERY_TONE,
  PAYMENT_TONE,
  STATUS_MAP,
  StatusPill,
  statusLabel,
  statusTone,
  type DeliveryMethodLabels,
  type LiveDeliveryMethod,
  type PaymentMethodLabels,
} from "../status-pill";

describe("StatusPill", () => {
  it("covers every value of every enum it claims to handle", () => {
    // A status the API can send and this map has no entry for would render an
    // empty pill in a shop's order list. The contract is the source of truth.
    expect(Object.keys(STATUS_MAP.BrandOrderStatus).sort()).toEqual(
      [...BrandOrderStatusSchema.options].sort()
    );
    expect(Object.keys(STATUS_MAP.ReturnStatus).sort()).toEqual(
      [...ReturnStatusSchema.options].sort()
    );
    expect(Object.keys(STATUS_MAP.SettlementStatus).sort()).toEqual(
      [...SettlementStatusSchema.options].sort()
    );
    expect(Object.keys(STATUS_MAP.ProductStatus).sort()).toEqual(
      [...ProductStatusSchema.options].sort()
    );
    expect(Object.keys(STATUS_MAP.BrandOrderStatus)).toHaveLength(12);
  });

  it("renders the label for the value, not the raw enum", () => {
    render(<StatusPill kind="BrandOrderStatus" value="PENDING_BRAND" />);

    expect(screen.getByText("Check the shelf")).toBeInTheDocument();
  });

  it("renders the Arabic label under ar", () => {
    render(
      <StatusPill kind="BrandOrderStatus" value="DELIVERED" locale="ar" />
    );

    expect(screen.getByText("تم التوصيل")).toBeInTheDocument();
  });

  it("marks the tone so the pill reads without colour vision", () => {
    const { container } = render(
      <StatusPill kind="BrandOrderStatus" value="DELIVERY_FAILED" />
    );

    expect(container.querySelector('[data-tone="bad"]')).not.toBeNull();
    expect(
      container.querySelector('[data-status="DELIVERY_FAILED"]')
    ).not.toBeNull();
  });

  it("gives the one status a brand must act on the act tone", () => {
    expect(
      statusTone({ kind: "BrandOrderStatus", value: "PENDING_BRAND" })
    ).toBe("act");
    expect(
      statusTone({ kind: "BrandOrderStatus", value: "PENDING_PAYMENT" })
    ).toBe("wait");
  });

  it("exposes the label without rendering, for a table cell or an aria-label", () => {
    expect(
      statusLabel({ kind: "SettlementStatus", value: "RECEIVED" }, "ar")
    ).toBe("تم الاستلام");
  });
});

/**
 * The two METHOD kinds. Route and payment wording was living in per-screen
 * message keys, so three consoles were about to invent three vocabularies for
 * the same five values. Tone is the design system's; copy is the caller's.
 */

/** Stand-ins for the catalogue keys — this suite tests wiring, not wording. */
const payLabels: PaymentMethodLabels = {
  CARD: "Card, prepaid",
  WALLET: "Wallet, prepaid",
  VALU: "ValU, prepaid",
  CASH: "Cash at the door",
  INSTAPAY: "InstaPay, prepaid",
};

const routeLabels: DeliveryMethodLabels = {
  RIDER_PER_BRAND: "Shopper's rider",
  BRAND_OWN_DELIVERY: "Own delivery",
};

describe("StatusPill PaymentMethod", () => {
  it("has a tone for every value the contract can send", () => {
    expect(Object.keys(PAYMENT_TONE).sort()).toEqual(
      [...PaymentMethodSchema.options].sort()
    );
  });

  it("has NO COD, whatever the mockups say", () => {
    // The design mockups call it COD throughout. The enum has CASH and the API
    // sends CASH; a pill keyed off anything else would render empty.
    expect(PAYMENT_TONE).not.toHaveProperty("COD");
    expect(PAYMENT_TONE).toHaveProperty("CASH");
  });

  it("renders every value from the caller's dictionary", () => {
    for (const value of PaymentMethodSchema.options) {
      const { unmount } = render(
        <StatusPill kind="PaymentMethod" value={value} labels={payLabels} />
      );
      expect(screen.getByText(payLabels[value])).toBeInTheDocument();
      unmount();
    }
  });

  it("marks cash as the one a person must act on, and the rest as settled", () => {
    // Somebody at the door has to take money for CASH. Everything else is
    // already paid, so there is no money question left.
    expect(
      statusTone({ kind: "PaymentMethod", value: "CASH", labels: payLabels })
    ).toBe("act");

    for (const value of ["CARD", "WALLET", "VALU", "INSTAPAY"] as const) {
      expect(
        statusTone({ kind: "PaymentMethod", value, labels: payLabels })
      ).toBe("good");
    }
  });

  it("hardcodes no English — the label comes from the dictionary", () => {
    render(
      <StatusPill
        kind="PaymentMethod"
        value="CASH"
        labels={{ ...payLabels, CASH: "الدفع عند الباب" }}
      />
    );

    expect(screen.getByText("الدفع عند الباب")).toBeInTheDocument();
  });
});

describe("StatusPill DeliveryMethod", () => {
  it("covers every LIVE route and only those", () => {
    const live = DeliveryMethodSchema.options.filter(
      (option) => option !== "SHIPPING_SERVICE"
    );

    expect(Object.keys(DELIVERY_TONE).sort()).toEqual([...live].sort());
  });

  it("renders both live routes from the caller's dictionary", () => {
    for (const value of Object.keys(DELIVERY_TONE) as LiveDeliveryMethod[]) {
      const { unmount } = render(
        <StatusPill kind="DeliveryMethod" value={value} labels={routeLabels} />
      );
      expect(screen.getByText(routeLabels[value])).toBeInTheDocument();
      unmount();
    }
  });

  it("waits on the shopper's rider and acts on its own delivery", () => {
    expect(
      statusTone({
        kind: "DeliveryMethod",
        value: "RIDER_PER_BRAND",
        labels: routeLabels,
      })
    ).toBe("wait");
    expect(
      statusTone({
        kind: "DeliveryMethod",
        value: "BRAND_OWN_DELIVERY",
        labels: routeLabels,
      })
    ).toBe("act");
  });

  it("REFUSES SHIPPING_SERVICE by rendering nothing at all", () => {
    /**
     * Not live: no courier contract, no brand carries it. A pill is the shape
     * this system uses for "one of the options", so drawing it greyed out, as
     * an em-dash or as the raw enum name would all still say "this exists and
     * is off today". Nothing is the only output that cannot be read as an offer.
     *
     * The cast is the point of the test: the prop type already makes this a
     * compile error, and this proves the rule ALSO holds for a value that came
     * off the wire and was never typed.
     */
    const { container } = render(
      <StatusPill
        kind="DeliveryMethod"
        value={"SHIPPING_SERVICE" as LiveDeliveryMethod}
        labels={routeLabels as DeliveryMethodLabels}
      />
    );

    expect(container.innerHTML).toBe("");
    expect(container.querySelector('[data-slot="badge"]')).toBeNull();
  });

  it("gives no label for the refused route either", () => {
    // So a caller building an aria-label by concatenation gets nothing, not
    // the name of something that is not live.
    expect(
      statusLabel({
        kind: "DeliveryMethod",
        value: "SHIPPING_SERVICE" as LiveDeliveryMethod,
        labels: routeLabels,
      })
    ).toBe("");
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { brandOrderDetailSchema } from "@loqal/contracts/order.contract";
import { en } from "@/messages/en";
import { LocaleProvider } from "@/lib/locale-context";

import {
  NOW,
  SIBLING_CANARIES,
  cardHandedOver,
  cashHandedOver,
  deliveredOrder,
  detail,
  guestOrder,
  ownPacked,
  returnRequestedOrder,
  riderPacked,
  shippingServiceDetail,
  twoBrandOrderRaw,
} from "./fixtures";

const get = vi.fn();
const patch = vi.fn();
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, api: { ...actual.api, get, patch } };
});

const { ApiError } = await import("@/lib/api");
const { OrderDetail } = await import("../[id]/order-detail");
const { ar } = await import("@/messages/ar");

const answer = (value: unknown) =>
  value instanceof Error ? Promise.reject(value) : Promise.resolve(value);

const show = (order: unknown, locale: "en" | "ar" = "en") => {
  get.mockImplementation(() => answer(order));
  return render(
    <LocaleProvider locale={locale}>
      <OrderDetail id="0199a000-0000-7000-8000-000000000001" />
    </LocaleProvider>
  );
};

beforeEach(() => {
  vi.spyOn(Date, "now").mockReturnValue(NOW.getTime());
  patch.mockImplementation(() => answer(detail()));
});

afterEach(() => {
  vi.restoreAllMocks();
  get.mockReset();
  patch.mockReset();
});

describe("detail fixtures match the shipped contract", () => {
  it("parses every order fixture with brandOrderDetailSchema", () => {
    for (const order of [
      detail(),
      riderPacked,
      ownPacked,
      cashHandedOver,
      cardHandedOver,
      deliveredOrder,
      returnRequestedOrder,
      shippingServiceDetail,
      guestOrder,
    ]) {
      expect(brandOrderDetailSchema.safeParse(order).success).toBe(true);
    }
  });

  /**
   * The fields the screen was written against and the contract no longer
   * carries. `.strict()` means a body shaped the old way never reaches a
   * component, so this asserts the reason the screens had to move rather than
   * the symptom.
   */
  it("REFUSES the flattened item shape the screen used to read", () => {
    const old = {
      ...detail(),
      items: [
        {
          id: "0199f000-0000-7000-8000-000000000001",
          sku: "MINE-LS-S",
          productName: { en: "Linen shirt" },
          variantLabel: { en: "Small" },
          quantity: 2,
          unitPrice: "620.00",
          lineTotal: "1240.00",
        },
      ],
    };
    expect(brandOrderDetailSchema.safeParse(old).success).toBe(false);
  });

  /**
   * The first line of defence, and worth asserting rather than assuming: the
   * contract is `.strict()`, so a body carrying a parent total or a sibling
   * brand does not reach a component at all — it fails in the client with the
   * path attached.
   */
  it("REFUSES a body carrying a parent total or a sibling brand", () => {
    const parsed = brandOrderDetailSchema.safeParse(twoBrandOrderRaw);
    expect(parsed.success).toBe(false);
  });
});

/**
 * THE TEST THIS SCREEN EXISTS FOR.
 *
 * A brand sees its own slice. The check is not "does the sibling field render
 * where I put it" — it is a scan of the entire serialised DOM, attributes
 * included, for strings that belong to the other shop on the same basket. A
 * leak in a field nobody thought to name is the leak that ships, and only a
 * scan catches that one.
 */
describe("a two-brand order leaks nothing about the sibling brand", () => {
  it("renders no canary anywhere in the serialised DOM", async () => {
    show(twoBrandOrderRaw);

    await screen.findByText("#1042");

    const serialised = document.body.innerHTML;
    for (const canary of SIBLING_CANARIES) {
      expect(serialised, `leaked ${canary}`).not.toContain(canary);
    }
  });

  it("leaks no parent figure and no basket vocabulary", async () => {
    show(twoBrandOrderRaw);

    await screen.findByText("#1042");

    const serialised = document.body.innerHTML;
    expect(serialised).not.toMatch(/parentTotal|grandTotal|siblingBrand/i);
    // The sibling's own subtotal, formatted the way this screen formats money.
    expect(serialised).not.toContain("8,420.00");
    expect(serialised).not.toContain("9,660.00");
  });

  it("still renders this brand's own slice — the scan is not passing on a blank screen", async () => {
    show(twoBrandOrderRaw);

    await screen.findByText("#1042");
    expect(screen.getAllByText("1,240.00 EGP").length).toBeGreaterThan(0);
    expect(screen.getAllByText("MINE-LS-S").length).toBeGreaterThan(0);
    expect(screen.getByText(en.brand.sliceOnly)).toBeInTheDocument();
  });
});

describe("the items are the frozen snapshot, not the catalogue", () => {
  it("reads the name and SKU out of productSnapshot", async () => {
    show(detail());

    await screen.findByText("#1042");
    expect(screen.getAllByText("Linen shirt").length).toBeGreaterThan(0);
    expect(screen.getAllByText("MINE-LS-S").length).toBeGreaterThan(0);
    expect(screen.getAllByText("2").length).toBeGreaterThan(0);
  });

  it("composes the variant label from the attributes, because none is stored", async () => {
    show(
      detail({
        items: [
          {
            id: "0199f000-0000-7000-8000-000000000001",
            variantId: null,
            qty: 1,
            unitPrice: "620.00",
            lineTotal: "620.00",
            productSnapshot: {
              name: { en: "Linen shirt" },
              sku: "MINE-LS-S",
              // The attribute SET differs per product, which is exactly why
              // there is no stored label to read.
              attributes: { size: "Small", colour: "Sand" },
              imageMediaId: null,
            },
          },
        ],
      })
    );

    await screen.findByText("#1042");
    expect(screen.getAllByText("Small · Sand").length).toBeGreaterThan(0);
  });

  it("says nothing rather than inventing a label when there are no attributes", async () => {
    show(
      detail({
        items: [
          {
            id: "0199f000-0000-7000-8000-000000000001",
            variantId: null,
            qty: 1,
            unitPrice: "620.00",
            lineTotal: "620.00",
            productSnapshot: {
              name: { en: "Linen shirt" },
              sku: "MINE-LS-S",
              attributes: {},
              imageMediaId: null,
            },
          },
        ],
      })
    );

    await screen.findByText("#1042");
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });
});

describe("the money on the order", () => {
  it("draws a zero delivery fee rather than hiding the row", async () => {
    // Non-nullable and defaulting to 0: a shop that charges no delivery fee
    // charges nothing, which is a number a shopper can be shown.
    show(detail({ shippingCost: "0.00" }));

    await screen.findByText("#1042");
    expect(screen.getByText(en.brand.deliveryFee)).toBeInTheDocument();
    expect(screen.getAllByText("0.00 EGP").length).toBeGreaterThan(0);
  });

  it("shows the brand its own commission and payout", async () => {
    show(detail());

    await screen.findByText("#1042");
    expect(screen.getByText(en.brand.commissionAmount)).toBeInTheDocument();
    expect(screen.getAllByText("124.00 EGP").length).toBeGreaterThan(0);
    expect(screen.getByText(en.brand.payoutAmount)).toBeInTheDocument();
    expect(screen.getAllByText("1,116.00 EGP").length).toBeGreaterThan(0);
  });
});

/**
 * The buttons come from the server's table, not from a copy of it in the
 * client. These are the screen-level half of the same argument fulfilment.test
 * makes against the pure function.
 */
describe("which buttons exist is the server's answer", () => {
  it("draws no action at all when the server allows nothing", async () => {
    show(detail({ status: "PACKED", allowedTransitions: [] }));

    await screen.findByText("#1042");
    expect(screen.getByTestId("order-no-action")).toHaveTextContent(
      en.brand.noActionTitle
    );
    expect(screen.queryByTestId("order-action")).toBeNull();
  });

  it("offers the cancel a refused parcel is allowed, which the copy used to hide", async () => {
    show(cashHandedOver);
    await screen.findByText("#1042");

    // HANDED_OVER offers no cancel...
    expect(
      screen.queryByRole("button", { name: en.brand.cancelOrderAction })
    ).toBeNull();

    show(detail({ status: "DELIVERY_FAILED", deliveryMethod: "BRAND_OWN_DELIVERY" }));
    await screen.findByText("#1042");

    // ...and DELIVERY_FAILED does, because TRANSITIONS says a brand may.
    expect(
      await screen.findByRole("button", { name: en.brand.cancelOrderAction })
    ).toBeInTheDocument();
  });
});

describe("the primary action is ONE control at every width", () => {
  it("renders a single button rather than one per breakpoint", async () => {
    show(riderPacked);

    await screen.findByText("#1042");
    // Two elements with the same accessible name is a screen reader hearing
    // "Mark ready for pickup, button" twice with nothing to tell them apart.
    expect(
      screen.getAllByRole("button", { name: en.brand.actReady })
    ).toHaveLength(1);
    expect(screen.getByTestId("order-action-bar")).toBeInTheDocument();
  });
});

describe("the delivery route decides the action", () => {
  it("RIDER_PER_BRAND shows NO tracking-number input", async () => {
    show(riderPacked);

    await screen.findByText("#1042");

    expect(screen.queryByLabelText(en.brand.tracking)).toBeNull();
    expect(screen.queryByLabelText(en.brand.courier)).toBeNull();
    expect(screen.queryByTestId("courier-fields")).toBeNull();
    // The action is a notification: the shopper books and pays their own rider.
    expect(screen.getAllByRole("button", { name: en.brand.actReady }).length).toBeGreaterThan(0);
    expect(screen.getByText(en.brand.routeNoteRider)).toBeInTheDocument();
  });

  it("BRAND_OWN_DELIVERY shows the courier and tracking-number inputs", async () => {
    show(ownPacked);

    await screen.findByText("#1042");

    expect(screen.getByLabelText(en.brand.courier)).toBeInTheDocument();
    expect(screen.getByLabelText(en.brand.tracking)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: en.brand.actHand }).length).toBeGreaterThan(0);
    expect(screen.getByText(en.brand.routeNoteOwn)).toBeInTheDocument();
  });

  it("will not hand over until the courier and tracking number are written", async () => {
    show(ownPacked);

    await screen.findByText("#1042");
    const buttons = screen.getAllByRole("button", { name: en.brand.actHand });
    expect(buttons[0]).toBeDisabled();
    expect(screen.getByText(en.brand.courierRequired)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(en.brand.courier), {
      target: { value: "Bosta" },
    });
    fireEvent.change(screen.getByLabelText(en.brand.tracking), {
      target: { value: "TRK-9" },
    });

    await waitFor(() =>
      expect(
        screen.getAllByRole("button", { name: en.brand.actHand })[0]
      ).not.toBeDisabled()
    );

    fireEvent.click(screen.getAllByRole("button", { name: en.brand.actHand })[0]!);

    await waitFor(() => expect(patch).toHaveBeenCalled());
    const [, path, body] = patch.mock.calls[0] as [unknown, string, unknown];
    expect(path).toBe(
      "/v1/dashboard/orders/0199a000-0000-7000-8000-000000000001/transition"
    );
    expect(body).toEqual({
      to: "HANDED_OVER",
      courierName: "Bosta",
      trackingNumber: "TRK-9",
    });
  });

  it("sends no consignment fields on the shopper's own rider", async () => {
    show(riderPacked);

    await screen.findByText("#1042");
    fireEvent.click(screen.getAllByRole("button", { name: en.brand.actReady })[0]!);

    await waitFor(() => expect(patch).toHaveBeenCalled());
    expect(patch.mock.calls[0]![2]).toEqual({ to: "HANDED_OVER" });
  });

  it("says cash is collected only where somebody from this shop is at the door", async () => {
    show(ownPacked);
    await screen.findByText("#1042");
    expect(screen.getByText(en.brand.collectCash)).toBeInTheDocument();

    show(riderPacked);
    await waitFor(() =>
      expect(screen.getAllByText(en.brand.prepaid).length).toBeGreaterThan(0)
    );
  });
});

describe("SHIPPING_SERVICE renders nowhere", () => {
  it("refuses the order entirely rather than drawing it without an action", async () => {
    const { container } = show(shippingServiceDetail);

    expect(
      await screen.findByText(en.brand.routeUnavailableTitle)
    ).toBeInTheDocument();

    // Not the order number, not the items, not the shopper, not the enum value.
    expect(screen.queryByText("#1042")).toBeNull();
    expect(screen.queryByText("MINE-LS-S")).toBeNull();
    expect(screen.queryByText(en.brand.shopper)).toBeNull();
    expect(container.innerHTML).not.toMatch(/SHIPPING_SERVICE/);
    expect(screen.getByRole("link", { name: en.brand.allOrders })).toBeInTheDocument();
  });
});

describe("a delivery refused at the door", () => {
  const openTheSheet = async () => {
    const trigger = await screen.findByRole("button", {
      name: en.brand.deliveryFailAction,
    });
    fireEvent.click(trigger);
    await screen.findByText(en.brand.deliveryFailTitle);
  };

  it("offers NO refund on a cash order — nothing was paid", async () => {
    show(cashHandedOver);
    await openTheSheet();

    expect(screen.getByText(en.brand.conseqNoRefund)).toBeInTheDocument();
    expect(screen.queryByText(en.brand.conseqRefund)).toBeNull();
    expect(screen.getByText(en.brand.conseqRestock)).toBeInTheDocument();
    // And nowhere else on the screen either.
    expect(document.body.innerHTML).not.toContain(en.brand.conseqRefund);
  });

  it("names the refund on a prepaid order", async () => {
    show(cardHandedOver);
    await openTheSheet();

    expect(screen.getByText(en.brand.conseqRefund)).toBeInTheDocument();
    expect(screen.queryByText(en.brand.conseqNoRefund)).toBeNull();
  });

  it("sends DELIVERY_FAILED once confirmed", async () => {
    show(cashHandedOver);
    await openTheSheet();

    fireEvent.click(
      screen.getByRole("button", { name: en.brand.deliveryFailConfirm })
    );

    await waitFor(() => expect(patch).toHaveBeenCalled());
    expect(patch.mock.calls[0]![2]).toEqual({ to: "DELIVERY_FAILED" });
  });
});

describe("PENDING_BRAND is a person waiting, not a state", () => {
  it("leads with the shelf check and says stock is held, not committed", async () => {
    show(detail({ status: "PENDING_BRAND" }));

    await screen.findByText("#1042");
    const action = screen.getByTestId("order-action");
    expect(action).toHaveTextContent(en.brand.shelfTitle);
    expect(screen.getByText(en.brand.shelfNote)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: en.brand.actConfirm }).length).toBeGreaterThan(0);
  });

  it("releases the hold rather than refunding when the shelf is short", async () => {
    show(detail({ status: "PENDING_BRAND" }));

    await screen.findByText("#1042");
    fireEvent.click(screen.getByRole("button", { name: en.brand.shelfReject }));

    await screen.findByText(en.brand.shelfRejectTitle);
    expect(screen.getByText(en.brand.conseqRelease)).toBeInTheDocument();
    expect(screen.getByText(en.brand.conseqCancelled)).toBeInTheDocument();
    expect(screen.queryByText(en.brand.conseqRefund)).toBeNull();
  });
});

describe("orders that are not waiting on this shop", () => {
  it("sends an open return to the returns screen instead of a second way to decide it", async () => {
    show(returnRequestedOrder);

    await screen.findByText("#1042");
    expect(screen.getByText(en.brand.returnOpenNote)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: en.brand.returnsTitle })).toHaveAttribute(
      "href",
      "/returns"
    );
    expect(screen.queryByTestId("order-action")).toBeNull();
  });

  it("says so plainly on a finished order rather than drawing a dead button", async () => {
    show(deliveredOrder);

    await screen.findByText("#1042");
    expect(screen.getByTestId("order-no-action")).toHaveTextContent(
      en.brand.noActionTitle
    );
    expect(screen.queryByTestId("order-action-bar")).toBeNull();
  });
});

describe("the shopper appears here and nowhere else", () => {
  it("shows the name, phone and address of the order being fulfilled", async () => {
    show(detail());

    await screen.findByText("#1042");
    expect(screen.getByText("Test Shopper")).toBeInTheDocument();
    // Structured, in the parts a rider reads — not one run-on line. This is
    // also exactly what checkout validated on the way in.
    expect(screen.getByText("12 Test Street · 4")).toBeInTheDocument();
    expect(screen.getByText("Maadi · Cairo")).toBeInTheDocument();
    expect(screen.getAllByText("+20 100 000 0000").length).toBeGreaterThan(0);
  });

  it("prints a dash rather than a blank where a guest left no name", async () => {
    show(guestOrder);

    await screen.findByText("#1042");
    // Both are nullable: a guest checkout may carry only a phone, and a row
    // with no name on it is a real state rather than a defect.
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
    expect(screen.getByText(en.brand.guest)).toBeInTheDocument();
    // The address still has a phone on it, which is the one a driver rings.
    expect(screen.getByText("Maadi · Cairo")).toBeInTheDocument();
  });

  it("offers no export and no route that aggregates shoppers", async () => {
    const { container } = show(detail());

    await screen.findByText("#1042");
    const hrefs = [...container.querySelectorAll("a")].map((a) =>
      a.getAttribute("href")
    );
    expect(hrefs).not.toContain("/customers");
    expect(container.innerHTML).not.toMatch(/export|customers/i);
  });
});

describe("/orders/[id] — the states", () => {
  it("draws the loading skeleton", () => {
    get.mockImplementation(() => new Promise(() => {}));
    const { container } = render(
      <LocaleProvider locale="en">
        <OrderDetail id="0199a000-0000-7000-8000-000000000001" />
      </LocaleProvider>
    );
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it("answers a 404 the same way it would answer another shop's order", async () => {
    const { container } = show(new ApiError(404, "Brand order not found", "NotFound"));

    expect(await screen.findByText(en.brand.orderNotFoundTitle)).toBeInTheDocument();
    expect(screen.getByText(en.brand.orderNotFoundBody)).toBeInTheDocument();

    // Its own state, not "empty" wearing a 404 title — empty means the list is
    // empty, this means there is nothing at this address.
    expect(container.querySelector('[data-state="notFound"]')).not.toBeNull();
    // And the way out is an ADDRESS, so it is an anchor rather than a button.
    expect(
      screen.getByRole("link", { name: en.brand.allOrders })
    ).toHaveAttribute("href", "/orders");
  });

  it("draws the denied panel on a 403", async () => {
    show(new ApiError(403, "Forbidden", "Forbidden"));

    expect(await screen.findByText(en.brand.brandOnlyTitle)).toBeInTheDocument();
  });

  it("draws the error state with a retry on anything else", async () => {
    show(new ApiError(500, "boom", "InternalServerError"));

    expect(await screen.findByText(en.brand.ordersErrorTitle)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: en.brand.retry })).toBeInTheDocument();
  });

  it("says so when a transition does not go through", async () => {
    show(riderPacked);
    await screen.findByText("#1042");

    patch.mockImplementation(() => answer(new ApiError(409, "conflict", "Conflict")));
    fireEvent.click(screen.getAllByRole("button", { name: en.brand.actReady })[0]!);

    expect(await screen.findByText(en.brand.transitionFailed)).toBeInTheDocument();
  });
});

describe("/orders/[id] — bilingual", () => {
  it("takes its copy from ar.ts under the Arabic locale", async () => {
    show(ownPacked, "ar");

    await screen.findByText("#1042");
    expect(screen.getByText(ar.brand.routeNoteOwn)).toBeInTheDocument();
    expect(screen.getByLabelText(ar.brand.tracking)).toBeInTheDocument();
    expect(screen.getByText(ar.brand.collectCash)).toBeInTheDocument();
  });

  it("still leaks nothing about a sibling brand under Arabic", async () => {
    show(twoBrandOrderRaw, "ar");

    await screen.findByText("#1042");
    for (const canary of SIBLING_CANARIES) {
      expect(document.body.innerHTML, `leaked ${canary}`).not.toContain(canary);
    }
  });
});

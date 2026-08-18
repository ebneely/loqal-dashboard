// @vitest-environment node
import { describe, expect, it } from "vitest";

import { returnPageSchema } from "@loqal/contracts/return.contract";

import { byOldestRequest, groupByRoute, isDecidable } from "../return-window";
import {
  decidedPage,
  emptyReturnsPage,
  pageWithCursor,
  returnsPage,
  undecidedPage,
} from "./fixtures";

describe("fixtures match the shipped contract", () => {
  it("parses every page with returnPageSchema", () => {
    for (const page of [
      returnsPage,
      decidedPage,
      undecidedPage,
      emptyReturnsPage,
      pageWithCursor,
    ]) {
      expect(returnPageSchema.safeParse(page).success).toBe(true);
    }
  });

  /**
   * The deadline is gone from the contract on purpose: the return window is
   * enforced when a shopper files, so on a row that already came through that
   * gate it was a countdown nobody could miss. `.strict()` means a fixture that
   * kept it would not parse — this asserts the reason rather than the symptom.
   */
  it("refuses a row carrying the deadline the screen used to print", () => {
    const withWindow = {
      items: [{ ...returnsPage.items[0]!, windowClosesAt: "2026-08-20T12:00:00.000Z" }],
      nextCursor: null,
    };
    expect(returnPageSchema.safeParse(withWindow).success).toBe(false);
  });
});

describe("the route is a decision, not a property", () => {
  it("leads with the returns nobody has decided yet", () => {
    const groups = groupByRoute(returnsPage.items);
    expect(groups.map((g) => g.route)).toEqual([null, "WALK_IN", "COURIER"]);
  });

  it("puts every undecided row in its own group rather than a route nobody chose", () => {
    const groups = groupByRoute(returnsPage.items);
    expect(groups[0]!.rows.every((r) => r.route === null)).toBe(true);
    expect(groups[0]!.rows.map((r) => r.orderNumber)).toEqual(["2045", "2044"]);
  });

  it("drops any row from a group it does not belong to", () => {
    const groups = groupByRoute(returnsPage.items);
    const numbers = groups.flatMap((g) => g.rows.map((r) => r.orderNumber));
    // Nothing lost: a nullable route used to make undecided rows vanish from a
    // screen that grouped strictly by WALK_IN / COURIER.
    expect(numbers.sort()).toEqual(["2041", "2042", "2043", "2044", "2045"]);
  });
});

describe("WALK_IN is not the second option", () => {
  it("puts walk-ins before couriers even though the API sent the courier first", () => {
    const groups = groupByRoute(returnsPage.items);
    const routed = groups.filter((g) => g.route !== null).map((g) => g.route);
    expect(routed).toEqual(["WALK_IN", "COURIER"]);
  });

  it("puts walk-ins first even though the courier row was asked for earliest", () => {
    // #2041 was asked for 15 hours ago; both walk-ins are more recent. A screen
    // that ranked purely by wait would bury the customer standing in the shop.
    const groups = groupByRoute(returnsPage.items);
    expect(groups[1]!.rows.map((r) => r.orderNumber)).toEqual(["2043", "2042"]);
  });

  it("drops a group with no rows rather than drawing an empty heading", () => {
    const groups = groupByRoute(
      returnsPage.items.filter((r) => r.route === "WALK_IN")
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]!.route).toBe("WALK_IN");
  });

  it("ranks by longest wait inside a group, counted from when it was asked", () => {
    // 2041 asked 15 h ago, 2043 13 h, 2042 6 h 40, 2045 5 h, 2044 2 h.
    const ranked = byOldestRequest(returnsPage.items);
    expect(ranked.map((r) => r.orderNumber)).toEqual([
      "2041",
      "2043",
      "2042",
      "2045",
      "2044",
    ]);
  });
});

describe("only an undecided return is still open", () => {
  it("is decidable while REQUESTED and never afterwards", () => {
    expect(isDecidable("REQUESTED")).toBe(true);
    for (const status of ["APPROVED", "REJECTED", "RESTOCKED"] as const) {
      expect(isDecidable(status), status).toBe(false);
    }
  });
});

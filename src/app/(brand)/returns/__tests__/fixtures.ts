/**
 * Fixtures for /returns. Here and only here — the route source ships no sample
 * return, and a scan over src/app enforces that.
 *
 * The shape moved with the contract: there is no `windowClosesAt` (the window
 * is enforced when a shopper files, so every row here is already through it),
 * `route` is null until the brand approves, and `brandOrderId` finally gives a
 * row somewhere to link to.
 */
import type {
  ReturnListItem,
  ReturnPage,
} from "@loqal/contracts/return.contract";

export const NOW = new Date("2026-08-14T12:00:00.000Z");

const at = (minutesFromNow: number) =>
  new Date(NOW.getTime() + minutesFromNow * 60_000).toISOString();

const orderId = (n: number) => `0199d100-0000-7000-8000-00000000000${n}`;

const row = (
  over: Partial<ReturnListItem> & Pick<ReturnListItem, "id">
): ReturnListItem => ({
  brandOrderId: orderId(0),
  orderNumber: "2000",
  status: "REQUESTED",
  // Null, not COURIER. Nobody has decided yet — that is what approving is for.
  route: null,
  itemCount: 1,
  reason: "Wrong size",
  refundAmount: null,
  requestedAt: at(-60),
  approvedAt: null,
  restockedAt: null,
  ...over,
});

/** Already approved, so it has a route and a decision time on it. */
const approved = (
  over: Partial<ReturnListItem> & Pick<ReturnListItem, "id">
): ReturnListItem =>
  row({
    status: "APPROVED",
    refundAmount: "385.50",
    approvedAt: at(-30),
    ...over,
  });

/**
 * Deliberately COURIER-first in the wire order, and with the walk-ins asked for
 * LATER than the courier row — so a screen that simply renders what the API
 * sent, or that ranks purely by wait, puts the walk-in group second. It must
 * not. The two undecided rows lead, because those are the ones the brand still
 * owes an answer on.
 */
export const returnsPage: ReturnPage = {
  items: [
    approved({
      id: "0199b100-0000-7000-8000-000000000001",
      brandOrderId: orderId(1),
      orderNumber: "2041",
      route: "COURIER",
      reason: "Zip broken",
      requestedAt: at(-900),
    }),
    approved({
      id: "0199b100-0000-7000-8000-000000000002",
      brandOrderId: orderId(2),
      orderNumber: "2042",
      route: "WALK_IN",
      reason: "Wrong colour",
      itemCount: 2,
      requestedAt: at(-400),
    }),
    approved({
      id: "0199b100-0000-7000-8000-000000000003",
      brandOrderId: orderId(3),
      orderNumber: "2043",
      route: "WALK_IN",
      reason: "Too small",
      requestedAt: at(-800),
    }),
    row({
      id: "0199b100-0000-7000-8000-000000000006",
      brandOrderId: orderId(6),
      orderNumber: "2044",
      requestedAt: at(-120),
    }),
    row({
      id: "0199b100-0000-7000-8000-000000000007",
      brandOrderId: orderId(7),
      orderNumber: "2045",
      reason: "Changed my mind",
      requestedAt: at(-300),
    }),
  ],
  nextCursor: null,
};

/** Nothing left to decide — restocked, and its route is long since settled. */
export const decidedPage: ReturnPage = {
  items: [
    row({
      id: "0199b100-0000-7000-8000-000000000004",
      brandOrderId: orderId(4),
      orderNumber: "2039",
      status: "RESTOCKED",
      route: "WALK_IN",
      refundAmount: "120.00",
      approvedAt: at(-2000),
      restockedAt: at(-1900),
    }),
  ],
  nextCursor: null,
};

/** One undecided row and nothing else, for the approve and reject paths. */
export const undecidedPage: ReturnPage = {
  items: [
    row({
      id: "0199b100-0000-7000-8000-000000000005",
      brandOrderId: orderId(5),
      orderNumber: "2038",
      requestedAt: at(-45),
    }),
  ],
  nextCursor: null,
};

export const emptyReturnsPage: ReturnPage = { items: [], nextCursor: null };

export const pageWithCursor: ReturnPage = {
  items: [returnsPage.items[0]!],
  nextCursor: "cursor-1",
};

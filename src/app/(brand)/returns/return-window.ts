/**
 * The two facts a returns screen has to get right, kept pure so they can be
 * checked without a DOM.
 *
 *  a. THE ORDER OF THE QUEUE. Longest wait first, counted from `requestedAt` —
 *     the moment a shopper asked and started waiting for an answer.
 *
 *     There is no deadline to count down to any more, and there never should
 *     have been one here. The return WINDOW is enforced at request time: a
 *     shopper past the shop's own `returnWindowDays` cannot file at all, so
 *     every row that reaches this screen is already through that gate. The old
 *     `windowClosesAt` printed a deadline nobody could miss, and it went out of
 *     the contract for exactly that reason.
 *
 *  b. THE ROUTE, and the fact that it is a DECISION rather than a property.
 *     `route` is null until the brand approves — that is the whole point of the
 *     approve body carrying a required one. So the groups below lead with the
 *     returns nobody has decided yet, and only then split the decided ones by
 *     how the goods are coming back.
 *
 *     Among those, WALK_IN is not the second option. Most of these brands have
 *     a shop, the customer often lives two streets away, and handing it back in
 *     person settles in minutes what a courier drags out for a week. The
 *     grouping puts walk-ins first, and the screen renders the groups in the
 *     order this function returns them.
 */
import type { ReturnRoute, ReturnStatus } from "@loqal/contracts/enums";
import type { ReturnListItem } from "@loqal/contracts/return.contract";

/** Only a REQUESTED return is still open to a decision. */
export const isDecidable = (status: ReturnStatus): boolean =>
  status === "REQUESTED";

/**
 * Longest wait first — the shopper who asked earliest has been waiting longest
 * for an answer, and an answer is the only thing this screen produces.
 */
export const byOldestRequest = (
  rows: readonly ReturnListItem[]
): ReturnListItem[] =>
  [...rows].sort(
    (a, b) => Date.parse(a.requestedAt) - Date.parse(b.requestedAt)
  );

export type RouteGroup = {
  /** Null while nobody has decided how the goods come back. */
  route: ReturnRoute | null;
  rows: ReturnListItem[];
};

/**
 * Undecided first, then walk-ins, then couriers — that is the whole point of
 * this function existing rather than the screen mapping over one flat list.
 *
 * The undecided group is not a leftover bucket. It is every row the brand still
 * owes an answer on, and before `route` became nullable those rows were sorted
 * into a route the brand had not chosen yet.
 */
export function groupByRoute(rows: readonly ReturnListItem[]): RouteGroup[] {
  const undecided = byOldestRequest(rows.filter((r) => r.route === null));
  const walkIn = byOldestRequest(rows.filter((r) => r.route === "WALK_IN"));
  const courier = byOldestRequest(rows.filter((r) => r.route === "COURIER"));

  const groups: RouteGroup[] = [];
  if (undecided.length > 0) groups.push({ route: null, rows: undecided });
  if (walkIn.length > 0) groups.push({ route: "WALK_IN", rows: walkIn });
  if (courier.length > 0) groups.push({ route: "COURIER", rows: courier });
  return groups;
}

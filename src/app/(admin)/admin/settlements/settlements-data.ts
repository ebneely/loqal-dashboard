"use client";

/**
 * Everything /admin/settlements and /admin/settlements/[id] read and write.
 *
 * Settlement is the only part of this system that has to run whether anyone is
 * watching or not, and Loqal's entire income arrives through it. NOTHING MOVES
 * MONEY ON ITS OWN: a daily job raises a run, and a human marks it sent or
 * received. There is no field in the contract that could describe an automatic
 * transfer and there is no call in this file that could trigger one.
 *
 * The read shapes come straight from `@loqal/contracts/settlement.contract` and
 * were checked against `SettlementAdminService`: `toSettlementRunView` spreads
 * the SettlementRun row, stringifies `netAmount`, and flattens three fields off
 * the brand relation — which is exactly `settlementRunSchema`.
 *
 * THE WRITE IS THE ODD ONE OUT, and it is a real gap. `PATCH
 * /admin/settlement-runs/:id` answers the RAW Prisma row returned by
 * `SettlementService.close`/`cancel` — no brandName, no stringified amount, no
 * view projection at all. It cannot be parsed with `settlementRunSchema` and
 * there is no other schema in the package that describes it. So the response is
 * parsed as `unknown` and deliberately discarded: the screen refetches, which
 * is the only way to get a shape anybody has agreed on.
 */
import { z } from "zod";

import {
  markSettlementBodySchema,
  settlementRunDetailSchema,
  settlementRunPageSchema,
  type SettlementRun,
  type SettlementRunDetail,
} from "@loqal/contracts/settlement.contract";
import {
  SettlementStatusSchema,
  type SettlementStatus,
} from "@loqal/contracts/enums";

import { api } from "@/lib/api";
import {
  useCursorFeed,
  useResource,
  type CursorFeed,
  type Resource,
} from "@/lib/resource";

import type { RunMark } from "./run-rules";

const RUNS_PATH = "/v1/admin/settlement-runs";

export type { SettlementRun, SettlementRunDetail };

export const isSettlementStatus = (
  value: string | null
): value is SettlementStatus =>
  value !== null &&
  (SettlementStatusSchema.options as readonly string[]).includes(value);

/**
 * The list.
 *
 * `brandId` is the endpoint's own filter and it takes an ID, not a name — there
 * is no name search on this route and inventing one in the browser would only
 * filter the page already downloaded, which on a cursor-paged list is a lie
 * about what was searched. The screen says so instead.
 */
export function useSettlementRuns(
  status: SettlementStatus | null,
  brandId: string
): CursorFeed<SettlementRun> {
  const trimmed = brandId.trim();
  return useCursorFeed(
    `admin-settlement-runs:${status ?? "all"}:${trimmed}`,
    true,
    (cursor, signal) =>
      api.get(settlementRunPageSchema, RUNS_PATH, {
        signal,
        query: {
          status: status ?? undefined,
          brandId: trimmed || undefined,
          cursor: cursor ?? undefined,
        },
      })
  );
}

/**
 * The run, plus ONE PAGE of the ledger lines behind its figure.
 *
 * The lines are paginated by the API — deliberately, since a monthly run on a
 * busy brand covers hundreds — which means the sum check on the detail screen
 * cannot run until they have all been fetched. `loadMoreLines` walks the cursor
 * and appends, and the screen refuses to give a verdict while `nextCursor` is
 * still set. See `run-rules.ts`.
 */
export function useSettlementRun(id: string): Resource<SettlementRunDetail> {
  return useResource(`admin-settlement-run:${id}`, true, (signal) =>
    api.get(settlementRunDetailSchema, `${RUNS_PATH}/${id}`, { signal })
  );
}

export const fetchRunLines = (id: string, cursor: string, signal?: AbortSignal) =>
  api
    .get(settlementRunDetailSchema, `${RUNS_PATH}/${id}`, {
      signal,
      query: { cursor },
    })
    .then((detail) => detail.entries);

/** See the header: the body of this response is not in any contract. */
const unparsed = z.unknown();

/**
 * Mark the run.
 *
 * The body is validated against the contract BEFORE the request, so a note
 * longer than the 300 characters the API accepts is refused here with a
 * sentence rather than there with a 400 somebody has to interpret.
 */
export const markSettlementRun = (id: string, status: RunMark, note: string) =>
  api.patch(
    unparsed,
    `${RUNS_PATH}/${id}`,
    markSettlementBodySchema.parse({
      status,
      ...(note.trim() ? { note: note.trim() } : {}),
    })
  );

/** True when the note as typed would be accepted by the contract. */
export const isNoteAcceptable = (note: string): boolean =>
  markSettlementBodySchema.safeParse({
    status: "CANCELLED",
    ...(note.trim() ? { note: note.trim() } : {}),
  }).success;

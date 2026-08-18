/**
 * Settlement fixtures, parsed by the contract's OWN schemas at module load, so
 * a fixture that drifts fails here rather than making every test below pass
 * against a shape the API does not send.
 */
import {
  settlementRunDetailSchema,
  settlementRunPageSchema,
} from "@loqal/contracts/settlement.contract";

const BRAND = "0199dddd-0000-7000-8000-000000000001";

/** Loqal holds card money for this brand. The only honest mark is SENT. */
export const owedRun = {
  id: "0199eeee-0000-7000-8000-000000000001",
  brandId: BRAND,
  brandName: "Nile Ceramics",
  periodStart: "2026-07-01T00:00:00.000Z",
  periodEnd: "2026-07-31T23:59:59.000Z",
  netAmount: "999.50",
  direction: "WE_PAY",
  status: "PENDING",
  settlementMethod: "INSTAPAY",
  settlementDetails: "nile.ceramics@instapay",
  markedBy: null,
  markedAt: null,
  note: null,
  createdAt: "2026-08-01T00:00:00.000Z",
} as const;

/** The brand holds cash Loqal is owed. The only honest mark is RECEIVED. */
export const owingRun = {
  ...owedRun,
  id: "0199eeee-0000-7000-8000-000000000002",
  brandName: "Maadi Textiles",
  netAmount: "-420.00",
  direction: "THEY_PAY",
  settlementMethod: null,
  settlementDetails: null,
} as const;

/** Already closed. Nothing further can be done to it, ever. */
export const sentRun = {
  ...owedRun,
  id: "0199eeee-0000-7000-8000-000000000003",
  status: "SENT",
  markedBy: "0199ffff-0000-7000-8000-000000000001",
  markedAt: "2026-08-02T10:00:00.000Z",
  note: "InstaPay ref 88213",
} as const;

export const runsPage = settlementRunPageSchema.parse({
  items: [owedRun, owingRun],
  nextCursor: null,
});

export const runsPageWithCursor = settlementRunPageSchema.parse({
  items: [owedRun, owingRun],
  nextCursor: owingRun.id,
});

export const emptyRunsPage = settlementRunPageSchema.parse({
  items: [],
  nextCursor: null,
});

const lines = [
  {
    id: "0199a2a2-0000-7000-8000-000000000001",
    brandId: BRAND,
    brandOrderId: "0199cccc-0000-7000-8000-000000000001",
    type: "SALE",
    amount: "1200.00",
    note: null,
    createdAt: "2026-07-04T10:00:00.000Z",
  },
  {
    id: "0199a2a2-0000-7000-8000-000000000002",
    brandId: BRAND,
    brandOrderId: "0199cccc-0000-7000-8000-000000000001",
    type: "COMMISSION",
    amount: "-180.00",
    note: null,
    createdAt: "2026-07-04T10:00:01.000Z",
  },
  {
    id: "0199a2a2-0000-7000-8000-000000000003",
    brandId: BRAND,
    brandOrderId: null,
    type: "DISCOUNT",
    amount: "-20.50",
    note: "Launch voucher",
    createdAt: "2026-07-09T08:00:00.000Z",
  },
] as const;

/** Every line loaded, and they add up to the figure on the run. */
export const agreeingDetail = settlementRunDetailSchema.parse({
  run: owedRun,
  entries: { items: lines, nextCursor: null },
});

/** Every line loaded, and they DO NOT add up. Do not mark this run. */
export const disagreeingDetail = settlementRunDetailSchema.parse({
  run: owedRun,
  entries: { items: [lines[0]], nextCursor: null },
});

/** A page remains, so there is no verdict to give yet. */
export const partialDetail = settlementRunDetailSchema.parse({
  run: owedRun,
  entries: { items: [lines[0]], nextCursor: lines[0].id },
});

/** The rest of the lines, for the walk that completes `partialDetail`. */
export const remainingLinesPage = settlementRunDetailSchema.parse({
  run: owedRun,
  entries: { items: [lines[1], lines[2]], nextCursor: null },
});

export const theyPayDetail = settlementRunDetailSchema.parse({
  run: owingRun,
  entries: { items: [], nextCursor: null },
});

export const markedDetail = settlementRunDetailSchema.parse({
  run: sentRun,
  entries: { items: lines, nextCursor: null },
});

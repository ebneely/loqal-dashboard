"use client";

/**
 * WHICH SHOPS THIS REP MAY ACTUALLY PRICE — and why the console has to keep
 * the answer itself.
 *
 * THE BINDING, AS THE BACKEND ACTUALLY EXPRESSES IT
 *
 * `SalesService.setTerms` refuses any brand the calling rep did not sign, and
 * the link it checks is `Brand.applicationId -> BrandApplication.reviewedBy`
 * (`SalesBrandApplicationRepository.isSignedBy`). `reviewedBy` is stamped in
 * exactly one place: `SalesService.registerShop`, when the rep sends a `slug`
 * and the deal closes on the spot. There is no `Brand.signedByRepId` column.
 *
 * Three consequences, all of which this console has to render truthfully:
 *
 *  1. A shop the rep filed as a LEAD (no slug) has no Brand at all. Nothing to
 *     price, today or ever from here.
 *  2. A lead an ADMIN approves later gets the ADMIN's id in `reviewedBy`. The
 *     rep who captured it is refused for good. That is fail-closed by design
 *     and it is not a bug this screen may paper over.
 *  3. Every brand that existed before a rep registered it — the five seeded
 *     ones included — has no application at all, so no rep is bound to any of
 *     them.
 *
 * THE GAP THAT FORCES THIS FILE TO EXIST
 *
 * The sales plane is four routes: `GET /v1/sales/pack`, `POST /v1/sales/brands`,
 * `GET /v1/sales/terms/band`, `POST /v1/sales/brands/:brandId/terms`. NONE of
 * them lists brands, and none of them answers "am I bound to this brand?"
 * without also writing to it. `GET /v1/admin/brands` is SUPER_ADMIN-only.
 *
 * So the ONLY brand ids this console can honestly offer are the ones it watched
 * the rep create in this browsing session, and the only place to keep them is
 * this device. That is a real limitation, not a design choice, and every screen
 * that uses this module says so in words rather than implying the list is
 * Loqal's record of what the rep has signed.
 *
 * WHY NOT JUST TRY THE WRITE AND HANDLE THE 404
 *
 * Because `setTerms` answers 404 — never 403 — for a brand that is not this
 * rep's, deliberately, so a lost phone cannot enumerate the platform. A screen
 * that offered a "Set the offer" button for an arbitrary id would be a button
 * whose only outcome is a refusal, and the refusal would read as "no such shop"
 * to a rep standing in front of that shop. Un-actionable, with the reason in
 * words, is the honest rendering.
 *
 * WHY sessionStorage AND NOT localStorage
 *
 * `UserRole.SALES` is described in prisma/schema.prisma as the easiest
 * credential in the system to lose. A phone left on a counter should not carry
 * a durable list of the shops a rep has signed. It survives a reload and dies
 * with the tab, which is exactly what the catalogue already promises in
 * `t.sales.draftNote`.
 */

/**
 * A brand this console watched the rep create, with the slug it was created
 * under. Nothing else off the register response is kept: `POST /v1/sales/brands`
 * answers with the brand's whole own-dashboard projection (`OWN_FIELDS`), which
 * carries `status`, `legalName`, `taxNumber`, `invoiceAddress` and every
 * commercial column whether the rep set it or not. A field-sales device stores
 * the three things it needs to name a shop, and drops the rest on the floor.
 */
export type SignedBrand = {
  brandId: string;
  name: string;
  slug: string;
  /** The application whose `reviewedBy` is what actually binds the two. */
  applicationId: string | null;
  signedAt: string;
};

/** An application filed without a slug. No Brand exists for it. */
export type FiledLead = {
  applicationId: string;
  businessName: string;
  filedAt: string;
};

export type SalesLedger = {
  signed: readonly SignedBrand[];
  leads: readonly FiledLead[];
};

export const EMPTY_LEDGER: SalesLedger = { signed: [], leads: [] };

/**
 * Why a shop on screen cannot be priced from here. A closed set, because each
 * member gets its own sentence — "you cannot do that" with no reason is what
 * makes a rep phone the office.
 */
export type BlockedReason =
  /**
   * The console has no record of this rep registering this brand. Could be
   * another rep's shop, an admin-approved one, a pre-existing one, or one this
   * rep signed from a different device — and the API deliberately answers all
   * four identically, so the screen must not guess between them.
   */
  | "NOT_YOURS"
  /** Filed as a lead. No Brand row exists, so there is nothing to price. */
  | "LEAD_NOT_CLOSED";

export type SalesBinding =
  | { actionable: true; brand: SignedBrand }
  | { actionable: false; reason: BlockedReason };

/**
 * The one decision this console makes about authorization, as a pure function.
 *
 * It is deliberately NARROWER than the API's own rule and never wider: a rep
 * who signed a shop yesterday on another phone is told no here and would be
 * told yes by the API. Erring the other way means drawing a button that only
 * ever produces a refusal, which is the thing this console must not do.
 */
export function bindingFor(
  brandId: string,
  ledger: SalesLedger
): SalesBinding {
  const brand = ledger.signed.find((row) => row.brandId === brandId);
  if (brand) return { actionable: true, brand };
  return { actionable: false, reason: "NOT_YOURS" };
}

/** Every row the /terms screen draws, actionable ones first. */
export type TermsCandidate =
  | { kind: "brand"; brand: SignedBrand }
  | { kind: "lead"; lead: FiledLead };

export function termsCandidates(ledger: SalesLedger): TermsCandidate[] {
  const signed = [...ledger.signed]
    .sort((a, b) => Date.parse(b.signedAt) - Date.parse(a.signedAt))
    .map((brand) => ({ kind: "brand" as const, brand }));

  const leads = [...ledger.leads]
    .sort((a, b) => Date.parse(b.filedAt) - Date.parse(a.filedAt))
    .map((lead) => ({ kind: "lead" as const, lead }));

  return [...signed, ...leads];
}

// ---------------------------------------------------------------------------
// The device side
// ---------------------------------------------------------------------------

/**
 * Keyed by rep id, so a second rep signing in on the same phone starts empty
 * rather than inheriting a list the API would refuse for them anyway.
 */
export const ledgerKey = (repId: string) => `loqal.sales.ledger.${repId}`;

/** Storage is optional everywhere: SSR has none, and a locked-down browser may refuse. */
function store(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const str = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

/**
 * Parsed defensively rather than trusted. This is a browser-owned string a user
 * can edit; a malformed entry drops out silently instead of taking the screen
 * down, and — because a forged entry only ever adds a brand id the API will
 * refuse anyway — nothing here is a security boundary.
 */
export function parseLedger(raw: string | null): SalesLedger {
  if (!raw) return EMPTY_LEDGER;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return EMPTY_LEDGER;
  }
  if (!isRecord(parsed)) return EMPTY_LEDGER;

  const signed: SignedBrand[] = [];
  for (const row of Array.isArray(parsed.signed) ? parsed.signed : []) {
    if (!isRecord(row)) continue;
    const brandId = str(row.brandId);
    const name = str(row.name);
    const slug = str(row.slug);
    if (!brandId || !name || !slug) continue;
    signed.push({
      brandId,
      name,
      slug,
      applicationId: str(row.applicationId),
      signedAt: str(row.signedAt) ?? new Date(0).toISOString(),
    });
  }

  const leads: FiledLead[] = [];
  for (const row of Array.isArray(parsed.leads) ? parsed.leads : []) {
    if (!isRecord(row)) continue;
    const applicationId = str(row.applicationId);
    const businessName = str(row.businessName);
    if (!applicationId || !businessName) continue;
    leads.push({
      applicationId,
      businessName,
      filedAt: str(row.filedAt) ?? new Date(0).toISOString(),
    });
  }

  return { signed, leads };
}

export function readLedger(repId: string): SalesLedger {
  const storage = store();
  if (!storage || !repId) return EMPTY_LEDGER;
  try {
    return parseLedger(storage.getItem(ledgerKey(repId)));
  } catch {
    return EMPTY_LEDGER;
  }
}

export function writeLedger(repId: string, ledger: SalesLedger): void {
  const storage = store();
  if (!storage || !repId) return;
  try {
    storage.setItem(ledgerKey(repId), JSON.stringify(ledger));
  } catch {
    /* A full or disabled store loses the list, not the screen. */
  }
}

/** De-duplicating on brand id: registering the same slug twice is a 409 anyway. */
export function withSignedBrand(
  ledger: SalesLedger,
  brand: SignedBrand
): SalesLedger {
  return {
    signed: [
      brand,
      ...ledger.signed.filter((row) => row.brandId !== brand.brandId),
    ],
    leads: ledger.leads.filter(
      (lead) => lead.applicationId !== brand.applicationId
    ),
  };
}

export function withFiledLead(
  ledger: SalesLedger,
  lead: FiledLead
): SalesLedger {
  return {
    signed: ledger.signed,
    leads: [
      lead,
      ...ledger.leads.filter((row) => row.applicationId !== lead.applicationId),
    ],
  };
}

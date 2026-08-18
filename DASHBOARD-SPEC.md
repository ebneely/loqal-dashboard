# Loqal Dashboard — Wireframe Spec

The screen inventory the dashboard must cover, derived from `prisma/schema.prisma`,
the controllers in `apps/loqal-backend/src/modules`, and `docs/user-stories.md`.

This is the input for wireframing. One section per role. Every screen names its
data source and whether the API exists today.

---

## 0. Scope decision — this is three consoles, not one

`UserRole` has five values and three of them log into a dashboard:

| Console | Roles | Primary device | Why |
|---|---|---|---|
| **Brand** | `BRAND_OWNER`, `BRAND_EMPLOYEE` | **Phone** | A shop owner runs their shop from behind a counter. They will never open a laptop to confirm an order. |
| **Admin** | `SUPER_ADMIN` | Desktop, must not break on a phone | Settlement, moderation, terms. Desk work with money on screen. |
| **Sales** | `SALES` | **Phone only** | Field rep standing inside a prospect's shop. Nothing else exists on this device. |

`SHOPPER` and guests are the storefront, not this app.

Build them as one Next.js app with three route groups and one shared design
system. Do not build one dashboard with a role switcher — the three have almost
no screens in common, and a shared shell is how a brand ends up one query
parameter away from an admin screen.

---

## 1. Design constraints that apply to every screen

1. **Mobile-first means designed at 390px, then widened.** Not a desktop layout
   that reflows. Draw the phone frame first for every Brand and Sales screen.
2. **Bilingual AR/EN with real RTL.** Egyptian market, and `Product.name` /
   `Brand.description` are `{ ar, en }` JSON. Layout must mirror, not just
   translate. Decide this in the design system, not per screen.
3. **No data tables on phone.** Every list is a card stack. The table is the
   desktop widening of the same component.
4. **Primary action in thumb reach.** Bottom bar or bottom sheet, not a top-right
   button.
5. **Every list needs four states drawn:** loading, empty, error, and
   permission-denied. The denied state is part of RBAC, not an afterthought.
6. **Money is `Decimal(10,2)` EGP.** Never a float, never a currency selector.
7. **Every destructive action is a bottom sheet with the consequence written out**,
   because the device is a phone in a busy shop.

---

## 2. RBAC matrix

Source of truth: `@Roles()` on each controller.

| Capability | SHOPPER | BRAND_EMPLOYEE | BRAND_OWNER | SALES | SUPER_ADMIN |
|---|:--:|:--:|:--:|:--:|:--:|
| View own brand profile | – | ✅ | ✅ | – | ✅ |
| **Edit** brand profile (`PATCH /brands/me`) | – | ❌ | ✅ | – | ✅ |
| Products CRUD (own brand) | – | ✅ | ✅ | – | ✅ |
| Stock adjustments | – | ✅ | ✅ | – | ✅ |
| Media upload | – | ✅ | ✅ | – | ✅ |
| Chat threads (own brand) | – | ✅ | ✅ | – | – |
| Reply to reviews | – | ✅ | ✅ | – | – |
| Brand analytics summary | – | ✅ | ✅ | – | ✅ |
| Orders / fulfilment (own brand) | – | ✅ | ✅ | – | ✅ |
| Money: ledger, settlement, invoices | – | ❌ | ✅ | – | ✅ |
| Payout details (`settlementMethod/Details`) | – | ❌ | ✅ | – | ✅ |
| Brand applications approve/reject | – | – | – | – | ✅ |
| Create brand + set commercial terms | – | – | – | – | ✅ |
| Set promotion (`isPromoted`) | – | – | – | ✅ | ✅ |
| Reputation score (manual 0–100) | – | – | – | – | ✅ |
| Verified badges | – | – | – | – | ✅ |
| Categories (global taxonomy) | – | – | – | – | ✅ |
| Hide a review | – | – | – | – | ✅ |
| Settlement runs mark sent/received | – | – | – | – | ✅ |
| Try-on models + budget settings | – | – | – | – | ✅ |
| Platform analytics overview | – | – | – | – | ✅ |
| Sales pack (market demand) | – | – | – | ✅ | ✅ |

**Owner vs employee is the only intra-console split.** Draw those four screens
twice — once whole, once with the money and payout blocks absent. Not greyed
out: absent. A disabled field still tells an employee what the payout account is.

**SALES sees no customer data and no other brand's dashboard.** Per
`schema.prisma:53` — a field device in a shop is the easiest thing here to lose.

---

## 3. Brand console — screen inventory

Phone-first. ~15 screens.

### Auth
| # | Screen | Source | API |
|---|---|---|---|
| B0 | Sign in | Better Auth | ✅ |
| B1 | **Forced password change** — first login only | `User.mustChangePassword` | ✅ |
| B2 | Set password from invite link | `Verification` | ✅ |

### Home
| # | Screen | Source | API |
|---|---|---|---|
| B3 | **Today** — the only screen most brands open. Orders awaiting shelf-check, low stock, unread chat, balance. | derived | partial |

`PENDING_BRAND` is the hero count. That status means *stock is held, not
committed, waiting for a human to look at the shelf* — it is the one thing that
makes the brand open the app.

### Orders and fulfilment
| # | Screen | Source | API |
|---|---|---|---|
| B4 | Orders list, filtered by `BrandOrderStatus` | `BrandOrder` | ❌ **not built** |
| B5 | Order detail — items, shopper name/phone/address, status timeline | `BrandOrder`, `OrderItem`, `OrderStatusHistory` | ❌ |
| B6 | Fulfil: confirm → `PACKED` → `HANDED_OVER` → `DELIVERED` | `BrandOrderStatus` | ❌ |
| B7 | Mark delivery failed (`DELIVERY_FAILED`) — restocks, no refund on COD | | ❌ |
| B8 | Returns list + approve/reject/restock | `Return`, `ReturnStatus`, `ReturnRoute` | ❌ |

**The single hardest rule to get right in the wireframe:** a brand sees *its
slice* of an order and nothing else. No parent `Order`, no other brand's items,
no order total, **no customer list and no export** (US-BRAND-011). If your order
screen has a "Customers" tab, it is wrong.

Delivery route changes the whole screen. `RIDER_PER_BRAND` prompts the *shopper*
to book a rider once the brand marks the parcel ready — so B6 needs a "ready for
pickup" state that does nothing but notify. `BRAND_OWN_DELIVERY` needs a manual
tracking field. `SHIPPING_SERVICE` is not live and must never render.

### Catalog
| # | Screen | Source | API |
|---|---|---|---|
| B9 | Products list — card grid, status filter | `GET /v1/dashboard/products` | ✅ |
| B10 | Product editor — AR/EN tabs, variants, media | `POST/PATCH /v1/dashboard/products` | ✅ |
| B11 | Variant editor — SKU, price, stock per variant | `.../variants` | ✅ |
| B12 | **Bulk photo drop → draft grid** (US-BRAND-005) | `POST /v1/dashboard/media/uploads` | ✅ |
| B13 | Publish / archive (`ProductStatus`) | `.../status` | ✅ |

B12 is the screen that wins brands. Drop 40 photos, each becomes a `DRAFT`
product, then fill names and prices in a **grid**, not a wizard. Design it as
bulk data entry on a phone — that is the hard part and it is the point.

Archive never deletes. Past orders reference the product forever.

### Inventory
| # | Screen | Source | API |
|---|---|---|---|
| B14 | Stock per variant — **available vs reserved shown separately** | `GET /v1/dashboard/inventory/variants/:id` | ✅ |
| B15 | Adjust stock, reason required | `StockAdjustmentReason` | ✅ |
| B16 | Adjustment history | `.../adjustments` | ✅ |

Never merge available and reserved into one number (US-BRAND-010). Availability
is `stockOnHand` minus active reservations, computed, never stored.

### Chat
| # | Screen | Source | API |
|---|---|---|---|
| B17 | Thread inbox, unread badges | `GET /v1/dashboard/chat/threads` | ✅ |
| B18 | Thread view, attachments (5 MB, images + PDF) | `.../messages` | ✅ |

Show the WhatsApp fall-through timer state — after
`chatUnansweredThresholdMinutes` (30) an unanswered thread escalates to the
brand's `notificationPhone`. The brand should see that coming.

### Reputation
| # | Screen | Source | API |
|---|---|---|---|
| B19 | Reviews + reply | `GET/PATCH /v1/brands/me/reputation` | ✅ |
| B20 | Badges — computed vs verified, and what is needed to earn each | `BrandBadge`, `VerifiedBadge` | ✅ |

B20 must distinguish **computed** badges (earned from delivered orders — needs
`badgeMinOrderCount` 20 over `badgeWindowDays` 60) from **verified** badges
(issued by admin). A brand must never be able to tick a box and wear a badge.

### Money — `BRAND_OWNER` only
| # | Screen | Source | API |
|---|---|---|---|
| B21 | Balance — **signed**: positive we owe them, negative they owe us | `SUM(LedgerEntry.amount)` | ❌ |
| B22 | Ledger — append-only, corrections are reversing entries | `LedgerEntry` | ❌ |
| B23 | Settlement runs + direction `WE_PAY` / `THEY_PAY` | `SettlementRun` | ❌ |
| B24 | Invoice per **brand order** | no `Invoice` model yet | ❌ |

The signed balance is the whole design problem here. Card orders settle to
Loqal, cash orders settle to the brand, so the same brand is owed money one week
and owes it the next. One signed figure, one screen — not two half-ledgers.

**Shipping never appears in the ledger.** If a money screen shows a delivery fee
in the balance, it is wrong.

### Settings — `BRAND_OWNER` only for the payout block
| # | Screen | Source | API |
|---|---|---|---|
| B25 | Brand profile — name, logo, cover, AR/EN description | `PATCH /v1/brands/me` | ✅ |
| B26 | Trading terms — `deliveryFee`, `returnWindowDays`, `minimumOrderValue`, `supportedDelivery` | Brand | ✅ |
| B27 | Invoice identity — `legalName`, `taxNumber`, `invoiceAddress` | Brand | ✅ |
| B28 | Payout — `settlementMethod`, `settlementDetails` (**owner only**) | Brand | ✅ |
| B29 | Analytics summary | `GET /v1/brands/me/analytics/summary` | ✅ |

`stockSetup` and commercial terms (`monthlyFee`, `perOrderCharge*`, `freeUntil`)
are **read-only** to the brand — admin sets them. Show them, do not let them be
edited.

---

## 4. Admin console — screen inventory

Desktop-first, must survive a phone. ~15 screens.

| # | Screen | Source | API |
|---|---|---|---|
| A1 | Applications queue → approve / reject with reason | `GET/POST /v1/admin/brand-applications` | ✅ |
| A2 | Brands list — status, GMV, balance, badges | Brand | partial |
| A3 | Brand detail — one page, everything about one brand | Brand | partial |
| A4 | **Commercial terms** — `freeUntil`, `monthlyFee`, `perOrderChargeType/Value`, `settlementCadence/Anchor/Method/Details` | `PATCH /v1/brands/:id/terms` | ✅ |
| A5 | Suspend / reactivate brand — in-flight orders still complete | `BrandStatus` | partial |
| A6 | Placement — `featuredUntil`, `sortOrder`, `isPromoted` | `PATCH /v1/admin/brands/:id/promotion` | ✅ |
| A7 | Reputation score 0–100, manual, with who/when | `PATCH .../reputation-score` | ✅ |
| A8 | Verified badges issue / revoke | `POST /v1/admin/verified-badges` | ✅ |
| A9 | Category tree — create, rename, reparent, reorder, delete | `/v1/admin/categories` | ✅ |
| A10 | Product moderation + status override | `PATCH /v1/admin/products/:id/status` | ✅ |
| A11 | **All orders, parent `Order` whole** — the only actor who sees this | Order | ❌ |
| A12 | Settlement runs — mark `SENT` / `RECEIVED` | `PATCH /v1/admin/settlement-runs/:id` | ✅ |
| A13 | Review moderation — hide | `POST /v1/admin/reviews/:id/hide` | ✅ |
| A14 | Try-on — models, budget governor, usage | `/v1/admin/try-on/settings` | ✅ |
| A15 | Platform settings — the whole `PlatformSetting` row | PlatformSetting | ❌ |
| A16 | Platform analytics overview | `GET /v1/admin/analytics/overview` | ✅ |
| A17 | Catalog import for a brand (US-ADMIN-002) | `ImportSource`, `ImportJob`, `ImportItem` | ❌ |

**A12 is the screen the business runs on.** Nothing moves money on its own — a
human marks each run sent or received. Design it so a wrong figure is obvious
before the button is pressed: period, ledger lines behind the number, direction,
method, and the account it goes to, all on one screen.

**A6 must render the promoted label.** Selling placement is fine; selling the
appearance of trust is not. `brands.repository.ts:57` currently orders by
`isPromoted` without selecting it — the wireframe should make it impossible to
ship a list that ranks by paid placement without saying so.

**A14 budget governor** — at 85% of `tryOnMonthlyBudgetCents` it drops to the
fallback model, at 100% it serves cache only. Draw that as a gauge with the two
thresholds marked, not a number in a settings form.

---

## 5. Sales console — screen inventory

Phone only. Three screens, no more.

| # | Screen | Source | API |
|---|---|---|---|
| S1 | **Sales pack** — market demand, traffic proof, anonymised category comparison | Analytics, k-anonymity floor 3 | ❌ |
| S2 | Register a brand in the room — application/brand creation | BrandApplication / Brand | ❌ for SALES |
| S3 | Set terms within the band — `defaultFreeMonths` prefilled, `salesCommissionFloorBps` / `salesMaxFreeMonths` bounds | PlatformSetting + Brand | partial |

S1 must respect `analyticsKAnonymityFloor` (3). Below three brands, "brands in
your category average X" is one competitor's private revenue, and the screen
must show a *blocked* state rather than a number.

**Gap:** `POST /v1/brands` is `SUPER_ADMIN` only today, so S2 has no route a
SALES user can call. Wireframe it anyway — the screen is the spec for the
endpoint.

---

## 6. Business rules that must be visible in the wireframes

These are the ones a plausible-looking dashboard gets wrong:

1. A brand sees **its slice** of an order, never the parent, never another
   brand's items, and there is **no customer list and no export**.
2. Stock shows **available and reserved separately**. Availability is computed.
3. Brand balance is **derived from the ledger and signed**. Never a stored total.
4. Commission is the rate that applied **when the order was placed**, not today's.
5. **Archive, never delete.**
6. Ledger is **append-only**; a correction is a reversing entry.
7. **Shipping money never enters the ledger.**
8. Paid placement is **always labelled**.
9. Computed badges are **earned**, never toggled.
10. A refused COD order is a `DELIVERY_FAILED`, **not a return** — nothing was
    paid, so there is nothing to refund and no ledger entry.
11. `SHIPPING_SERVICE` exists in the schema but is **not live** — it must never
    appear in any UI until a courier contract is signed.
12. Every money figure is EGP, `Decimal(10,2)`.

---

## 7. Build order

Wireframe in this order. Each batch is one design document.

| Batch | Contents | Why here |
|---|---|---|
| **1** | Design system: tokens, RTL/LTR mirroring, card-list ↔ table component, status pill per enum, money row, four list states, bottom-sheet action pattern | Every later batch inherits it. Doing this after the screens means redrawing them. |
| **2** | Brand shell + B3 Today + B0–B2 auth | Proves the nav and the one screen that gets opened daily. |
| **3** | Brand orders B4–B8 | Highest business risk, and the RBAC slice rule lives here. |
| **4** | Brand catalog B9–B13 + inventory B14–B16 | B12 bulk drop is the brand-acquisition screen. |
| **5** | Brand money B21–B24 + settings B25–B29, drawn twice for owner vs employee | The only intra-console RBAC split. |
| **6** | Brand chat B17–B18 + reputation B19–B20 | Self-contained, APIs already exist. |
| **7** | Admin shell + A1–A8 (brand lifecycle) | |
| **8** | Admin A9–A17 (operations, money, settings) | A12 settlement is the one to spend time on. |
| **9** | Sales S1–S3 | Smallest, and depends on decisions made in batch 8. |

Batches 2, 3, 4 and 6 have working APIs today — those can go from wireframe to
built immediately. Batches 3 (orders), 5 (money) and 9 (sales) are wireframing
*ahead* of the backend; the wireframe becomes the endpoint spec.

---

## 8. Backend gaps this spec exposes

Wireframing the whole business surfaces what is not built. In dependency order:

1. **No orders module.** `src/modules/` has no `orders/` — no checkout, no
   brand-order list, no fulfilment transitions. Waves 4 and 5 of the build plan.
2. **No returns or shipments endpoints**, though `Return` and `Shipment` are
   modelled.
3. **No ledger, balance or settlement-run read API** for a brand. Only the admin
   `PATCH` exists.
4. **No `Invoice` model at all**, despite invoices being a named deliverable.
5. **No import module**, though `ImportSource` / `ImportJob` / `ImportItem` exist.
6. **No SALES-callable brand creation**, so the whole Sales console is unroutable.
7. **No platform-settings write API** for the `PlatformSetting` row.
8. `UserRole.ADMIN → SUPER_ADMIN` rename is planned but not applied.

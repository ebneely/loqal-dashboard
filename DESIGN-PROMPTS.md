# Claude Design prompts — full dashboard UI

Three prompts, one per console. Each is self-contained: business primer, every
screen, the rules that must not break, and the output contract.

Paste one at a time into Claude Design with the **Loqal Design System** selected
and the **Console screen** template (use plain **UI mockups** only for prompt 1's
auth screens, which have no shell).

Append `## OUTPUT CONTRACT` (bottom of this file) to the end of every prompt.

---

## PROMPT 1 — Brand console (the big one)

```
Loqal brand dashboard — the complete brand console. Production-fidelity screens,
not sketches. Every screen listed below, all states.

## The business

Loqal is a marketplace for small Egyptian brands, most of them offline shops
with no website. A shopper can buy from several brands in one basket and one
checkout, but each brand fulfils its own half independently and never sees the
other's.

This console is used by a shop owner (role BRAND_OWNER) or their staff
(BRAND_EMPLOYEE), on a phone, standing behind the counter of a real shop.
Phone-first is not a preference here — a laptop is not present.

Currency is Egyptian pounds only, two decimals, no currency selector.
Interface is Arabic and English with true RTL mirroring.

Design at 390px first, then md (768px) and lg (1024px). shadcn only, using the
attached design system.

## Roles

Owner and employee see the SAME data everywhere except money and payout details.
For an employee those screens and their nav entries are ABSENT, never disabled —
a greyed-out field still tells an employee what the payout account is. Drive
this off a role prop typed "BRAND_OWNER" | "BRAND_EMPLOYEE" and emit both
variants wherever they differ.

## Screens

### Auth (no app shell)
1. /sign-in — email and password only. No social login, no sign-up link: brand
   accounts are issued by an admin and never self-created. Include the
   invalid-credentials state.
2. /set-password — first login only, because credentials were issued by an
   admin. Cannot be navigated away from. Include the emailed-invite variant and
   its expired-link state.

### Shell
3. Sidebar collapsing to Sheet on mobile. Nav: Today, Orders, Products,
   Inventory, Chat, Reviews, Money, Settings. Money is owner-only and absent for
   an employee.

### Today
4. /today — a prioritised feed of what needs a human, NOT a metrics dashboard:
   a. Orders awaiting a shelf check — the hero. The platform's stock number is
      only a copy of what the shop last told us, so nothing is promised to a
      shopper until a person physically looks at the shelf. These orders are
      held, not committed, and each is a shopper waiting. Row: order number,
      item count, how long it has waited, one primary action to confirm or
      reject against the shelf.
   b. Orders packed, waiting to be handed to whoever delivers.
   c. Low stock per variant.
   d. Unread customer messages.
   e. Balance — a SIGNED EGP figure. Owner only.
   Emit four states: work waiting, empty, loading skeleton, error.

### Orders and fulfilment
5. /orders — list filtered by status. Card stack below md, Table at md+.
   Statuses: PENDING_VERIFICATION, PENDING_PAYMENT, PENDING_BRAND, CONFIRMED,
   PACKED, HANDED_OVER, DELIVERED, DELIVERY_FAILED, RETURN_REQUESTED, RETURNED,
   CANCELLED, REFUNDED.
6. /orders/[id] — items, shopper name, phone and delivery address, payment
   method, delivery route, and a status timeline of every transition with who
   made it and when.
7. Fulfilment actions on that screen, as a progression:
   confirm against the shelf → PACKED → HANDED_OVER → DELIVERED.
   The available action depends entirely on the delivery route:
   - RIDER_PER_BRAND: the SHOPPER books and pays the rider themselves, and is
     only prompted once the brand marks the parcel ready. So this route needs a
     "ready for pickup" state whose only effect is to notify the shopper. The
     brand never books anything. Prepaid only — there is nobody to hand cash to.
   - BRAND_OWN_DELIVERY: the brand uses its own driver or its own Bosta/Mylerz
     account. Manual courier name and tracking number fields. Can collect cash.
   - SHIPPING_SERVICE: NOT LIVE. There is no courier contract. It must never
     render anywhere in this UI. Do not design it.
8. Mark delivery failed (DELIVERY_FAILED) — the shopper refused it at the door.
   Stock returns to available. For a cash order there is nothing to refund, so
   the screen must not offer one.
9. /returns — list, and approve / reject / restock. A return is per brand order,
   never per parent order: one brand's items may come back while another's stay.
   The window in days is per brand, not a platform constant, so show it as a
   deadline on each request. Approval restocks the item and writes an audit row.
   Statuses: REQUESTED, APPROVED, REJECTED, RESTOCKED. Route is COURIER or
   WALK_IN — walk-in matters most here, because the customer often lives nearby
   and handing it back at the shop settles in minutes what a courier drags out
   for a week.

### Catalog
10. /products — card grid on mobile, table at md+. Filter by status. Show
    price-from and whether anything is in stock.
11. /products/[id] — editor with Arabic and English tabs. At least one language
    is required, never both. Bilingual fields: name, description.
12. Variant editor — every variant has its own SKU, price and stock, because
    size XL may legitimately cost more than S.
13. Bulk photo drop. THIS IS THE SCREEN THAT WINS BRANDS. A shop with no website
    drops 40 phone photos; each becomes a DRAFT product; then names and prices
    are filled in a GRID, not a wizard. It is bulk data entry, on a phone, and
    that is the hard part and the whole point. Show upload progress per file,
    and the grid with inline editing.
14. Publish and archive. Archived, NEVER deleted — past orders reference the
    product forever, and editing a product must never change what a past order
    says was bought.

### Inventory
15. /inventory — stock per variant, showing AVAILABLE and RESERVED as two
    separate figures. Never merge them into one number. Availability is stock on
    hand minus active reservations, computed, never stored.
16. Stock adjustment — a reason is REQUIRED on every change, so that "where did
    my stock go" always has an answer.
17. Adjustment history per variant, with reason, quantity delta, and who.

### Chat
18. /chat — thread inbox with unread badges. Threads come from registered
    shoppers and from guests who left only a first name and an email.
19. Thread view — messages, attachments (images and PDF only, 5 MB ceiling).
    Show the WhatsApp fall-through state: after 30 minutes unanswered, the
    conversation escalates to the shop's notification phone. The brand should
    see that countdown coming, not be surprised by it.

### Reputation
20. /reviews — reviews with a reply action.
21. Badges. Two kinds, and they must be visually distinct:
    - COMPUTED badges are earned from delivered orders over a rolling window and
      cannot be switched on. Show progress toward each: minimum order count in
      the window, same-day dispatch share, median minutes to confirm,
      cancellation rate.
    - VERIFIED badges are issued by the platform.
    A brand must never be able to tick a box and wear a badge — the day it can,
    every badge on the site is advertising.

### Money (BRAND_OWNER ONLY — absent for employees)
22. /money — balance. A SIGNED figure: positive means the platform owes this
    brand, negative means this brand owes the platform. Card orders settle to
    the platform and cash orders settle to the brand, so the SAME brand is owed
    money one week and owes it the next. One signed figure, one screen — never
    two half-ledgers. The sign must be unmistakable at a glance on a phone.
23. Ledger — append-only. A correction is a reversing entry, never an edit, so
    there is no edit or delete affordance anywhere on this screen. Entry types:
    SALE, COMMISSION, DISCOUNT, PAYOUT, REFUND, BRAND_PAYMENT.
24. Settlement runs — one per period, with direction WE_PAY or THEY_PAY and
    status PENDING, SENT, RECEIVED, CANCELLED. Read-only to the brand.
25. Invoice per BRAND ORDER, never per parent order — each brand files its own
    tax separately.

### Settings
26. Brand profile — name, logo, cover, Arabic and English description.
27. Trading terms the brand sets for itself: delivery fee charged to the
    shopper, return window in days, minimum order value, and which delivery
    routes it offers.
28. Invoice identity — legal name, tax number, invoice address, invoice terms.
    Each brand issues its own invoices; the platform is not the issuer.
29. Payout — method (bank transfer, InstaPay, mobile wallet) and the account
    behind it. OWNER ONLY.
30. Read-only commercial terms — free-until date, monthly fee, per-order charge,
    settlement cadence. The platform sets these; the brand can see them and
    cannot edit them. Show them as facts, not as a disabled form.
31. /analytics — the brand's own views, searches and conversion summary.

## Rules that must not break anywhere in this console

1. A brand sees only ITS slice of an order. Never the parent order, never
   another brand's items, never a combined total.
2. There is NO customer list and NO export. Shoppers are visible only inside an
   individual order being fulfilled.
3. Available and reserved stock are always two numbers.
4. Balance is derived from the ledger and signed. Never a stored total.
5. Archive, never delete.
6. The ledger is append-only.
7. Shipping money NEVER appears in the ledger. If a delivery fee shows up in a
   balance, the screen is wrong.
8. Computed badges are earned, never toggled.
9. A refused cash order is a failed delivery, not a return: nothing was paid, so
   there is nothing to refund and no ledger entry.
10. SHIPPING_SERVICE never renders.
11. Primary actions sit in thumb reach at the bottom on mobile, never top right.
12. Every list gets four states drawn for real: loading, empty, error, and
    permission-denied. Permission-denied is a first-class screen, not a toast.
```

---

## PROMPT 2 — Admin console

```
Loqal admin console — the complete platform back office. Production-fidelity
screens, not sketches.

## The business

Loqal is a marketplace for small Egyptian brands. This console belongs to one
role, SUPER_ADMIN, and it is the only actor that sees the platform whole: every
brand, every parent order, and all the money.

Desktop-first, but it must not break on a phone — approvals and settlement get
checked on the move. shadcn only, using the attached design system. Arabic and
English with true RTL. Egyptian pounds only.

## Screens

1. /applications — the queue of brands applying to join. A public form, no
   password and NO account created. Approve creates the brand, issues
   credentials by a one-time invite link (never a plaintext password by email),
   and starts indexing. Reject records a reason and creates nothing, leaving no
   orphan user behind. Statuses: PENDING, APPROVED, REJECTED.
2. /brands — every brand, with status, gross sales, current signed balance and
   badges.
3. /brands/[id] — one page holding everything about one brand.
4. Commercial terms editor. Every brand negotiates a different deal:
   free-until date, monthly fee, per-order charge (a percentage OR a fixed EGP
   amount), settlement cadence (weekly, twice weekly, monthly) with its anchor
   day, settlement method and the account behind it. These are per-brand data,
   not platform rules, so the form must make the current deal obvious at a
   glance and show what changed.
5. Suspend and reactivate a brand — for counterfeit goods, non-fulfilment or
   non-payment. A suspended brand vanishes from the storefront immediately, but
   its in-flight orders still complete. The confirmation must say both of those
   things in words.
6. Placement — featured-until date, sort order, and a paid-promotion flag.
   ANYTHING PROMOTED MUST BE LABELLED AS PROMOTED wherever it appears. Selling
   placement is fine; selling the appearance of trust burns every badge on the
   site. Design the list so it is impossible to rank by paid placement without
   saying so.
7. Reputation score — the platform's own judgement of a brand, 0 to 100, set by
   hand, with who set it and when. It sits BESIDE the computed badges and is
   never merged into one figure: a brand can ship on time and still argue with
   every customer, and no metric catches that.
8. Verified badges — issue and revoke.
9. /categories — the global taxonomy tree. Create, rename, reparent, reorder,
   delete. Drag to reorder on desktop, explicit move controls on mobile.
10. /products — moderation across all brands, with a status override.
11. /orders — every order, including the PARENT order that spans several brands.
    This is the only place in the entire system where a multi-brand order is
    visible whole. Show the parent with its per-brand children, each at its own
    independent fulfilment status.
12. /settlements — THE SCREEN THE BUSINESS RUNS ON. One run per brand per
    period, raised automatically, but NOTHING MOVES MONEY ON ITS OWN: a human
    marks each run sent or received. A wrong payout sent automatically is money
    gone; a wrong figure on a screen is a conversation. So design it so a wrong
    figure is obvious BEFORE the button is pressed — period dates, the ledger
    lines behind the number, the signed net amount, the direction (we pay them
    vs they pay us), the method, and the destination account, all on one screen.
    Statuses: PENDING, SENT, RECEIVED, CANCELLED.
13. /reviews — moderation, with a hide action.
14. /try-on — the virtual try-on feature's controls: the current model, the
    fallback model, and a monthly budget governor in USD. At 85% of the ceiling
    it degrades to the cheaper fallback model; at 100% it serves cache only.
    Draw that as a gauge with both thresholds marked, not as a number in a
    settings form — the whole point is that a traffic spike cannot produce a
    surprise invoice.
15. /settings — the single platform settings row: analytics timezone and
    k-anonymity floor, default free months, the commission band a sales rep may
    close inside, try-on caps, chat attachment size and allowed types, guest
    thread lifetime, the unanswered-chat threshold, and every badge threshold.
    Group these by what they govern, not by column order.
16. /analytics — platform overview: gross merchandise value, orders per brand,
    conversion, and searches that returned nothing.
17. /import — load a brand's catalog on their behalf from a file they sent.
    Sources, jobs, and a per-item review grid. NOTHING PUBLISHES
    AUTOMATICALLY — real catalogs are full of "TEST PRODUCT" and old prices. The
    reviewer maps categories, fixes prices and unticks junk. Re-running an
    import updates rather than duplicating. Item statuses need a clear
    needs-attention state.

## Rules that must not break

1. Paid placement is always labelled.
2. Reputation score and computed badges stay separate figures.
3. Money never moves without a human pressing a button.
4. The ledger is append-only; corrections are reversing entries.
5. Suspension hides a brand but does not kill its in-flight orders.
6. Imports never auto-publish.
7. Every list gets loading, empty, error and permission-denied states.
```

---

## PROMPT 3 — Sales console

```
Loqal sales console — three screens, phone only.

## Who uses this

A field sales rep for Loqal, an Egyptian marketplace for small local brands.
They are standing INSIDE a prospect's shop, holding a phone, trying to sign that
shop up in the room. They carry no brand of their own.

They see exactly two things: the sales pack, and brand onboarding. No orders, no
other brand's dashboard, no customer data — the customer belongs to Loqal, and a
field device in a shop is the easiest thing in this system to lose. Design for
that: nothing sensitive on screen, and nothing cached that matters if the phone
walks.

Phone only. Do not design a desktop layout. shadcn only, using the attached
design system. Arabic and English with true RTL, and assume the conversation is
happening in Arabic. Egyptian pounds.

## Screens

1. /pack — the sales pack. The argument, made on a phone, held up across a
   counter to a shop owner who is not technical and is busy. Market demand for
   this shop's category, proof of real traffic, and anonymised comparisons
   against other brands in the same category.
   HARD CONSTRAINT: no aggregate shown to an unsigned brand may be derived from
   fewer than three brands. Below that, "brands in your category average X"
   stops being a market fact and becomes one competitor's private revenue. So
   design an explicit BLOCKED state — the comparison is withheld and says why —
   and make it look deliberate, not broken.
2. /onboard — register the shop in the room. Business details, category,
   contact, and the shop's own trading terms. Optimised for a rep typing on a
   phone while talking: large targets, few fields per step, resumable.
3. /terms — set the commercial offer, pre-filled with the platform default free
   period. The rep may close anywhere inside a band the platform sets — a
   commission floor and a maximum free period. Show the band explicitly and make
   an out-of-band figure impossible to submit rather than merely warned about:
   the point of the band is that the worst deal a rep can sign is a number
   chosen in advance rather than one discovered in a settlement run. Include the
   state where the band is unbounded, which is the current reality while the
   first brands are being signed.

## Rules

1. No customer data anywhere.
2. No other brand's dashboard, no orders, no catalog.
3. The k-anonymity floor of three is enforced in the UI, not just the API.
4. Out-of-band terms cannot be submitted.
```

---

## OUTPUT CONTRACT

Append this to every prompt above.

```
OUTPUT CONTRACT — this is being ported into a Next.js App Router codebase, so
emit real code, not a picture of code.

- Real TypeScript React. One .tsx file per screen, plus shared pieces extracted
  into their own files.
- Import every primitive from "@/components/ui/<name>" exactly as the shadcn
  CLI installs it. Never redefine a shadcn component inline. If something is
  needed that shadcn does not ship, compose it from shadcn primitives and name
  which primitives it is made of.
- Tailwind utility classes only. No inline style objects, no custom CSS files,
  no arbitrary hex — colours come from the design system's CSS variables via
  Tailwind classes.
- Use logical properties (ps/pe/ms/me/start/end) everywhere, never left/right,
  so RTL works without a second stylesheet.
- Presentational only. No fetch, no server actions, no data layer, no business
  logic. Local UI state only.
- All mock data in one exported typed const at the TOP of each file, with its
  TypeScript type written out. Porting must be "delete the const, pass real
  props" and nothing else.
- Type every status against the real backend enum as a string union, never a
  generic string.
- Name files and folders to match the Next.js App Router structure of the route
  they represent, and put the intended route path in a comment at the top of
  each file.
- Mark client components with "use client" only where a hook or handler
  actually requires it.
```

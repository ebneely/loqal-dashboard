# loqaaal — the consoles

## Register

**Product.** Design serves the work. Nothing here is a landing page; every screen
is a tool somebody opens to get something done and closes again.

## What this is

Three consoles in one Next.js app, sharing one design system and almost no
screens:

| Console | Roles | Device | The person |
| --- | --- | --- | --- |
| **Brand** | `BRAND_OWNER`, `BRAND_EMPLOYEE` | **Phone** | A shop owner behind a counter in Cairo. They will not open a laptop to confirm an order. |
| **Admin** | `SUPER_ADMIN` | Desktop, must survive a phone | Settlement, moderation, commercial terms. Desk work with money on screen. |
| **Sales** | `SALES` | **Phone only** | A field rep standing inside a prospect's shop, holding one phone and a folder. |

They are deliberately not one dashboard with a role switcher. The three have
almost nothing in common, and a shared shell is how a brand ends up one query
parameter away from an admin screen.

`SHOPPER` never sees this app — that is the storefront, which has its own
PRODUCT.md and its own register.

## Users and their context

**The shop owner** is the hardest user and the one who sets the rules. They are
standing, one-handed, in bad light, between customers. Arabic first. They are
not curious about the interface; they want to know whether an order came in and
whether they got paid. Every screen in the brand console is designed at 390px
and then widened — not a desktop layout that reflows.

**The admin** is at a desk, with money on screen, making decisions that move
real amounts between real people. Density is welcome; ambiguity is not.

**The rep** is in someone else's shop with a signal that comes and goes. Their
console is three screens and nothing else, because the credential is the easiest
thing in the system to lose.

## The job

- **Brand:** did an order come in, is my stock right, when do I get paid.
- **Admin:** which shops need a decision, what does the platform owe and to whom.
- **Sales:** show a prospect the numbers, sign them, record the deal.

## Personality

**Quiet, exact, trustworthy.**

A working tool that stays out of the way. Money and stock read as facts, not as
features. Somebody checks this twenty times a day for years; it has to survive
the hundredth look, not win the first.

That is a real constraint, not a mood board. It means: hairline borders instead
of shadows, one accent colour used sparingly, figures set in a tabular face so a
column can be read down, and no ornament anywhere near a number.

## Anti-references

All four were named explicitly. None is a straw man; each is a live temptation
in this exact product.

- **The generic AI dashboard.** Purple gradients, identical rounded cards in a
  grid, a huge number over a tiny label, glassmorphism. The tell is uniformity:
  every panel the same size and shape because nothing decided which mattered.
- **The enterprise admin panel.** Grey on grey, forty columns, everything a
  table, no hierarchy at all. Powerful and miserable.
- **The consumer analytics toy.** Illustrations, confetti, vanity metrics
  dressed as achievements. This is somebody's livelihood; celebrating a number
  they cannot act on is worse than not showing it.
- **The crypto/fintech terminal.** Neon on near-black, glowing charts, every
  series a candlestick. A shop's books are not a trading floor.

## Strategic design principles

1. **Say what is missing rather than filling it in.** Where the API cannot
   answer, the screen says so and points at where the real number lives. There
   is precedent: `/admin/analytics` carries a panel explaining that it has no
   money in it, instead of three tiles quietly filled from whatever was to hand.
2. **A number nobody can act on is noise.** Every figure earns its place by
   changing what somebody would do.
3. **Empty is a state, not a failure.** With one order in the database, this
   product will be mostly empty for a while. Zero renders as zero; a map with no
   orders is grey and says why.
4. **Four states, always drawn.** Loading, empty, error, permission-denied. The
   denied state is part of the permission model, not an afterthought — and it is
   *absent*, never disabled, because a greyed-out Ledger tab still answers
   "does this shop have a settlement account".
5. **Bilingual is layout, not translation.** Arabic mirrors the interface. Every
   spacing and position value is logical, and two source-scanning tests fail the
   build on `pl-`, `text-left`, `left-4` and their kin.
6. **Latin digits in both languages.** Arabic-Indic numerals fall out of the
   figures face mid-number and break a column meant to be compared down.

## Accessibility

WCAG AA as a floor, verified rather than assumed — the body-text token was
already darkened once because 4.73:1 on the stone ground was a failure. Every
tap target 44px. Motion respects `prefers-reduced-motion` with a real
alternative, never by removing the feedback entirely.

## The register's hardest test

The analytics screen. It is the one place where "modern SaaS dashboard" pulls
hardest against "quiet, exact, trustworthy", and where four anti-references all
live at once. A KPI card with a sparkline is one honest glance or one AI cliché
depending entirely on whether the number changes what anybody does.

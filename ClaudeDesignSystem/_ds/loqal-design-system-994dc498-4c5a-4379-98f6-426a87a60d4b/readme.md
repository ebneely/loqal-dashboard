# Loqal Design System

Loqal is a marketplace for small Egyptian brands, most of them offline shops with no
website. This design system covers the **back office**, not the storefront.

It is three consoles sharing one system, not one dashboard with a role switcher:

| Console | Roles | Device | The job |
|---|---|---|---|
| **Brand** | `BRAND_OWNER`, `BRAND_EMPLOYEE` | Phone, always | A shop owner running their shop from behind a counter: confirm orders against a real shelf, adjust stock, load a catalog from phone photos, answer shoppers, see what they are owed. The primary console. |
| **Admin** | `SUPER_ADMIN` | Desktop, must survive a phone | Approve brands, set each brand's commercial terms, moderate the catalog, settle money. |
| **Sales** | `SALES` | Phone only | A field rep inside a prospect's shop, signing that shop up in the room. Three screens, and no customer data at all. |

Money is Egyptian pounds only, `Decimal(10,2)`, no currency selector anywhere. The
interface is Arabic and English with true RTL, because most users read Arabic.

## Sources

- **`loqal-dashboard/`** — a read-only local folder attached to this project. It
  contained exactly two files: `DASHBOARD-SPEC.md` (a 320-line screen inventory
  derived from `prisma/schema.prisma`, the controllers in
  `apps/loqal-backend/src/modules`, and `docs/user-stories.md`) and an empty
  `package.json`. **No application source, no components, no CSS, no design tokens,
  no assets.** Every visual value in this system is therefore a decision made here,
  not a copy of something that exists.
- **The user's brief**, which pinned the component library: shadcn/ui, new-york
  style, CSS variables, neutral base, no invented components.
- Screens are named by their spec IDs (B3, A12, S1…) throughout, so anything here
  can be traced back to `DASHBOARD-SPEC.md`.

Not available and not guessed: the Figma file (none), the backend repo, the
storefront, any brand assets.

## Library discipline — shadcn/ui only

Every primitive here is a shadcn/ui component. Six things the product needs that
shadcn does not ship are **compositions of shadcn primitives**, and each one names
its parts:

| Composed component | Made of |
|---|---|
| `StatusPill` | Badge, restyled per enum tone |
| `MoneyRow` | plain layout + the type and colour tokens |
| `ResponsiveList` | Card (below md) + Table (md and up) |
| `ListState` | Card + Skeleton + Button |
| `DestructiveSheet` | Sheet + Button ×2 |
| `MobileActionBar` | the sticky container shadcn's Button sizes assume |
| `AppShell` | Sidebar behaviour + Sheet + Button + Badge |

### Intentional additions

- **`Icon`** — a wrapper over Lucide, the icon set shadcn ships with. Needed because
  this system has no bundler: it loads glyphs from `lucide-static` as a CSS mask.
- **`FieldHint`** (exported from `Label.jsx`) — shadcn's `FormMessage` without
  react-hook-form, which this system does not carry.
- **State colour tokens** (`--state-*`, `--money-*`) — shadcn ships only
  `--destructive`, and this product renders 20-plus enum values plus a signed
  balance. Everything else is the stock neutral ramp, untouched.

Deliberately **not** built, because nothing in the spec needs them: Dialog (there is
no centred modal in Loqal), Toast (nothing a user must act on is transient),
Tooltip, Accordion, Command, Calendar, Carousel, DataTable.

## System-level rules

1. **Mobile-first literally.** Designed at 390px, then widened to 768 and 1024.
   Never a desktop layout that reflows down.
2. **Every list is a Card stack below md and a Table at md and up** — same data,
   same column definitions, one component: `ResponsiveList`. The switch is a
   *container* query, not a media query, so a 390px phone frame embedded in a
   desktop page still renders cards.
3. **Every list draws four states**: loading skeleton, empty, error,
   permission-denied. Denied is a first-class state, not a toast — the three
   consoles differ mostly by what a user may not see. Hide the block, do not
   disable it: a greyed-out payout field still tells an employee the account number.
4. **The primary action is in thumb reach** — `MobileActionBar`, 52px, full width,
   bottom of the screen. Top-right buttons are tertiary only.
5. **Every destructive action is a bottom sheet that writes the consequence out in
   words**, including what happens to stock, to the shopper, and to money.
6. **The signed balance never appears as a bare number.** Colour, a boxed +/− glyph,
   and a sentence naming who owes whom.
7. **`dir="rtl"` is the only RTL switch.** Logical properties throughout — no
   `left`/`right`, no `margin-left`, no per-screen mirroring overrides. Every class
   that carries prose or a title also sets `unicode-bidi: plaintext`, so an English
   string sitting inside an RTL screen keeps its own punctuation and leading numbers
   in place instead of having them thrown to the far edge.

## Content fundamentals

The tone is a working tool for busy people. Someone is standing behind a counter
with a customer waiting.

- **Second person, present tense, active voice.** "Stock stays reserved until you
  confirm." Not "stock will be reserved" and not "reservations are held".
- **Loqal refers to itself as Loqal**, not "we", anywhere money or policy is
  involved: "Loqal owes you 4,820.50", "Set by Loqal". First-person plural appears
  only inside the admin console, where the reader *is* Loqal: "We owe Nefertari
  Leather".
- **Say the consequence, not the caution.** "The 3 reserved items go back to
  available stock" beats "This action cannot be undone". Never "Are you sure?".
- **Escape hatches are phrased as the outcome, not as Cancel** — "Keep the order",
  "Leave it active", "Not yet". Half these screens are *about* cancelling
  something, so a button labelled Cancel is ambiguous.
- **Sentence case everywhere.** Uppercase is reserved for two things: table column
  heads and key labels (11px, 0.06em tracking) and literal backend enum names shown
  as facts (`BRAND_OWNER`, `PENDING_BRAND` in a pill's tooltip).
- **Numbers are digits, always Latin digits, always two decimals for money**, even
  in Arabic. Egyptian shop owners read financial figures in Latin numerals; Arabic
  dates and counts may use Arabic-Indic numerals, money never does.
- **Say what is absent and why.** "You see your shop's items only. Loqal does not
  show you the wider order or other shops in it." A missing thing explained is a
  feature; a missing thing unexplained is a bug report.
- **Empty states describe what will appear**, not the emptiness: "Orders that need
  a shelf check show up here."
- **No emoji, ever.** No exclamation marks. No "Oops", no "Great!", no
  congratulation on a completed task — completing a task is the job.
- **Arabic is a translation of meaning, not of words.** `PENDING_BRAND` is "Check
  the shelf" in English and "راجع الرف" in Arabic; neither says "pending".

## Visual foundations

**Palette.** shadcn's neutral base, unmodified, plus one brand colour: emerald,
`--primary: oklch(0.505 0.122 163)`. Chosen against the constraint — dense data on a
cheap phone screen in Egyptian daylight — so it is dark enough to hold white text at
high ambient brightness and saturated enough to survive a low-gamut panel.
Everything structural is grey; only one token in the palette is branded, and a screen
carries at most two background values, `--background` and `--card`.

Because the brand colour is green, the state tones were re-cut around it rather than
left to collide: `good` and `money-credit` **are** the brand emerald — a delivered
order and money owed to you wear the house colour on purpose — and `live` (in
flight) moved from teal to blue so nothing green ever means "still happening".

**State tones.** Six tones cover twenty-plus enum values, each a fg/bg/border
triplet so a pill needs no opacity arithmetic: `neutral` (closed, no money moving),
`wait` (waiting on someone else), `act` (a human must act now — the dot pulses),
`live` (in flight and correct), `good` (finished well), `bad` (finished badly).
Money has its own pair, `--money-credit` green and `--money-debit` red, deliberately
distinct from `good`/`bad`: a debit is not a failure.

**Type.** Readex Pro for both scripts — one family, matched x-height and stroke
weight, so an Arabic row and an English row are the same height in the same table. It
is drawn for reading ease at small sizes: open apertures, a tall x-height and
letterforms that stay distinct at 14px on a low-gamut panel, which is the whole
requirement here. Source Code Pro for every figure: money, SKUs, IDs, counts,
timestamps, all tabular and lining. It is a humanist mono rather than a terminal one,
so a settlement figure reads like a number on an invoice rather than a line of code —
with a dotted zero that cannot be an O and a footed 1 that cannot be an l, which is
the difference between a checkable figure and a guessed one. Body is **14px, not 16** — these cards carry four to six fields
each and the user is scanning. 12px is the floor for anything at all, 14px for
anything interactive. 34px belongs to the signed balance and to nothing else.

**Backgrounds.** Flat. No gradients, no photography, no illustration, no texture, no
pattern. The only non-flat surface in the system is the blur behind
`MobileActionBar`, and that exists so list content stays legible while it scrolls
underneath.

**Borders and elevation.** A 1px `--border` means the thing sits on the page; a
shadow means it floats and will go away. So: cards get `--shadow-xs` and a border,
popovers get `--shadow-md`, sheets get `--shadow-sheet` (upward, `0 -8px 24px`), and
nothing else is raised. No inner shadows anywhere. No coloured left-border accents.

**Corner radii.** `--radius: 0.75rem`, one step rounder than shadcn new-york's default,
because these screens are almost entirely stacked cards and the softer corner is what
keeps a dense phone list from reading as a spreadsheet. Checkbox 8, input and button
10, card 12, sheet top corners 16, pills and avatars fully round. Everything derives
from the one token, so the whole system re-rounds by changing that line.

**Motion.** Fast, and attached to actions rather than to decoration. 120ms for
colour, hover and press; 180ms for a sheet, a collapse or a toggle; 240ms for an
entrance. `--ease-out` (`cubic-bezier(.16,1,.3,1)`) for anything entering,
`--ease-in-out` for state changes.

Every action leaves a mark:

| Action | What moves |
|---|---|
| Any button press | A ripple from the touch point, 520ms, `currentColor` at 32% — the only confirmation a tap landed before the network answers |
| Button, card, nav press | `scale(0.985)` and, on cards, a 1px lift on hover that drops on press |
| Checkbox | The Lucide tick scales in from 0.3; the box squashes to 0.9 while held |
| Switch | Thumb slides 180ms and stretches to 22px while held |
| Select | Chevron rotates 180°, panel pops in from -4px |
| Tab, status pill, unread count, money sign | `loqal-pop` — 0.86 → 1.05 → 1 |
| A list arriving | Rows rise 7px in sequence, 35ms apart (30ms for table rows), so a refreshed list reads as new |
| Sheet | Slides up 180ms behind a fading overlay, and slides back down on close — `usePresence` holds it mounted for the exit rather than letting it vanish on a frame |
| Select panel | Pops in, and pops back out over 120ms on close |
| Progress, gauges | 320ms width transition |
| Loading skeleton, `act` dot | The only two looping animations in the system |

Anything that unmounts animates out, not just in: `components/primitives/usePresence.js` keeps a sheet or popover rendered for the length of its exit keyframes, driven by a `[data-state="closed"]` rule. A side sheet slides from the start edge in both directions — the keyframe reads `--side-from`, which flips under `[dir="rtl"]`, so nothing is mirrored by transform.

Nothing bounces past 1.05, nothing springs, and there are no page transitions. All of
it collapses under `prefers-reduced-motion: reduce`.

**Hover.** Buttons darken 12% via `color-mix` toward black — never a lightening, never
an opacity change, because opacity on a dense card reveals the row behind it. Ghost
and outline buttons take `--accent` as a background instead. Interactive cards shift
their border toward the foreground and tint 3%. Table rows tint 4%.

**Press.** `scale(0.985)` plus the hover colour. Cards drop to `--accent`. That is
the whole press language.

**Focus.** `2px solid var(--ring)` at `2px` offset, and `--ring` is the brand teal, so
keyboard focus reads as intentional rather than as a browser default. Fields also take
a 3px 22%-alpha ring on the border colour.

**Transparency and blur.** Two uses only: the 45%-black sheet overlay, and the
`MobileActionBar` at 88% background with a 10px backdrop blur. Nothing else is
translucent — a translucent card over dense data is unreadable in daylight.

**Layout.** Fixed elements: the top bar (56px, sticky, phone and tablet only), the
sidebar (248px, `lg` and up, never collapsible to icons — the labels are the
navigation), the bottom tab bar (phone, brand and sales consoles only, absent from
admin), and the action bar. Content gutters are 16 / 24 / 32 by breakpoint. Nothing
is centred in a max-width column; these are tools, and horizontal space is data.

**Imagery.** There is none. No product photography exists in this system, and none is
invented: a product thumbnail is a square `--muted` tile with a Lucide `image` glyph.
When real photography arrives it will be brand-supplied phone photos, warm and
uneven, which is another reason the chrome around it is grey.

## Iconography

**Lucide**, the set shadcn/ui ships with — pinned to `lucide-static@0.541.0` and
loaded per glyph as a CSS `mask-image` so it inherits `currentColor`. This is a
substitution to flag: no icon assets were provided with the codebase, so the system
uses shadcn's own default set rather than approximating one.

- 16px inside buttons and list rows, 20px in navigation and empty-state glyphs,
  18px for a standalone icon button. Lucide's native 2px stroke at 24px, unchanged.
- Icons never appear alone as the only label for a destructive or money action.
- The house set: `sun`, `package`, `package-check`, `boxes`, `camera`, `image`,
  `message-square`, `paperclip`, `wallet`, `store`, `users`, `settings`, `inbox`,
  `lock`, `triangle-alert`, `refresh-cw`, `check`, `x`, `plus`, `search`,
  `chevron-right`, `arrow-left`, `sparkles`, `folder-tree`, `pencil`, `upload`,
  `chart-no-axes-column`, `file-pen`. The chevron and back arrow mirror in RTL via
  `scale(-1 1)`.
- Because the glyphs are CSS masks, some DOM-rasterising screenshot tools render
  them as solid squares. That is a capture artifact, not a defect — the icons are
  correct in a real browser.
- **No emoji, in the product or in this system.** No Unicode glyphs used as icons,
  with two exceptions that are typography rather than iconography: the `+` and `−`
  (U+2212, true minus) in `MoneyRow`.

## Brand assets

**There is no logo.** None was provided, and none has been drawn. Wherever a mark
would go, the word *Loqal* is set in IBM Plex Sans Arabic 700 at −0.03em, beside a
console label. `assets/` is therefore empty of imagery; see
`guidelines/wordmark.card.html` for the stand-in.

## Fonts

Readex Pro and Source Code Pro are loaded from Google Fonts by `@import` in
`tokens/fonts.css`. **No font binaries were provided**, so no `@font-face` rules with
local `src:` targets exist and the design-system compiler reports zero fonts. If
Loqal has licensed faces, drop the files into `assets/fonts/` and replace the
`@import` with real `@font-face` rules — nothing else has to change.

## Index

| Path | What it is |
|---|---|
| `styles.css` | The one file consumers link. `@import` lines only. |
| `tokens/` | `fonts.css`, `colors.css`, `typography.css`, `spacing.css`, `elevation.css`, `base.css` |
| `css/components.css` | The `lq-*` class layer the components render into. Logical properties and container queries only. |
| `components/primitives/` | Icon, Button (ripple), Input, Label (+FieldHint), Textarea, Select (popover listbox), Checkbox, Switch, Badge, Card (+CardHeader, CardTitle, CardDescription, CardContent, CardFooter), Separator, Tabs, Avatar, Progress, Alert |
| `components/data/` | StatusPill, MoneyRow, Table, ResponsiveList (+`statusMap.js`) |
| `components/feedback/` | Skeleton, ListState |
| `components/overlays/` | Sheet, DestructiveSheet, MobileActionBar |
| `components/shell/` | AppShell |
| `ui_kits/brand-console/` | 7 screens, phone-first. See its README. |
| `ui_kits/admin-console/` | 4 screens, desktop-first. See its README. |
| `ui_kits/sales-console/` | 3 screens, phone only. See its README. |
| `templates/console-screen/` | A starting file for a new console screen. |
| `guidelines/` | 16 specimen cards: colours, type, spacing, radii, elevation, RTL, states, icons, wordmark. |
| `SKILL.md` | Agent-skill entry point. |

### Components

Alert, AppShell, Avatar, Badge, Button, Card, CardContent, CardDescription,
CardFooter, CardHeader, CardTitle, Checkbox, DestructiveSheet, FieldHint, Icon,
Input, Label, ListState, MobileActionBar, MoneyRow, Progress, ResponsiveList,
Select, Separator, Sheet, Skeleton, StatusPill, Switch, Table, Tabs, Textarea.

## Open questions

1. `ProductStatus` and `BrandStatus` values (`DRAFT`/`PUBLISHED`/`ARCHIVED` and
   `PENDING`/`ACTIVE`/`SUSPENDED`) were inferred — the spec names the enums but does
   not list their members. Confirm against `schema.prisma`.
2. The Arabic status labels are meaning-first translations, not a reviewed
   localisation. They need a native speaker's pass before shipping.
3. No `StockAdjustmentReason` members were given; the adjust sheet shows four
   plausible ones.

# loqaaal consoles — design

Documents the system that is already built, in `src/app/globals.css` (tokens),
`src/app/loqal-components.css` (a verbatim copy of the design system's
`components.css`), `src/components/ui/` (shadcn output, never hand-edited) and
`src/components/loqal/` (the domain layer).

## Theme

**Light, stone-grounded.** Not dark, and not white.

The scene decides it: a shop owner reading a phone in daylight between
customers, and an admin at a desk with money on screen. Dark mode exists and is
complete, but daylight is the design case.

The ground is `oklch(0.94 0.008 90)` — `#EDEBE5`, the exact value the storefront
ships as `--paper`, so the two halves of the product stand on the same floor
rather than on two whites that nearly match. `--card` stays pure white **on
purpose**: a white card on stone lifts by itself, so a table, a KPI strip and a
sheet read as sheets laid on a desk. On a white page the system had one surface
and asked 1px borders to carry every separation.

## Color

**Restrained.** Tinted neutrals, one accent, colour reserved for meaning.

| Role | Token | Light | Notes |
| --- | --- | --- | --- |
| Ground | `--background` | `oklch(0.94 0.008 90)` | stone |
| Surface | `--card` | `oklch(1 0 0)` | white, lifts off the ground |
| Ink | `--foreground` | `oklch(0.145 0 0)` | |
| Muted ink | `--muted-foreground` | `oklch(0.51 0 0)` | darkened from 0.556 — that failed AA on stone at 3.97:1 |
| Accent | `--primary` | `oklch(0.505 0.122 163)` | one green, used sparingly |
| Hairline | `--border` | `oklch(0.842 0.016 90)` | 1px, the system's main separator |

**Six semantic state buckets**, each a fg/bg/border triplet so a pill needs no
opacity maths: `neutral`, `wait`, `act`, `live`, `good`, `bad`. Twenty backend
enum values collapse into these six.

**Signed money has its own three**: `--money-credit`, `--money-debit`,
`--money-zero`. The sign is never load-bearing alone — the party is written out
in words, because a minus sign on a phone in a busy shop is not a sentence
anybody reads correctly.

**Charts** reuse the same five hues as the state system at mark lightness, so a
legend and a status badge for the same concept read as the same family.
`--chart-1` **is** `--primary`.

## Typography

Two families, paired on a real contrast axis — not two sans-serifs that differ
slightly.

- **Readex Pro** — body and headings. Carries Arabic and Latin with matched
  x-height, so an Arabic price row and an English one are the same height in the
  same grid.
- **Source Code Pro** — every figure. Tabular and lining, so a total lines up
  under a subtotal. Applied by `[data-num]`.

Dense working tool: body is **14px, not 16px**. Nothing interactive below 14px,
nothing at all below 12px.

| Token | Size | Use |
| --- | --- | --- |
| `--text-2xs` | 11px | tabular column heads only, never a sentence |
| `--text-xs` | 12px | meta, timestamps, helper text |
| `--text-sm` | 14px | body default |
| `--text-base` | 15px | card titles |
| `--text-2xl` | 26px | a KPI figure |
| `--text-3xl` | 34px | the signed balance, and nothing else |

**Never `letter-spacing` or `text-transform` on Arabic.** Both are meaningless
in a connected script and one of them breaks it.

## Layout

- **Hairlines, not shadows.** Shadow means "this floats above the page" —
  sheets, popovers, bars. A card gets a 1px border.
- **Container queries, not media queries**, where a component's width is what
  matters. `.lq-kpis` is 2-up below 768px and 4-up above — of its *container*,
  so a KPI row inside a narrow column stays 2-up.
- **Phone first at 390px, then widened.** Brand and sales screens are drawn at
  phone width and the desktop layout is the widening. Admin is the reverse but
  must not break on a phone.
- **No data tables on a phone.** Every list is a card stack; the table is the
  desktop widening of the same component (`ResponsiveList`).
- **Logical properties only.** `ps-`/`pe-`, `ms-`/`me-`, `start-`/`end-`,
  `text-start`/`text-end`. Two source-scanning tests fail the build otherwise.

## Motion

Present, restrained, and never gating content.

- `--dur-fast` 120ms (press, hover, colour), `--dur-base` 180ms (sheet, drawer),
  `--dur-slow` 240ms (skeleton crossfade).
- `--ease-out: cubic-bezier(0.16, 1, 0.3, 1)`. No bounce, no elastic.
- **Entrance is a stagger on arrival**, not a scroll reveal: list rows and KPI
  tiles arrive 30–40ms apart via `loqal-rise`. Content is visible without it.
- `prefers-reduced-motion` gets a real alternative, never a removal. Note that
  the global clamp shortens *durations* — an `animation-delay` survives it and
  must be removed separately, or a staggered list still arrives one at a time.

## Components

Three layers, in dependency order:

1. **`src/components/ui/`** — shadcn CLI output. Never hand-written; values
   transcribed from the design system where they differ from stock.
2. **`src/components/loqal/`** — the domain layer. `AppShell`, `ResponsiveList`,
   `ListState`, `StatusPill`, `MoneyRow`, `Kpi`/`KpiGrid`, `DestructiveSheet`,
   `InviteResult`, `LocaleSwitch`, `EgyptMap`.
3. **Screens** — four files each: `page.tsx` (default export only, or
   `next build` fails), `*-screen.tsx`, `*-data.ts`, and a pure `*-rules.ts`.

**Cards are used where a card is the affordance, not as the default container.**
Nested cards do not appear anywhere in this system.

## Known deviations, and why

- **`aspect-video` on `ChartContainer`** is shadcn's default and wrong for a
  sparkline; override per use.
- **`.lq-kpis` entrance delays stop at `nth-child(4)`** — a five-tile row has
  four staggered and the rest arriving together.
- **`src/components/ui/chart.tsx` was dead code** until the analytics dashboard.
  It is complete and correct; the analytics work is its first consumer.

# loqaaal consoles — design

Documents the system that is already built, in `src/app/globals.css` (tokens,
and the shell rules that deviate from the design system), `src/app/loqal-components.css`
(a verbatim copy of the design system's `components.css`), `src/components/ui/`
(shadcn output) and `src/components/loqal/` (the domain layer).

The register is the storefront's, value for value: `loqal-frontend/src/app/tokens.css`
and its `DESIGN.md` are the source. Change a value there first, then here.

## Theme

**White ground, one deep green, square corners.**

The shop and its back office are one brand. A white page, green-black ink, and
one bottle green (`#0B3D2E`) that owns whole regions — the sidebar rail, the
primary button, a chosen state — rather than being sprinkled as accents.

`.dark` still exists in globals.css but nothing in the app applies it; it was
not redesigned.

## Color

| Role | Token | Value | Notes |
| --- | --- | --- | --- |
| Ground / surface | `--background`, `--card` | `#ffffff` | one surface; hairlines separate |
| Ink | `--foreground` | `#0f1a15` | 17.8:1 on white |
| Secondary ink | `--muted-foreground` | `#4b5a52` | 7.3:1 |
| Brand | `--primary` (`--green`) | `#0b3d2e` | rail, primary button, active states |
| Brand hover | `--primary-hover` (`--green-2`) | `#145a45` | also green as text on white |
| Action on green | `--green-bright` | `#127a4c` | the wordmark's a's on white |
| Pale | `--muted`, `--accent` (`--pale`) | `#e7f2eb` | **hover and disabled only**, never a content surface |
| Hairline | `--border` | `#c7dccf` | the 1px between rows |
| Input edge | `--input` | `#a9c3b4` | a hairline that must be found |
| Signal | `--destructive` | `#a5122a` | errors and price drops, nothing else |

**Six semantic state buckets** (fg/bg/border triplets): `neutral`, `wait`, `act`,
`live`, `good`, `bad` — the storefront's values. Every pill also carries a word.

**Signed money**: credit `--green-2`, debit `--signal`, zero `--ink-2`. The party
is written in words; the sign is never load-bearing alone.

**The rail re-points tokens, it does not restyle controls.** `.lq-sidebar`,
`.lq-navsheet` (phone nav sheet) and `.lq-topbar` set `--background`,
`--foreground`, `--border`, `--accent`, `--primary` to their on-green values for
their subtree, so the nav, locale switch and sign-out button turn light-on-green
by themselves. Active nav item: white block, green ink. Counts: mint square.

## Typography

- **Reem Kufi** (`--font-heading`) — page titles, `h1`/`h2`, section and sheet
  titles, the wordmark.
- **Alexandria** (`--font-sans`) — everything else in both scripts, **including
  figures**. `--font-mono` now points at Alexandria too: every `font-mono` /
  `[data-num]` call site wanted aligned digits, which `tnum` gives.

Dense working tool: body stays **14px**. Page title is 20px on a phone, 34px at
lg (`.lq-page-title`, the one `h1` of every screen, rendered by `AppShell`).

**Never letter-space Arabic.** `:where(:lang(ar)) { letter-spacing: 0 !important }`
in the base layer enforces it, including over `tracking-*` utilities. KPI keys
and table heads are sentence case, not uppercase.

## Shape and depth

- **Radius 0** everywhere: every `--radius-*` is a literal `0px` (never
  `calc()` off zero — it goes negative and is dropped). `rounded-full` stays for
  dots, counters and swatches only.
- **Flat by default.** `--shadow-xs/sm` and `shadow` are `none`. A soft offset
  shadow (`--shadow-md` and up, `--shadow-sheet`) is only for things that float:
  menus, popovers, dialogs, toasts, sheets.
- **Tables**: no box; an ink rule under the heads, hairlines between rows, pale
  on hover.
- **KPIs are a strip**, not cards: ink rule above and below, 1px hairlines
  between cells (the grid's ground showing through a 1px gap).

## Layout

- **Container queries, not media queries**, where a component's width matters.
- **Phone first at 390px.** The phone top bar is green and carries the wordmark;
  the screen title is the `h1` at the head of the content.
- **No data tables on a phone.** Every list is a card stack (`ResponsiveList`).
- **Logical properties only.** Two source-scanning tests fail the build otherwise.

## Motion

- `--ease-out: cubic-bezier(0.22, 1, 0.36, 1)` (the storefront's curve).
- The wordmark's three a's light up green one after another every 7s and rest;
  off under `prefers-reduced-motion`.
- Entrance is a stagger on arrival via `loqal-rise`; content is visible without it.

## Copy

Arabic is Modern Standard Arabic (فصحى), not Egyptian colloquial. The brand is
always written `loqaaal` in Latin letters, never لوكال or لوقال.

## Components

1. **`src/components/ui/`** — shadcn output. Hand edits are limited to the
   design register: `button` (primary hover `--primary-hover`; secondary is a
   hairline box), `badge` (square; `count` stays round), `table` (rules above).
2. **`src/components/loqal/`** — the domain layer: `AppShell`, `Wordmark`,
   `ResponsiveList`, `ListState`, `StatusPill`, `MoneyRow`, `Kpi`/`KpiGrid`, …
3. **Screens** — `page.tsx`, `*-screen.tsx`, `*-data.ts`, `*-rules.ts`.

## Known deviations, and why

- `loqal-components.css` is still the design system's verbatim copy (rounded
  pills, Readex-era sizes). The redesign overrides it from globals.css rather
  than editing it, so a section can still be re-copied.
- `aspect-video` on `ChartContainer` is shadcn's default and wrong for a
  sparkline; override per use.

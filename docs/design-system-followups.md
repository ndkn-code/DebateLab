# Design system — open decisions

Opened 2026-09-01 during the design.md rewrite. Both items change values in shipped UI, so
they are batched here for one reviewed, browser-verified pass rather than applied piecemeal.

## 1. Fifty-two token roles drift between tokens.ts and globals.css

`tokens.ts` (via `ThinkfyThemeVariables`) wins at runtime for `var()`. The declarations in
`globals.css` are what Tailwind bakes into literals — notably every opacity modifier. Where
the two disagree, the same role renders two different colors depending on how it is
referenced.

Re-run with `npx tsx scripts/design-token-drift.ts`. It resolves the whole cascade; note
`globals.css` declares each theme across several blocks and later declarations win.

### Light — 11 of 104

In most rows `globals.css` holds the better value and `makeWebCssVariables` in `tokens.ts`
has a lazy mapping. The fix is mostly **tokens-side**, which is the opposite of the usual
direction.

| Role | globals.css | tokens.ts | Likely correct |
|---|---|---|---|
| `--color-ring` | `#0077E6` | `#333333` | globals — a blue focus ring is visible and conventional |
| `--color-on-primary-fixed` | `#FFFFFF` | `#333333` | globals — tokens maps to `colors.inverse`, unreadable on a dark fill |
| `--color-on-primary-fixed-variant` | `#E9E9E5` | `#222222` | globals |
| `--color-primary-fixed-dim` | `#E9E9E5` | `#333333` | globals |
| `--color-inverse-primary` | `#F5F5F2` | `#333333` | globals |
| `--color-on-tertiary-container` | `#333333` | `#15B042` | globals — tokens maps to `colors.tertiary`, green on green |
| `--color-on-tertiary-fixed` | `#333333` | `#15B042` | globals — same lazy mapping |
| `--color-on-tertiary-fixed-variant` | `#087C2B` | `#15B042` | globals |
| `--color-tertiary-dim` | `#087C2B` | `#15B042` | globals |
| `--color-sidebar-muted` | `#666666` | `#777777` | undecided |
| `--color-input` | `#D7D7D2` | `#E2E2DE` | undecided |

**Live defect.** `button.tsx` uses `focus-visible:ring-ring/50`. The opacity modifier bakes
the `globals.css` literal, so that ring renders blue, while anything reading
`var(--color-ring)` renders near-black. One role, two colors.

### Dark — 41 of 104, and worse

Dark is a different problem: `globals.css` still carries the **previous aqua palette** where
`tokens.ts` has moved to neutral. This is a stale generation, not a mapping bug, so here the
fix is **globals-side**.

The whole dark chart ramp is affected — `chart-1` is `#22C9E6` (aqua cyan) in globals versus
`#5AA9FF` (blue) in tokens, and `chart-2` through `chart-7`, `chart-grid`, `chart-axis`,
`chart-tooltip-bg/text`, and `chart-crosshair` all disagree. Also drifting: `--color-ring`
(`#5AA9FF` vs `#F5F5F2`), the `secondary-*` and `tertiary-*` families (still coral and cyan),
`surface-bright`, `surface-variant`, `card`, `popover`, `muted`, `accent`, `inverse-surface`,
`inverse-on-surface`, and `on-background`.

This has probably not surfaced visibly because design.md §Chart System already forbids
opacity modifiers on chart tokens. That prohibition is currently load-bearing — the moment
someone writes `bg-chart-1/20`, dark mode renders the old palette.

**Also worth fixing while in here:** `globals.css` contains two `.dark` blocks — an aqua one
around line 285 and the current neutral one around line 907. The first is shadowed by the
second, so it is dead, but it means the file ships two contradictory palettes and any reader
(human or agent) can land on the wrong one. Delete the stale block.

## 2. Palette migration — settled style, values not yet landed

Decided 2026-09-01. The style is written up in design.md §Posture; this is the value change
that implements it. **Do this in the same pass as item 1** — both edit `tokens.ts` and
`globals.css`, and running them separately means two conflicting migrations over the same
roles.

Reference family: [arcade.software](https://www.arcade.software), measured from its live
computed styles. Same typeface and structure Thinkfy already uses; the differences are
contrast, accent saturation, and grey temperature.

### Target

| Role | Today (web light) | Target | Why |
|---|---|---|---|
| canvas / `background` | `#F5F5F2` warm | `#F9FAFB` cool | chosen: cool neutrals |
| `foreground` / `on-surface` | `#333333` | `#111827` | ink on canvas 11.6:1 → 17.0:1 |
| `on-surface-variant` | `#666666` | `#4B5563` | 5.3:1 → 7.2:1 |
| tertiary muted | — | `#6B7280` | 4.6:1, for the quietest metadata |
| `primary` (CTA fill) | `#333333` near-black | `#2142E7` | 7.01:1 under white; accent becomes the CTA |
| `secondary` | `#0077E6` | supporting role only | today's blue is **4.39:1 — below AA as text** |
| control radius | `10px` | `12px` | closes the ramp to 6/8/12/16/24 |

`#1D4ED8` (6.70:1) is an equally valid accent if `#2142E7` reads too electric in volume —
decide it in a render, not from the hex.

### Constraints
- Dark mode inverts: the accent needs a lighter step of the same hue as the fill with dark
  text, matching the existing `primary #F5F5F2` / `on-primary #242422` pattern.
- `info` currently sits near the old aqua hue and will collide with a blue primary. Move it
  or merge it into primary.
- **Charts must not follow the accent.** design.md forbids charts stealing CTA colors, so
  `chart-1` stays distinct from primary — data must not read as interactive.
- The near-black that primary vacates stays as ink, and becomes a neutral button variant for
  workbench rows.
- Cyan was considered and rejected: the brand cyan `#12B9EF` is **2.28:1**, decorative only,
  and the founder confirmed the favicon can be recolored.

### Scale
`primary` drives every CTA, active nav row, focus ring, selected state, and progress fill.
This is a whole-product visual change and needs Browser QA in both themes across every
surface class, not a spot check.

## 3. Control geometry is not tokenized

The shipped geometry (documented in design.md §Component Guidance) is correct but hardcoded
as arbitrary values in each primitive:

- `rounded-[10px]` in `button.tsx`, `card.tsx`, `select.tsx`, `tabs.tsx` — a de facto control
  radius with no token. Add `--radius-control: 10px` to the `@theme` block and use it.
- `rounded-[6px]` in `badge.tsx` — already equals the existing `--radius-sm` (0.375rem); use
  `rounded-sm`.
- `rounded-[min(var(--radius-md),10px)]` and `…,12px)` in the button size variants always
  resolve to `--radius-md` (8px), since md is smaller than both clamps. Either the clamp is
  vestigial or `--radius-md` was meant to be larger. Resolve before simplifying.

Verify a `rounded-control` utility actually generates before relying on it — `@theme inline`
changes whether the variable is emitted, and this should be confirmed in a render rather than
assumed.

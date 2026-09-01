# Thinkfy Design System

Authority for product surfaces — everything behind sign-in, both Debate and IELTS. Public
marketing pages are governed by `design-marketing.md`, which layers on top of this one.

This document is descriptive, not aspirational: it records what the system *is*. When it and
the code disagree, the code is right and this file is a bug — fix it in the same change.

## Posture

Thinkfy's product style is the **calm SaaS canvas**: a neutral cool-grey field, near-black
ink, one saturated accent, Inter throughout, and hierarchy built from contrast and spacing
rather than from color, borders, or ornament. The nearest public reference is
[arcade.software](https://www.arcade.software) — same typeface, same neutral-plus-one-accent
structure, same 6/8/12/16/24 radius family, same 13–16px core type.

Take from that family its **typography, grey ramp, contrast discipline, radius ramp, and
single saturated accent**. Do not take its marketing composition — full-bleed dark bands,
oversized display type, and gradient washes belong to a landing page, not to a gradebook.

Logged-in surfaces are **warm in behavior, restrained in appearance**. The warmth is earned at
the moment it lands — a result, a streak, a completion — and is carried by the accent and the
reward role, not by ambient decoration. Marketing surfaces drop the warmth entirely for
editorial restraint (`design-marketing.md`). Do not mix the two registers on one surface.

Thinkfy should feel:
- more credible than playful, but never cold
- more polished than flashy
- more structured than decorative
- calm, intelligent, and confident

### Contrast is the dial
Most of what separates a screen that looks designed from one that looks unfinished is
contrast discipline, not taste. These are floors, not targets:

- Ink on canvas: **≥ 12:1**. Aim nearer 16:1.
- Any accent used as a CTA fill under white text: **≥ 4.5:1**.
- Any color used as body or link text: **≥ 4.5:1** on its actual background.
- Muted text on canvas: **≥ 4.5:1**.

A "nice" accent that cannot carry white text is a decorative tint, not an action color. Give
it a darker step of the same hue for actions and keep the bright one for fills.

## Surface Modes

One visual system, two densities. Every product surface declares which it is; the mode
decides spacing, type scale, and how much explanation is allowed.

**Workbench** — teaching calendar, gradebook, review queue, question bank, mock player,
attendance, admin tables, materials.
- Data-first and scannable. Rows over cards. Metadata over prose.
- Compact padding, stable row heights, one-line labels at 13-inch widths in both locales.
- The repeating unit never truncates its most important field. If it does, the density is
  wrong — fix the column math, not the font size.
- Celebration does not belong here.

**Momentum** — home and today, results, study plan, onboarding, completion and streak moments.
- One dominant action in the first viewport, and room around it.
- Generous spacing, larger type steps, the accent and reward roles doing real work.
- Warmth lands here, at the moment it is earned.

Full-attention flows — live debate practice, the speaking recorder, the mock exam shell —
are neither. They currently follow §Live Practice Flow; whether they become a formal third
mode is open (`docs/teacher-calendar-polish.md`).

## Color System

Color is tokenized. App code names a **role**; it never names a value. The source of truth is
`packages/shared/src/design-system/tokens.ts` (`ThinkfyColorRole`), mirrored into Tailwind
utilities by the `@theme inline` block in `apps/web/src/app/globals.css`.

### The token API
Use these role names. If the role you need does not exist, add it to the token source first —
never inline a value, and never alias an existing role under a new name.

- **Brand** — `primary`, `primary-dim`, `primary-depth`, `primary-container`, `primary-fixed`,
  `on-primary`, `on-primary-container`, `secondary`, `secondary-dim`, `secondary-container`,
  `tertiary`, `tertiary-container`, `inverse-primary`
- **Surfaces** — `background`, `surface`, `surface-dim`, `surface-container`,
  `surface-container-low` / `-lowest` / `-high` / `-highest`, `inverse-surface`
- **Text and lines** — `foreground`, `on-surface`, `on-surface-variant`, `inverse-on-surface`,
  `muted`, `placeholder`, `outline`, `outline-variant`
- **Status** — `success`, `warning`, `error`, `info`, each with its `*-container` and `on-*` partners
- **Product** — `reward`, `reward-dim`, `reward-container`, `on-reward`, `course-accent`
- **Data** — `chart-1` … `chart-7`, `chart-grid`, `chart-axis`, `chart-tooltip-bg`,
  `chart-tooltip-text`, `chart-crosshair`

### Tokens are dual-source
Every value exists twice: in `tokens.ts`, emitted as inline critical CSS by
`ThinkfyThemeVariables` and authoritative at runtime for `var()`; and in the `@theme inline`
block of `globals.css`, which Tailwind uses to generate utilities and to bake literals.
Change one without the other and they diverge silently — the runtime looks correct while
every baked literal keeps the stale value.

Two consequences, both non-negotiable:

- A token change edits **both** files, in the same commit.
- **Never** put an opacity modifier on a theme token (`text-on-surface/70`). It bakes the
  light-mode literal and breaks dark mode. Use a solid token, or `opacity-*` on the element.

### Role meaning
- **Primary is the accent.** It fills the one dominant action on a surface, and carries
  selected states, links, focus, and progress. Never a full-page heavy fill. Near-black is
  *ink*, not an action color — a near-black CTA reads as a professional tool, which is the
  wrong register for a learner surface.
- **Neutral button variants** exist for dense workbench surfaces where a saturated CTA in
  every row would be noise. One accent CTA per surface still applies.
- **Secondary** is a supporting accent — used sparingly, and never as a second CTA.
- **Reward** is XP, streaks, level-ups, badges, and celebratory CTAs. Nothing else.
- **Success** is correctness and completion. **Warning** and **error** are functional states,
  never decorative brand accents.
- **Info** and the chart roles serve data and explanation surfaces. Charts do not borrow CTA
  colors without a reason.

Rough balance on a product surface: ~70% surface and neutral, ~20% brand, ~10% semantic and
accent. When a screen feels loud, the brand share is usually why.

### Chart colors
`chart-1` … `chart-7`, defined for both themes. Intent beats index order: `chart-3` is
positive, `chart-4` is caution, `chart-7` is negative. Start a series at `chart-1`. Never a
raw hex, and never an opacity modifier on a chart token.

### Contrast and non-color signals
- Verify contrast for headings and body copy in **both** themes; AA is the floor.
- Do not place muted text on a tinted surface without measuring it.
- Semantic color is never the only signal — pair it with a label, an icon, or state text.

## Typography

One family does all UI work. The scale is tokenized the same way color is — a fixed set of
steps applied through utilities and primitives, never ad-hoc `text-[…]`/`tracking-[…]`.

### Font families
Three faces, loaded once via `next/font` in `apps/web/src/app/layout.tsx`. The `vietnamese`
subset is explicitly enabled on both faces that carry product copy, so stacked tone +
dot-below marks (`Ậ Ự Ợ Ệ Ộ`) render correctly. We do **not** use Apple's SF fonts — they are
licensed for Apple platforms only.

- **Inter** (`--font-inter`, weights 400/500/600/700) — display *and* all product UI. One
  family from hero headline to helper text; hierarchy comes from size and weight, never from
  switching face.
- **Noto Serif** (`--font-noto-serif`) — editorial and long-form reading (transcripts).
  Chosen over Lora, which has a Google Fonts bug that breaks Vietnamese dot-below stacks.
- **Geist Mono** (`--font-geist-mono`) — codes, timestamps, ids. Latin subset only; never set
  Vietnamese product copy in it.

The `type-*` utilities reference these `--font-*` variables directly. The `@theme inline`
`--font-*` tokens are **not** emitted as runtime custom properties, so `var(--font-sans)`
will not resolve — always go through a utility or primitive.

### Scale
Sizes are px at a 16px root. Each step bundles family + size + line-height + weight +
tracking. Color is deliberately excluded so steps compose with the color tokens
(`type-heading-lg text-on-surface`). Defined as Tailwind v4 `@utility` rules in
`apps/web/src/app/globals.css`; mirrored in `packages/shared` as `thinkfyTypography`.

| Step | Family | Size | Weight | Use |
|---|---|---|---|---|
| `type-display-xl/lg/md/sm` | Inter | fluid (clamp) → 72 / 56 / 44 / 36 max | 800 / 700 | hero & marketing headlines |
| `type-heading-xl` | Inter | 30 | 700 | page title (h1) |
| `type-heading-lg` | Inter | 24 | 700 | section (h2) |
| `type-heading-md` | Inter | 20 | 600 | sub-section (h3) |
| `type-title` | Inter | 16 / 20 lh | 500 | card and panel titles (h4) |
| `type-body` | Inter | 14 | 400 | default UI copy |
| `type-body-lg` | Inter | 18 | 400 | lede, marketing paragraphs |
| `type-body-sm` | Inter | 14 | 400 | readable paragraphs (looser leading) |
| `type-label` | Inter | 13 / 16 lh | 500 | form labels, dense metadata |
| `type-caption` | Inter | 12 | 500 | helper text, timestamps |
| `type-eyebrow` | Inter | 12 | 700 | uppercase kicker (0.14em tracking) |
| `type-code` | Geist Mono | 14 | 400 | codes, ids, timestamps |
| `type-prose` | Noto Serif | 16 | 400 | transcripts, long-form |

`type-body` and `type-body-sm` are the same size and differ only in line-height — 1.43 for
dense UI, 1.55 for paragraphs meant to be read. Reach for `type-body-lg` when copy needs to
breathe; do not bump a size to create emphasis.

### Primitives
`apps/web/src/components/ui/typography.tsx` — `<Display>`, `<Heading level={1..4}>`,
`<Eyebrow>`, `<Text variant>`, `<Stat>`, `<Code>`. Prefer a **primitive** for semantic
elements (headings, eyebrows, stat numbers, code, prose); use a bare **`type-*` utility**
for inline/leaf nodes where a component is overkill. All accept `className` (merged via
`cn()`) and an `as` element override.

### Rule
No arbitrary `text-[…]`, `tracking-[…]`, `leading-[…]`, `font-[…]`, or hardcoded
`font-family` in app code (emails are exempt — they need web-safe fonts). Enforced by the
typography pass in `scripts/design-system-audit.ts`, mirroring the color guard.

## Component Sourcing

Most of what we need already exists, made better than we would make it under time pressure.
Build order:

1. An existing internal primitive — `components/ui`, `components/data-viz`, `components/charts`.
2. An approved external source below, **copied exactly**.
3. Something new. Last resort; say in the PR why 1 and 2 did not fit.

### Approved sources

| Source | Use it for |
|---|---|
| [magicui](https://magicui.design/docs/components) | decorative and animated primitives — beams, grid patterns, bento grids. Already vendored in `components/magicui/`. |
| [Rare UI](https://www.rareui.com) | distinctive interaction components — sidebars, pickers, activity grids. shadcn CLI, one file per component. |
| [Beautiful UI](https://www.beautifului.dev) | AI-native interface primitives — thinking and loading states, streaming text, approval cards, chat composer, diff and record views. MIT. The natural source for coach, grading, and review surfaces. |
| [amicro](https://amicro.vercel.app) | React micro-transitions and interaction polish. Confirm its licence before vendoring. |

Anything outside this list gets a line in this document before it enters the repo.

### Take the code. Never rebuild it from memory.

The consistent failure is this: the source gets opened, the idea gets understood, and a weaker
version gets written from memory. That is more work for a worse component. Whichever mode
below applies, start from the actual source file — never from your recollection of how it
looked.

There are two legitimate modes, and every folder must say which one it is. Mixing them, or
leaving it unstated, is how geometry drifts silently.

### Mode 1 — Adapt (the default)

Take the code, then convert every **surface** value to our system. Structure, layout,
interaction, states and accessibility stay as written; the skin becomes ours. From that point
the file is our code and follows our system, including future token changes and sweeps.

Convert, without exception:

| Upstream | Becomes |
|---|---|
| any color literal or utility | a semantic role (§Color System) |
| any font size / weight / tracking | a `type-*` step |
| any radius | our ramp — `rounded-control`, `sm`, `md`, `lg`, `xl` |
| any icon import | `@/components/ui/icons` |
| any spacing literal | the Tailwind spacing scale |

> **The trap that makes literal copy-paste dangerous here.** Our scale **redefines Tailwind's
> class names with different values**. `rounded-lg` is `16px` in this codebase and `8px` in
> stock Tailwind; `rounded-xl` is `24px` here and `12px` there. So pasted markup keeps its
> class names, compiles without error, passes every audit — and renders at roughly double the
> radius the source intended. Re-check every `rounded-*` and spacing class against our scale
> when adapting. This has already shipped once: ~15 elements in the AI chat sit at double
> their intended radius.

Record the source in a `README.md` beside the components: the upstream URL, its licence, and
what was deliberately changed. `components/beautifului/` does this well.

### Mode 2 — Vendor (the exception)

Use only when you want to diff against upstream later or pull its updates — a library you are
tracking, not a component you are absorbing.

- Copy the file **verbatim**. Do not retype, simplify, or restyle it.
- Record the upstream URL **and commit SHA** in a header comment, so the copy can be diffed.
- Adapt only through documented props; wrap it rather than editing internals.
- Add the path to the allowlist in `scripts/design-system-audit.ts` with a comment saying the
  source is deliberately untouched, and **exclude it from mechanical sweeps**.
- Upstream typography and geometry stay upstream. Our utilities apply to the wrapper only.

### Which mode each folder is

| Folder | Mode |
|---|---|
| `components/charts/` | vendored (bklit/Visx) — verbatim, excluded from sweeps |
| `components/magicui/` | vendored — verbatim, excluded from sweeps |
| `components/beautifului/` | adapted — our tokens, follows our system, included in sweeps |

### Adoption QA
Before calling a vendored component done, capture the upstream demo and our integration at
the same viewport and device scale factor, and compare them side by side. Then verify
interaction, keyboard behavior, reduced motion, both themes, and both locales.

Upstream components often carry English-only or domain-specific semantics — a GitHub-style
activity grid means nothing to a learner. Keep the visual, hide it from assistive technology,
and pair it with a localized text equivalent rather than redrawing it.

## Component Guidance

### Control geometry
One control rhythm across the product. These are the shipped values; treat them as the
system, not as per-component choices.

| | Height | Radius |
|---|---|---|
| Button (default) | 32px | 12px (`rounded-control`) |
| Button `xs` / `sm` / `lg` | 24 / 28 / 36px | 8px |
| Badge | 20px | 6px |
| Data row | 40px | — |
| List / store row | 44px | — |

Radius scale: `sm` 6px · `md` 8px · `control` 12px · `lg` 16px · `xl` 24px. Controls use
`rounded-control`; never a literal. Do not invent a radius per component. Letter-spacing is `0` by default; mild negative
tracking is reserved for large headings.

### Buttons
- Geometry is fixed: `32px` height, `12px` radius (`h-8 rounded-control`). Sizes `xs`/`sm`/`lg` step to `24`/`28`/`36px`; icon-only buttons stay square.
- Primary button: `primary` fill, `on-primary` text. Secondary: `surface` with an `outline-variant` border.
- Text and link buttons carry color only — no fill.
- One dominant CTA per surface. `primary` for it (`default` is a legacy alias), `outline` for
  secondary actions, `ghost` for quiet utilities, `reward` only for XP and celebration, and
  `destructive` only for destruction.
- Icon-only buttons must use a stable square size and a tooltip or accessible label when the action is not obvious.
- Do not hand-roll new button styles unless the shared `Button` variants cannot express the required state.

### Cards
- Default card: `surface`. Grouped or recessed card: `surface-container-low` / `-high`.
- Border: `outline-variant`. Radius stays soft and consistent — do not invent a new one per card.
- Shadows are subtle and cool-toned, never muddy. Prefer a border or a surface step over a shadow.
- Never nest a card inside a card.

### Inputs
- Background `surface`, border `outline-variant`, placeholder `placeholder`.
- Focus ring is tokenized (`ring`) — custom focus colors are not allowed.

### Navigation
- Active row: `on-surface` text on a `surface-container-high` fill. Weight and fill carry the
  active state; icon tone is a secondary signal at most.
- Inactive row: `on-surface-variant`.
- Dividers and tab rails stay very subtle — `outline-variant` at most.

### Status
- `success` for confirmed positive states only. `warning` for caution, never for failure.
  `error` for errors and destruction. `info` for neutral notice.
- Status is never carried by color alone — pair it with a label, icon, or state text.

## Icon System

### Product Icon Source
DebateLab uses Phosphor as the production icon family for v1. The prior generated SVGs in `public/icons` are not production-ready and should not be used as the default product icon source unless a future designed asset pass explicitly replaces this rule.

All product code should import icons from `@/components/ui/icons`, never from `lucide-react` and never directly from `@phosphor-icons/react`. The only file allowed to import Phosphor directly is the governed registry at `src/components/ui/product-icon.tsx`.

### Registry Rule
- Use `ProductIcon` when adding new UI. Choose a semantic `name`, not a one-off library glyph.
- Existing migrated surfaces may use compatibility exports from `@/components/ui/icons`, but new work should prefer semantic names so icon meaning stays stable across sessions.
- If a concept is missing, add it to the registry with an approved Phosphor icon before using it.
- Do not introduce a second icon library without updating this document and the lint guard.

### Sizes And Weights
- Icon sizes are `xs: 14`, `sm: 16`, `md: 20`, `lg: 24`, `xl: 32`.
- Sidebar nav icons are `20px`.
- Compact buttons and metadata rows usually use `16px`.
- Page-title leading icons and feature/status icons may use `20px` to `24px`.
- Use Phosphor `regular` by default, `fill` only for selected/active/starred states, and `duotone` only for intentional feature or status emphasis.

### Tone Rules
- Icon color comes from the shared tone mapping: `current`, `muted`, `neutral`, `primary`, `success`, `warning`, `danger`, or `inverse`.
- Avoid one-off icon colors in product UI. If a tone is genuinely missing, add the semantic tone once.
- Keep sidebar icons quiet. Active state should read from the row highlight and text weight first, with icon tone as a secondary signal.

### Icon Direction
DebateLab icons should feel:
- clean
- simple
- readable at small sizes
- slightly refined, but not illustrative
- consistent with the calm, trustworthy product tone

Icons should support the interface, not compete with it.

### Core Rules
- icons should use a transparent background by default
- do not bake icons into colored tiles or cards
- containers, pills, or tinted circles should be added by the UI when needed, not by the icon asset itself
- avoid gradients inside icons
- avoid overly decorative shadows, glow, blur, or 3D effects
- use a flat, crisp look first
- keep silhouettes clear enough to understand at a glance

### Style Rules
- prefer simple geometric construction
- use rounded corners and soft line endings where appropriate
- keep icons visually calm and uncluttered
- avoid too many micro-details
- if extra detail is added, it must improve recognition, not ornament
- icons should still read clearly at small dashboard sizes

### Background and Contrast
- icons must work on white and near-white surfaces
- shapes must hold contrast against `surface`, `background`, and `surface-container-high`
- if a shape disappears on light surfaces, darken the fill or stroke rather than adding decorative effects

### Product Usage
For product UI:
- use simple SVG icons with transparent backgrounds
- keep them optimized for speed and clarity
- default sizes should be designed to scale well at `16`, `20`, `24`, and `32` px
- icons for navigation, cards, and metrics should feel like one family

### Detail Balance
The target is:
- more polished than a generic line icon
- less detailed than an illustration

Good icons should feel:
- product-grade
- instantly readable
- calm and modern

They should not feel:
- cartoonish
- noisy
- over-rendered
- like mini illustrations dropped into UI

## Dashboard Direction
When we apply this palette to the app, the dashboard should follow these rules:
- one dominant action area
- light background with white or near-white cards
- the accent carries hierarchy and action, not everywhere
- metrics should feel calm and readable, not gamified
- gradients should be soft and reserved

Recommended balance:
- 70% surface / neutral
- 20% brand and accent
- 10% semantic and accent color

## Reject These Defaults

Draft — cut what you disagree with. These are the reflexes that show up when a surface is
generated rather than designed. Naming them makes them a decision instead of a default.

- A card around every block. Cards nested inside cards. Borders used to repair weak hierarchy.
- Title, subtitle, card title, card description, and helper text all in one viewport. Remove a
  layer. A subtitle that explains what the visible controls already say is the first to go.
- A metric box for a number we did not measure, or four repeated metric boxes where one
  composed relationship would read faster.
- A badge, pill, or capsule for ordinary metadata.
- Icons in tinted tiles as decoration, oversized icons, or mixed icon weights in one view.
- Celebration for routine actions. Spending `reward` on ordinary completion devalues it for
  the moments that have earned it.
- Decorative gradients, glows, blobs, mesh backgrounds, glass, textures, ornamental shadows,
  fake depth.
- A generic card-grid skeleton that does not match the surface it is loading — or a skeleton
  with no resolution, no empty state, and no retryable error.
- Tiny muted copy used to make density fit. Cut content before shrinking type.
- Motivational paragraphs where a metadata chip would do.
- Coming-soon items, roadmap promises, or decorative cards inside a list of today's actions.
- Color as the only signal for a state.
- Em dashes in product copy.

Do not overcorrect into sterility. Restraint here means precise hierarchy, real evidence, and
celebration that is earned — not the removal of all warmth. Thinkfy product surfaces are
allowed to feel good; they are not allowed to feel unearned.

## In-App Feedback Popups

### Purpose
Feedback popups collect immediate product feedback without interrupting core practice work. They should feel like a respectful intercept: short, clear, localized, and easy to dismiss.

### Interaction Rules
- Show feedback popups only on safe protected pages, never during auth, onboarding, administration, or live practice sessions.
- Use the current app locale for all title, body, question, option, and thank-you copy.
- Keep surveys short: 1 to 5 questions is ideal, 8 questions is the hard maximum.
- Required questions should be obvious with a small `*`; validation should happen inline without losing entered answers.
- Completed feedback earns `50 Credits` and must show a calm thank-you state.

### Layout Rules
- Use a compact modal, not a full-screen interruption.
- Use 8px-radius controls inside the modal and avoid nested card-on-card styling.
- Primary action is the submit button; secondary actions are Later and Don’t ask again.
- Mobile layouts must keep rating scales, choices, and text inputs inside the modal width without horizontal scrolling.

### Admin Control Panel
- Admin pages use the same surface system as the rest of Administration.
- Builder previews should show English and Vietnamese side by side on desktop and stacked on mobile.
- Campaign status, delivery mode, response counts, average rating, and send-now actions must be visible without opening a detail page.

## Smart Popup Notification Pattern

### Purpose
Smart popups should feel like a Duolingo-style product nudge: compact, celebratory, practical, and easy to dismiss. This pattern applies to feature nudges, feedback surveys, rewards, and future notification modals. It replaces large hero art, pill-heavy labels, and paragraph copy with a small code-native celebration cluster, short action-first copy, and one tactile primary CTA.

### Modal Frame
- Desktop modal width is `560px` to `620px`; mobile uses `92vw`.
- Modal max height must stay inside the viewport with internal scrolling when survey content grows.
- Use a blurred/dimmed app backdrop, compact white surface, `24px` to `28px` radius, and a reachable circular close button.
- Do not place large square illustrations or generated mascot art at the top of smart popups in v1.
- Keep the frame visually light: no nested cards, no heavy header block, no extra eyebrow pill.

### Visual System
- Top decoration is a small celebration cluster only: target, check, star, chart, gift, clock, book, chat, or flame symbols.
- Eyebrow text is plain accent-colored text, not a pill.
- Title is action-first and preferably one line: `Drill rebuttal for 10 minutes.`
- Body is one sentence max and explains why now.
- Show `1` to `2` fact chips/rows, such as `Weakest skill`, `63/100`, `10 min`, or `+50 Credits`.
- Fact chips use quiet tinted surfaces, compact icons, and truncation-safe labels.

### Actions
- Primary CTA is full-width, `primary`-filled, and tactile: light top, darker bottom shadow, strong active press state.
- Secondary action is quiet outline text such as `Later`.
- Suppression action is link-weight text such as `Don't show again`; it must be visually quieter than the primary and secondary actions.
- CTA labels should name the next action: `Start rebuttal drill`, `Share feedback`, `Continue course`.

### Copy And Data Rules
- Feature nudge copy uses this formula: `Eyebrow` + `Action title` + `one why sentence` + `two facts` + `one CTA`.
- Feedback surveys use this formula: `Quick feedback` + `short ask` + `reward/time facts` + concise questions.
- Thank-you states show reward confirmation, one sentence, and one `Done` action.
- Template fields supported by popup copy and fact metadata: `{skillFocus}`, `{weakestSkill}`, `{lastScore}`, `{durationMinutes}`, and `{rewardCredits}`.
- Keep legacy `imageSrc` payload fields for compatibility, but do not render them by default in smart popup v1.

### QA Checklist
- No horizontal overflow at `390x844`, `768x1024`, `1280x720`, `1440x900`, `1728x1117`, or `2560x1440`.
- Modal never exceeds viewport height; if content grows, only the modal body scrolls.
- Primary CTA is visible without scrolling for feature nudges.
- Close button remains reachable.
- Vietnamese strings fit in titles, fact chips, action buttons, and survey controls.
- `Don't show again` remains quiet and never competes with the primary CTA.
- Survey validation is inline and preserves entered answers.
- Future visual directions that need artwork must use imagegen with the selected popup reference first, then store production assets as `.webp` under `public/images/smart-popups/`.

## Product Proportion System

### Purpose
DebateLab product UI should feel disciplined at 13-inch laptop sizes first. The reference rhythm is OnePrep's proportion system: a compact fixed sidebar, restrained content width, modest typography, and internal scrolling panes. Copy the layout discipline only — not its palette or type.

### App Shell
- Protected app shells use `h-dvh w-screen overflow-hidden`; the main pane is `min-w-0 flex-1 overflow-y-auto overflow-x-hidden`.
- Special live-practice flows may stay full-screen, but their phase body still owns `overflow-y-auto` below the top bar so growing notes, transcript, and action rails remain reachable.
- Avoid page-level `min-h-screen` inside the protected shell unless a route deliberately replaces the app frame.
- Do not allow horizontal document scrolling. If a surface needs overflow, it scrolls inside the relevant table, chart, or panel.

### Sidebar Rhythm
- Desktop student and admin sidebars are fixed at `w-55` / `220px`.
- Sidebar nav rows are `32px` tall (`h-8` or `min-h-8`), with `20px` icons, compact labels, and grouped utility rows at the bottom.
- Section labels use `12px` uppercase text with relaxed spacing only when grouping helps scanability.
- Persistent sidebars do not hold large promotional cards. Referral, upgrade, or campaign prompts should be compact rows in the rail or live inside dashboard content.
- Sidebar content may scroll internally, but the rail itself remains stable and never pushes the page wider.

### Containers
- Use the shared page container primitive for product pages.
- `focused`: `max-w-3xl` for auth, onboarding, focused forms, and narrow review tasks.
- `standard`: `max-w-5xl`, expanding to about `1504px` at `2xl`, for most product pages, profile, analytics, settings, history, and form/table hybrids.
- `wide`: `max-w-6xl`, expanding to about `1680px` at `2xl`, for dashboards, practice selection, course pages, and dense-but-readable workflows.
- `data`: `max-w-7xl`, expanding to about `1800px` at `2xl`, only for true admin data tables or special full-screen review surfaces that need the space.
- Large desktop and 27-inch displays should not leave product pages as a small centered island. Keep the 13-inch rhythm unchanged up to `1440px`, then allow dashboard, analytics, and data surfaces to widen one step at `2xl` while preserving readable line lengths inside cards.
- Remove ad hoc `max-w-[1400px]` style defaults unless the page is a real data-table surface.

### Type Scale
Use the `type-*` steps from §Typography; the ranges below are what they resolve to at
product density.
- Body and dense UI copy: `14px` (`type-body`).
- Card and compact panel titles: `16px` (`type-title`).
- Page titles: `24px` to `30px` (`type-heading-lg` / `type-heading-xl`).
- Stats and hero numerals may use `30px` to `36px`.
- Letter spacing should be `0` by default; use only mild negative tracking for large headings.

### Component Density
- Cards should use compact padding (`p-4` to `p-6`) and 8px to 16px radius unless an existing component family requires more.
- Avoid cards nested inside larger decorative cards.
- Buttons and inputs should keep labels on one line at 13-inch Safari widths in both English and Vietnamese.
- Four-column card grids should not appear at 13-inch laptop widths unless each card has enough measured width for its localized labels.

### Live Practice Flow
- Full-screen debate and speaking sessions may replace the app sidebar, but they still use the product rhythm: `56px`-ish top bars, `max-w-6xl` content, compact chips, and no hero-scale titles.
- Motion/topic panels should be readable workbench panels: compact metadata chips, `20px` to `22px` motion titles, one short context block, and row-like argument anchors.
- Timer panels should stay secondary to the motion and notes. Desktop timer dials should usually land around `160px` to `190px`; avoid oversized circular timers that force scrolling on a 13-inch Safari viewport.
- Notes and transcript panels use the same quiet card rhythm as the rest of the product: `p-4`, 8px radius, `14px` controls, and normal-flow action rails so buttons do not float over transcript text. Let the phase body scroll; do not trap note growth behind `overflow-hidden`.
- Practice session labels, controls, and phase names must be checked in English and Vietnamese. Do not ship English-only mic/audio/prep/speaking labels on a Vietnamese route.

### QA Checklist
- Check desktop widths `1280x720`, `1440x900`, and large desktop `2560x1440`; also check tablet `768x1024` and mobile `390x844`.
- Verify `document.documentElement.scrollWidth <= document.documentElement.clientWidth`.
- Verify no clipped labels, offscreen buttons, or text bleeding outside cards.
- Verify analytics/dashboard cards do not collide or truncate awkwardly at 13-inch Safari size.
- Verify English and Vietnamese labels fit the sidebar and primary controls.
- Capture Browser screenshots for dashboard, profile/analytics, practice, history, courses, chat, settings, onboarding, auth, landing, and admin after proportion changes.

## Quiet Product UX System

### Purpose
DebateLab product UI should feel calm, sparse, and action-led. The OnePrep lesson is not color or branding; it is that each screen has one obvious job, very little explanatory copy, and compact metadata in place of paragraphs.

### Page Contract
- Before designing a product page, name its primary object or action: start practice, ask the coach, review history, tune settings, choose a course, or inspect admin data.
- Everything on the page must either operate on that object, provide metadata about it, or be removed.
- Avoid using a subtitle to explain what the visible controls already say.
- Marketing pages may keep persuasive copy, but protected product pages should default to workbench clarity.

### Copy Budget
- Page title: usually 2 to 5 words.
- Page subtitle: optional, one line maximum, only when it resolves real uncertainty.
- Card titles: 2 to 5 words.
- Card descriptions: use only when the user needs the text to choose safely.
- Empty states: one sentence plus a clear action. Do not stack headline, subtitle, helper paragraph, and prompt cards.
- Preserve instructional lesson content, legal/security warnings, billing explanations, and destructive-action confirmations.

### Metadata Over Prose
- Replace explanatory sentences with compact metadata whenever possible: duration, score, progress, category, date, status, language, level, or cost.
- Prefer inline labels, chips, row captions, and right-aligned values over paragraphs.
- If a phrase is not needed for a decision, remove it before shrinking the font.

### Row-First Surfaces
- Suggestions, recent items, conversation history, next steps, and setup choices should usually be rows or list items.
- Use cards for real objects that need grouping, not for every action prompt.
- Rows should keep stable heights, predictable left/right alignment, and one-line labels at 13-inch Safari widths in English and Vietnamese.
- Avoid stacked decorative icons, shadows, and descriptions when a simple label plus chevron works.

### AI Coach Pattern
- The chat canvas has no large page header. The input and conversation are the product.
- Empty state uses a small mascot or mark, one sentence, 3 to 5 plain prompt rows, and the composer visible below.
- The conversation rail is compact: new chat, title-only rows, quiet active state, and delete affordances only on hover/focus.
- Assistant answers should read as plain text first. Use small callouts only when they add structure: `Tip`, `Common mistake`, `Try this`, `Example`, `Practice`, or `Next steps`.
- Avoid assistant badges, large avatars, and repeated coach identity text inside every message.

### Coach Dashboard Pattern
- The student dashboard's first job is to answer: "what should I do next?" The first viewport must show one recommended drill with one dominant CTA.
- Recommendation order is weakest scored skill below target, active course continuation, latest feedback review, then underused practice track. If data is sparse, fall back to a simple practice-start recommendation instead of a vague overview.
- Use generated dashboard graphics as supportive WebP assets inside the recommendation panel. They should contain no readable text, no logos, and no marketing composition; the CTA and metadata remain real UI.
- The recommendation panel uses compact metadata chips for duration, target, score, progress, or track. Avoid motivational paragraphs and oversized generic hero headlines.
- "Today plan" rows are concrete actions with direct routes. Do not include coming-soon items, roadmap promises, or decorative cards in this area.
- Quick actions are secondary shortcuts near the recommendation, not the primary dashboard experience.
- Recent practice stays row-first. Skill Snapshot and progress panels are secondary and compact, especially on 13-inch and 27-inch desktop layouts.

### Loading And Failure
- Skeletons should match the final surface, not a generic card grid.
- Chat, dashboard, and high-traffic pages must resolve, show useful empty state, or show a quiet retryable error. Do not leave users in an indefinite skeleton.
- Failed background personalization should not block the primary action when the user can still continue.

### QA Checklist
- Compare DebateLab against OnePrep in Safari for `/chat`, `/home`, `/study-planner`, and `/question-bank` before shipping major quiet UX changes.
- Check Browser viewports `1280x720`, `1440x900`, `2560x1440`, `768x1024`, and `390x844`.
- Verify no horizontal overflow, clipped prompt rows, hidden composer controls, or text bleeding in English and Vietnamese.
- Count copy density on every changed page: if a screen has title, subtitle, card title, card description, and helper text in the same viewport, remove one layer.

## Design System Hardening Contract

### Layers
- Primitive values live only in `@thinkfy/shared/design-system`. See §Color System for the
  role API and the dual-source rule.
- Components consume **component tokens** — button background/text/shadow, card
  background/border/shadow, input border and focus ring, badge tone pairs, progress fills —
  rather than reaching for raw roles.
- Web variables are emitted by `ThinkfyThemeVariables`; mobile derives from `getThinkfyTheme(mode)`.

### Component rules
- `Badge` tones carry product meaning; never a hardcoded pill color.
- Progress bars use `primary`, `reward`, or `success` — never an arbitrary fill.
- Inputs use the tokenized border, focus border, and focus ring.
- Do not hand-roll a variant the shared component already expresses.

### Literal-color exceptions
`scripts/design-system-audit.ts` holds the authoritative allowlist. Treat it as a **debt
ledger, not a design decision**: all but one category on it is a surface that has not been
migrated yet. Adding a path requires a comment saying why, and when it goes away. Vendored
third-party components (§Component Sourcing) are the one permanent category.

### Changing a token value
1. Edit `tokens.ts` **and** the `@theme inline` block in `globals.css` in the same commit.
   Editing one alone is how light and dark drift apart.
2. `npm run test:design-system && npm run audit:design-system`, then lint and typecheck.
3. Browser QA in **both themes** across landing, auth, dashboard, courses, practice,
   feedback/history, coach, profile, settings, and admin.
4. Any visible legacy color outside the allowlist is a failure.

## Chart System
- **Tokens:** the §Chart Colors palette is promoted to `--color-chart-1..7` (light + dark), plus `--color-chart-grid/axis/tooltip-bg/tooltip-text/crosshair`. Source of truth: `@thinkfy/shared/design-system` (mirrored in `globals.css`). Semantic intent over index order: `chart-3` = positive, `chart-4` = caution, `chart-7` = negative.
- **Engine:** one engine — the vendored bklit ChartKit (Visx) under `apps/web/src/components/charts/`, re-themed via a single `--chart-*` → `var(--color-chart-*)` bridge in `globals.css` (auto theme-switches, incl. nested `.dark`). Import chart roots + parts from `@/components/charts` (`AreaChart/BarChart/LineChart/RadarChart/RingChart/HeatmapChart` + `Grid/XAxis/ChartTooltip/...`).
- **Primitives:** `@/components/data-viz` — `ChartCard` (shell), `StatCard` (KPI + count-up + sparkline), `Sparkline`, `SegmentedRange`, `DashboardSectionHeader`, and `ChartSkeleton/ChartEmpty/ChartError`.
- **Rules:** series colors use `var(--chart-line-primary|secondary)` or `var(--color-chart-1..7)` — never raw hex, never `/opacity` on a chart token (use `opacity-*`). `components/charts/` is audit-allowlisted (vendored); every consuming surface is token-clean and audit-enforced.
- **Reference:** the `/dashboard/admin/ui-system` styleguide; full plan in `docs/analytics-ui-revamp-masterplan.md`.

## Motion System
- **Tokens:** `thinkfyMotion` in `@thinkfy/shared` — `duration` (fast/base/slow), `ease` (standard/emphasized/overshoot), `spring` (soft/snappy). CSS mirrors: `--motion-duration-*` / `--motion-ease-*`.
- **Kit:** `@/components/motion` — `PageTransition`, `Stagger`/`StaggerItem`, `AnimatedNumber`, `Shimmer`, `SuccessCheck`, `Swap`, `Shake` (variants in `@/lib/motion/variants`). Built on framer-motion from the transitions.dev vocabulary; all respect `prefers-reduced-motion`.

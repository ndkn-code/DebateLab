# DebateLab Design System

## Purpose
This document defines the next visual direction for DebateLab based on the provided color profile.

The target feeling is:
- clean
- modern
- trustworthy
- light and airy
- calm, intelligent, and confident

This should become the visual source of truth before we roll the palette into the app.

## Design Intent
DebateLab should feel:
- more credible than playful
- more polished than flashy
- more structured than decorative

The palette is centered on calm blues, soft neutrals, and very light surfaces. That means:
- blue should carry action and emphasis
- neutrals should carry readability and structure
- semantic colors should be used sparingly and functionally
- gradients should feel soft and premium, not loud

## Core Palette

### Primary
- `Primary Dark`: `#0788A0`
- `Primary`: `#00B8D9`
- `Primary Light`: `#8BE8F7`

### Surface
- `Background`: `#F3FCFE`
- `Surface`: `#FFFFFF`
- `Surface Alt`: `#E5F8FC`
- `Border / Divider`: `#CDECF3`

## Neutral / Grayscale
- `Heading`: `#102936`
- `Text Strong`: `#102936`
- `Text`: `#657B84`
- `Text Muted`: `#657B84`
- `Muted`: `#8A96A8`
- `Placeholder`: `#BCC6D3`
- `Border Soft`: `#D9E5F4`
- `Disabled`: `#E5F8FC`

## Semantic Colors
- `Success`: `#34C759`
- `Info`: `#00B8D9`
- `Warning`: `#F5B942`
- `Error`: `#EF6A6A`

## Chart Colors
Use these for analytics, history charts, and progress visuals:
- `#00B8D9`
- `#8BE8F7`
- `#34C759`
- `#F5B942`
- `#7B61FF`
- `#00B8D9`
- `#FF7A59`

Rules:
- start charts with blue first
- use green for improvement / positive performance
- use amber for caution
- use red-orange for drop-off / risk only when meaningfully negative

## Gradients

### Primary Gradient
- `#8BE8F7` -> `#00B8D9`
- Use for hero accents, key CTA emphasis, selected states, and premium-feeling highlights.

### Hero Gradient
- `#F3FCFE` -> `#E5F8FC`
- Use for large page backgrounds, landing hero sections, dashboard spotlight containers.

### Soft Blue Gradient
- `#FFFFFF` -> `#E5F8FC`
- Use for section backgrounds, information panels, and subtle card emphasis.

### Card Gradient
- `#FFFFFF` -> `#F3FCFE`
- Use for elevated panels, large dashboard cards, and soft shells.

## Color Role Mapping

### Primary
Use for:
- primary buttons
- active tabs
- links
- key icons
- progress indicators
- selected states

Do not use primary blue as a full-page heavy fill.

### Primary Light
Use for:
- hover states
- soft selected backgrounds
- icon containers
- subtle callout backgrounds

### Surface Alt
Use for:
- grouped panels
- dashboard sections
- muted content blocks
- cards inside larger white surfaces

### Border
Use for:
- dividers
- input borders
- card outlines
- segmented controls

### Heading
Use for:
- page titles
- major section titles
- card titles
- critical content

### Text
Use for:
- body text
- labels
- paragraph copy

### Text Muted / Muted
Use for:
- supporting copy
- timestamps
- helper text
- empty state descriptions

### Disabled
Use for:
- disabled buttons
- inactive controls
- unavailable states

## Typography

Typography is tokenized the same way color is: a fixed set of families and a semantic
scale, applied through utilities and primitives — never ad-hoc `text-[…]`/`tracking-[…]`.

### Font families
All four are open-source and cover Vietnamese (including stacked tone + dot-below marks
like `Ậ Ự Ợ Ệ Ộ`). We do **not** use Apple's SF fonts — they are licensed for Apple
platforms only.

- **Display — Nunito.** Rounded, friendly headline face for marketing/brand moments (the Duolingo "characterful display" role).
- **Body / UI — Be Vietnam Pro.** Clean neo-grotesque designed by Vietnamese designers; the global default and the workhorse for all product UI.
- **Serif — Noto Serif.** Editorial/long-form reading (transcripts). Chosen over Lora, which has a Google Fonts bug that breaks Vietnamese dot-below stacks.
- **Mono — Geist Mono.** Codes, transcripts, timestamps, ids.

Loaded once via `next/font` in `apps/web/src/app/layout.tsx` (`--font-nunito`,
`--font-be-vietnam`, `--font-noto-serif`, `--font-geist-mono`) and mapped to
`--font-display/sans/serif/mono` in `globals.css`.

### Scale
Defined as Tailwind v4 `@utility type-*` rules in `apps/web/src/app/globals.css`
(documented in `packages/shared` as `thinkfyTypography`). Each step bundles
family + size + line-height + weight + tracking. Color is intentionally separate —
compose with the color tokens (e.g. `type-heading-lg text-on-surface`).

| Step | Family | Size | Weight | Use |
|---|---|---|---|---|
| `type-display-xl/lg/md/sm` | Nunito | fluid (clamp) → 72 / 56 / 44 / 36 max | 800/700 | hero & marketing headlines |
| `type-heading-xl` | Be Vietnam Pro | 30 | 700 | page title (h1) |
| `type-heading-lg` | Be Vietnam Pro | 24 | 700 | section (h2) |
| `type-heading-md` | Be Vietnam Pro | 20 | 600 | sub-section (h3) |
| `type-title` | Be Vietnam Pro | 17 | 600 | card title (h4) |
| `type-body-lg` / `type-body` / `type-body-sm` | Be Vietnam Pro | 18 / 16 / 14 | 400 | lead / paragraphs / dense copy |
| `type-caption` | Be Vietnam Pro | 12 | 500 | meta, helper text |
| `type-label` | Be Vietnam Pro | 13 | 600 | form labels |
| `type-eyebrow` | Be Vietnam Pro | 12 | 700 | uppercase kicker |
| `type-code` | Geist Mono | 14 | 400 | codes, timestamps |
| `type-prose` | Noto Serif | 16 | 400 | transcripts, long-form |

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

## Component Guidance

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

### Color Rules
- default icon colors should come from the approved palette only
- primary icon color: `#00B8D9`
- darker emphasis / stroke: `#0788A0`
- supporting light fill: `#8BE8F7`
- optional neutral support: `#CDECF3` or `#E5F8FC`

Do not:
- use unapproved saturated colors
- use purple-first icon styling
- use gradient fills
- use white-on-white shapes with weak contrast

### Background and Contrast
- icons must work on white and near-white surfaces
- shapes should maintain enough contrast against `#FFFFFF`, `#F3FCFE`, and `#E5F8FC`
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

### Buttons
- Primary button: `#00B8D9` background, white text
- Primary hover: slightly darker blue or subtle gradient depth
- Secondary button: white background, `#CDECF3` border, primary text
- Text button / link: primary text with no heavy fill
- Use one dominant primary CTA per surface.
- Use `default` only for the primary action, `outline` for secondary actions, `ghost` for quiet utilities, and `destructive` only for destructive actions.
- Icon-only buttons must use a stable square size and a tooltip or accessible label when the action is not obvious.
- Do not hand-roll new button styles unless the shared `Button` variants cannot express the required state.

### Cards
- Default card background: `#FFFFFF`
- Secondary card background: `#F3FCFE` or `#E5F8FC`
- Border: `#CDECF3`
- Radius should stay soft and modern
- Shadows should be subtle and cool-toned, not muddy

### Inputs
- Background: white
- Border: `#CDECF3`
- Placeholder: `#BCC6D3`
- Focus ring: derived from `#8BE8F7` / `#00B8D9`

### Navigation
- Active item: blue text on very light blue background
- Inactive item: text or muted text
- Dividers and tab rails should remain very subtle

### Status
- Success: green only for confirmed positive states
- Warning: amber for caution, not failure
- Error: red only for errors or destructive actions
- Info: primary blue

## Dashboard Direction
When we apply this palette to the app, the dashboard should follow these rules:
- one dominant action area
- light background with white or near-white cards
- blue used for hierarchy and action, not everywhere
- metrics should feel calm and readable, not gamified
- gradients should be soft and reserved

Recommended balance:
- 70% surface / neutral
- 20% blue family
- 10% semantic and accent color

## Accessibility Notes
- maintain strong contrast for headings and body text
- avoid placing muted text on tinted blue surfaces unless contrast is verified
- do not use `Primary Light` as text color on white for important content
- semantic colors must not be the only signal; pair with label, icon, or state text

## Implementation Notes
When we roll this into the project, we should map these values into:
- global CSS variables
- semantic tokens, not raw hex usage
- component-level variants for buttons, cards, tabs, badges, and inputs

Recommended token structure:

```css
--color-background: #F3FCFE;
--color-surface: #FFFFFF;
--color-surface-alt: #E5F8FC;
--color-border: #CDECF3;

--color-primary: #00B8D9;
--color-primary-light: #8BE8F7;
--color-primary-dark: #0788A0;

--color-heading: #102936;
--color-text-strong: #102936;
--color-text: #657B84;
--color-text-muted: #657B84;
--color-muted: #8A96A8;
--color-placeholder: #BCC6D3;
--color-disabled: #E5F8FC;

--color-success: #34C759;
--color-info: #00B8D9;
--color-warning: #F5B942;
--color-error: #EF6A6A;
```

## Adoption Plan
Recommended rollout order:
1. define global color tokens
2. update surfaces, borders, and typography colors
3. update buttons, tabs, badges, and inputs
4. update dashboard and course cards
5. update charts and status states
6. clean up any remaining hardcoded colors

## Non-Goals
This palette should not push the product toward:
- neon gradients
- dark-heavy UI
- overly playful gamification
- saturated multi-color surfaces
- purple-first branding

The visual direction should stay blue-led, editorial, and trustworthy.

## In-App Feedback Popups

### Purpose
Feedback popups collect immediate product feedback without interrupting core practice work. They should feel like a respectful intercept: short, clear, localized, and easy to dismiss.

### Color Profile
- `Primary`: `#00B8D9`
- `Primary Dark`: `#0788A0`
- `Primary Light`: `#8BE8F7`
- `Background`: `#F3FCFE`
- `Surface`: `#FFFFFF`
- `Surface Alt`: `#E5F8FC`
- `Border`: `#CDECF3`
- `Heading`: `#102936`
- `Text`: `#657B84`
- `Muted`: `#657B84`
- `Success`: `#34C759`
- `Warning`: `#F5B942`
- `Error`: `#EF6A6A`

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
- Admin pages use the same light-blue surface system as the rest of Administration.
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
- Eyebrow text is plain blue text, not a pill.
- Title is action-first and preferably one line: `Drill rebuttal for 10 minutes.`
- Body is one sentence max and explains why now.
- Show `1` to `2` fact chips/rows, such as `Weakest skill`, `63/100`, `10 min`, or `+50 Credits`.
- Fact chips use quiet blue-tinted surfaces, compact icons, and truncation-safe labels.

### Actions
- Primary CTA is full-width, blue-filled, and tactile: light top, darker bottom shadow, strong active press state.
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
DebateLab product UI should feel disciplined at 13-inch laptop sizes first. The reference rhythm is OnePrep's proportion system: a compact fixed sidebar, restrained content width, modest typography, and internal scrolling panes. Keep DebateLab's blue-led brand and Plus Jakarta Sans; copy the layout discipline, not OnePrep's palette.

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
- Keep Plus Jakarta Sans.
- Body and dense UI copy: `14px` to `16px`.
- Card titles and compact panel titles: `14px` to `16px`.
- Page titles: `24px` to `32px`.
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

### Token Layers
- Primitive colors live only in `@thinkfy/shared/design-system`.
- App surfaces consume semantic roles, not raw hex values: `primary`, `onPrimary`, `surface`, `onSurface`, `outline`, `reward`, `success`, `warning`, `error`, `info`, `chart`, and `courseAccent`.
- Components consume component tokens: button background/text/shadow, card background/border/shadow, input border/focus ring, badge tone pairs, and progress fills.
- Web variables are emitted by `ThinkfyThemeVariables`; mobile colors derive from `getThinkfyTheme(mode)`.
- `globals.css` may keep fallback values for Tailwind class generation, but the shared token source is the product contract.

### Product Meaning
- Primary is for habit-building CTAs, selected states, and the one dominant action on a surface.
- Reward is for XP, streaks, level-up moments, badges, and celebratory CTAs.
- Success is for correctness, completion, and healthy status.
- Warning and error are functional states only; do not use them as decorative brand accents.
- Info and chart colors support data visualization and coach/explanation surfaces; charts should not steal CTA colors without a reason.

### Component Rules
- Use `<Button variant="primary" />` or `<Button variant="default" />` for dominant CTAs. `default` remains an alias for compatibility.
- Use `<Button variant="reward" />` only for XP/streak/celebration actions.
- Use `Badge` tones for product meaning instead of hardcoded pill colors.
- Inputs use tokenized border, focus border, and focus ring; custom focus colors are not allowed.
- Progress bars use `primary`, `reward`, or `success` tones instead of arbitrary fills.

### Allowed Literal Color Exceptions
- Shared design-token source.
- Generated theme variable bridge.
- Tailwind fallback variables in `globals.css`.
- Email templates and unsubscribe HTML.
- Chart/data-viz palettes.
- Course artwork palette modules.
- Dashboard, debate, and feedback visualization palettes.
- Landing, onboarding, practice, and profile visualization palettes.
- Profile banner presets and Supabase-stored `banner_color` defaults.
- Static SVG/bitmap assets.

### Palette Swap Workflow
1. Update only `@thinkfy/shared/design-system`.
2. Run `npm run test:design-system` and `npm run audit:design-system`.
3. Run web/mobile typechecks and lint.
4. Use Browser QA on landing, auth, dashboard, courses, practice, feedback/history, chat/coach, leaderboards, profile/social, settings, admin, and dev QA pages.
5. Capture screenshots for changed surfaces and compare against the approved imagegen reference board.
6. Any visible legacy primary color outside the approved exceptions is a failure.

## Chart System
- **Tokens:** the §Chart Colors palette is promoted to `--color-chart-1..7` (light + dark), plus `--color-chart-grid/axis/tooltip-bg/tooltip-text/crosshair`. Source of truth: `@thinkfy/shared/design-system` (mirrored in `globals.css`). Semantic intent over index order: `chart-3` = positive, `chart-4` = caution, `chart-7` = negative.
- **Engine:** one engine — the vendored bklit ChartKit (Visx) under `apps/web/src/components/charts/`, re-themed via a single `--chart-*` → `var(--color-chart-*)` bridge in `globals.css` (auto theme-switches, incl. nested `.dark`). Import chart roots + parts from `@/components/charts` (`AreaChart/BarChart/LineChart/RadarChart/RingChart/HeatmapChart` + `Grid/XAxis/ChartTooltip/...`).
- **Primitives:** `@/components/data-viz` — `ChartCard` (shell), `StatCard` (KPI + count-up + sparkline), `Sparkline`, `SegmentedRange`, `DashboardSectionHeader`, and `ChartSkeleton/ChartEmpty/ChartError`.
- **Rules:** series colors use `var(--chart-line-primary|secondary)` or `var(--color-chart-1..7)` — never raw hex, never `/opacity` on a chart token (use `opacity-*`). `components/charts/` is audit-allowlisted (vendored); every consuming surface is token-clean and audit-enforced.
- **Reference:** the `/dashboard/admin/ui-system` styleguide; full plan in `docs/analytics-ui-revamp-masterplan.md`.

## Motion System
- **Tokens:** `thinkfyMotion` in `@thinkfy/shared` — `duration` (fast/base/slow), `ease` (standard/emphasized/overshoot), `spring` (soft/snappy). CSS mirrors: `--motion-duration-*` / `--motion-ease-*`.
- **Kit:** `@/components/motion` — `PageTransition`, `Stagger`/`StaggerItem`, `AnimatedNumber`, `Shimmer`, `SuccessCheck`, `Swap`, `Shake` (variants in `@/lib/motion/variants`). Built on framer-motion from the transitions.dev vocabulary; all respect `prefers-reduced-motion`.

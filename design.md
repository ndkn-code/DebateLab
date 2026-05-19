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
- `Primary Dark`: `#3E78EC`
- `Primary`: `#4D86F7`
- `Primary Light`: `#A9C6FB`

### Surface
- `Background`: `#F7FAFE`
- `Surface`: `#FFFFFF`
- `Surface Alt`: `#F1F6FD`
- `Border / Divider`: `#DEE8F8`

## Neutral / Grayscale
- `Heading`: `#0B1424`
- `Text Strong`: `#162033`
- `Text`: `#415069`
- `Text Muted`: `#718096`
- `Muted`: `#8A96A8`
- `Placeholder`: `#BCC6D3`
- `Border Soft`: `#D9E5F4`
- `Disabled`: `#EEF2F7`

## Semantic Colors
- `Success`: `#34C759`
- `Info`: `#4D86F7`
- `Warning`: `#F5B942`
- `Error`: `#EF6A6A`

## Chart Colors
Use these for analytics, history charts, and progress visuals:
- `#4D86F7`
- `#A9C6FB`
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
- `#A9C6FB` -> `#4D86F7`
- Use for hero accents, key CTA emphasis, selected states, and premium-feeling highlights.

### Hero Gradient
- `#F7FAFE` -> `#EEF4FF`
- Use for large page backgrounds, landing hero sections, dashboard spotlight containers.

### Soft Blue Gradient
- `#FFFFFF` -> `#F1F6FD`
- Use for section backgrounds, information panels, and subtle card emphasis.

### Card Gradient
- `#FFFFFF` -> `#F7FAFE`
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
- primary icon color: `#4D86F7`
- darker emphasis / stroke: `#3E78EC`
- supporting light fill: `#A9C6FB`
- optional neutral support: `#DEE8F8` or `#F1F6FD`

Do not:
- use unapproved saturated colors
- use purple-first icon styling
- use gradient fills
- use white-on-white shapes with weak contrast

### Background and Contrast
- icons must work on white and near-white surfaces
- shapes should maintain enough contrast against `#FFFFFF`, `#F7FAFE`, and `#F1F6FD`
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
- Primary button: `#4D86F7` background, white text
- Primary hover: slightly darker blue or subtle gradient depth
- Secondary button: white background, `#DEE8F8` border, primary text
- Text button / link: primary text with no heavy fill
- Use one dominant primary CTA per surface.
- Use `default` only for the primary action, `outline` for secondary actions, `ghost` for quiet utilities, and `destructive` only for destructive actions.
- Icon-only buttons must use a stable square size and a tooltip or accessible label when the action is not obvious.
- Do not hand-roll new button styles unless the shared `Button` variants cannot express the required state.

### Cards
- Default card background: `#FFFFFF`
- Secondary card background: `#F7FAFE` or `#F1F6FD`
- Border: `#DEE8F8`
- Radius should stay soft and modern
- Shadows should be subtle and cool-toned, not muddy

### Inputs
- Background: white
- Border: `#DEE8F8`
- Placeholder: `#BCC6D3`
- Focus ring: derived from `#A9C6FB` / `#4D86F7`

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
--color-background: #F7FAFE;
--color-surface: #FFFFFF;
--color-surface-alt: #F1F6FD;
--color-border: #DEE8F8;

--color-primary: #4D86F7;
--color-primary-light: #A9C6FB;
--color-primary-dark: #3E78EC;

--color-heading: #0B1424;
--color-text-strong: #162033;
--color-text: #415069;
--color-text-muted: #718096;
--color-muted: #8A96A8;
--color-placeholder: #BCC6D3;
--color-disabled: #EEF2F7;

--color-success: #34C759;
--color-info: #4D86F7;
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
- `Primary`: `#4D86F7`
- `Primary Dark`: `#3E78EC`
- `Primary Light`: `#A9C6FB`
- `Background`: `#F7FAFE`
- `Surface`: `#FFFFFF`
- `Surface Alt`: `#F1F6FD`
- `Border`: `#DEE8F8`
- `Heading`: `#0B1424`
- `Text`: `#415069`
- `Muted`: `#718096`
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

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
- Special live-practice flows may stay full-screen, but their top bars and panels still follow the same type, spacing, and container discipline.
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
- `standard`: `max-w-5xl` for most product pages, profile, analytics, settings, history, and form/table hybrids.
- `wide`: `max-w-6xl` for dashboards, practice selection, course pages, and dense-but-readable workflows.
- `data`: `max-w-7xl` only for true admin data tables or special full-screen review surfaces that need the space.
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

### QA Checklist
- Check desktop widths `1280x720` and `1440x900`, tablet `768x1024`, and mobile `390x844`.
- Verify `document.documentElement.scrollWidth <= document.documentElement.clientWidth`.
- Verify no clipped labels, offscreen buttons, or text bleeding outside cards.
- Verify analytics/dashboard cards do not collide or truncate awkwardly at 13-inch Safari size.
- Verify English and Vietnamese labels fit the sidebar and primary controls.
- Capture Browser screenshots for dashboard, profile/analytics, practice, history, courses, chat, settings, onboarding, auth, landing, and admin after proportion changes.

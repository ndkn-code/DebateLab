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

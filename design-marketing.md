# Thinkfy Marketing Design

Authority for public, logged-out surfaces: the two product landing pages, and anything else a
stranger sees before signing in. Product surfaces are governed by `design.md`; read this one
in addition to it, not instead of it.

Tokens, type scale, icons, charts, and the component-sourcing rules all still apply. What
changes here is posture and composition.

## Posture

Product surfaces are warm and encouraging. Marketing surfaces are **restrained and
editorial** — the argument does the persuading, not the decoration. Confidence comes from
specificity and from being visibly honest about limits; never from hype, borrowed authority,
or invented numbers.

Both products share one shell. They differ in exactly two places: the hero panel and the
deep-proof spread. Everywhere else, differing means swapping strings — if a section needs a
structurally different layout per product, question whether the section is earning its place.

## Grid and shell

- `Shell` is the only container: `max-w-[1200px]`, padding `20 / 32 / 40px` by breakpoint.
- One 12-column editorial grid. Sections are separated by a hairline `border-b
  border-outline-variant`, not by alternating background bands.
- The section-head split is 4 columns for the mark, 8 for the headline and lede. It collapses
  to a single stacked column below `lg`.
- Vertical rhythm is `py-20 / 24 / 28` at `base / sm / lg`. Do not tune it per section.

## Section vocabulary

Use these; do not invent a parallel set.

| Primitive | What it is |
|---|---|
| `Shell` | the container. Never nest two. |
| `SectionMark` | short rule + optional numbered index + eyebrow. Marks a section start. |
| `SectionHead` | `split` or `stacked` — mark, `type-display-sm` headline, `type-body-lg` lede. |
| `Rule` | hairline divider, `aria-hidden`. |
| `Chip` | `neutral` / `accent` / `positive` / `caution`. |
| `Prose` | serif. Reserved for the learner's own words and exam material — never for our copy. |
| `Eyebrow` | `muted` / `accent` / `inverse`. |
| `Reveal` | scroll reveal. See Motion. |

**`Chip` tone `caution` is reserved for anything provisional.** Predicted bands, estimates,
and preview features must read differently from neutral metadata at a glance. Do not spend
`caution` on ordinary emphasis.

## Composition

Section order on both pages: hero → loop strip → capability grid → deep proof → audience
split → honesty band → FAQ → final CTA.

- **The hero panel is real product UI**, composed from real components — not a screenshot, not
  a mockup, not a browser chrome frame. Depth comes from layering: an offset plate behind a
  bordered surface. No drop shadows standing in for hierarchy, no glass, no glow.
- **Measures are deliberate.** Hero headline `15ch`, hero lede `52ch`, section headline `22ch`,
  section lede `58ch`, stacked blocks `46ch`. Rewrite copy before widening a measure.
- **Every claim needs a home.** One evidence location per claim; a later section may hold the
  detail, but two sections must not make the same point at equal prominence.
- End on the decision, not on a ledger.

## Copy

- **Never present an unmeasured number as a metric.** The honesty band is top-ruled editorial
  columns rather than stat cards precisely so nothing reads as a measurement we did not take.
  No user counts, no score-improvement claims, no "trusted by" logos we have not earned.
- Sentence case headlines that state a specific claim, not a category label.
- Name the limit where one exists. A stated constraint reads as confidence; an omitted one
  reads as a gap once found.
- Copy lives in `copy-shared.ts`, `copy-debate.ts`, `copy-ielts.ts` — never inline in a
  component. Both locales ship together; Vietnamese is not a follow-up.

## Motion

`Reveal` is **additive only**: content renders in its final state by default, and the
animation arms on mount only for elements that start below the fold. Anything already on
screen — including a section reached by an in-page anchor — is never left invisible waiting
for a frame. `prefers-reduced-motion` skips the motion path entirely.

Keep it that way. A reveal that can hide content on a slow connection or a failed hydration is
a bug, not an effect.

## Reject these defaults

Draft — cut what you disagree with.

- Every section wrapped in a reveal, so the whole page has one silhouette and one cadence.
- Identical section shapes for unrelated arguments. Repetition is rhythm only between true
  peers; otherwise it is template noise.
- Stat cards for numbers we did not measure.
- A card around anything that spacing and a rule could separate. No card inside a card.
- Gradient text, glows, blobs, mesh backgrounds, glass, ornamental shadows, fake depth.
- A badge or pill for ordinary metadata.
- Centered hero copy over a card grid — the generic AI-landing silhouette.
- Icons in tinted tiles used as decoration.
- Logo walls, testimonial slots, or "as seen in" rows with nothing real to put in them.
- Em dashes in body copy.
- A subtitle that restates the headline in longer words.

## QA

Before shipping a marketing change:

- Both locales. Vietnamese runs longer — check headlines, chips, nav, and buttons.
- Both themes.
- `1280×720`, `1440×900`, `2560×1440`, `768×1024`, `390×844`; no document-level horizontal
  overflow at any of them.
- Reduced motion: content complete and readable with the motion path disabled.
- Keyboard: header nav, in-page anchors, FAQ disclosure, and every CTA reachable and visibly
  focused.
- Every CTA resolves to a real route in both the logged-in and logged-out states.

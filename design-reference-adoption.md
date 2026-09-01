# Adopting a visual reference

Protocol for "make it look like this" — a screenshot, a live site, a Dribbble shot, a
competitor's app. Read this **before writing any code** for that task.

`design.md` §Component Sourcing covers vendoring a component whose source you have. This
covers matching a design you can only see.

## Why the naive attempt fails

"Make it look like this reference" gives a model nothing to check itself against. It
approximates, declares done, and the result reads as a weaker cousin of the reference — right
colors, wrong composition. The fix is to make the target *explicit and measurable* before any
code exists, then compare renders rather than impressions.

The same failure in the other direction: handing over a component library and saying "use
this." A library supplies parts. What makes a screen look designed is composition —
what leads, what is emphasized, what got cut, how dense it sits. Parts without a composition
brief produce generic arrangement. Extract the composition too, or you have copied nothing
that matters.

## Phase 0 — Decide what you are copying

Say this out loud before starting, because it is usually not what it feels like.

| Always copy | Never copy | Judgment call |
|---|---|---|
| Composition and information hierarchy | Brand palette | Corner radii |
| Density — px per column, lines per block | Logo, wordmark, brand marks | Shadow language |
| Control fidelity and affordances | Typeface, when it conflicts with ours | Motion and transitions |
| Spacing rhythm and alignment | Product-specific content and copy | Iconography weight |
| What the reference chose to omit | Anything implying their identity | Illustration style |

Most of what reads as "polish" in a reference is in the first column. Almost none of it is in
the second. If the extraction ends up mostly about color, it was done wrong.

## Phase 1 — Extract, before any code

Write this out. No implementation until it exists — an unwritten spec is the thing that lets
"close enough" pass.

**Frame**
- Viewport of the reference, and whether it is a real app or a marketing mockup. Mockups add a
  floating canvas, page-tint, and shadow that a real app does not have. Do not copy chrome
  that only exists because it is a presentation.

**Grid and density**
- Column count, and usable px per column. Compute it.
- Content width, gutters, page padding at each breakpoint.
- For any repeating unit: lines of text per block, and what is on each line.

**Spacing and shape**
- The spacing steps actually used, in ascending order. Reference designs rarely use more than
  five or six.
- Radii per component class. Border widths. Where borders are used at all versus spacing.

**Type**
- Every distinct size/weight pair, with what it is used for. Count them — a disciplined
  reference usually has 5–8 and yours probably has more.
- Where hierarchy comes from: size, weight, color, or position.

**Color, as roles not values**
- Canvas, surface, raised surface. Ink, muted ink. One line/border tone.
- The accent, and every place it appears. Count those places; restraint is usually the point.
- Data or category fills: how many distinct ones, how saturated, bordered or not.

**Components**
- Inventory every distinct control. For each: is it custom or native, what states are shown,
  what does its resting state look like.

**Composition decisions** — the part that is usually skipped
- What occupies the most valuable space, and why it earns it.
- What the reference chose *not* to show.
- Where the eye lands first, and what makes it land there.

## Phase 2 — Map to our system

Every extracted value becomes one of three things. Write which:

1. **An existing token or primitive.** Default. `#0F766E` accent → `primary`.
2. **A new token**, added to `tokens.ts` *and* `globals.css` per design.md §Color System.
3. **A deliberate exception**, with a one-line reason.

A raw value that is none of these is a bug the audit will catch. Extraction never licenses
literals.

**Check class names, not just values.** Our scale reuses Tailwind's names with different
numbers — `rounded-lg` is 16px here versus 8px upstream, `rounded-xl` is 24px versus 12px. Any
class copied from a reference implementation renders differently here while looking identical
in the source. Resolve every `rounded-*` and spacing class explicitly.

If the reference's palette conflicts with ours, ours wins — see Phase 0. Structure is the
thing being copied.

## Phase 3 — Inventory before building

List which of our existing primitives cover the extracted components, and which are genuinely
missing. Do this explicitly, because the most common polish failure is not bad taste — it is
hand-rolling a control that already exists in `components/ui/`, and getting the browser
default instead.

**Native `<select>`, `<input type="date">`, and unstyled `<input>` are the loudest
unfinished signals in any interface.** If the extraction shows a custom dropdown or date
control, that is not optional detail; it is most of the perceived gap.

Anything genuinely missing follows design.md §Component Sourcing — an approved source copied
exactly, before anything is built from scratch.

## Phase 4 — Build

Build to the written spec, not to the image. The image is for verification; the spec is the
instruction. Working from the image directly is how approximation creeps back in.

## Phase 5 — Capture and compare

Same viewport, same device scale factor, side by side. This half is already established —
see `design-qa.md` and the Rare UI adoption QA for the format.

- Normalize honestly. State the viewport, scale factor, theme, and locale. If the captures
  differ in size, say how they were fitted; judge fine geometry from DOM measurements at
  native CSS pixels, not from a scaled montage.
- Compare against the Phase 1 spec item by item, not by vibe.
- State what was intentionally not copied and why. A divergence you can name is a decision; an
  unnamed one is a miss.

## Phase 6 — Done means

- Every Phase 1 item either matches or has a written reason it does not.
- No native form control where the reference had a designed one.
- The repeating unit does not truncate its most important field. If it does, the density is
  wrong — fix the column math, not the font size.
- Both themes, both locales, and the reference's own breakpoints.
- Gates green: `npm run audit:design-system && npm run test:design-system && npm run lint && npm run typecheck -w @thinkfy/web`

## Anti-patterns of this workflow

- Starting to code before Phase 1 is written down.
- An extraction that is mostly a color list.
- Copying a marketing mockup's floating canvas into a real application shell.
- Copying the reference's content structure when our data has a different shape — match the
  density and hierarchy, not the columns of somebody else's business.
- Declaring done from a side-by-side glance instead of the spec.
- Treating a divergence as a failure. Some are correct; they just have to be named.

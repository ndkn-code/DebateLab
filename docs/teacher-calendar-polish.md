# Teacher calendar — polish gap

Logged 2026-09-01, not yet actioned. Compares the shipped Teaching Calendar against a
reference appointment app (Fresha/Booksy family) at roughly matched desktop widths.

Work this with `design-reference-adoption.md` — run the Phase 1 extraction against the
reference before implementing, rather than working item by item off this list alone.

Ordered by how much each contributes to the perceived gap.

## 1. Native form controls

`apps/web/src/components/teacher-workspace/TeacherCalendar.tsx` uses four `<select>` elements
(lines ~1529, 1544, 1557, 1571) and an `<input type="date">` (line ~1475). The browser draws
its own chevrons and date glyph, which is the single loudest "unfinished" signal on the page.

`select.tsx`, `dropdown-menu.tsx`, and `popover.tsx` already exist in `components/ui/` and
were not used. This is a reuse gap, not a taste gap — the same pattern that made the IELTS
screens feel unpolished.

Reference treatment: pill control, leading icon, label, trailing chevron.

## 2. Column math forces truncation

Seven day columns in ~1000px is ~140px per column. The reference fits five columns in
~1070px, about 215px each. At 140px the event block truncates the **time** — `9:00 …` —
which is the one field that must never clip.

Sunday renders 0 events. Default to a five-day weekday view with a weekend toggle; that alone
buys back roughly 50% of column width. Fix the density, not the font size.

## 3. Event block hierarchy

Currently four lines: time, then a bold title wrapping to two lines, then subject. The
reference uses two: `10:00-10:30 **Savannah**` on one line, muted `Personal Training` on the
next. Same information, half the height, no truncation.

## 4. Day headers

Reference leads with a large date numeral, then weekday, then the count, and gives today a
filled accent chip. Ours crams weekday and count on one line with the date below, and marks
today only with the red current-time line.

## 5. The preview banner owns the top strip

"Teacher presentation preview" is the most prominent element on the page. The banner is
honest and should stay, but as a thin strip. The reference spends that space on summary
cards with deltas — real product value in the most valuable real estate.

Whether the equivalent here is attendance, upcoming load, or review backlog is a product
question, not a design one. Do not add stat cards for numbers we do not measure
(`design-marketing.md` honesty rule applies to product surfaces too).

## 6. Control row reads as loose parts

Day/Week/Month/Agenda renders as four separate text buttons with one filled, rather than a
single grouped segmented control. The filter row leads with a bare `Filters` label followed by
unstyled selects. The reference groups the view switcher and gives each filter a leading icon
inside a pill.

## Out of scope

The reference screenshot is a marketing mockup — the floating canvas, page tint, and outer
shadow are presentation chrome, not application UI. Do not copy them into the app shell.

---

# Live practice flow — redesign needed

Logged 2026-09-01 (founder: "those live practice flows look ass and need redesign sometime
soon"). Not yet diagnosed — no itemized gap list exists yet, unlike the calendar above.

Surfaces: the full-screen debate session, the speaking recorder, prep/notes/transcript panels,
and the timer. Governed today by design.md §Live Practice Flow.

These are a third surface class — neither dense workbench nor spacious momentum, but a
focused single-task environment with its own chrome. Whether that becomes a formal third
density mode in design.md is open; it was raised and deferred when the workbench/momentum
split was settled.

Next step is a Phase 1 extraction (`design-reference-adoption.md`) against a reference worth
matching, rather than piecemeal fixes.

# Teacher workspace design QA

## Comparison target

- Source visual truth:
  - `/Users/jacknguyen/Downloads/HP15H7gaIAAWvm3.jpeg` for compact calendar density, view controls, time rhythm, and overlap treatment.
  - `/Users/jacknguyen/Downloads/HQy1RbubwAAoYeT.jpeg` for the anchored right-side event detail pattern.
- Implementation evidence is stored in `/Users/jacknguyen/.codex/visualizations/2026/09/02/01a063e7-a000-7c00-9fd7-89d693e7ce5f/thinkfy-teacher-ui/`.
- Both references are 3200×2400 pixels. Browser captures use deviceScaleFactor 1, so image pixels equal CSS viewport pixels.
- `reference-comparison.png` puts both references and the 1440×900 implementation in one visual input. `drawer-reference-comparison.png` compares the source detail panel and implementation drawer in one input. Pixel geometry was measured from the live DOM before normalization.

## Pattern adoption

- Adopted: 64 px hourly rhythm, compact time gutter, Day/Week/Month/Agenda control, accessible per-class accents, deterministic overlap lanes, current-time line, and a fixed right event drawer.
- Reframed: source appointment details became class, lesson, roster/attendance, materials, homework/review, announcements, and permitted teacher actions.
- Rejected: appointment commerce, KPI-heavy cards, checkout/payment content, drag-to-reschedule, and color-only meaning.

## Passed

- 1440×900 calendar headers align to event columns with 0 px x/width delta.
- Every hour label aligns to its grid line with 0 px center delta.
- Every rendered event top and height matches its start/end minute geometry with 0 px delta.
- Overlap lanes are deterministic in unit tests and visibly non-overlapping at all desktop widths.
- Drawer geometry is x=1008, width=432, right=1440 at 1440×900; x=0, width=390, right=390 at 390×844 after the opening transition. It does not resize or shift the calendar grid.
- Drawer focus enters the heading, all 18 tested Tab advances remain trapped inside, Escape closes it, and focus returns to the originating event.
- Day, Week, Month, and Agenda render; the Week preference is the wide default. Compact 768×1024 and 390×844 presentations normalize to Agenda instead of compressed week columns.
- Class and status URL filters preserve Week as the view and reduce the rendered event set correctly.
- No document-level horizontal overflow at 1440×900, 1280×800, 1024×768, 768×1024, or 390×844. At 1024, any excess calendar width is contained by the calendar panel; at 390, the Head Teacher table scrolls inside its frame.
- English/Vietnamese, light/dark, and reduced-motion states were rendered. Reduced-motion transition duration resolves to Chromium's 0.000001 s normalization.
- Representative dark-theme contrast is 19.27:1 for the page heading and 8.15–9.23:1 for calendar event text. Scheduled/planned copy, cancelled strike-through, completed double borders, and accessible labels keep status non-color-dependent.
- Head Teacher Organization, People, Curriculum, and Reports routes render without 404 or denial in the explicit demo. The dedicated rail includes the pending Review Queue badge and omits Duel and AI Coach.

## Evidence

- `calendar-1440x900.png`, `calendar-1280x800.png`, `calendar-1024x768.png`, `calendar-768x1024.png`, `calendar-390x844.png`
- `calendar-drawer-1440x900.png`
- `organization-dark-1440x900.png`
- `reports-vi-dark-390x844.png`
- `reference-comparison.png`, `drawer-reference-comparison.png`

## Blocked or external

- The subject-neutral student class-week presentation is implemented on the existing `/ielts/classes` learner route, not the manager-only legacy class route. Local browser rendering is blocked by the existing student data path returning `permission denied for table ielts_study_plans` under the development bypass. This is an authorization/backend contract defect and was not changed in this presentation-only scope.
- Live reschedule/cancel/complete mutations remain disabled. The existing mutation repository requires an `expectedUpdatedAt` concurrency token, but the teacher event/detail projection does not expose one and provides no mutation action URL. The explicit demo validates and demonstrates these states; the UI does not invent a production token or bypass the server contract.
- Toggling the existing shared theme control while Chromium simultaneously emulates reduced motion applies the requested theme, but the development runtime logs its existing `Transition was aborted because of timeout in DOM update` rejection. Stable light, dark, and reduced-motion reloads render correctly; the shared transition infrastructure was not changed in this workspace patch.
- Full repository lint remains red on pre-existing unrelated scoring, IELTS mock/coach, AI benchmark, and admin workbench files. Targeted lint for every touched TS/TSX file passes.

final result: passed with external blockers documented above

# IELTS results continuation

Adapt mode. Results are momentum density; the detailed review is workbench.

Source inspected: user-provided Lumist checkout `/Users/jacknguyen/Developer/app-lumist-ai`,
commit `73875b1267cb3a6e36a82af2cd1469285a57e9e1`.
No license declaration was found in its package.json; reuse is limited to the behavior and
small action composition explicitly requested by the user. No branding or exam content copied.

- `app/assessment/attempt/[attemptId]/result/page.tsx:154-217,422-440`:
  contextual continuation priority and prominent action.
- `features/assessment-result/components/recap/RecapActionButtons.tsx:33-64`:
  conditional secondary Review paired with primary Continue. `ResultsActions` partially
  adapts this composition using native links, Thinkfy Button variants, responsive wrapping,
  localized labels, and a review anchor instead of a separate review route.
- `app/api/client/assessment-attempts/[attemptId]/next-resource/route.ts:47-80,201-228`:
  authorization before sequencing. Thinkfy uses its existing RLS learner assignment reader;
  it does not introduce resource sequencing or a navigation endpoint.

Design research: [Mobbin / Codecademy quiz completion](https://mobbin.com/screens/d5bb01b9-4ee9-4537-9e5b-25e67dea0e89).
Adopted single continuation hierarchy; retained Thinkfy's score and review components, tokens,
control geometry, typography and both locales. No fixed footer, XP display or illustrations.

Resume passes the exact authorized attempt ID to the existing mock loader, preserving its
stored assignment and frozen answers. Assignment next steps use a fragment pointing at the
existing card: the assigned route's `?assignment=` query would redirect back to results.
Unavailable assignment enrichment falls back to the learner's study plan. No weak-skill
recommendation is inferred. Pending results can refresh; route-load failures can retry.

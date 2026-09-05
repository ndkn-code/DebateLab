# Teacher workspace recovery — workbench

## Reference extraction before implementation

This is a behavior adoption, not a navigation redesign. Lumist's manager dashboard
loads only the active section and separates failed resources from successful lists.
Partial fork source: `app-lumist-ai/features/manager-dashboard/services/client/manager-dashboard.service.ts:8-100`
and `app/[slug]/manager/dashboard/page.tsx:339-374,557-605` in the local Lumist checkout.
The independent roster/statistics status pattern comes from
`features/class-workspace/hooks/useClassWorkspaceRoster.ts:68-112,167-187`.
The explicit loading → error/retry → unavailable → empty → content ordering comes from
`features/class-workspace/components/ClassroomAssignments.tsx:92-123` and the reusable
`ClassroomStatePanel.tsx:13-83`. These patterns are translated to server presentation
source states and the existing Next route refresh, with current authorization checks.

Mobbin research (2026-09-05), inspected actual supplied screenshots:
- [Height unavailable page](https://mobbin.com/screens/bd98fbd3-903c-4b52-9a17-fd3ce92fc0ad): 768×521 reference including attribution footer; left navigation survives, centered short explanation and retry. Its tiny retry is unsuitable for this audience.
- [Revolut Business connection issue](https://mobbin.com/screens/b719158e-0a19-4b2e-8cc0-5217648ea20a): 768×512 reference including footer; left navigation, retained filter row and main content error with visible retry. Adopt control/context continuity, not financial content or dark palette.

## Native composition specification

Keep the existing data-width PageContainer and navigation. One full-width status row
above available content: short title/explanation followed by a visible outline Retry
button. At narrow widths wrap the row, never truncate the explanation or class name.
Use existing 12px control radius, 12/16px spacing, 1px outline-variant border,
surface-container-low background, on-surface/on-surface-variant text, type-body-sm
and type-label. No new primitives, tokens, fonts, icons, or libraries required.
Status belongs with the affected panel; real empty content is shown only after a
successful read. Unrequested summaries direct teachers to the relevant page instead
of claiming zero students or reviews. Retry retains URL context and mounted filters.

Do not copy Lumist branding, raw Tailwind styling, full-screen error layout, or toast-only
retry. Do not copy its abort-as-success behavior: a deadline is unavailable. Do not
retain data across an authorization failure. This change uses no cross-user cache.

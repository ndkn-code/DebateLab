# Coexistence with navigation and teacher recovery drafts

Inspected without messaging or changing other tasks:

- PR47, `0da26733819b1a0e05a7492bde9b415d079cea24` (teacher navigation).
- PR49, `aa2b788997cfecb31f457d54945a472daa8b9fe7` (teacher workspace recovery).

This branch starts from main and does not import either draft. No cherry-pick, production merge or deployment was performed.

## Merge-sensitive paths

`apps/web/src/app/[locale]/(protected)/layout.tsx` needs deliberate reconciliation with PR47. Keep this branch's authoritative identity/profile checks, dependency deadlines, unavailable enrollment state and recovery redirects. Keep PR47's capability-derived role projection, explicit learner-mode preference, classes/organizations used by shortcuts, and center-only organization access. A missing capability must never become a fabricated `canAccess: true` result. Either retain this branch's teacher-route recovery page or PR47's explicit unavailable navigation state; never flash learner navigation for a failed teacher read.

`lib/api/class-lms/teacher-workspace-sidebar.ts`: keep the new capability-only loader and null counts, then project PR47's class and organization fields into it. Reuse PR47's center-membership access predicate; do not replace that predicate with the feature flag alone. The pre-existing main navigation-item function is deliberately retained here; PR47 owns its center semantics.

`components/shared/sidebar.tsx` and `components/dashboard/dashboard-sidebar-rail.tsx`: this branch changes only the imported navigation contract and a nonproduction demo null coalescing expression. Retain PR47's WorkspaceSwitcher, TeacherSidebarNavigation and organization context. Extend its shell navigation type to accept unknown optional counts. This patch does not add profile-role authorization fallback behavior.

`lib/teacher-workspace/presentation.ts` is not edited here. `ShellTeacherNavigation` derives from its type, so PR47's new optional fields remain representable, but its loader projection must populate them during reconciliation.

`[locale]/localized-app-providers.tsx`, `lib/supabase/server.ts`, request budgets, recovery routes and enrollment state should retain their bounded behavior if another change touches these shared files.

PR49's presentation loaders, TeacherWorkspaceScreen, TeacherCalendar and review-queue behavior are not edited. Preserve its `partial`, `unavailable`, denied and retry states. This patch bounds the independently awaited shell data identified in PR49's report; it does not replace that page recovery implementation.

A virtual merge check is recorded in verification.md. A clean text merge alone does not verify cross-draft entitlement semantics; combined browser and capability tests must be rerun after PR47 reconciliation.

# Shared navigation provenance

`teacher-sidebar-navigation.tsx` partially forks the ordered group filtering,
nested class shortcuts, exclusive parent/child active state and mobile close
callback from Lumist `features/manager-dashboard/components/ManagerSidebar.tsx`
and `ManagerSidebarConfig.ts`, commit `bb85a06ff1e06524cb562a0a4c0c23fe05fbdb5d`:
https://github.com/lumist-ai/app-lumist-ai

Reuse was explicitly requested by the repository owner. The inspected Lumist
checkout has no top-level license; this does not label it as open source or MIT.

Mode: **adapt**. Thinkfy routes and RLS-backed capability projections replace
Lumist entities and callbacks. Existing Base UI Sheet/dropdown primitives handle
interaction. Semantic tokens, Inter typography, 40px rows, 8px radii and governed
icons replace its skin. Class recency uses local session visits and current server
access. See `docs/teacher-navigation/design-and-provenance.md` for research and QA.

The scrollable middle/pinned utility composition follows Thinkfy's existing
Beautiful UI adaptation (`components/beautifului/sidebar-nav.tsx`, MIT attribution
retained in that source). No new third-party package is introduced.

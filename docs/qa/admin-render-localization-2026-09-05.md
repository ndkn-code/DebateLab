# Admin rendering and Vietnamese localization repair

Surface: **workbench**. Branch: `codex/admin-render-localization`.

## Defect and fix

The production organizations list called `buttonVariants()` from a `use client` module while rendering a Server Component. The same import existed in shared organization detail's empty/error states. Move the existing CVA definition, unchanged, into `ui/button-variants.ts`; those server components import it directly. `ui/button.tsx` retains its client component and compatible exports. No access policy, data query, schema, or admin/manager boundary changes.

The list remains server-rendered. Loading failure no longer also claims an empty result. Reload retains filters. True empty and no-match states have different explanations. Filters use the shared Select primitive, and layout uses PageContainer with a responsive filter grid. Names can wrap.

The admin error boundary shows EN/VI recovery copy and refreshes the server payload before resetting. Raw messages and React documentation URLs are not displayed; diagnostics remain in existing telemetry. The overview return link preserves locale.

Admin navigation uses readable, wrapping labels. Overview geographic empty states, metric labels, currency, numbers, date axes, and tooltip dates use the active locale. Calendar dates use UTC so date-only buckets do not shift a day. Course titles remain user-authored. The optional chart date formatter leaves existing consumers' defaults unchanged.

## Source provenance and adaptation

- Lumist `features/admin-dashboard/components/sections/OrganizationsSection.tsx:73–113, 183–225` at `/Users/jacknguyen/Developer/app-lumist-ai`: partially forked the mutually exclusive load-error / populated / empty state structure and distinction between filtered-empty and initial-empty. Thinkfy keeps its server GET filters and row links rather than copying client fetching, cards, branding, or mutation dialogs.
- Lumist `app/error.tsx:1–35`: partially forked localized generic recovery copy plus retry, retaining Thinkfy telemetry and adding server refresh / overview recovery.
- Lumist `components/AdminTopBar.tsx:259–277` and `components/AppShell.tsx:110–124` were navigation composition references only. No sidebar code was copied; Thinkfy already had grouped navigation.
- Mobbin [Charma admin console](https://mobbin.com/screens/553c2f03-04ec-42a0-a13d-b7bda1392e5f) and [X admin tools](https://mobbin.com/screens/33585a0e-c609-4c59-b694-5eecd5538f7a) were inspected as inline screenshots. Adopted full labels, quiet navigation and row-first management hierarchy; no branding or palette copied.

Composition mapping: retain one navigation column and one content column; one create action in the header; compact search/type/status/filter controls; organization rows carry name/status then type/location/counts, with a trailing destination cue. Use existing PageContainer, Button, Select, semantic colors, type utilities and 12px control radius. Filters stack below desktop widths. No new visual system or library.

## Verification

- `npm run audit:design-system`: passed.
- `npm run test:design-system`: passed.
- `npm run lint`: passed, 12 existing warnings and zero errors.
- `npm run typecheck -w @thinkfy/web`: passed.
- `npm run test:admin-rendering`: passed. Bundled SSR models the client helper boundary explicitly (ordinary SSR ignores `use client`). Covers EN/VI populated, true-empty, filtered-empty, failed load and retained query, detail empty/error, localized map/totals, and unchanged course titles. A temporary mutation back to the original import failed as expected.
- `npm run test:admin-clubs`, `npm run test:admin-analytics`: passed.
- Organization setup model: passed with `tsx --tsconfig apps/web/tsconfig.json`.
- Organization repository: passed with `NODE_OPTIONS='--conditions=react-server' tsx --tsconfig apps/web/tsconfig.json`.
- Real Next.js development RSC rendering: ten cases passed (EN/VI × list populated/empty/error and detail empty/error) through a temporary localhost-only fixture using the actual components. Ego Lite `serverFetch` read the rendered responses; each contained the worktree marker `2f04`, expected data/alert state, and no client-helper error. Server launched directly from this worktree on port 3104. Temporary fixture was removed after verification.

## Remaining limits — not release acceptance

Ego Lite space **68**, never audit space 63, could list tabs and fetch server responses, but `Runtime.evaluate`, `Page.navigate`, and `Runtime.runIfWaitingForDebugger` timed out. No usable visual capture was obtained. EN/VI × light/dark × 1280×720, 1440×900, 768×1024 and 390×844 browser QA, overflow measurements, mobile menu behavior, real filter/navigation interaction and retry interaction remain unverified. Authenticated production data was not copied into fixtures or changed. Local protected-route fetch redirected to login; fixture rendering does not establish authenticated end-to-end acceptance.

The admin layout currently overlays the learner shell with fixed positioning. Visible duplication could not be verified, so the layout and excluded shared sidebar files were not changed.

An analogous `buttonVariants` server import remains in IELTS attempt results, outside this admin scope; it should be handled in that surface's task. No IELTS gate or scoring code was changed.

No production deployment or merge. Review as a draft until browser acceptance is completed.

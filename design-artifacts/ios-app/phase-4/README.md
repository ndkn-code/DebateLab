# Phase 4: Mobile Dashboard, Streaks, Today Plan, And Analytics

Date: 2026-05-21

## Summary

Phase 4 replaces the static mobile Today tab with the first live signed-in student surface. The mobile app now requests dashboard data through a bearer-authenticated Next.js API route, renders live loading/ready/empty/error states, keeps the development preview mode for simulator QA, and records best-effort dashboard analytics events.

No Supabase schema changes, practice recording, feedback detail rendering, coach streaming, course players, or notification work were introduced in this phase.

## Implemented Scope

- Added shared `@thinkfy/shared/dashboard` contracts for the dashboard payload used by web and mobile.
- Added `GET /api/mobile/dashboard`, guarded by `requireRequestAuth()` and backed by `getDashboardData(auth.user.id)`.
- Kept dashboard data on the existing fallback table-query path because live Supabase does not expose `public.get_dashboard_payload`.
- Replaced the Today tab static mock with live dashboard states:
  - loading skeleton
  - signed-in live dashboard
  - starter/empty dashboard
  - retryable error state
  - dev-only preview dashboard
- Rendered streak, XP/level progress, recommended drill, today goal progress, today plan, recent activity, and quick actions for Practice, Feedback/History, Coach, and Courses.
- Added best-effort analytics events:
  - `mobile_dashboard_viewed`
  - `mobile_dashboard_quick_action_tapped`
  - `mobile_dashboard_recommended_drill_tapped`

## Supabase Verification

Live project: `DebateLab - Main` (`rsbnryympenjyzhhchhu`)

Verified with Supabase MCP:

- Project status is active and healthy.
- Required public tables exist with RLS enabled, including `profiles`, `debate_sessions`, `daily_stats`, `courses`, `enrollments`, `activity_log`, and `analytics_events`.
- `public.get_skill_breakdown` exists.
- `public.get_dashboard_payload` does not exist, so Phase 4 intentionally uses the existing fallback dashboard query path and does not add a migration.

## UI Reference

- Reference board: `ui-reference/live-dashboard-reference.png`
- Details: `ui-reference-board.md`

## QA Log

Static checks completed:

- `npm run typecheck:shared`
- `npm run typecheck:mobile`
- `npm run lint:mobile`
- `npm run typecheck:web`
- `npm run lint:web` completed with existing warnings outside the Phase 4 mobile dashboard changes.
- `git diff --check`
- `npm run test:skill-snapshot`
- `npm run test:practice-language`
- `npm run test:topics`

Build and API checks completed:

- `npm run build:web`
- `GET /api/mobile/dashboard` with no auth returned `401`.
- `GET /api/mobile/dashboard` with malformed bearer returned `401`.
- Malformed bearer still returned `401` when a dev-bypass cookie was also present, confirming bearer precedence.
- Dev-bypass returned dashboard JSON for local no-data/starter validation.
- `POST /api/analytics/events` accepted `mobile_dashboard_viewed` through dev-bypass.
- Valid live bearer-token curl was not executed because no live mobile OAuth session token is available in this workspace. The route now passes the authenticated Supabase client from `requireRequestAuth()` into `getDashboardData()`, so bearer requests query under the bearer user's RLS context instead of falling back to cookie auth.

Native and visual checks completed:

- `xcodebuild -workspace apps/mobile/ios/Thinkfy.xcworkspace -scheme Thinkfy -configuration Debug -destination 'platform=iOS Simulator,id=3ADC2894-566D-4DAF-BABC-5DBE3D975554' build CODE_SIGNING_ALLOWED=NO`
- `screenshots/today-preview-iphone-17-pro.png`
- `screenshots/today-preview-iphone-17e.png`
- `screenshots/auth-signed-out.png`

Notes:

- The simulator screenshots include Expo dev-client chrome/gear overlay that is not part of the production UI.
- A dummy Supabase key produced an Expo SecureStore entitlement error in the existing dev build. The clean signed-out screenshot was captured with live auth env omitted, which keeps SecureStore disabled and confirms the signed-out shell renders.

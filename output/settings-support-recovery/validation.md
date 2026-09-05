# Settings and support recovery validation

Scope: settings workbench; no production merge or deployment. Source base: origin/main at branch creation. Browser: Ego Lite space 76, own worktree server on localhost:3186. Space 63 was not used.

## Implementation and provenance

See design-provenance.md for inspected Mobbin images and the partially forked Lumist save-feedback/refresh and server-validation pattern. Existing Thinkfy authorization, preference merge, next-intl routing, theme persistence and feature gates remain authoritative. Organization affiliation still loads when join codes are disabled because its status remains visible; the join-code flag only governs claiming codes. Existing saveSettings success-only API is retained for other consumers; the settings workbench uses saveSettingsWithFeedback for typed translated errors.

Optional organization and leaderboard reads have independent 3-second deadlines and abort signals. Membership retains user_id, active status and student role filters. Query failures are unavailable, not absent. Profile/privacy read errors render a retry surface before mounting the editor; stored drafts cannot be replaced by fallback values. Missing profile is an error; a confirmed absent privacy row retains existing default semantics.

## Browser evidence — synthetic components, not authenticated QA

The authenticated local /en/settings route redirected to login. No authenticated successful account save, language navigation, or theme persistence was claimed. An explicitly labeled temporary dev fixture rendered the real SettingsContent and SupportIssueDialog components using a synthetic UUID and example.invalid email. Fixture source is preserved as local-fixture.tsx.txt; the route was removed before commit. No test route or function is shipped.

Settings overflow matrix: EN and VI × light and dark × 1280×720, 1440×900, 768×1024, 390×844 (16 combinations) passed scrollWidth == clientWidth after fixing the settings grid's mobile min-width. Themes were initialized through the existing thinkfy-theme storage and thinkfy_theme cookie, then reloaded; unauthenticated theme-save action correctly rolled back attempted toggles. Viewport changes explicitly dispatched resize. Final 390px width was 390px in both themes/locales. Vietnamese section labels and visible actions were inspected through the semantic tree.

Failure injection:
- CDP Fetch paused requests matching *tally.so* in the dedicated local space. After 8 seconds, the real dialog displayed localized timeout/retry. Retry returned to loading and retained both trusted external and email links. Interception was disabled afterward; no form was submitted.
- At VI/dark/390×844, final timeout dialog bounds were x8/y8/374×828. Retry and both footer links were inside the viewport. A discovered zero-height form body was corrected with explicit dialog/body sizing.
- External/mailto links were present in loading as well as timeout. Link destinations were read, not opened/submitted.
- With both public Tally URL variables explicitly empty for a restarted local server, the real VI dialog rendered no iframe and a usable mailto support action. No extra service was contacted.
- Critical profile failure fixture rendered zero inputs, localized retry, and preserved the exact localStorage draft string across navigation.
- Optional failure fixture rendered unavailable organization/leaderboard messages and no join action; retry refresh controls were added.
- Escape dismissed the dialog and restored focus to its trigger after the close transition. Support close control now has a localized accessible name.

Ego Page.captureScreenshot timed out. There are no successful visual screenshots; geometry/semantic evidence is not a substitute for screenshot or authenticated live QA. The source audit's production auth504 and prior >20-second membership fixture are context, not live findings reproduced here.

## Automated checks

Required design audit, token tests, lint, web typecheck and affected settings/support suites are run before commit. Lint has existing warnings outside this slice. Settings suite includes real bundled server-action behavior with mocked request-scoped Supabase: no writes on absent auth/profile/read error, duplicate-handle response, privacy write error, retained unknown preferences and successful saved result. Optional query tests cover filters, disabled flags, absence, rejection, timeout+abort, missing club, RPC/schema failure and normalization. Support tests cover trusted URL behavior, email destination injection rejection, localized mailto and timeout/retry state transitions.

Remaining limits: real account persistence and successful locale/theme interactions require an authenticated session. Screenshot visual QA remains blocked by Ego capture timeout. No claim of completed production QA.

# IELTS results/resume validation — 2026-09-05

Branch: codex/ielts-results-next-step. Dedicated Ego Lite space: 75. Fixture server:
127.0.0.1:4318, explicitly built from worktree 87b8 components and stylesheet. Inter font
assets copied from the existing local build; no other checkout code served.

## Implemented

- In-progress server route renders the client Button as JSX, rather than invoking its
  client-bound variant factory. Resume includes the exact authorized attempt ID so the
  existing mock loader restores frozen answers and stored assignment context.
- Results offer one primary action: return to authorized assigned-work card (class/title
  shown) or open existing study plan. The fragment avoids the assigned route query redirect
  loop. Optional assignment enrichment uses learner RLS, explicit attempt/owner filters,
  and the existing learner assignment reader; failures fall back to study plan.
- Secondary review anchor, pending-score refresh, truthful failed-grading copy, missing-slug
  browse fallback, and route-error retry. No grading retry or recommendation invented.

## Automated validation

- Four UI gates: design-system audit, design-system token tests, web lint, web typecheck.
- IELTS results suite: band visuals, band summary, objective review, skill feedback,
  view model, review source marks, new next-step/context/component/RSC tests.
- IELTS learner suite: summary, library, learn path, onboarding.
- IELTS assignments suite and IELTS routes tests.
- `npm run ci:checks`: RLS, inline-query, score-column, function-entrypoint checks.

The RSC test uses Next's real createClientModuleProxy, webpack manifest and stream renderer;
actual route, path helper, next-step selection, view-model and product layout execute.
Repository responses are controlled synthetic fixtures; client components are references.
Negative control proves server invocation of client buttonVariants fails. Assertions cover
exact resume attempt, missing slug, null unknown/unauthorized loader result, assigned locale
and class context, and scored/pending/failed writing projections. These tests do not replace
live database RLS tests.

## Browser evidence and limitations

64 synthetic layout cases passed: completed, pending, failed, route error × EN/VI ×
light/dark × 1280×720, 1440×900, 768×1024, 390×844. Document scrollWidth never exceeded
clientWidth; buttons fit. Completed CTA visible in first viewport in all 16 combinations.
Inter font loaded; both light/dark computed background and ink values verified.

Real clicks in the synthetic fixture verified the localized study-plan href, assigned-work
href and actual AssignedTestsList card fragment, review anchor, refresh invocation and
error reset callback in both locales. Fixture navigation/refresh adapters are explicitly
synthetic: authenticated destination loading, grading persistence and an actual Next
router refresh/reset could not be tested live.

Live https://thinkfy.net/en/ielts/home returned middleware 504 / MIDDLEWARE_INVOCATION_TIMEOUT
before IELTS rendered. The renderer bug was source-confirmed and regression-tested, not
live-reproduced. Ego Page.captureScreenshot also timed out; screenshot-based visual sign-off
remains unavailable. No production merge or deployment performed.

Source provenance and composition decisions: components/ielts/results/README.md and
output/ielts-results-next-step/design-brief.md. Lumist source commit:
73875b1267cb3a6e36a82af2cd1469285a57e9e1. Mobbin Codecademy quiz-completion screen:
https://mobbin.com/screens/d5bb01b9-4ee9-4537-9e5b-25e67dea0e89.

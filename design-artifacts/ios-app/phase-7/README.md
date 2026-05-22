# Phase 7: Mobile Feedback, Analysis Jobs, And History

ClickUp task: `86ba1uqex`.

## Summary

Phase 7 connects the Phase 6 mobile transcript to the existing async practice analysis pipeline. The mobile app can submit a transcript for feedback, poll the queued analysis job, render the result, and browse completed history.

This phase intentionally does not solve the broader mobile UI/reference mismatch. That should become a separate UI revamp epic.

## Implementation Notes

- Mobile analysis uses the existing Vercel Queue-backed `practice_attempts` and `analysis_jobs` pipeline.
- Mobile feedback submission uses `/api/mobile/practice-attempts`; polling uses `/api/mobile/analysis-jobs/[id]`.
- Mobile history uses `/api/mobile/history` and `/api/mobile/history/[id]`.
- Credit deduction is performed before queue enqueue and uses the authenticated Supabase client so `auth.uid()` remains valid.
- `orb_transactions.reference_id` now has a partial unique index for practice charge idempotency.
- Dev preview can simulate analysis, feedback, and history without live OAuth.

## UI References

- `ui-reference/analysis-progress-reference.png`
- `ui-reference/feedback-result-reference.png`
- `ui-reference/history-detail-reference.png`

## QA Log

Last updated: 2026-05-21.

- Static checks: passed `npm run typecheck:mobile`, `npm run lint:mobile`, `npm run typecheck:shared`, `npm run typecheck:web`, `npm run lint:web`, `npm run build:web`, `npm run test:practice-analysis`, `npm run test:practice-feedback-plan`, `npm run test:skill-snapshot`, and `git diff --check`. Web lint still reports 21 pre-existing warnings outside Phase 7.
- Supabase checks: verified live `DebateLab - Main` resources for `practice_attempts`, `analysis_jobs`, `debate_sessions`, `activity_log`, `daily_stats`, `profiles`, and `practice-audio`. Applied and verified `idx_orb_transactions_mobile_practice_attempt_reference`, a partial unique index for mobile practice charge idempotency.
- API checks: local no-auth and malformed bearer calls return `401` for the new practice attempt, analysis job, history, and history detail endpoints. Local dev-bypass short transcript returns `400 short_transcript`. Local dev-bypass history returns an empty `200` list and missing detail returns `404`, not a false server error.
- Supabase advisors: security/performance advisors still report existing project-wide issues, including security-definer view/function exposure warnings, mutable function search paths, leaked password protection disabled, unindexed foreign keys, RLS init-plan warnings, multiple permissive policies, and duplicate indexes. No new advisor issue was attributable to the Phase 7 idempotency index.
- Mobile functional checks: dev preview can show mocked feedback and history without live OAuth. Signed-out users remain redirected away from protected feedback/history surfaces unless the dev preview flag is enabled.
- Native and visual checks: `xcodebuild -workspace apps/mobile/ios/Thinkfy.xcworkspace -scheme Thinkfy -configuration Debug -destination 'platform=iOS Simulator,id=3ADC2894-566D-4DAF-BABC-5DBE3D975554' build CODE_SIGNING_ALLOWED=NO` passed. Dev-client visual QA ran on iPhone 17 Pro and iPhone 17e. Fixed badge wrapping on history cards and score clipping in feedback/history score circles.
- QA screenshots:
  - `qa-screenshots/feedback-preview-iphone17pro.png`
  - `qa-screenshots/feedback-preview-iphone17e.png`
  - `qa-screenshots/history-preview-iphone17pro.png`
  - `qa-screenshots/history-preview-iphone17e.png`
  - `qa-screenshots/history-detail-preview-iphone17pro.png`
- Remaining blockers: the required real signed-in mobile E2E gate is still open: `.m4a` recording -> Deepgram transcript -> paid analysis enqueue -> polling -> feedback -> persisted history. This requires a valid live mobile OAuth session/access token and a real Phase 6 transcription artifact. Phase 7 should remain in progress in ClickUp until that pass is completed.
- Product note: the broader mismatch between generated UI references and the actual mobile UI should become a separate mobile UI revamp epic after the feedback loop is live.

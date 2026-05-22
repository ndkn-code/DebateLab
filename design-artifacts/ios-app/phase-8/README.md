# Phase 8: Mobile AI Coach Chat

## Summary

Phase 8 turns the mobile Coach tab into a live signed-in experience. The mobile app now loads personalized coach context, recent conversation history, saved threads, structured assistant cards, suggested actions, and a non-streaming JSON send-message path designed for React Native stability.

This phase intentionally does not solve the broader mismatch between current mobile UI and the ImageGen reference boards. That should become a separate UI revamp epic after the functional student app loop is stable.

## Scope Implemented

- Shared mobile coach contracts in `@thinkfy/shared/coach`.
- Bearer-authenticated mobile coach APIs:
  - `GET /api/mobile/coach`
  - `GET /api/mobile/coach/conversations/[id]`
  - `POST /api/mobile/coach/messages`
- Existing web coach profile/context helpers can now run against the bearer-authenticated Supabase client.
- Mobile Coach tab loads live context, saved conversations, active threads, composer, send/retry states, structured cards, suggested actions, and dev-preview mocks.
- Mobile analytics events were added for coach view, conversation open, message sent, response received/failed, and suggested-action taps.
- Local simulator E2E login has a development-only filesystem auth fallback for unsigned dev-client builds when SecureStore cannot persist between restarts.
- Three ImageGen reference boards were generated for Phase 8 UI direction.

## Live Supabase Verification

Verified read-only against `DebateLab - Main` before implementation:

- `chat_conversations` exists with RLS enabled.
- `chat_messages` exists with RLS enabled and supports `metadata`.
- `profiles`, `debate_sessions`, `daily_stats`, and `analytics_events` exist with RLS enabled.
- No schema migration was required for Phase 8.

## QA Notes

Checks completed on May 22, 2026:

- `npm run typecheck:mobile`
- `npm run lint:mobile`
- `npm run typecheck:shared`
- `npm run typecheck:web`
- `npm run lint:web` passed with existing unrelated warnings.
- `npm run build:web`
- `npm run test:practice-analysis`
- `npm run test:practice-feedback-plan`
- `npm run test:skill-snapshot`
- `git diff --check`
- `xcodebuild -workspace apps/mobile/ios/Thinkfy.xcworkspace -scheme Thinkfy -configuration Debug -destination 'platform=iOS Simulator,id=3ADC2894-566D-4DAF-BABC-5DBE3D975554' build CODE_SIGNING_ALLOWED=NO`

API smoke checks completed:

- `GET /api/mobile/coach` with no auth returned `401`.
- `GET /api/mobile/coach` with malformed bearer returned `401`.
- `GET /api/mobile/coach/conversations/[id]` with no auth returned `401`.
- `POST /api/mobile/coach/messages` with no auth returned `401`.
- Signed-in Google simulator E2E loaded `GET /api/mobile/dashboard` with `200`.
- Signed-in Google simulator E2E loaded `GET /api/mobile/coach` with `200`.
- Signed-in Google simulator E2E sent `POST /api/mobile/coach/messages` with `200`.
- Restart restore loaded `GET /api/mobile/coach/conversations/3a8adbf1-e8e0-414e-8aa8-c5381dc91849` with `200`.

Visual checks completed:

- iPhone 17 Pro dev-preview Coach screen.
- iPhone 17e dev-preview Coach screen.
- iPhone 17e active conversation/composer state after fixing a long-preview overflow.
- iPhone 17 Pro live-env signed-out guard.
- iPhone 17e signed-in Google live Coach response with structured cards and suggested actions.
- iPhone 17e app restart kept the signed-in session and restored the most recent saved Coach conversation.

## Artifact Index

- `ui-reference/coach-chat-reference.png`
- `ui-reference/coach-history-reference.png`
- `ui-reference/coach-structured-cards-reference.png`
- `ui-reference-board.md`
- `qa/iphone-17-pro-coach-updated.png`
- `qa/iphone-17e-coach-retry.png`
- `qa/iphone-17e-coach-conversation-fixed.png`
- `qa/iphone-17-pro-coach-live-attempt.png`
- `qa/iphone-17e-coach-live-response.png`
- `qa/iphone-17e-coach-live-persisted-conversation.png`
- `qa/iphone-17e-coach-live-restart-restore-fixed.png`
- `qa/iphone-17e-coach-live-restart-thread-visible.png`

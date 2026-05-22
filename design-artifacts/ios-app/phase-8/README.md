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

Visual checks completed:

- iPhone 17 Pro dev-preview Coach screen.
- iPhone 17e dev-preview Coach screen.
- iPhone 17e active conversation/composer state after fixing a long-preview overflow.
- iPhone 17 Pro live-env signed-out guard.

Remaining manual QA gate:

- A valid signed-in Google session was not available after the laptop reset, so the live valid-bearer send-message path still needs one signed-in simulator or physical-device pass. No test auth user was created and no Supabase data was mutated.

## Artifact Index

- `ui-reference/coach-chat-reference.png`
- `ui-reference/coach-history-reference.png`
- `ui-reference/coach-structured-cards-reference.png`
- `ui-reference-board.md`
- `qa/iphone-17-pro-coach-updated.png`
- `qa/iphone-17e-coach-retry.png`
- `qa/iphone-17e-coach-conversation-fixed.png`
- `qa/iphone-17-pro-coach-live-attempt.png`

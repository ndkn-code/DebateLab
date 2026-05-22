# Phase 0: iOS Product Scope, App Map, And Technical Audit

Created: 2026-05-21
Owner: Nguyen Nguyen
ClickUp task: `86ba1uq8z`

## Executive Summary

Phase 0 confirms that the Thinkfy iOS app should be built as an Expo React Native app inside the existing DebateLab repo, not as a separate repository. The repo is currently a Next.js web application with Supabase SSR auth, browser-first audio capture, Deepgram transcription, async practice analysis jobs, coach chat, courses, history, profile, settings, and student progress surfaces.

No native scaffold exists today. Phase 1 can add Expo cleanly, but only after the team locks two implementation decisions: protected API routes must support Supabase bearer-token auth in addition to web cookies, and the speaking stack must move from browser audio APIs to an Expo-compatible recording/transcription plan.

Phase 0 produced these artifacts:

- [Student app map](student-app-map.md)
- [Technical audit](technical-audit.md)
- [Supabase live audit](supabase-live-audit.md)
- [UI reference board](ui-reference-board.md)
- [Dashboard and practice reference](ui-reference/dashboard-practice-reference.png)
- [Practice and feedback reference](ui-reference/practice-feedback-reference.png)
- [Coach, courses, and profile reference](ui-reference/coach-courses-profile-reference.png)

## Current State

- Existing repo has no Expo, React Native, Capacitor, `ios`, `android`, `app.json`, `app.config.*`, `eas.json`, or Metro config scaffold.
- Student web surfaces already cover auth, onboarding, dashboard, practice, practice session, feedback, history, coach chat, courses, profile, and settings.
- Current protected server routes use `@supabase/ssr` server clients backed by Next.js cookies.
- Current speech capture depends on browser APIs including `navigator.mediaDevices.getUserMedia`, `MediaRecorder`, `AudioContext`, `ScriptProcessorNode`, and browser WebSocket behavior.
- Live Supabase project `DebateLab - Main` is healthy and contains the expected student data areas for profiles, courses, lessons, practice topics, practice attempts, analysis jobs, chat conversations/messages, and storage buckets.

## Locked Decisions

- Mobile app remains in the current repo as an Expo React Native app.
- Phase 0 does not scaffold Expo or change production code/schema.
- First-week prototype target remains 2026-05-28.
- Formal six-week target remains 2026-07-02.
- The first-week prototype should cover auth, dashboard, practice setup, a recorded speaking session, analysis submission, and feedback result.
- Mobile auth must use Supabase session tokens and protected APIs must accept bearer tokens in addition to web cookie sessions.
- Mobile audio must use an Expo-native strategy; browser `MediaRecorder` and Web Audio paths are not portable.

## First-Week Prototype Definition

The prototype is successful if a real iOS simulator or device can:

1. Sign in through Supabase mobile auth.
2. Load a mobile dashboard with streak/progress and a recommended practice action.
3. Pick a practice topic, language, mode, timing, and side.
4. Record a speaking attempt with native microphone permissions.
5. Submit the transcript/attempt into the existing async analysis pipeline.
6. Poll the analysis job and render a feedback result with score, category breakdown, and transcript notes.

The prototype can use a validated upload/transcribe fallback if realtime Deepgram streaming is not stable in React Native by May 28.

## Top Risks

| Risk | Classification | Why It Matters | Phase 1-5 Action |
| --- | --- | --- | --- |
| Cookie-only protected APIs | Prototype blocker | Mobile requests cannot rely on Next.js browser cookies. | Add a shared server auth helper that accepts Supabase bearer tokens and preserves cookie behavior for web. |
| Browser-only audio stack | Prototype blocker | Expo cannot use `MediaRecorder`, Web Audio, or DOM media streams as-is. | Choose Expo AV/Audio recording plus server transcription fallback or a proven React Native Deepgram streaming path. |
| Practice audio bucket MIME limits | Prototype blocker | Live bucket accepts `audio/webm` only; iOS recordings may be `m4a`/`aac`. | Update storage policy/mime plan in Phase 5/6 after validating recording format. |
| Shared contracts are not packaged | TestFlight blocker | Web types and API response models are reusable but not separated for Expo imports. | Create shared types/API package boundaries in Phase 1. |
| Chat streaming compatibility | TestFlight blocker | Web chat streams may not behave the same in React Native fetch/runtime. | Validate streaming early and add non-streaming fallback. |
| Courses/activity interaction breadth | Post-prototype risk | Activity player has many modes and can expand scope fast. | Keep courses after feedback/history/coach unless PM reprioritizes. |

## Go/No-Go Criteria For Phase 1

Go into Phase 1 if:

- Expo-in-repo remains accepted as the architecture.
- Mobile bearer-token auth is accepted as required backend work.
- The prototype scope above is accepted as the May 28 target.
- The audio strategy is allowed to start with recorded upload/transcription fallback if realtime streaming is too risky.

Pause before Phase 1 if:

- The team wants a separate repo.
- The May 28 prototype must include every course/activity/profile/settings surface.
- Mobile must preserve realtime Deepgram streaming exactly as the web flow before a fallback is accepted.
- Live Supabase auth/storage cannot be changed to support iOS recording formats during Phase 5/6.

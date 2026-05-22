# Phase 5: Mobile Practice Flow, Native Mic, And Speaking

Phase 5 turns the static mobile Practice tab into a working local iOS practice run. The app now supports topic selection, language/track/mode/side/timing setup, mic permission handling, prep and speaking timers, native Expo audio recording, pause/resume, background pause recovery, and a local completion screen.

## Implementation Notes

- The mobile app uses `expo-audio` with high-quality `.m4a` recording for iOS.
- Audio remains local in Phase 5. There is no Deepgram streaming, Supabase upload, practice attempt submission, analysis polling, feedback rendering, or orb deduction.
- Shared practice duration/session contracts live in `@thinkfy/shared/practice` so mobile and web can use the same timing bounds without importing web-only stores or hooks.
- The signed-out route remains auth-gated. The development design preview flag can still render the practice flow without live OAuth.
- Live Supabase storage verification showed the private `practice-audio` bucket currently allows only `audio/webm` and `audio/webm;codecs=opus`; Phase 6 must add mobile MIME support before upload.

## Go/No-Go

Go to Phase 6 only when the app can complete a local iOS practice recording and the QA log confirms static checks, simulator build/run, and mic permission scenarios.

Do not treat Phase 5 as complete if recordings cannot produce a local URI and duration, if signed-out users can reach the session route, or if the implementation uploads/transcribes audio early.

## QA Log

Completed on 2026-05-21 against the iOS 26.5 simulators.

- `npm install` completed after adding `expo-audio`; npm reported existing audit findings but no install failure.
- `npm run prebuild:ios -w @thinkfy/mobile` completed after adding the Expo audio plugin.
- `npm run typecheck:mobile` passed.
- `npm run lint:mobile` passed.
- `npm run typecheck:shared` passed.
- `npm run typecheck:web` passed.
- `npm run build:web` passed with existing Next.js metadata/middleware warnings.
- `npm run test:topics` passed with the existing Node deprecation warning.
- `npm run test:practice-language` passed with the existing Node deprecation warning.
- `npm run test:practice-analysis` passed with the existing Node deprecation warning.
- `git diff --check` passed.
- `xcodebuild -workspace apps/mobile/ios/Thinkfy.xcworkspace -scheme Thinkfy -configuration Debug -destination 'platform=iOS Simulator,id=3ADC2894-566D-4DAF-BABC-5DBE3D975554' build CODE_SIGNING_ALLOWED=NO` passed and included `ExpoAudio`.
- `Info.plist` includes the Phase 5 microphone permission copy and does not add audio background modes.
- Secret scan found no mobile service-role, Deepgram, Gemini, Resend, cron, or webhook secrets. The only match was the expected mobile env documentation warning.
- Supabase read-only verification confirmed `practice-audio` is private and still allows only `audio/webm` plus `audio/webm;codecs=opus`; Phase 6 must add mobile MIME support before upload.

Functional simulator QA:

- Signed-out users remain blocked from the session route unless development design preview is enabled.
- Topic selection, category chips, duration chips, and setup defaults render in the Practice tab.
- Denied microphone permission renders a recoverable settings state.
- Granted microphone permission renders the mic-ready state.
- Prep timer starts and skip-to-speaking starts native recording.
- Native recording creates local `.m4a` artifacts with non-null URI and duration.
- Pause, resume, manual finish, and finish-from-paused complete successfully.
- Backgrounding the app pauses recording and shows a recoverable foreground warning.
- No upload, transcription, analysis submission, feedback rendering, or orb deduction occurred.

Screenshot evidence:

- `screenshots/practice-setup-iphone-17-pro.png`
- `screenshots/practice-setup-iphone-17e.png`
- `screenshots/mic-permission-denied-iphone-17-pro.png`
- `screenshots/mic-ready-iphone-17-pro.png`
- `screenshots/prep-timer-iphone-17-pro.png`
- `screenshots/speaking-recording-iphone-17-pro.png`
- `screenshots/speaking-paused-iphone-17-pro.png`
- `screenshots/background-paused-iphone-17-pro.png`
- `screenshots/recording-complete-iphone-17-pro.png`

Implementation bugs found and fixed during QA:

- Rebuilt and reinstalled the dev client after adding `expo-audio`; otherwise JS could import `ExpoAudio` before the native module existed.
- Restarted the iPhone 17 Pro simulator and selected the Mac microphone after CoreSimulator audio initially reported missing `audiohald` and failed recorder preparation.
- Fixed session draft phase restoration so the UI remains on `speaking` after native recording starts.
- Paused prep/speaking timers while a recorder error is visible.
- Ensured `Finish` from a paused recording stops the native recorder before saving the local artifact.

# Phase 6: Mobile Audio Upload And Transcription

ClickUp task: Phase 6, Deepgram transcription and audio upload.

## Summary

Phase 6 turns the Phase 5 local `.m4a` recording into a server-ready transcript. The mobile app automatically uploads the completed recording to the private `practice-audio` Supabase bucket under a user-owned path, then calls the web API to run server-side Deepgram prerecorded transcription.

Phase 6 intentionally stops at transcript readiness. Practice attempt submission, analysis jobs, feedback rendering, XP/orb behavior, and history detail screens remain Phase 7.

## Implementation Notes

- Mobile upload path format: `{userId}/mobile-practice/{recordingId}.m4a`.
- Mobile upload MIME: `audio/mp4`.
- Storage bucket remains private with 25 MB limit.
- The only Supabase migration expands `practice-audio.allowed_mime_types`; it does not change application tables or owner-folder policies.
- Deepgram runs server-side through `/api/mobile/practice-transcriptions`; no Deepgram key is exposed to Expo.
- Empty or short transcripts are recoverable warning states, not fake feedback.

## UI References

- `ui-reference/upload-transcription-progress-reference.png`
- `ui-reference/transcript-review-reference.png`

## QA Log

- Static checks: passed `npm run typecheck:mobile`, `npm run typecheck:web`, `npm run typecheck:shared`, `npm run lint:mobile`, `npm run lint:web`, `npm run build:web`, `npm run test:topics`, `npm run test:practice-language`, `npm run test:practice-analysis`, and `git diff --check`. Web lint still reports 21 pre-existing warnings outside Phase 6.
- Supabase migration verification: applied `20260521190000_enable_mobile_practice_audio_mime.sql` to live project `DebateLab - Main` (`rsbnryympenjyzhhchhu`). Verified `practice-audio` remains private, keeps the 25 MB limit, and allows `audio/webm`, `audio/webm;codecs=opus`, `audio/mp4`, `audio/m4a`, `audio/x-m4a`, and `audio/aac`. Owner-folder storage policies remain in place.
- API contract checks: verified no auth returns `401`, malformed bearer returns `401`, cross-user path returns `403`, missing object returns `404`, and oversized request metadata returns `413` against local web API. Valid live bearer plus real `.m4a` Deepgram transcription still needs a signed-in mobile session token and uploaded object.
- Mobile simulator/native checks: `xcodebuild -workspace apps/mobile/ios/Thinkfy.xcworkspace -scheme Thinkfy -configuration Debug -destination 'platform=iOS Simulator,id=3ADC2894-566D-4DAF-BABC-5DBE3D975554' build CODE_SIGNING_ALLOWED=NO` passed. `npm run prebuild:ios -w @thinkfy/mobile` passed. `npm run ios:mobile` remains blocked by local Apple code-signing certificates, so the unsigned simulator build was installed and launched manually.
- Visual screenshots: saved iPhone 17 Pro Practice preview, iPhone 17 Pro transcript-ready preview, and iPhone 17e Practice preview under `tmp/phase6-qa/`. The dev-preview pipeline covers local recording, simulated private upload, simulated Deepgram transcript, transcript badges, and Phase 7 boundary copy.
- Remaining blockers: complete live E2E requires a valid signed-in mobile OAuth session and Deepgram-backed `.m4a` object in `practice-audio`. Physical-device QA is still preferred once Apple provisioning and OAuth provider setup are fully available.

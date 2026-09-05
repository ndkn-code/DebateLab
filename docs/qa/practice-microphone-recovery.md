# Practice microphone recovery — implementation and verification

## Design brief (before implementation)

Setup uses the momentum density: one focused permission/test prompt, generous space,
visible Back and Retry. Active recording recovery uses workbench density: a compact
status panel above the retained notes/transcript, with stable controls and no celebration.
Follow design.md Live Practice Flow within the existing full-screen session shell.

Reference research: Mobbin Hume AI permission screen
https://mobbin.com/screens/bc155ede-07de-437a-a7c1-602855e8a843
and Heidi recording error
https://mobbin.com/screens/c6bcf0cb-30a8-49b6-aca6-e993a49c74ff
were inspected as images. Hume puts the microphone status and one action at the center
of a quiet workspace; Heidi pairs a short error heading with a specific next step.
The Whereby reference
https://mobbin.com/screens/06b1ce57-f135-4a91-9787-68767154428a
separates permissions from entering a call. Adopt that distinction for device test
versus actual recording; do not copy its camera or profile setup.

Frame: real web app references, 768px-wide supplied images; no inferred pixel-perfect
measurement. Thinkfy target: existing focused max-w-lg setup; active recovery inside
PageContainer focused, single column. 16/24px gutters; 8/16/24px spacing; rounded-control
buttons and panels; a single 1px outline. Heading type-heading-md, body type-body,
helper type-body-sm. Canvas background, surface-container-lowest, on-surface,
on-surface-variant, primary action, functional warning/error only. Existing Button,
PageContainer, icons registry and next-intl cover the controls; no new design tokens.

Composition: status heading first, one actionable explanation, then persistent Back
and Retry; mobile controls wrap/stack instead of truncating. Setup must explain it is
a device test and has not begun recording the speech. Recovery keeps recorded work
visible. Browser permission prompts are browser-owned: cancellation invalidates the
request and stops any late stream, rather than claiming to close the browser prompt.

Do not copy brand colors, oversized error illustration, modal overlay, or refresh-only
recovery. Thinkfy retries in place and retains practice configuration and transcript.

## Safety and scope

No ambient microphone capture for QA. Use fake streams/recorders and browser-injected
controlled media. The supplied live observation (2026-09-05 15:36–15:39 UTC) reported
microphone permission `prompt`, no in-page controls, no grant and no audio capture.
There was no captured microphone screenshot; the supplied setup screenshot is visual
context only. Credits are charged on feedback analysis submission, not microphone setup.
Do not infer the cause of the unrelated later zero balance.

## Source provenance

Partial behavioral fork from `/Users/jacknguyen/Developer/app-lumist-ai/hooks/admin/useModuleSearch.ts:42-105`
(cancel the previous operation, explicit loading/error, ignore cancellation), and
`:147-173` / `:220-247` (reset/refresh and unmount cleanup). Inspected source directly.
`hooks/useResourceCounts.ts:42-110` also guards late async results after unmount.
Thinkfy adapts cancellation to a request handle because getUserMedia has no AbortSignal;
a cancelled pending promise settles immediately and any later stream is stopped.
Unlike the source search reset, microphone recovery deliberately retains notes,
transcripts and session settings. Lumist establishes no microphone/recording parity.

## Implementation

- `practice-microphone-request.ts`: cancellable request handle; late resolved tracks
  are stopped. Cancellation does not claim to dismiss browser-owned permission UI.
- `mic-check.tsx`: Back/Retry while pending or failed; Back remains available in the
  device test; live-stream handoff only; tracks/listeners/AudioContext/RAF cleaned up.
- `practice-recording-start.ts` and session page: acquire and start the recorder before
  committing speaking/round/timer state. Cancel, leave, finish and unmount invalidate
  pending work. Disconnection/muting pauses capture and shows recovery in view.
- Audio recorder controller: failed starts retain existing chunks, stop calls share a
  promise, final queued data is collected before resume, and errors stop the recorder.
  A one-second stop fallback retains all chunks received if the browser omits its stop
  event. The hook supports React StrictMode replay and an in-memory initial audio blob.
- STT: stale token/WebSocket callbacks cannot restart a paused or replaced connection;
  a restored transcript can seed a resumed connection. Interim words survive pause.
- Back uses the existing locale router and practice prefill query (topic, track, side,
  mode, difficulty and class/assignment context). Setup preserves active in-memory
  settings; Resume is dominant, and starting a replacement is labelled explicitly.
  In-memory audio and remaining speech time survive returning through setup. Existing
  draft restoration retains text; raw audio does **not** persist across browser reload.
- Finishing invalidates pending capture, keeps finalized audio, deduplicates round
  progression, and offers Retry finishing after an error. Short-speech confirmation
  uses the existing accessible Dialog and bilingual non-destructive controls.
- No analysis/payment/server endpoint was added or changed. Existing feedback
  submission transaction and analysis deduplication still own credit charging.

## Verification — 2026-09-05

Dedicated Ego Lite space **72**, never audit space 63. Local server: port **3145**;
process cwd confirmed by `lsof` as
`/Users/jacknguyen/.codex/worktrees/7405/DebateLab/apps/web`.

The existing development-and-localhost-gated `/[locale]/dev/qa` route now includes
`?tab=microphone&mic=pending|denied|missing|success&phase=prep|speaking`.
This mounts the actual session page. It replaces getUserMedia with controlled errors,
pending promises or an oscillator connected only to a MediaStreamDestination (never
the speakers or a physical microphone). STT token requests return a simulated 503;
analysis calls are blocked. The local backend was changed to an unreachable fixture
address after live auth calls took ~28 seconds and returned 504. This is **not** an
authenticated production end-to-end test. No production write, debit or refund was made.

Browser observations:

- EN pending microphone: visible Back and Retry, no captured tracks.
- VI denied microphone: visible practical permission steps and Back/Retry; changing
  the fixture to a live synthetic stream and retrying reached a working device test.
- VI prep → pending start → Cancel: remained in prep, notes retained and timer at
  02:00. Delivering the cancelled request afterward produced an `ended` track, not
  a phase advance or recording.
- Retrying with a synthetic stream entered speaking and reported recording. Simulated
  device disconnect ended all tracks and showed paused recovery. A denied resume
  left the speech timer unchanged and retained the session.
- Restored EN speaking draft → missing-device retry: no tracks, paused recovery,
  and the previous transcript and notes remained visible.

Computed-layout matrix (all checks passed):

| Surface/state | Locales | Themes | Viewports | Result |
| --- | --- | --- | --- | --- |
| SessionConfig setup fixture | EN, VI | light, dark | 1280×720, 1440×900, 768×1024, 390×844 | No document overflow or clipped button labels |
| Pending mic (EN), denied mic (VI) | EN, VI | light, dark | same four | No document overflow or clipped button labels |
| Active recovery: missing device (EN), denied resume (VI) | EN, VI | light, dark | same four | No document overflow or clipped button labels |

**Visual limitation:** Ego `Page.captureScreenshot` timed out; a second capture with
`fromSurface:false` returned “Unable to capture screenshot”. No new screenshots are
claimed. The matrix is DOM/computed-layout evidence, not a pixel comparison. Real
permission prompts, physical device unplugging, production STT, paid feedback, and
full authenticated Back→setup→Resume navigation remain unverified in a live browser.
The fixture's topic content and QA toolbar intentionally remain authored English.

Automated checks:

- `npm run audit:design-system` — pass.
- `npm run test:design-system` — pass.
- `npm run lint` — pass; 12 existing warnings outside this change, zero errors.
- `npm run typecheck -w @thinkfy/web` — pass.
- `npm run test:practice-session-resilience` — pass, including 22 focused lifecycle
  tests for pending cancel, late cleanup, denied/no-device retry, start/resume/next-round
  failure, recorder failure, final chunk retention, StrictMode, and locale/context.
- `npm run test:stt` — pass (STT/transcription checks and 18 live-finalization,
  token/access, endpoint and recorder-stop tests).
- `test:practice-analysis`, `test:practice-feedback-plan`,
  `test:practice-judge-reliability`, `test:practice-language` — pass. These include
  existing server transaction/deduplication and auth-state-isolation checks.

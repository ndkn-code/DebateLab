# Gemini 3.5 Transcribe Live — internal IELTS Speaking benchmark

Date: 2026-09-02

Status: internal benchmark only; disabled by default; not approved for learner rollout.

## Decision

Gemini 3.5 Transcribe Live is promising as a low-latency transcript source, but
this small synthetic benchmark does not justify making it the authoritative
IELTS transcript yet. Keep Deepgram as the production fallback and Azure
Pronunciation Assessment as the acoustic pronunciation signal. The scoring
model, not the transcription model, remains responsible for provisional band
assessment.

Before a learner pilot, obtain written confirmation that DebateLab's intended
student-facing use is permitted under the then-current Google terms. The
current gate is intentionally limited to an adult-attested platform admin on a
UUID allowlist.

## Method

- Six synthetic English responses generated with macOS system voices: US, UK,
  Australian, Indian and Irish varieties, including one faster response.
- Same PCM16 mono 16 kHz WAV used for both providers.
- Gemini: `gemini-3.5-transcribe-live`, `VERBATIM`, 300 ms silent pre-roll,
  40 ms real-time chunks.
- Deepgram: `nova-3`, current post-recording production-style request.
- Punctuation and casing ignored for word error rate; fillers and repetitions
  retained.
- One Gemini session initially closed with WebSocket code 1011 after five
  consecutive sessions. The exact case passed after cooldown and is included
  in the six-case quality aggregate. The first failure remains a reliability
  warning rather than being discarded.

This is a technical smoke benchmark, not the locked examiner benchmark and not
a substitute for adult, consented, accent-balanced human speech.

## Result

| Metric                               | Gemini Live | Deepgram Nova-3 | Interpretation                                 |
| ------------------------------------ | ----------: | --------------: | ---------------------------------------------- |
| Completed after cooldown             |         6/6 |             6/6 | Gemini had one transient 1011 on the first run |
| Word error rate                      |       2.11% |           1.05% | Deepgram was more accurate on this sample      |
| Filler recall                        |   50% (2/4) |       75% (3/4) | Neither meets an IELTS fluency-evidence gate   |
| Mean final latency after audio ended |      244 ms |          617 ms | Gemini saved about 373 ms, or 60%              |

The latency comparison reflects the intended product paths: streaming Gemini
versus the current post-recording Deepgram request. It is not a provider-only
laboratory comparison with identical transport.

## Required release gates

- Run a consented adult shadow study across target accents, devices, noise and
  IELTS parts; do not use synthetic voices as the release dataset.
- Preserve fillers, repetitions, false starts and self-corrections. Target at
  least 98% disfluency recall before the transcript can support fluency scoring.
- Demonstrate no meaningful criterion-band degradation against the locked,
  double-marked examiner set.
- Add the production path as a private Cloud Run WebSocket gateway so the
  server, not a browser-supplied transcript, owns the scored evidence.
- Retain the original recording for Azure acoustic assessment and Deepgram
  fallback.
- Split the 11–14 minute IELTS Speaking test into answer/part sessions because
  the dedicated live transcription session is limited to ten minutes.

## Official references

- [Live transcription](https://ai.google.dev/gemini-api/docs/live-api/live-transcribe)
- [Ephemeral tokens](https://ai.google.dev/gemini-api/docs/live-api/ephemeral-tokens)
- [Session management](https://ai.google.dev/gemini-api/docs/live-api/session-management)
- [Gemini API terms](https://ai.google.dev/gemini-api/terms)

# Grafana Faro frontend diagnostics

Faro is optional and starts only after the existing analytics consent cookie is
granted. Session Replay is not installed or enabled. PostHog remains the product
analytics system.

## Configuration

Set `NEXT_PUBLIC_GRAFANA_FARO_COLLECTOR_URL` to the public collector URL from
Grafana Frontend Observability. The app name is `thinkfy-web`; environment and
the full release commit SHA are attached automatically.

Private source-map upload is opt-in. Set
`GRAFANA_FARO_SOURCE_MAPS_ENABLED=true` and configure the four server-only
`GRAFANA_FARO_SOURCEMAP_*`/stack/app variables documented in `.env.example`.
The post-build step fails closed if credentials or the release SHA are missing,
uploads the maps to Grafana, and removes every `.map` from the deployable
`.next/static` directory even when upload fails.

## Capturing handled failures

Use `captureHandledError` from `@/lib/observability/faro-client` only at the
point where an operation has definitively failed. Pass categorical metadata,
never request/response bodies, transcripts, essays, prompts, audio, email, or
tokens. The shared `beforeSend` scrubber is a final guard, not permission to add
user content.

The global, admin dashboard, and course editor React error boundaries are wired
in the initial rollout. Follow-up instrumentation should prioritize the existing
client failure branches for practice analysis, transcription, TTS, IELTS
scoring, authentication, payments, and AI-provider operations. Add one boundary
at a time with a stable `featureArea` and fingerprint, and verify its context is
categorical before rollout.

The manual Tally report includes only Faro session, active trace, release, and
application debug identifiers. Routes are normalized without query strings.

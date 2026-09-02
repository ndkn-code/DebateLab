# AI grading worker

Private Cloud Run service for DebateLab practice analysis and IELTS
Writing/Speaking provisional scoring. It consumes authenticated Pub/Sub push
messages containing only source IDs, loads student data from Supabase with the
service role, and reuses the web app's centralized AI core.

The service is intentionally not a Vercel Function and must never be made
public. See `docs/ai-grading-gcp-runbook.md` for resources, identities, secrets,
rollback, and smoke tests.

Runtime endpoints:

- `POST /` — Pub/Sub push identity only.
- `POST /internal/reconcile` — Cloud Scheduler identity only.
- `GET /healthz` — Cloud Run private health check.
- `GET /readyz` — secret-safe deployment readiness; returns 503 when required
  runtime identity/provider configuration is missing or invalid.

When `AI_GRADING_REQUIRE_AZURE_PRONUNCIATION=true`, readiness requires an
explicit Azure key and region plus `AI_GRADING_AZURE_EXPECTED_REGION`. The
configured and expected regions must match (for the current Azure for Students
resource, both are `centralus`). Readiness returns variable names only and never
secret values. A custom endpoint alone cannot satisfy this release check.

## Locked IELTS calibration job

The protected IELTS release benchmark is a Cloud Run **Job**, not an HTTP
endpoint. It executes the same version-pinned rubric/exemplar retrieval,
provisional scorer, adjacent-band retrieval, and evidence adjudication used by
production grading:

```sh
npm run benchmark -w @thinkfy/ai-grading-worker
```

Configure `AI_GRADING_GATE_CORPUS_VERSION` and optionally
`AI_GRADING_BENCHMARK_SPLIT` / `AI_GRADING_BENCHMARK_KEYS`. The grader version
is locked in code to `evidence-adjudicated-v1`; a conflicting
`AI_GRADING_GATE_VERSION` fails closed. Bind the same attestation value both as
the job's `AI_GRADING_BENCHMARK_ATTESTATION_SECRET` Secret Manager secret and
as the Supabase Vault secret named `ai_grading_benchmark_attestation_secret`.

Protected manifests must carry the exact question grounding used by live
scoring: the reviewed reference/model answer (or explicit `null`), examiner
notes, peer references, and Part 2 cue-card bullets. Audio cases additionally
require non-null Azure pronunciation, accuracy, fluency, and prosody signals;
the immutable audio checksum; Azure provider/config/report checksums; and STT
provider/model/transcript checksum. Azure unscripted assessment may leave
completeness `null` only when the manifest records the limitation reason. The
Azure snapshot is locked to provider `azure`, model
`pronunciation-assessment`, Speech SDK `1.51.0`, the production 16 kHz mono PCM
configuration, assessment mode, locale, grading system, phoneme granularity,
IPA, prosody, and miscue settings. Its hash covers that entire identity. The
private normalized Azure report is a separately versioned object with its own
ETag and SHA-256. Both import and release execution download it, verify its raw
bytes, derive the signal again with the production parser, and compare every
score and flagged word. The benchmark never runs Speaking from a transcript
alone. Every protected response, audio artifact, and report must live in the
`ai-grading-benchmarks-private` bucket; the importer, worker, and release gate
independently verify that the bucket exists and is not public.
The trusted acoustic-preprocessing job signs a versioned envelope binding the
benchmark/capture identity, object paths, audio/transcript/config/report hashes,
and Azure provider/model/API/mode. Import, execution, and release verify that
signature through a Vault-backed RPC; the importer has no signing secret or
signing code path. Active cases cannot reuse a report path, report hash, or
attestation envelope.

The trusted preprocessing boundary is executable rather than a manual JSON
editing convention:

```sh
npm run acoustic:preprocess -w @thinkfy/ai-grading-worker
```

Set `AI_GRADING_ACOUSTIC_MODE=assess` with
`AI_GRADING_ACOUSTIC_INPUT_FILE` pointing to a protected JSON instruction file
to validate a 16 kHz, mono, 16-bit PCM WAV and create the normalized Azure
report plus a signed assessment receipt. The receipt cryptographically binds
the report bytes to the exact WAV bytes, benchmark/capture identity, and locale;
the later attestation refuses a report assessed from any other audio. Assess
mode receives only `AI_GRADING_ACOUSTIC_ASSESSMENT_RECEIPT_SECRET`; it must not
receive the final envelope signing secret. Keep the
receipt protected with the report. Upload the WAV and report to the private
benchmark bucket, record their immutable storage versions and ETags, and have a
second person verify the STT transcript against the audio. Then run
`AI_GRADING_ACOUSTIC_MODE=attest` with the same input variable and the
Secret Manager-bound
`AI_GRADING_ACOUSTIC_ASSESSMENT_RECEIPT_SECRET` to verify the intermediate
receipt and `AI_GRADING_BENCHMARK_ATTESTATION_SECRET` to sign the final
envelope. These secrets must be independently generated and stored. The command refuses unreviewed
transcripts, scripted reports, unsupported WAV files, non-private object paths,
future review timestamps, invalid object identities, mismatched assessment
receipts, and existing output files.
It writes the protected result with mode `0600` and emits only a status/path
summary to stdout. The signed envelope binds the transcript-review receipt and
both objects' storage versions/ETags in addition to their hashes.

Both live and benchmark scoring use the same skill-specific policy builders:
Speaking allows 3,072 output tokens, Writing 4,096, provisional temperature is
0.2, and adjudication temperature is 0. The configured primary and bounded
Groq fallback candidates are identical at both boundaries.
Provider preflight also requires a non-empty `GROQ_API_KEY` and rejects model
names outside the built-in verified set. A newly qualified model must be
explicitly listed in `GROQ_IELTS_SUPPORTED_MODELS` before any stage claim.

Each benchmark/run-kind/pipeline-stage has an atomic database lease immediately
before that stage's paid provider call. Secret checks and retrieval complete
before the corresponding lease crosses the spend boundary. A completed
provisional audit is checkpointed and reused if adjacent retrieval or final
adjudication later crashes. An expired provider-started stage becomes
`PROVIDER_OUTCOME_UNKNOWN` and is not automatically retried. Recovery accepts
only a successful provider audit whose HMAC is verified inside Supabase using
the Vault secret. This prevents concurrent jobs and post-provider crashes from
duplicating paid calls. Audited HTTP responses and persisted schema-invalid
responses may release the matching stage for at most three attempts; transport
timeouts or socket loss remain outcome-unknown. The job emits summaries
only—never labels or model predictions.
Failure audits are HMAC-bound to the exact claim token and attempt number. An
old genuine 429/schema failure therefore cannot release a later claim.

This job adds no Vercel route, function, queue, cron, webhook, or Workflow
entrypoint.

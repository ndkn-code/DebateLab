# AI grading on Cloud Run and Pub/Sub

This runbook describes infrastructure only. Nothing in the repository applies
it automatically. Production project: `thinkfy-debatelab-prod`; region:
`asia-southeast1`.

## Security and data boundary

- `ai-grading-worker` is a private Cloud Run service (`--no-allow-unauthenticated`).
- Pub/Sub messages contain only the grading kind, source UUID, and durable run
  UUID. Student content is loaded from Supabase inside Cloud Run.
- Pub/Sub and Cloud Scheduler use separate service accounts. The worker verifies
  their Google-signed ID-token email and audience in addition to Cloud Run IAM.
- Vercel publishes with its OIDC token through Workload Identity Federation and
  service-account impersonation. Do not create or upload a JSON key.
- `ai_grading_checkpoints` is service-role-only. Learners can still read the
  sanitized `ai_workflow_runs` projection under its existing RLS policy.

## Required resources

Names used by the checked-in configuration:

- Artifact Registry: `debatelab-workers`
- Cloud Run service: `ai-grading-worker`
- runtime service account: `debatelab-ai-grading-worker`
- Vercel publisher service account: `debatelab-vercel-publisher`
- Pub/Sub push service account: `debatelab-ai-grading-push`
- Scheduler service account: `debatelab-ai-grading-scheduler`
- topic: `ai-grading-jobs`
- subscription: `ai-grading-jobs-cloud-run`
- dead-letter topic/subscription: `ai-grading-jobs-dlq` /
  `ai-grading-jobs-dlq-ops`
- Scheduler job: `ai-grading-reconcile`

Grant the shared Vercel publisher `roles/pubsub.publisher` on exactly the two
topics it serves: `ai-grading-jobs` and `lms-material-processing`. Do not grant
project-wide Pub/Sub publishing.
Grant the push and Scheduler identities only `roles/run.invoker` on the worker.
Grant the runtime identity `roles/secretmanager.secretAccessor` on the named
runtime secrets and `roles/pubsub.publisher` on the grading topic for reconcile.
Pub/Sub's service agent needs publisher/subscriber permissions required for DLQ
forwarding.

## Build and deploy (manual, reviewed release only)

Build from the repository root, then resolve the tag to its immutable digest:

```bash
gcloud builds submit . \
  --project=thinkfy-debatelab-prod \
  --region=asia-southeast1 \
  --config=services/ai-grading-worker/cloudbuild.yaml \
  --substitutions=_IMAGE=asia-southeast1-docker.pkg.dev/thinkfy-debatelab-prod/debatelab-workers/ai-grading-worker:$GIT_SHA

AI_GRADING_IMAGE_URI="asia-southeast1-docker.pkg.dev/thinkfy-debatelab-prod/debatelab-workers/ai-grading-worker:$GIT_SHA"
AI_GRADING_IMAGE_DIGEST="$(gcloud artifacts docker images describe "$AI_GRADING_IMAGE_URI" \
  --project=thinkfy-debatelab-prod \
  --format='value(image_summary.digest)')"
test -n "$AI_GRADING_IMAGE_DIGEST"
AI_GRADING_IMAGE="${AI_GRADING_IMAGE_URI%:*}@$AI_GRADING_IMAGE_DIGEST"
```

Deploy privately with concurrency one. Concurrency one is defense in depth; the
database lease remains the authority.

```bash
gcloud run deploy ai-grading-worker \
  --project=thinkfy-debatelab-prod \
  --region=asia-southeast1 \
  --image="$AI_GRADING_IMAGE" \
  --service-account=debatelab-ai-grading-worker@thinkfy-debatelab-prod.iam.gserviceaccount.com \
  --no-allow-unauthenticated --concurrency=1 --timeout=3600 --max-instances=10 \
  --set-env-vars=GCP_PROJECT_ID=thinkfy-debatelab-prod,GCP_AI_GRADING_TOPIC=ai-grading-jobs,AI_GRADING_IMAGE_DIGEST="$AI_GRADING_IMAGE_DIGEST",AZURE_SPEECH_REGION=centralus,AI_GRADING_AZURE_EXPECTED_REGION=centralus,AI_GRADING_REQUIRE_AZURE_PRONUNCIATION=true \
  --set-secrets=NEXT_PUBLIC_SUPABASE_URL=supabase-url:latest,SUPABASE_SERVICE_ROLE_KEY=supabase-service-role-key:latest,GROQ_API_KEY=debatelab-groq-api-key:latest,DEEPSEEK_API_KEY=debatelab-deepseek-api-key:latest,DEEPGRAM_API_KEY=debatelab-deepgram-api-key:latest,VOYAGE_API_KEY=debatelab-voyage-api-key:latest,AZURE_SPEECH_KEY=debatelab-azure-speech-key:latest
```

Also set `DEBATE_CORPUS_EMBEDDING_URL`,
`GCP_PUBSUB_PUSH_SERVICE_ACCOUNT_EMAIL`,
`GCP_SCHEDULER_SERVICE_ACCOUNT_EMAIL`, and `CLOUD_RUN_SERVICE_URL` as ordinary
environment variables. `GROQ_IELTS_SCORING_FALLBACK_MODEL` is optional and
defaults to `openai/gpt-oss-20b`; it provides a fast, same-provider fallback
inside the already-fenced logical provider phase. Add Voyage only when the
collection runtime is enabled; it is not required for the queue transport.

Create the push subscription with authenticated OIDC, exponential retry, and a
dead-letter policy. Recommended values:

```bash
gcloud pubsub subscriptions create ai-grading-jobs-cloud-run \
  --project=thinkfy-debatelab-prod --topic=ai-grading-jobs \
  --push-endpoint="$CLOUD_RUN_SERVICE_URL/" \
  --push-auth-service-account=debatelab-ai-grading-push@thinkfy-debatelab-prod.iam.gserviceaccount.com \
  --push-auth-token-audience="$CLOUD_RUN_SERVICE_URL" \
  --min-retry-delay=10s --max-retry-delay=600s \
  --dead-letter-topic=ai-grading-jobs-dlq --max-delivery-attempts=5 \
  --ack-deadline=600
```

Create Cloud Scheduler to POST `/internal/reconcile` every five minutes with
the Scheduler service account and the exact service URL as OIDC audience:

```bash
gcloud scheduler jobs create http ai-grading-reconcile \
  --project=thinkfy-debatelab-prod \
  --location=asia-southeast1 \
  --schedule='*/5 * * * *' \
  --uri="$CLOUD_RUN_SERVICE_URL/internal/reconcile" \
  --http-method=POST \
  --oidc-service-account-email=debatelab-ai-grading-scheduler@thinkfy-debatelab-prod.iam.gserviceaccount.com \
  --oidc-token-audience="$CLOUD_RUN_SERVICE_URL"
```

Use `gcloud scheduler jobs update http` when the job already exists; a release
must never create a duplicate scheduler.

## Protected IELTS benchmark Cloud Run Job

The release benchmark reuses the worker image but runs as an offline Cloud Run
Job. It does not expose an HTTP endpoint. After applying migration
`20260901180000_ai_grading_benchmark_executor_claims.sql`, store the identical
attestation value in Google Secret Manager and Supabase Vault (Vault name:
`ai_grading_benchmark_attestation_secret`). Never put it in a command or build
argument.

Before import, each protected case must include the exact-question grounding
used by production: reference/model answer (or explicit `null`), examiner
notes, peer references, and Speaking Part 2 cue-card bullets. Speaking audio
must also include Azure pronunciation, accuracy, fluency, and prosody signals,
plus immutable audio, Azure config/report, and STT transcript provenance. A
missing Azure completeness score is valid for unscripted continuous
assessment only when its limitation reason is recorded. The importer verifies
the stored artifact and transcript checksums, the canonical production Azure
configuration, and the private report object's storage version, ETag, and raw
SHA-256. The release executor independently downloads that same report,
re-derives every score and flagged word through the production parser, and
recomputes the prompt hash. Transcript-only Speaking cases fail closed. Do not
substitute synthetic provenance or run live Azure during benchmark import.
All protected response, audio, and Azure report objects must be stored in the
dedicated `ai-grading-benchmarks-private` bucket. Migration `1800` forces that
bucket private and prevents rename, publicization, or deletion; no learner or
authenticated-user object policy is created.
Before import, the trusted preprocessing job must sign the versioned acoustic
envelope with the benchmark attestation secret. The envelope binds benchmark
and capture IDs, object paths, all four hashes, and the Azure runtime identity.
The importer never receives this secret: it calls the Vault-backed verification
RPC, as do the executor and release gate. Reused report paths, hashes, or
envelopes are rejected.

Examiner credentials, consent, withdrawal freshness, and study grouping use a
second, independent trust boundary. The study lead holds an offline Ed25519
private key; import and release processes receive only its public key. A signed
release envelope binds the artifact, consent/retention, a withdrawal-registry
snapshot, examiner credential proof hashes, and the four grouping receipts. It
expires within 24 hours of the withdrawal check. Configure the public
`AI_GRADING_BENCHMARK_TRUST_SET_JSON` for the release gate and mount that same
public trust set as `AI_GRADING_BENCHMARK_TRUST_SET_FILE` for the importer and
detached attestation refresh command. The trust set supports an overlap window
during key rotation. Refresh updates only the release-attestation table and
never rewrites protected benchmark labels. Never give the
study-lead private key to the importer, worker, or service-role environment.

Run acoustic preparation as a separate private Cloud Run Job using the same
reviewed worker image. It is deliberately two-stage:

1. `AI_GRADING_ACOUSTIC_MODE=assess` validates the exact recorder WAV format
   and creates a normalized unscripted Azure report. It never uses the learner
   transcript as reference text.
2. After the audio/report objects are uploaded and a separate human verifies
   the STT transcript against the recording,
   `AI_GRADING_ACOUSTIC_MODE=attest` reopens all three artifacts, re-derives the
   production signal, and signs their hashes, object versions/ETags, Azure
   identity, and transcript-review receipt. Output is a new mode-0600 file;
   existing output is never overwritten.

The job command is `npm run acoustic:preprocess -w
@thinkfy/ai-grading-worker`. Provision two independent secrets:

- bind `AI_GRADING_ACOUSTIC_ASSESSMENT_RECEIPT_SECRET` to both `assess` and
  `attest`; it authenticates only the intermediate Azure assessment receipt;
- bind Azure credentials only to `assess`;
- bind `AI_GRADING_BENCHMARK_ATTESTATION_SECRET` only to `attest`; it signs the
  final benchmark acoustic envelope.

The two HMAC values must be different. Do not grant either job public ingress
and do not reuse the importer identity as the attestation signer.

Create or update the job with the reviewed immutable image digest:

```bash
gcloud run jobs deploy ai-grading-ielts-benchmark \
  --project=thinkfy-debatelab-prod \
  --region=asia-southeast1 \
  --image="$AI_GRADING_IMAGE" \
  --service-account=debatelab-ai-grading-worker@thinkfy-debatelab-prod.iam.gserviceaccount.com \
  --command=npm \
  --args=run,benchmark,-w,@thinkfy/ai-grading-worker \
  --max-retries=0 --task-timeout=3600 \
  --set-env-vars=AI_GRADING_GATE_CORPUS_VERSION="$CORPUS_VERSION",AI_GRADING_BENCHMARK_SPLIT=holdout \
  --set-secrets=NEXT_PUBLIC_SUPABASE_URL=debatelab-supabase-url:latest,SUPABASE_SERVICE_ROLE_KEY=debatelab-supabase-service-role:latest,GROQ_API_KEY=debatelab-groq-api-key:latest,VOYAGE_API_KEY=debatelab-voyage-api-key:latest,AI_GRADING_BENCHMARK_ATTESTATION_SECRET=debatelab-ai-grading-benchmark-attestation:latest
```

Execute it manually for a reviewed release. A separate database claim for each
provisional/adjudication stage is the spend authority; Cloud Run retries stay
disabled. Preflight and retrieval finish before the matching stage starts, and
a verified provisional checkpoint is reused after a later crash. The grader is locked to
`evidence-adjudicated-v1`, all retrieval is pinned to the requested published
corpus version, and the job prints counts only. A stale provider-started claim
becomes `PROVIDER_OUTCOME_UNKNOWN` and requires a Vault-HMAC-verified provider
audit to recover; it is never automatically charged again. A definite HTTP or
schema-invalid failure is released only after Supabase verifies every linked
error audit and is capped at three attempts. Provider preflight checks the key
and every selected model before any claim; extend the verified model set with
`GROQ_IELTS_SUPPORTED_MODELS` only after qualification.
Definite-failure audit signatures also bind the exact claim token and attempt;
replaying a prior attempt's valid audit cannot unlock current spend authority.

## Vercel WIF publisher

Use the existing `vercel` workload identity pool/provider and production
subject restriction. Required Vercel variables are documented in `.env.example`.
The web app needs `@vercel/oidc`; it does not need a GCP private key.

`AI_GRADING_BACKEND` is mandatory:

- `gcp`: create/reuse the durable run and publish it.
- `legacy`: pause new durable grading. New IELTS Writing/Speaking submissions
  receive an actionable 503 before metering or persistence; existing runs and
  checkpoints are retained. The existing Debate `/api/analyze` compatibility
  path remains usable.
- missing/unknown: fail closed before a provider is selected.

`PRACTICE_FULL_ROUND_CORE_STAGED_ENABLED` controls the durable English/Vietnamese
full-round compound judge. It defaults on only for the GCP practice worker and
still performs one fenced provider transaction. Set it to `false` for an
immediate quality-path rollback; short debate, speaking practice, and the
synchronous compatibility route are unaffected.

## Release smoke tests

Before setting the web environment to `gcp`:

1. Apply migrations through `20260902090000` in preview and verify all new RPCs
   reject `anon` and `authenticated` while service role succeeds.
   Before applying, confirm `20260901200000` is absent from
   `supabase_migrations.schema_migrations`. The `2000`/`2010`/`2020` sequence
   is a corrected three-phase replacement and must not be applied over a target
   that already ran the earlier monolithic `2000` file; use a new reviewed
   forward-only repair sequence for such a target.
   Before switching traffic, call the private `/readyz` endpoint using an
   authorized identity and require HTTP 200 with `azurePronunciation=true`.
2. Submit one practice, Writing, and Speaking job. Confirm the Pub/Sub payload
   contains no learner content and each produces one checkpoint/run.
3. Send the same Pub/Sub envelope twice concurrently. Confirm one provider phase
   and one persisted result.
4. Fail persistence after output checkpoint. Confirm redelivery reuses output.
5. Expire a pre-provider lease. Confirm Scheduler republishes and processing
   resumes within the three-attempt cap.
6. Kill the worker after the third claim. Confirm a validated output checkpoint
   is persisted without another provider call; without a checkpoint, confirm
   the workflow and source become an explicit terminal/manual-retry state.
7. Simulate loss after provider start but before output checkpoint. Confirm the
   terminal code is `PROVIDER_OUTCOME_UNKNOWN` and no automatic second charge.
8. Simulate an HTTP 429/5xx and malformed provider output. Confirm only these
   definite failures are re-driven within the three-attempt cap. A client
   timeout or socket loss must remain outcome-unknown and must not auto-call a
   fallback provider.
9. Confirm an invalid Pub/Sub/Scheduler identity receives no work.
10. Persist one immutable `ai_grading_operational_evidence` run linked to the
    actual workflow rows for duplicate delivery, provider timeout, stale claim,
    persistence retry, and retry exhaustion. The evidence expires after seven
    days and must be regenerated for a release. Begin the run with
    `begin_ai_grading_operational_evidence`, predeclare each fresh queued job with
    `declare_ai_grading_operational_scenario`, finalize it only after the fault
    with `finalize_ai_grading_operational_scenario`, then seal all five. These
    functions bind deployment/grader/corpus identity and derive provider calls,
    checkpoints, worker-authored `K_REVISION`/image digest, and ordered fault
    transitions from durable rows; direct inserts are denied. Deploy the worker
    with `AI_GRADING_IMAGE_DIGEST` set to the immutable container digest in
    `sha256:<64 lowercase hex characters>` form. The smoke fails closed unless
    Cloud Run also supplies a valid `K_REVISION`; placeholder runtime identities
    are never accepted. Only
    the dedicated smoke revision sets `AI_GRADING_OPERATIONAL_ATTESTATION_ENABLED=true`;
    ordinary grading avoids the extra transition RPCs.
11. Inspect DLQ alerts, latency, provider attempt count, workflow failures, and
    Cloud Run instance/cost dashboards.

### Staging-only operational fault harness

Never run this harness against production. The CLI refuses any environment
other than `preview` or `staging`, requires the target hostname to contain that
environment, rejects `thinkfy.net`, and rejects production/main deployment
refs. It performs no provider work itself and never changes the reference-only
Pub/Sub contract. Scenario control comes only from the protected operational
claim created by the existing RPC and the current fenced worker claim token.

Prepare an explicit protected state file and a deterministic, non-production
smoke revision name. The state file is created atomically with mode `0600` and
contains the scenario tokens, so do not commit it or print it in CI logs.

Before enabling the harness, an infrastructure operator must create the Vault
secret `ai_grading_environment_bootstrap_secret` and call
`bootstrap_ai_grading_environment_marker` exactly once in each database. Mark
the smoke database `preview` or `staging` with its real Supabase project ref;
mark production `production`. The marker is immutable. A production or absent
marker makes the worker, readiness check, and CLI fail closed. Never put the
bootstrap secret in the worker revision or state file.

```bash
export AI_GRADING_OPERATIONAL_ENVIRONMENT=staging
export AI_GRADING_OPERATIONAL_TARGET_URL=https://ai-grading-worker-staging-REPLACE.run.app
export AI_GRADING_OPERATIONAL_DEPLOYMENT_REF=codex/ai-grading-staging-smoke
export AI_GRADING_OPERATIONAL_DATABASE_REF=REPLACE_STAGING_SUPABASE_PROJECT_REF
export AI_GRADING_PRODUCTION_DATABASE_REF=REPLACE_PRODUCTION_SUPABASE_PROJECT_REF
export AI_GRADING_OPERATIONAL_STATE_FILE=/secure/path/ai-grading-operational-state.json
export AI_GRADING_OPERATIONAL_RUN_ID=release-smoke-REPLACE
export AI_GRADING_GATE_VERSION=evidence-adjudicated-v1
export AI_GRADING_GATE_CORPUS_VERSION=REPLACE
export K_REVISION=ai-grading-worker-staging-smoke-REPLACE
export AI_GRADING_IMAGE_DIGEST=sha256:REPLACE_WITH_64_LOWERCASE_HEX
npm run operational:evidence -w @thinkfy/ai-grading-worker -- begin
```

The CLI extracts the actual project ref from `NEXT_PUBLIC_SUPABASE_URL`, requires
both database refs, and refuses either a mismatch or equality with the declared
production ref. It then fetches the database-owned immutable marker through the
service-role RPC and requires the same preview/staging environment and ref. It
reports variable names only, never project secrets. `begin`, `declare`,
`finalize`, and `seal` re-read protected DB state, so rerunning after an RPC
success/local-state-write crash is idempotent.

Before creating any scenario jobs, pause push delivery so a normal worker cannot
claim the fresh rows before their protected scenario records and token bundle
exist. Clearing the push config retains messages on the subscription as pull
messages; it does not delete them.

```bash
export AI_GRADING_SMOKE_SUBSCRIPTION=ai-grading-jobs-cloud-run-staging
gcloud pubsub subscriptions modify-push-config "$AI_GRADING_SMOKE_SUBSCRIPTION" \
  --project=thinkfy-debatelab-prod --clear-push-config
```

Create five fresh queued IELTS Writing/Speaking workflow rows through the normal
staging submission path while push delivery remains paused. For each row,
declare exactly one scenario. Declaration does not publish or modify a learner
payload.

```bash
export AI_GRADING_OPERATIONAL_SCENARIO=duplicate_delivery
export AI_GRADING_OPERATIONAL_WORKFLOW_RUN_ID=REPLACE_UUID
npm run operational:evidence -w @thinkfy/ai-grading-worker -- declare
```

Repeat for `provider_timeout`, `stale_claim`, `persistence_retry`, and
`retry_exhaustion`. Bind the comma-separated five `injectionToken` values from
the protected state file to Secret Manager as
`AI_GRADING_OPERATIONAL_FAULT_INJECTION_TOKENS`; do not echo them. Deploy only
the predeclared smoke revision with that secret plus:

```text
AI_GRADING_OPERATIONAL_FAULT_INJECTION_ENABLED=true
AI_GRADING_OPERATIONAL_ATTESTATION_ENABLED=true
AI_GRADING_OPERATIONAL_ENVIRONMENT=staging
AI_GRADING_OPERATIONAL_DATABASE_REF=REPLACE_STAGING_SUPABASE_PROJECT_REF
AI_GRADING_PRODUCTION_DATABASE_REF=REPLACE_PRODUCTION_SUPABASE_PROJECT_REF
```

Only after `/readyz` is 200 for that smoke revision, restore authenticated push
delivery to the private staging service. Reapply the same OIDC service account
and audience used when the subscription was created; do not point this
subscription at production.

```bash
gcloud pubsub subscriptions modify-push-config "$AI_GRADING_SMOKE_SUBSCRIPTION" \
  --project=thinkfy-debatelab-prod \
  --push-endpoint="$AI_GRADING_OPERATIONAL_TARGET_URL/" \
  --push-auth-service-account=debatelab-ai-grading-push@thinkfy-debatelab-prod.iam.gserviceaccount.com \
  --push-auth-token-audience="$AI_GRADING_OPERATIONAL_TARGET_URL"
```

The deployment identity and image digest must exactly match the evidence run.
The five deterministic transitions are:

- `duplicate_delivery`: persist and complete once, return a non-ack once, then
  let the redelivery observe the completed run without another provider call.
- `provider_timeout`: stop after the provider reservation with an ambiguous
  outcome; atomically record one simulated paid-boundary attempt, then the run
  becomes `PROVIDER_OUTCOME_UNKNOWN` and is never repaid.
- `stale_claim`: non-ack after preparation while leaving the lease intact;
  Scheduler reconciliation re-drives it after expiry.
- `persistence_retry`: checkpoint output, mark persistence started, then
  non-ack before the persistence call; redelivery reuses the paid output.
- `retry_exhaustion`: record three definite HTTP-5xx-equivalent failures; the
  third exhausts to the existing manual-retryable terminal state.

The timeout and retry-exhaustion scenarios do not contact a live provider.
Their protected boundary-attempt RPC proves provider-call fencing, attempt
accounting, terminal consistency, and retry policy without consuming student
data or spend; it does not validate Groq availability or latency.

Poll emits counts only. Once a scenario is terminal, bind the protected token
bundle in the operator shell, finalize it, and repeat. Finalization derives the
pass/fail result from real run, checkpoint, provider-attempt, runtime-attestation,
and ordered-transition rows; it does not accept a caller-authored pass flag.

```bash
npm run operational:evidence -w @thinkfy/ai-grading-worker -- poll
export AI_GRADING_OPERATIONAL_SCENARIO=duplicate_delivery
export AI_GRADING_OPERATIONAL_FAULT_INJECTION_TOKENS=REDACTED_COMMA_SEPARATED_UUIDS
npm run operational:evidence -w @thinkfy/ai-grading-worker -- finalize
# After all five have passed:
npm run operational:evidence -w @thinkfy/ai-grading-worker -- seal
```

There is deliberately no cleanup/delete operation. Disable the push
subscription, remove the smoke revision's injection enable flag, and retain the
sealed evidence for the release gate. Ordinary revisions must leave both
operational enable flags unset.

## Rollback

Set `AI_GRADING_BACKEND=legacy` in the web environment to reject new IELTS
Writing/Speaking grading before charging or persistence. Do not delete the
topic, run rows, checkpoint rows, or migration. Stop the push subscription if
worker behavior itself is unsafe. Existing validated checkpoints remain
replayable after a corrected image is deployed. Roll Cloud Run back to the
prior image, run the smoke suite, then restore `gcp`. Database migrations are
forward-only.

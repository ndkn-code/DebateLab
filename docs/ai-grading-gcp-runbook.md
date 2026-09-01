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

Grant the Vercel publisher only `roles/pubsub.publisher` on the grading topic.
Grant the push and Scheduler identities only `roles/run.invoker` on the worker.
Grant the runtime identity `roles/secretmanager.secretAccessor` on the named
runtime secrets and `roles/pubsub.publisher` on the grading topic for reconcile.
Pub/Sub's service agent needs publisher/subscriber permissions required for DLQ
forwarding.

## Build and deploy (manual, reviewed release only)

Build from the repository root:

```bash
gcloud builds submit . \
  --project=thinkfy-debatelab-prod \
  --region=asia-southeast1 \
  --config=services/ai-grading-worker/cloudbuild.yaml \
  --substitutions=_IMAGE=asia-southeast1-docker.pkg.dev/thinkfy-debatelab-prod/debatelab-workers/ai-grading-worker:$GIT_SHA
```

Deploy privately with concurrency one. Concurrency one is defense in depth; the
database lease remains the authority.

```bash
gcloud run deploy ai-grading-worker \
  --project=thinkfy-debatelab-prod \
  --region=asia-southeast1 \
  --image=asia-southeast1-docker.pkg.dev/thinkfy-debatelab-prod/debatelab-workers/ai-grading-worker:$GIT_SHA \
  --service-account=debatelab-ai-grading-worker@thinkfy-debatelab-prod.iam.gserviceaccount.com \
  --no-allow-unauthenticated --concurrency=1 --timeout=3600 --max-instances=10 \
  --set-env-vars=GCP_PROJECT_ID=thinkfy-debatelab-prod,GCP_AI_GRADING_TOPIC=ai-grading-jobs \
  --set-secrets=NEXT_PUBLIC_SUPABASE_URL=debatelab-supabase-url:latest,SUPABASE_SERVICE_ROLE_KEY=debatelab-supabase-service-role:latest,GROQ_API_KEY=debatelab-groq-api-key:latest,DEEPSEEK_API_KEY=debatelab-deepseek-api-key:latest,DEEPGRAM_API_KEY=debatelab-deepgram-api-key:latest,AZURE_SPEECH_KEY=debatelab-azure-speech-key:latest
```

Also set `AZURE_SPEECH_REGION`, `EMBEDDING_API_URL`,
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
the Scheduler service account and the exact service URL as OIDC audience.

## Vercel WIF publisher

Use the existing `vercel` workload identity pool/provider and production
subject restriction. Required Vercel variables are documented in `.env.example`.
The web app needs `@vercel/oidc`; it does not need a GCP private key.

`AI_GRADING_BACKEND` is mandatory:

- `gcp`: create/reuse the durable run and publish it.
- `legacy`: do not publish new GCP work. This is the kill switch; saved jobs are
  retained, and the existing `/api/analyze` compatibility path remains usable.
- missing/unknown: fail closed before a provider is selected.

## Release smoke tests

Before setting the web environment to `gcp`:

1. Apply migrations through `20260901170000` in preview and verify all new RPCs
   reject `anon` and `authenticated` while service role succeeds.
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

## Rollback

Set `AI_GRADING_BACKEND=legacy` in the web environment. Do not delete the topic,
run rows, checkpoint rows, or migration. Stop the push subscription if worker
behavior itself is unsafe. Existing validated checkpoints remain replayable
after a corrected image is deployed. Roll Cloud Run back to the prior image,
run the smoke suite, then restore `gcp`. Database migrations are forward-only.

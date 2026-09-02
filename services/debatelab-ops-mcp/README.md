# DebateLab private operations MCP

Read-only, data-minimized Model Context Protocol service for DebateLab AI operations. It runs as a private Cloud Run service and uses the MCP SDK's stateless Streamable HTTP transport.

## HTTP surface

- `POST /mcp` — MCP JSON-RPC; requires both Cloud Run IAM and an app-layer Google OIDC ID token.
- `GET /healthz` — process liveness.
- `GET /readyz` — secret-safe configuration and Supabase connectivity readiness.

There are no Vercel routes, cron jobs, queues, workflows, webhooks, Server Actions, arbitrary SQL tools, or arbitrary provider prompts in this service. Request bodies, tool arguments, provider content, learner content, and database error details are never logged. MCP bodies are limited to 64 KiB.

## Tools

The read tools return only workflow IDs/statuses, counts, collection versions, and aggregate model/evaluation metrics:

- `get_grading_run_status(runId)`
- `get_model_health(windowHours)` (1–168 hours)
- `get_failed_or_stale_jobs(limit)` (1–100 jobs)
- `get_corpus_versions()`
- `get_corpus_review_readiness(collection)` — one allowlisted Debate/IELTS collection
- `get_benchmark_results()`
- `run_synthetic_model_smoke(model, confirm=true)` — disabled by default and limited to one invocation per minute per service instance; accepts only `qwen` (`qwen/qwen3.8-27b`) or `gpt-oss` (`openai/gpt-oss-120b`) and sends a fixed synthetic prompt. It never accepts or returns learner text.

The service deliberately does not select or return source IDs, user IDs, transcripts, essays, prompts, predictions, or protected benchmark labels. It has no service-role credential. Its capability token can execute only the sanitized `ops_mcp_*` functions introduced by migration `20260902140000_debatelab_ops_mcp_reader.sql`.

## Required configuration

Set these with Cloud Run environment variables and Secret Manager references:

- `CLOUD_RUN_SERVICE_URL` — the exact HTTPS Cloud Run service URL and OIDC audience.
- `GCP_OPS_MCP_CALLER_SERVICE_ACCOUNT_EMAIL` — the one service account allowed by the app-layer identity check.
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — the public project key; not a privileged credential.
- `OPS_MCP_READER_TOKEN` — Secret Manager only. Its SHA-256 hash is registered in the private database credential table; the raw token is never stored in the database.
- `OPS_MCP_ENVIRONMENT=production|staging` — production cannot enable synthetic provider calls.
- `MCP_ALLOW_SYNTHETIC_SMOKE=true` and `GROQ_API_KEY` — optional; both work only when `OPS_MCP_ENVIRONMENT=staging`.

Cloud Run must remain private. Grant `roles/run.invoker` only to the configured caller service account. The same identity's signed ID token must use `CLOUD_RUN_SERVICE_URL` as its audience; IAM alone is not considered sufficient.

## Build and validate

```bash
npm run test:ops-mcp
npm run typecheck:ops-mcp
npm run build:ops-mcp
```

Build the image without deploying:

```bash
gcloud builds submit --config services/debatelab-ops-mcp/cloudbuild.yaml .
```

## Manual deployment runbook

Deployment is intentionally manual and is not performed by CI in this slice.

1. Apply migration `20260902140000_debatelab_ops_mcp_reader.sql` forward-only.
2. Using the migration-owner/project-scoped Supabase SQL connection, generate a random reader token locally, insert only its SHA-256 hash into `private.debatelab_ops_mcp_credentials`, and store the raw token in Secret Manager. The credential table intentionally denies `service_role`; provisioning and rotation cannot be performed by the deployed service. Never mount the Supabase service-role key.
3. Create a dedicated runtime service account with Secret Manager access only to the reader token.
4. Create a separate caller service account. Do not reuse a human account or a learner-facing runtime identity.
5. Grant that caller `roles/run.invoker` on this service only.
6. Deploy with `--no-allow-unauthenticated`, the dedicated runtime identity, secrets from Secret Manager, and ingress appropriate to the approved caller path. Deploy an immutable build ID/commit tag and pin the resulting digest.
7. Set `CLOUD_RUN_SERVICE_URL` to the final service URL and `GCP_OPS_MCP_CALLER_SERVICE_ACCOUNT_EMAIL` to the exact caller email.
8. Keep synthetic smoke disabled in production. If it is ever enabled, use a narrowly scoped Groq key, one Cloud Run instance, and an external durable quota/budget gate.
9. Verify unauthenticated and wrong-service-account requests receive `401/403`, `/readyz` is ready, and MCP tool output contains no learner or protected fields.
10. Audit Cloud Run logs to confirm they contain only method/path/status metadata and no arguments or content.

Rollback is to remove the caller's `roles/run.invoker` grant or set service traffic to the previous revision. This service is read-only; rollback requires no data migration.

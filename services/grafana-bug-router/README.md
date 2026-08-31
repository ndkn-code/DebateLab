# Grafana bug router

GCP-only pipeline that accepts signed Grafana alert webhooks, publishes sanitized `BugEventV1` messages to Pub/Sub, and creates or updates deduplicated ClickUp tasks. It does not add a Vercel route, function, cron, queue, workflow, webhook, or Server Action.

## Services

The same image has two entry commands:

- `APP_MODULE=app.ingress:app`: public `POST /webhooks/grafana`. It requires Grafana HMAC-SHA256 with `X-Grafana-Alerting-Signature` and timestamp header `X-Grafana-Alerting-Signature-Timestamp`. Requests more than 256 KiB, timestamps outside five minutes, invalid JSON, and invalid alert schemas are rejected before Pub/Sub.
- `APP_MODULE=app.worker:app`: private `POST /pubsub/grafana-bug-events`, invoked only by an authenticated Pub/Sub push service account through Cloud Run IAM.

Only allowlisted labels and annotations enter `BugEventV1`. Emails, authorization values, API tokens, JWTs, query parameters, NULs, and oversized values are removed. Supabase stores only fingerprints, aggregate counters, workflow state, delivery hashes, and ClickUp task IDs—never messages, traces, URLs, stack frames, or user content.

## Prerequisites requiring account access

Do not deploy until all are complete:

1. Apply `supabase/migrations/20260830170000_observability_bug_incidents.sql` to the linked Supabase project.
2. In ClickUp, create a `Production Bugs` list with statuses `New`, `Ready for Agent`, `Agent Working`, `Needs Review`, `Done`, and `Ignored`. Create a personal API token and note the list ID.
3. In GCP Secret Manager, create secret values without putting them on a command line or in git:
   - `grafana-webhook-secret`: a newly generated high-entropy shared secret.
   - `grafana-otlp-auth-header`: the complete `Authorization: Basic ...` value
     from Grafana Cloud's OTLP details (store only the value, e.g. `Basic ...`).
   - `supabase-url`
   - `supabase-service-role-key`
   - `clickup-api-token`
   - `clickup-list-id`
4. Sign in to Grafana Cloud. After deployment, create a webhook contact point using the printed URL, HMAC secret, default signature header, and timestamp header `X-Grafana-Alerting-Signature-Timestamp`. Send a test alert before attaching alert rules.

For optional backend traces, export `GRAFANA_OTLP_TRACES_ENDPOINT` before
running the deploy script. It must be the HTTPS Grafana Cloud endpoint ending
in `/v1/traces` (for example, the OTLP gateway URL from the Grafana stack
details). The script injects the endpoint as a normal environment variable and
the authorization value from Secret Manager; neither service logs credentials.
Without the endpoint, the router still accepts alerts and uses OpenTelemetry's
no-op provider locally.

The deployer needs permission to enable APIs, run Cloud Build, deploy Cloud Run, create Pub/Sub resources/service accounts, and bind narrowly scoped IAM roles in `thinkfy-debatelab-prod`.

## Deploy

Deployment is intentionally a manual operation after the prerequisites are available:

```bash
cd services/grafana-bug-router
./deploy-gcp.sh
```

The script deploys to `asia-southeast1`, limits both services to two instances, grants the ingress service only Pub/Sub publishing and its HMAC secret, grants the worker only its four secrets, and makes only the webhook ingress public. The worker subscription retries after the two-minute database lease and sends repeated failures to `grafana-bug-events-dead-letter` after ten attempts. Its pull subscription `grafana-bug-events-dead-letter-inspect` retains failed messages for seven days for operational review.

## Local tests

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
.venv/bin/pytest -q
```

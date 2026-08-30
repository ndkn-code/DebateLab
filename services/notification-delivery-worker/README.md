# Notification delivery worker

Private Cloud Run service for authenticated Pub/Sub push delivery of
`notification_delivery_jobs`. It claims a Supabase lease, re-checks current
recipient consent and subject mute state, sends email through Resend when the
job channel is `email`, and completes the durable job. `in_app` jobs are
already materialized in the inbox and are acknowledged; `push` remains an
explicitly unsupported channel until a provider is approved.

The service has no Next.js route, Server Action, Vercel Queue handler, Vercel
cron, workflow, or Vercel configuration entrypoint. Cloud Run is the only
consumer runtime. A future publisher may be the existing application process
using keyless Vercel OIDC to publish opaque `{ "jobId": "..." }` messages to
Google Pub/Sub; the worker itself does not require Vercel credentials. The
default publisher is Cloud Scheduler, which publishes `{ "mode": "reconcile" }`
to the topic once per minute. Reconcile claims at most 25 jobs, processes them
sequentially, and reports `followUpExpected` when the batch is full so the next
scheduled tick continues draining work.

## Runtime contract

Pub/Sub sends the standard authenticated push envelope. The base64 `message.data`
must contain either `{ "jobId": "uuid" }` or a compatibility `{ "job": { "id":
"uuid", "leaseToken": "uuid" } }` object. Without a lease token, the worker
calls `claim_notification_delivery_job(job_id, 300)` and owns the returned
lease. With a token, it verifies the existing `processing` lease before sending.

Transient Supabase/batch-claim/completion errors return HTTP 500 so Pub/Sub retries.
Malformed or obsolete/non-claimable jobs return HTTP 204 after logging, so they
do not poison the subscription. Individual delivery failures are recorded
through `complete_notification_delivery_job(..., p_success => false)` and
acknowledged; the database controls bounded retry/backoff and dead-letter state.

## Runtime configuration

Required environment variables/secrets:

- `SUPABASE_URL` — Supabase project URL.
- `SUPABASE_SERVICE_ROLE_KEY` — Secret Manager mapping from
  `supabase-service-role-key`; never expose to browser or publisher.
- `RESEND_API_KEY` — Secret Manager mapping from `resend-api-key`.
- `RESEND_TRANSACTIONAL_FROM` — notifications stream sender.
- `RESEND_LIFECYCLE_FROM` — updates stream sender.
- `APP_URL` — canonical HTTPS application URL used in links.

Optional variables are `REPLY_TO_EMAIL_ADDRESSES`, `RESEND_API_URL`,
`EMAILS_ENABLED`, and `NOTIFICATION_DELIVERY_LEASE_SECONDS` (clamped by the
worker/RPC to a safe lease range). No Google service-account key is stored in
the service image.

## Database release dependency

Apply the existing notification foundation migration before publishing jobs:

- `supabase/migrations/20260830060000_notification_v2_foundation.sql`

It must provide `notification_events`, `notification_inbox_items`,
`notification_user_settings`, `notification_preferences`,
`notification_mutes`, `notification_delivery_jobs`, and the enqueue/claim/
complete/reclaim RPCs. The worker does not run migrations.

## Build and deploy (runbook summary)

Build an immutable image from this directory:

```bash
gcloud builds submit \
  --tag asia-southeast1-docker.pkg.dev/thinkfy-debatelab-prod/debatelab-workers/notification-delivery-worker:TAG \
  services/notification-delivery-worker \
  --project thinkfy-debatelab-prod
```

Deploy with `--no-allow-unauthenticated`, runtime service account
`debatelab-notification-worker`, min 0/max 1, concurrency 1, 1 vCPU, 512 MiB,
60-second timeout, Startup CPU Boost, and Secret Manager mappings for both
secrets. Grant only `roles/run.invoker` on this service to
`debatelab-pubsub-push`. Configure the subscription with authenticated push,
ack deadline 60 seconds, retry backoff 10–300 seconds, max five delivery
attempts, and `notification-delivery-dead-letter` as its DLQ.

Do not deploy from this task or grant project-wide publisher/editor roles.

Create Cloud Scheduler job `notification-delivery-reconcile` with schedule
`* * * * *`, target Pub/Sub topic `notification-delivery`, and message body
`{"mode":"reconcile"}`. Pub/Sub targets publish as the Google-managed Cloud
Scheduler service agent
`service-PROJECT_NUMBER@gcp-sa-cloudscheduler.iam.gserviceaccount.com`; retain
its `roles/cloudscheduler.serviceAgent` role. Vercel OIDC is optional and
should not be configured for the default reconcile path.

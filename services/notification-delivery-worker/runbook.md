# Notification delivery worker runbook

## Identities and least privilege

| Identity | Scope | Required access |
| --- | --- | --- |
| `debatelab-notification-worker` | Cloud Run runtime | Secret Manager accessor on `supabase-service-role-key` and `resend-api-key` only; Supabase authorization is via the service key. |
| `debatelab-pubsub-push` | Pub/Sub push subscription | `roles/run.invoker` on `debatelab-notification-delivery-worker` only. |
| Cloud Scheduler service agent (`service-$PROJECT_NUMBER@gcp-sa-cloudscheduler.iam.gserviceaccount.com`) | Scheduled publisher | Retain `roles/cloudscheduler.serviceAgent`; the Google-managed service agent publishes `{ "mode": "reconcile" }` once per minute. Do not grant this service-agent role to a user-managed principal. |
| `debatelab-vercel-publisher` | Optional Vercel publisher | `roles/pubsub.publisher` on `notification-delivery` only, obtained through keyless OIDC/WIF; no service-account key. |
| Pub/Sub service agent (`service-$PROJECT_NUMBER@gcp-sa-pubsub.iam.gserviceaccount.com`) | DLQ forwarding | `roles/pubsub.publisher` on `notification-delivery-dead-letter` and `roles/pubsub.subscriber` on `notification-delivery-worker`. |

The push identity is not the runtime identity. No unauthenticated invocation,
Cloud Run admin role, project editor role, or broad Pub/Sub subscriber role is
required by the worker. Cloud Scheduler is the default publisher; Vercel OIDC
is only an optional compatibility publisher.

## Provisioning checklist

1. Create `notification-delivery` and
   `notification-delivery-dead-letter` in `thinkfy-debatelab-prod`.
2. Grant the Pub/Sub service agent its DLQ publisher/subscriber permissions
   before creating the subscription; otherwise Pub/Sub cannot forward failed
   messages to the dead-letter topic.
3. Create the push subscription `notification-delivery-worker` with an
   authenticated push endpoint of the private Cloud Run URL, push identity
   `debatelab-pubsub-push`, ack deadline 60 seconds, retry backoff 10–300
   seconds, max five delivery attempts, and the dead-letter topic.
4. Create the Cloud Scheduler job `notification-delivery-reconcile` with
   `* * * * *` and a Pub/Sub target carrying `{ "mode": "reconcile" }`. The
   Google-managed Cloud Scheduler service agent is the publisher and must retain
   `roles/cloudscheduler.serviceAgent`; no user-managed scheduler identity or
   Vercel publisher is required for this path.
5. Create/grant only the two Secret Manager secret versions to the runtime
   identity.
6. Deploy the immutable image with the settings in `gcp-resources.json`.
7. Grant the push identity `roles/run.invoker` on the service and verify an
   unauthenticated request is rejected by Cloud Run IAM.
8. Confirm the Supabase migration is present and enqueue one test job with a
   non-production recipient. Verify claim, Resend idempotency, email audit row,
   completion, and provider/webhook correlation before enabling a publisher.

## Failure handling

- `processing` jobs whose lease expires are reclaimed by
  `reclaim_notification_delivery_jobs`; failed attempts use database backoff
  and eventually become `dead_letter` after five attempts.
- Each scheduler tick claims at most 25 rows and processes them sequentially;
  a full batch sets `followUpExpected: true`, so the next minute continues
  draining pending work without exceeding the worker's bounded request window.
- A provider failure is written to `email_messages` and the delivery job is
  completed as failed/dead-letter. The Pub/Sub message is acknowledged to avoid
  a second uncontrolled send; the database job is the retry authority.
- A malformed message, missing job, or stale lease is acknowledged with 204 and
  remains visible in Cloud Run logs for investigation.
- A transient Supabase or completion-RPC failure returns 500 and relies on
  Pub/Sub retry/DLQ.

## Operational checks

Track Cloud Run request count/latency/error rate, Pub/Sub oldest unacked
message, delivery-job counts by status/channel, Resend API failures, and the
gap between `notification_delivery_jobs.completed_at` and email provider
webhook timestamps. Alert on a growing `failed`/`dead_letter` count, stale
`processing` leases, or repeated 500 responses.

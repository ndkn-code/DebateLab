# LMS material worker on GCP

Production uses a private Cloud Run service and authenticated Pub/Sub push
subscription in `thinkfy-debatelab-prod` (`asia-southeast1`). Vercel publishes
with Workload Identity Federation; no Google service-account key exists.

## Runtime topology

- Cloud Run: `debatelab-lms-material-worker`
- Pub/Sub topic: `lms-material-processing`
- Subscription: `lms-material-processing-worker`
- Dead-letter topic: `lms-material-processing-dead-letter`
- Artifact Registry: `debatelab-workers`
- Secret Manager: `supabase-service-role-key`

Cloud Run is request-billed, scales to zero, allows one instance and one
concurrent request, and uses 1 vCPU / 512 MiB with Startup CPU Boost. The
service is private; only `debatelab-pubsub-push` has `roles/run.invoker`.

## Vercel federation

The workload identity provider trusts only this production subject:

```text
owner:ndknwork-1412s-projects:project:debate-lab:environment:production
```

The impersonated service account
`debatelab-vercel-publisher@thinkfy-debatelab-prod.iam.gserviceaccount.com`
is shared with AI grading and has topic-scoped publisher access only on
`lms-material-processing` and `ai-grading-jobs`. It has no project-wide
publisher role.

Required Vercel production config:

- `GCP_PROJECT_ID=thinkfy-debatelab-prod`
- `GCP_PROJECT_NUMBER=1038392416565`
- `GCP_PUBSUB_TOPIC=lms-material-processing`
- `GCP_SERVICE_ACCOUNT_EMAIL=debatelab-vercel-publisher@thinkfy-debatelab-prod.iam.gserviceaccount.com`
- `GCP_WORKLOAD_IDENTITY_POOL_ID=vercel`
- `GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID=vercel`

## Deploy

Build with a dated or commit-SHA tag, then deploy the immutable image:

```bash
gcloud builds submit \
  --tag asia-southeast1-docker.pkg.dev/thinkfy-debatelab-prod/debatelab-workers/lms-material-worker:TAG \
  services/lms-material-worker \
  --project thinkfy-debatelab-prod
```

The deployed service must retain these settings: private ingress authorization,
runtime service account `debatelab-lms-worker`, min instances 0, max instances
1, concurrency 1, 1 CPU, 512 MiB memory, 60-second timeout, Startup CPU Boost,
`SUPABASE_URL`, and Secret Manager mapping
`SUPABASE_SERVICE_ROLE_KEY=supabase-service-role-key:latest`.

Run `npm run test:lms-material-worker` before building.

## Cost controls

- Native spend-cap budget: `DebateLab Cloud Run $1 hard stop`, scoped to this
  project and Cloud Run, status `Configured`.
- Alert budget: `DebateLab production $1 alert`, scoped to the full project,
  with 1%, 50%, 80%, and 100% notifications.
- Artifact cleanup keeps two images and deletes images older than seven days.
- Cloud Build staging objects are deleted after one day.

Spend-cap enforcement uses estimated gross cost and is not instantaneous; small
overages remain possible under Google's Preview terms.

## Release dependency

Production Supabase project `rsbnryympenjyzhhchhu` must contain the LMS material
migrations beginning with `20260830050000_shared_lms_materials.sql`. Verify the
remote migration list before enabling the shared-material feature flags.

# Center operations deployment runbook

This service is a private Cloud Run worker/API. This document describes activation steps;
see [activation.md](activation.md) for verified infrastructure/OAuth state and remaining
release steps. Merchant and Zalo activation remain separate.

## Runtime configuration

`src/main.mjs` requires `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (Secret Manager),
`CENTER_KMS_KEY_NAME`, `THINKFY_APP_ORIGIN`, `CENTER_CALLBACK_ORIGIN`, `GOOGLE_CLIENT_ID`,
and `GOOGLE_CLIENT_SECRET` (Secret Manager).

The Google callback is `${CENTER_CALLBACK_ORIGIN}/oauth/google/callback`. Optional settings
are `GCP_PROJECT_ID`, `GCP_PUBSUB_TOPIC` (defaults to `lms-material-processing`),
`GOOGLE_PICKER_APP_ID`, and `GOOGLE_PICKER_API_KEY`. KMS access uses the Cloud Run metadata
identity; do not place service-account keys in the image or manifest.

## Network and identity

Run Cloud Run with IAM-authenticated requests and no `allUsers` invoker grant. API Gateway
may expose only the callback paths in `gateway.yaml`: Google OAuth callback, Google push
callback, ZBS callback, and ZaloPay callback. Keep `/oauth/google/start`, `/resources/*`,
`/tasks`, and `/reconcile` IAM-authenticated. The API Gateway backend service account needs
Cloud Run Invoker. Vercel uses Workload Identity Federation: grant the impersonated service
account `roles/iam.workloadIdentityUser` to the WIF principal, `roles/iam.serviceAccountOpenIdTokenCreator`
to the caller, and Cloud Run Invoker to the service account. Scheduler uses a dedicated
OIDC service account with only the permissions needed to invoke this service.

Configure a Scheduler job to POST the IAM-authenticated `/reconcile` route; reconciliation
scans pending center outbox events. `/tasks` consumes center outbox event IDs. Material
processing is published as `material.processing_requested` to the existing
`lms-material-processing` topic for the existing LMS worker. Use OIDC tokens on private calls
and validate the expected audience.

## OAuth and provider activation

Register the HTTPS callback with Google. Request the minimum center scope set: `drive.file`
and `calendar.app.created`; add existing-calendar scopes only when the operator explicitly
chooses existing calendars. Google Picker credentials are short-lived response data and
must not be persisted or logged.

Run `scripts/activate-provider.mjs` only as an authorized operator with secret values
injected through the environment. It accepts `CENTER_PROVIDER=zbs|zalopay`,
`CENTER_PROVIDER_SECRET_JSON`, `CENTER_PROVIDER_STATUS`, `CENTER_PROVIDER_ACCOUNT_ID`,
`CENTER_PROVIDER_LABEL`, `CENTER_CLUB_ID`, and `CENTER_ACTOR_ID` plus the required
Supabase/KMS variables. The script encrypts credentials
with KMS; no provider key is written to disk or command arguments. ZBS requires approved
templates and recipient consent. ZaloPay requires merchant onboarding. Neither is claimed
ready by this repository.

Enable the native center CRM when its own authorization and KMS checks are ready; provider
operations remain guarded by their connection status. OA templates and merchant onboarding
are separate activation steps. The ZaloPay adapter supports refund/query operations, but no
product workflow exposes them, so refund handling remains manual operator recovery.

## Release sequence

1. Apply the ten `20260905` migrations in filename order through the normal database
   release workflow, then regenerate public database types with the project-scoped
   Supabase MCP. The existing Vercel entrypoint baseline must stay unchanged.
2. Enable Calendar, Drive, Sheets, Picker, Cloud Run, API Gateway, KMS, IAM Credentials,
   Secret Manager, and Cloud Scheduler APIs in the deployment project. Configure the
   OAuth consent screen and allowed callback URL; restrict the Picker browser key to
   the deployed Thinkfy origins and Picker API. Complete any Google verification required
   for the selected scopes before broader rollout.
3. Build `services/center-operations/Dockerfile` with that directory as its context.
   Replace every placeholder in `cloudrun.yaml` and `gateway.yaml` before deployment.
   Grant the runtime service account KMS encrypter/decrypter on this key, Secret Accessor
   on each named secret reference, and Pub/Sub Publisher on the existing LMS topic.
   The `*.production.yaml` manifests capture the configured production resource values.
   Deploy the runtime in Singapore and the callback gateway in Tokyo; API Gateway does
   not offer Singapore in this project's available locations.
4. Deploy Cloud Run with authenticated IAM access. Bind `roles/run.invoker` to the
   gateway backend identity, scheduler identity, and federated application service account.
   Deploy the gateway API config with that backend identity. Its backend address and
   JWT audience must match the Cloud Run origin; retain `APPEND_PATH_TO_ADDRESS`.
5. Configure a scheduler every minute, POST to `https://RUN_HOST/reconcile`, body `{}`,
   with an OIDC audience of `https://RUN_HOST` and the scheduler service account. Set a
   bounded retry policy. The outbox leases make overlapping scheduler requests safe.
6. On Vercel, configure `CENTER_OPERATIONS_SERVICE_URL` and the existing WIF variables:
   `GCP_PROJECT_NUMBER`, `GCP_WORKLOAD_IDENTITY_POOL_ID`,
   `GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID`, `GCP_SERVICE_ACCOUNT_EMAIL`.
   Initially keep `CENTER_OPERATIONS_V1=false`; enable it for the pilot after database
   and application deployment. Native operations can run before Zalo activation.
7. Connect a center-owned Google account in Integrations and select each resource.
   Test a Calendar change in both directions, a reviewed Sheet import, and a selected
   material revision reaching the LMS review queue. Reconnect/disconnect must revoke
   resource access and retire indexed material from teacher retrieval.
8. When the OA and merchant accounts arrive, prepare their connection rows in the UI,
   inject activation secrets into the operator job, and run `scripts/activate-provider.mjs`.
   Keep ZaloPay in `sandbox` until verified callback, duplicate callback, missed callback
   reconciliation, and capacity-exception scenarios pass. ZBS policies start disabled;
   set approved template IDs and verified consent records before enabling sends.

## Operational checks

Alert on outbox `failed` events, expired processing leases, connection `reconnect_required`,
payment `exception` attempts, and delivery `uncertain` receipts. Query jobs retain attempts
and error codes; logs must never contain OAuth tokens, guardian invite tokens, or secrets.
A paid invoice with an enrollment exception is still money received: an operator must
resolve class placement or issue a merchant refund and reconcile the ledger. Do not retry
an uncertain outbound message blindly. Analytics Sheet export and product refund screens
are not exposed in this release.

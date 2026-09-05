# Google/cloud activation checkpoint

Updated 2026-09-05 UTC (2026-09-04 America/New_York).
User authorized Google OAuth and cloud configuration. Cloud CLI authenticated access
was verified; browser OAuth setup awaits the user's Google sign-in.

## Created and verified

- Project: `thinkfy-debatelab-prod`, number `1038392416565`; region `asia-southeast1`.
- Enabled Calendar, Drive, Sheets, Picker, API Gateway, Service Control, Cloud KMS,
  and API Keys APIs; existing Run, Secret Manager, IAM Credentials, Scheduler and Pub/Sub
  APIs were already enabled.
- Runtime service account: `center-operations@thinkfy-debatelab-prod.iam.gserviceaccount.com`.
- Gateway backend service account: `center-callbacks@thinkfy-debatelab-prod.iam.gserviceaccount.com`.
- Scheduler service account: `center-reconcile@thinkfy-debatelab-prod.iam.gserviceaccount.com`.
- KMS key: `projects/thinkfy-debatelab-prod/locations/asia-southeast1/keyRings/thinkfy-center/cryptoKeys/provider-credentials`.
  Encryption key rotation: 90 days. Runtime has key-scoped encrypter/decrypter permission.
- Runtime can read only the named secrets `supabase-url`, `supabase-service-role-key`,
  `center-google-client-secret`, and `center-google-picker-key`, and publish to
  `lms-material-processing`.
- `center-google-client-secret` exists without a version: it must receive the actual
  OAuth client secret after browser setup. No placeholder secret was inserted.
- Picker API key resource: `projects/1038392416565/locations/global/keys/thinkfy-center-picker`.
  Restricted to Picker API and `https://thinkfy.net/*`, `https://www.thinkfy.net/*`.
  Its value is stored in Secret Manager as `center-google-picker-key`.
- Existing `debatelab-vercel-publisher` now has OpenID Token Creator on itself for the
  access-token-to-ID-token step. Existing WIF trust remains restricted to the exact
  `debate-lab` production deployment subject; preview trust was not broadened.
- API resource `thinkfy-center-callbacks` is ACTIVE; its managed service is
  `thinkfy-center-callbacks-0abizj8sbllct.apigateway.thinkfy-debatelab-prod.cloud.goog`.
  No API config or public gateway deployment exists yet.
- Cloud Build `49d4d748-d3fb-4444-9dcf-c418b9fb4755` succeeded for commit `87f64025`.
  Image: `asia-southeast1-docker.pkg.dev/thinkfy-debatelab-prod/debatelab-workers/center-operations:87f64025`.
  Digest: `sha256:e8111f4eab4d857f6fab2ced580d1e72a25dc69574cb01b7f4d4b1f7d6a8b0de`.

## Resume after browser sign-in

1. Resume the existing Ego Lite task space 57 only after the user confirms control.
   Configure the Google Auth Platform branding/audience and a dedicated web OAuth client.
   Use the center integrations scope model; do not alter an unrelated sign-in client.
2. Capture the client secret directly into Secret Manager without printing it or writing
   it into tracked files. Configure the client ID as a non-secret runtime value.
3. Deploy the immutable image to IAM-authenticated `thinkfy-center-operations` with the
   runtime identity and actual secret references. Resolve its returned service URL.
4. Create a callback-only API config under API `thinkfy-center-callbacks`, grant its
   backend identity Run Invoker, deploy the gateway, then configure its returned hostname
   as `CENTER_CALLBACK_ORIGIN` and the OAuth redirect `/oauth/google/callback`.
5. Grant Run Invoker to the scheduler and federated application identities. Configure
   Vercel's service URL/WIF variables and an OIDC `/reconcile` Scheduler job. Keep the job
   paused and the feature flag off until the database and app release are ready.
6. Apply/review the migration release, deploy the application, connect the center account,
   and verify actual Calendar/Sheets/Drive round trips before activating automation.

Cloud Run, a gateway deployment, Scheduler, Vercel changes, production migrations,
and account OAuth consent are not yet complete at this checkpoint. Creating cloud
resources does not mean the center integration is live. Zalo activation remains separate.

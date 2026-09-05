# Google/cloud activation checkpoint

Updated 2026-09-05 UTC (2026-09-04 America/New_York).
User authorized Google OAuth and cloud configuration. Cloud CLI authenticated access
and browser sign-in were verified. Google OAuth and cloud configuration are provisioned.
The twelve center migrations are applied; application acceptance testing is in progress.
Center-account consent remains a separate user step.

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
- `center-google-client-secret` has enabled version 1, captured directly from the
  dedicated OAuth client into Secret Manager without logging the secret.
- Picker API key resource: `projects/1038392416565/locations/global/keys/thinkfy-center-picker`.
  Restricted to Picker API and `https://thinkfy.net/*`, `https://www.thinkfy.net/*`.
  Its value is stored in Secret Manager as `center-google-picker-key`.
- Existing `debatelab-vercel-publisher` now has OpenID Token Creator on itself for the
  access-token-to-ID-token step. Existing WIF trust remains restricted to the exact
  `debate-lab` production deployment subject; preview trust was not broadened.
- API resource `thinkfy-center-callbacks` is ACTIVE; its managed service is
  `thinkfy-center-callbacks-0abizj8sbllct.apigateway.thinkfy-debatelab-prod.cloud.goog`.
  API config `center-v1-87f64025` is ACTIVE. Gateway provisioning/readback is recorded below.
- Cloud Build `49d4d748-d3fb-4444-9dcf-c418b9fb4755` succeeded for commit `87f64025`.
  Image: `asia-southeast1-docker.pkg.dev/thinkfy-debatelab-prod/debatelab-workers/center-operations:87f64025`.
  Digest: `sha256:e8111f4eab4d857f6fab2ced580d1e72a25dc69574cb01b7f4d4b1f7d6a8b0de`.

## OAuth configuration

- Google Auth Platform app: **Thinkfy Center Integrations**, External / Testing.
- Support/developer contact and sole test user: `jknguyen.wor@gmail.com`.
- Web client: **Thinkfy Center Integrations — Production**.
- Client ID: `1038392416565-homl6he6ritj09ilis395h3h8p5d4sap.apps.googleusercontent.com`.
- JavaScript origin: `https://thinkfy.net`.
- Exact redirect: `https://thinkfy-center-callbacks-d91418hh.an.gateway.dev/oauth/google/callback`.
- Home: `https://thinkfy.net`; privacy: `https://thinkfy.net/en/privacy`;
  terms: `https://thinkfy.net/en/terms`. Public policy pages loaded successfully.
- Declared scopes: `drive.file`, `calendar.app.created`, `calendar.events`,
  `calendar.calendarlist.readonly`, all under `https://www.googleapis.com/auth/`.
  Actual initial consent requests only the first two; the existing-calendar option
  explicitly requests the additional scopes. No restricted Drive scopes were added.
- Testing allows only listed test users. Broader rollout requires the appropriate
  Google publishing/verification work. No center-owned Google data grant exists yet.

## Deployed infrastructure

- Cloud Run: `thinkfy-center-operations`, `asia-southeast1` (Singapore).
- Origin: `https://thinkfy-center-operations-1038392416565.asia-southeast1.run.app`.
- Ready revision: `thinkfy-center-operations-00002-67c`, serving 100% of traffic.
- Runtime configuration is captured in `cloudrun.production.yaml`; secrets are references.
  `CENTER_CALLBACK_ORIGIN` is the gateway origin below, not the temporary bootstrap origin.
- Callback gateway: `thinkfy-center-callbacks`, `asia-northeast1` (Tokyo).
  Singapore is not an available API Gateway location; the locations API was checked.
- Gateway origin: `https://thinkfy-center-callbacks-d91418hh.an.gateway.dev`.
- Callback-only spec: `gateway.production.yaml`; config `center-v1-87f64025`, using
  `center-callbacks` as the backend authentication identity. Preserve path translation.
- Gateway state: **ACTIVE**, verified after provisioning completed.
- Cloud Run IAM has exactly three resource-level invokers: gateway, scheduler, and
  `debatelab-vercel-publisher`. No `allUsers` or `allAuthenticatedUsers` grant.
- Scheduler `thinkfy-center-reconcile`, `asia-southeast1`: **PAUSED**.
  Schedule `* * * * *`, time zone `Asia/Ho_Chi_Minh`, POST `/reconcile`, body `{}`,
  deadline 300 seconds, three retries, 5–60 second backoff. OIDC audience is the Run
  origin; identity is `center-reconcile`.
- Vercel project `debate-lab`, production only:
  `CENTER_OPERATIONS_SERVICE_URL` = Run origin; `CENTER_OPERATIONS_V1=false`.
  Readback confirmed existing WIF project number `1038392416565`, pool/provider `vercel`,
  and service account `debatelab-vercel-publisher@thinkfy-debatelab-prod.iam.gserviceaccount.com`.
  These settings apply to the next deployment; no frontend deployment was made here.

## Verification and remaining release steps

- Cloud Run reports Ready, ConfigurationsReady and RoutesReady.
- Direct resource request without cloud IAM: HTTP 403.
- Resource request with cloud IAM but without a Thinkfy user token: HTTP 401.
- Direct OAuth callback with cloud IAM and missing state/code: HTTP 303.
- Public gateway OAuth callback with missing state/code: HTTP 303; browser navigation
  confirmed `https://thinkfy.net/vi/dashboard/teacher/center?connection=failed`.
- Public gateway POST `/resources/list`, `/tasks`, and `/reconcile`: HTTP 404.
- Five focused server tests passed. Production YAML parsed and callback-only paths,
  path translation, matching origins and secret references were validated.
- `/healthz` returned HTTP 404 at the public Run frontend even with cloud IAM; it is
  not a verified external health probe. Use the Ready state and authenticated route
  checks above for this checkpoint; choose a reachable path before adding HTTP monitoring.
- OAuth branding, redirect URL, scope save, test-user readback, enabled secret version,
  Vercel environment values, Run IAM and paused Scheduler were checked.

## Application/database acceptance checkpoint

- Applied all twelve `20260905` migrations through the project-scoped Supabase MCP.
  Canonical version and name checks match every release filename. All 27 center tables
  in `public` and `private` have RLS enabled. Private OAuth intents, refresh leases and
  credentials retain service-only access.
- Regenerated live database types, preserving the project-authored activity aliases.
- The global Supabase CLI dry run remains blocked by historical remote/local migration
  naming differences predating this release. No historical migration was marked reverted
  or replayed. Release validation used exact version/name checks, live object inspection,
  and the isolated database regression suites instead.
- SQL regressions: 94 pgTAP assertions, OAuth contract block, and four additional vault
  RLS/single-use assertions passed with rollback. Native app tests: 58 center tests,
  173 AI platform tests, 30 LMS worker tests, seven LMS material tests, 23 payment tests,
  design audit/tests, lint (12 existing warnings), typecheck and CI checks passed.
- Live browser QA on an isolated center passed student creation, note saving, trial
  booking in Vietnam time, tuition offer/invoice creation, owner access, and denied access
  to an unrelated center. All seven tabs fit the four required viewports in both themes
  and both locales (112 overflow checks).
- A live teacher response exposed a plan-schema failure. Commit `0f5767b8` uses the
  existing structured provider path with one schema repair, explicit citation shapes,
  and unchanged context authorization/action confirmation. Its regression tests pass.
  Date/time triggers now display the selected time as well as the date.
- Live corrected chat tests passed cited read-only answers, automatic draft creation,
  draft visibility in Materials, and a pending trial proposal that executed only after
  confirmation. Proposal fields and dates use readable English/Vietnamese labels.
- The real app-to-Cloud-Run OAuth start reached Google's account chooser with S256 PKCE,
  the exact gateway callback and only `calendar.app.created` plus `drive.file`.
- The user selected `jknguyen.wor@gmail.com` for the pilot. Acceptance records are in
  the isolated **Thinkfy Center Pilot QA** center, not an existing operational center.
- Google data consent and actual Calendar/Sheets/Drive round trips remain pending.
  Zalo OA and merchant activation remain pending. ZBS policies remain disabled.

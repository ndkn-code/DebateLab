# Google/cloud activation checkpoint

Updated 2026-09-05 UTC (2026-09-04 America/New_York).
User authorized Google OAuth and cloud configuration. Cloud CLI authenticated access
and browser sign-in were verified. Google OAuth and cloud configuration are provisioned.
Fourteen center migrations are applied and the application is live on `thinkfy.net`.
Google consent and live Calendar/Sheets/Picker acceptance passed for the pilot account.
This file records release evidence; verify the current canonical deployment after each merge.

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
  Google publishing/verification work. The pilot grant was completed on 2026-09-05 with
  exactly `calendar.app.created` and `drive.file`; existing-calendar access was not requested.

## Deployed infrastructure

- Cloud Run: `thinkfy-center-operations`, `asia-southeast1` (Singapore).
- Origin: `https://thinkfy-center-operations-1038392416565.asia-southeast1.run.app`.
- Ready revision: `thinkfy-center-operations-00004-9lv`, serving 100% of traffic.
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
- Scheduler `thinkfy-center-reconcile`, `asia-southeast1`: **ENABLED**.
  Schedule `* * * * *`, time zone `Asia/Ho_Chi_Minh`, POST `/reconcile`, body `{}`,
  deadline 300 seconds, three retries, 5–60 second backoff. OIDC audience is the Run
  origin; identity is `center-reconcile`.
- Vercel project `debate-lab`, production only:
  `CENTER_OPERATIONS_SERVICE_URL` = Run origin; `CENTER_OPERATIONS_V1=true`.
  Readback confirmed existing WIF project number `1038392416565`, pool/provider `vercel`,
  and service account `debatelab-vercel-publisher@thinkfy-debatelab-prod.iam.gserviceaccount.com`.
  Accepted web candidate `ba17e453`, deployment `dpl_BEFfHgzwGkZh4SqkqeNWqDaucYY2`:
  `https://debate-9nu39bfuz-ndknwork-1412s-projects.vercel.app`.
  It was promoted after runtime QA and preserves the mail release. The final `main`
  deployment following PR #43 supersedes this acceptance candidate.
  The combined center/mail rollback candidate is `dpl_7Givue7HXqVy4sbJGTXAdSdoSfXC`.
  Existing PDF import/compliance flags remain disabled.

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
  Vercel environment values and Run IAM were checked. Scheduler was resumed after
  application promotion. Manual and scheduled runs returned HTTP 200 at
  `2026-09-05T03:34:48Z` and `2026-09-05T03:35:05Z`.

## Application/database acceptance checkpoint

- Applied all fourteen `20260905` migrations through the project-scoped Supabase MCP.
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
- Final source `455c446a` passed GitHub Quality bar and Vercel checks. The final build
  passed all 112 layout checks, Vietnamese read-only chat, a natural-language booking
  request producing a pending confirmation card, and cancellation without booking.
  Canonical production browser readback confirmed all seven tabs and the QA records.
- Reconciliation finished all nine QA events with no failed/pending events. Native-only
  events were skipped as designed. Two drafts and two trial bookings persist; one trial
  proposal was executed and one cancelled. No ZBS delivery receipt was created.
- The real app-to-Cloud-Run OAuth start reached Google's account chooser with S256 PKCE,
  the exact gateway callback and only `calendar.app.created` plus `drive.file`.
- The user selected `jknguyen.wor@gmail.com` for the pilot. Acceptance records are in
  the isolated **Thinkfy Center Pilot QA** center, not an existing operational center.
- Google OAuth consent succeeded and the authenticated Picker action returns scoped access.
  Calendar/Sheets/Picker acceptance is detailed below. Zalo OA and merchant activation
  remain pending; ZBS policies remain disabled.
- Release PR: `https://github.com/ndkn-code/DebateLab/pull/43`. Vercel Git integration
  automatically deploys `main`; all future main releases must contain these center changes.


## Live Google acceptance and fixes

- Pilot account: `jknguyen.wor@gmail.com`; isolated organization **Thinkfy Center Pilot QA**.
  Google credentials remain encrypted in the private vault. No token values enter this log.
- A modern PostgREST JSON-claim incompatibility rejected Google resource RPCs after consent.
  Migration `20260905111000` uses `auth.role()` in seven guards, retaining ownership checks
  and service-only grants. Ten new rollback assertions cover service success, authenticated
  denial, non-owner denial and Calendar authority.
- Commit `ba17e453` permits the exact `https://docs.google.com` Picker frame, sends required
  Calendar watch type `web_hook`, and uses collision-resistant, Google-valid event IDs.
  Picker opened in canonical production and returned **Thinkfy Pilot QA Roster**.
- Thinkfy created a secondary calendar. A newly booked trial appeared in Google; changing
  its time in Google updated the Thinkfy trial and projection. A Google-created lesson
  projected into Thinkfy, then a Thinkfy reschedule updated the same Google event using an
  ETag and `sendUpdates=none`. Authenticated push callbacks returned HTTP 204.
- A Sheet with duplicate rows staged without changing the roster; its review blocked both
  duplicates. Correcting the source created a new stage. Preview plus explicit confirmation
  imported exactly one synthetic student and marked that stage applied. No invitations sent.
- Drive QA exposed a missing original-storage finalization step. Commit `71dad102` validates
  file signatures/hash/size and writes immutable `lms-material-originals` objects before
  queueing. Migration `20260905112000` records original path and detected MIME and refuses
  unfinished inputs; six new SQL assertions passed. The worker now releases leases on
  missing originals and acknowledges already failed versions; two worker regressions passed.
- Cloud Build `275d3b7f-eb7e-40aa-84e3-7405de61ed10` produced center image
  `sha256:eed64aafa819522c4d45cec31aa18f36f63f03b3c5a7c78b4110491e0a5846f6`, deployed as
  `thinkfy-center-operations-00004-9lv`, 100% traffic.
- Cloud Build `6b8e9787-648e-40a8-94d8-725d77667bb4` produced LMS worker image
  `sha256:cdf6905065c783b9a7e956a08ddda17a37ced5f182b98630a7f76f34d3e80236`, deployed as
  `debatelab-lms-material-worker-00005-s2d`, 100% traffic. Parser fixes from `b8252365`
  are retained; question-import flags were not enabled.
- Post-fix tests: 49 center service tests, 32 LMS worker tests, five CSP tests and 16 added
  rollback SQL assertions passed. Design audit/tests, lint, web typecheck and CI gates pass.
  The first malformed synthetic Drive version was marked rejected before testing a new
  source revision; no operational center data was repaired or removed.
- An unrelated main merge briefly replaced the combined center/mail deployment with a build
  lacking center files. The combined release was restored. `AGENTS.md` now documents the
  observed automatic main deployment behavior and canonical source verification requirement.

- Corrected Drive source revision reached `processing_status=ready`, with an original
  object, detected MIME, readable native document and one preview rendition. Re-syncing
  unchanged bytes reused the same version. Trashing the synthetic source then caused
  `binding.state=revoked`, `source.status=revoked`, and an archived material. No failed
  center event remained. The pilot Google connection, Calendar and Sheet remain connected.
- Connected-state integration QA passed 16 checks: EN/VI, verified light/dark state, and
  all four required viewports. Reduced-motion emulation was used for settled theme captures.
- All nine SQL suites passed against the fully migrated `thinkfy_center_verify` database:
  110 pgTAP assertions plus the OAuth contract block. An earlier broad rerun against the
  obsolete `thinkfy_center_test` database failed missing ACLs; that stale database is not
  release evidence. The complete verification database passed without weakening grants/tests.

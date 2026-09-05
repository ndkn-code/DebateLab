# Vietnam center operations

The center workspace covers lead, trial, assessment, tuition, enrollment, progress, and
renewal operations. It reuses B3 `student_records` and `student_record_enrollments`.
Google Calendar is authoritative for connected classes. ZBS/Zalo OA and ZaloPay remain
activation dependencies and are never represented as production success before setup.

The center service runs as an IAM-authenticated Cloud Run service behind authenticated
application calls or API Gateway. Vercel uses Workload Identity Federation with service
account impersonation; Scheduler uses a dedicated OIDC service account. Provider credentials are encrypted
with the configured KMS key. The runtime environment and callback routes are documented in
`services/center-operations/deploy/README.md`.

Google OAuth uses PKCE and offline access. The minimum requested scope is `drive.file` plus
`calendar.app.created`; existing-calendar scopes are optional and require an explicit
operator choice. Picker access is per selected file and does not grant recursive folder
access. OAuth callback, Google push, ZBS, and ZaloPay callbacks may be routed through API
Gateway; resource, task, and reconcile routes stay IAM-authenticated. `/tasks` consumes
center outbox event IDs, while material processing is published to the existing LMS topic.

Calendar synchronization fetches a rolling window from 90 days before the current time to
366 days after it. All-day and overnight Google events are skipped by the current projection
path. Full sync staging preserves the last confirmed projection until all pages are fetched
and committed. Calendar mutations use ETags and `sendUpdates=none`; conflicts require a
fresh synchronization. Native class schedules are migrated only after the Google projection
succeeds.

Teacher chat automatically handles internal notes, evaluations, and unpublished drafts.
Shared, financial, and external effects produce exact proposals requiring confirmation.
Conversation history is organization and actor scoped. No new Vercel runtime entrypoints
are required.

Material ingestion is selected-file only and capped at 20 MB. MIME and hash validation
precede immutable storage in `lms-material-originals`; only finalized originals are
queued through the existing LMS worker as drafts with unknown rights. It is never
published automatically. Sheet imports are staged for reviewed duplicate resolution and
the existing B3 commit transaction; they do not mutate the roster during synchronization.
The analytics export helper is not exposed by this release.

Activation remains manual: configure Google OAuth/KMS/IAM, verify callback signatures, and
enable provider-specific operations only after their status checks pass. Approve ZBS templates
and consent policy, and complete ZaloPay merchant onboarding before using those channels.
The ZaloPay adapter supports refund/query operations, but no product workflow exposes them;
refunds therefore require manual operator recovery.

## Implementation map

- `apps/web/src/components/center-operations`: bilingual workbench and family view.
- `apps/web/src/lib/center-operations`: validated commands, teacher planning, scoped
  retrieval, Google service transport, guardian access, and B3 Sheet review adapters.
- `apps/web/src/app/actions/admin-clubs.ts`: extends the approved server-action entrypoint.
- `services/center-operations`: Cloud Run runtime, provider adapters, encrypted OAuth,
  Calendar projection, payment reconciliation, delivery leases, and activation job.
- `supabase/migrations/20260905*`: ordered, transactional migrations for the ledger,
  outbox, permissions, provider state, teacher conversations, and guardian links.

## Provider references

Calendar pagination and reset behavior follow [Google's sync guide](https://developers.google.com/workspace/calendar/api/guides/sync).
Selected-file authorization follows [Google Drive scope guidance](https://developers.google.com/workspace/drive/api/guides/api-specific-auth).
Zalo token rotation and callback verification follow the official
[OA authorization](https://docs.zaloplatforms.com/docs/OA/bat-dau/xac-thuc-va-uy-quyen-cho-ung-dung-new)
and [OA webhook](https://docs.zaloplatforms.com/docs/OA/webhook/tin-nhan/su-kien-nguoi-dung-gui-tin-nhan)
contracts. Recheck provider requirements during account activation.

## Verification and rollout status

Implemented on `codex/vietnam-center-integrations`. Production activation and live
acceptance evidence are tracked in
[`activation.md`](../services/center-operations/deploy/activation.md).
Verification includes:

- The initial ten migrations applied in order to a fresh, isolated database based on the
  repository's existing schema; 94 pgTAP assertions plus OAuth contract checks pass.
- 14 application tests and 44 service tests pass, covering permission/risk decisions,
  duplicate imports, callbacks, payment IDs, token rotation, retry behavior, and sync failures.
- Existing payments, material pipeline/worker, roster import, teacher workspace, and
  class schedule suites pass.
- Design audit, design token tests, lint, TypeScript, and CI architecture/RLS checks pass.
  Lint retains 12 pre-existing warnings outside this feature.
- The Docker image builds and its actual entrypoint returns HTTP 200 from `/healthz`.
- Real components rendered against temporary local fixtures: 128 panel/layout checks
  across EN/VI, light/dark, and 1280×720, 1440×900, 768×1024, 390×844 showed no
  horizontal document overflow or runtime error overlays. The final changed integration
  and chat panels passed another 32 checks. Preview fixtures are removed from the branch.

Production center migrations and cloud infrastructure are deployed; the center flag is
enabled on `thinkfy.net`. Native browser acceptance passed in the isolated Thinkfy Center
Pilot QA organization, including teacher chat, confirmed/cancelled actions and 112 final
layout checks across both locales and themes. Google consent was completed for
`jknguyen.wor@gmail.com` with only `calendar.app.created` and `drive.file`; live Calendar push/pull, reviewed Sheets import, Picker selection and Drive processing/
revocation acceptance passed. Detailed evidence is in the activation checkpoint. No external message or real payment
was sent during QA.

Zalo OA, approved templates/recipient consent and merchant onboarding remain external
activation dependencies. Google remains in Testing with the pilot account as its sole
test user. Guardian progress currently includes classes, trials and attendance. Analytic
Sheet export, refund screens, no-show rebooking automation and richer post-payment
welcome/study-plan automation remain follow-up scope; the existing adapters or lifecycle
states alone do not mean those product workflows are shipped.

Vercel Git integration currently deploys `main` automatically. A main merge briefly
replaced the manually promoted combined center/mail release with a build lacking this
feature; the combined release was restored. Keep release code in `main`, and verify the
canonical deployment/source after every merge or promotion.

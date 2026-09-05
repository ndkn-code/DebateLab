# September 4 production release

## Scope

Integrates `integration/term-readiness` (S1, B3, B1 and its QA fixes), B4 parent
band reports, B6 class/centre analytics, the completed public landing redesign,
and the document question-import implementation. The middleware hotfix from
PR #40 was merged and deployed first to restore POST/server-action traffic.

The release also fixes the lint baseline, a nullable submission timestamp in
analytics, teacher-workspace gradebook identity reads after class authorization,
class-list navigation in teacher mode, and tablet overflow from a decorative
landing animation. The legacy attendance transaction now resolves its required
lesson occurrence without losing its authorization, atomicity, or audit events.

## Database rollout

The project-scoped Supabase MCP was used for staging rehearsal and production
application. Production's ledger is current through
`20260904142000_attendance_transaction_occurrence`.

Applied the pending grants/reconciliation, age-assurance, payment hardening,
replay guards, transactional practice analysis, homework notifications, and
student-record migrations, plus question-import schema and the release repairs.
The duplicate later question-type migration from the old checkout was not
replayed: its sentence-ending enum addition already exists in the canonical
migration chain.

Eight duplicate adaptive evidence records were archived in a private RLS table.
First writes were retained; eight derived skill states were recomputed with the
repository's actual derivation functions. The production repair locked both
sets of rows and checked complete before/after snapshots in one transaction.
No original attempt scores were changed. The resulting duplicate count is zero.

The missing profile/progress routines were captured from production with guarded
creation and their existing ACLs, so a rebuilt database receives those routines.
Existing production implementations were preserved.

## Verification

- All 85 root test suites passed.
- Design audit, design tests, lint, web typecheck, and `ci:checks` passed.
- The combined optimized production build passed locally.
- Landing: 40 settled browser cases, both products, EN/VI, light/dark, five sizes.
- Teacher calendar, attendance, gradebook and parent reports: 64 browser cases.
- Teacher-facing class analytics: 16 browser cases, including real authorized
  server-action reads and learner names.
- Attendance transaction: actual SQL writes, denied access, ambiguous/missing
  occurrence errors, and atomic rollback assertions passed against local fixtures.
- The initial production hotfix returned normal 200 page responses; a deliberate
  unknown server-action POST returned 404, and unauthenticated chat returned 401,
  rather than the middleware invocation failure.

## Worker and feature configuration

Private Cloud Run service `debatelab-lms-material-worker`, `asia-southeast1`, now
serves revision `debatelab-lms-material-worker-00002-htc` at 100% traffic. Readiness,
private invoker IAM, Pub/Sub delivery, publisher permissions and Vercel workload
identity wiring were checked. All 25 worker tests passed.

The completed student LMS, roster import and classic shared-material features
are enabled for the production web deployment. Existing organization/class
entitlements and the IELTS access logic remain authoritative.

PDF-to-question import code and schema are included, but its UI/server/compliance
flags remain off. Its existing launch runbook requires recorded vendor and data
processing approval, parser configuration, and a monitored copyright contact.
No approval was fabricated and no parser credential was invented.

## Local preservation

Before cleanup, all repository references were bundled and dirty working sources,
patches, indexes, local configuration and environment files were archived under
`/Users/jacknguyen/Developer/Thinkfy-release-archive-20260904` with restricted local
access. The archive includes a SHA-256 manifest. It must not be published because
it includes local credentials. Unmerged unrelated work is preserved separately
from the production release.

Final web deployment and cleanup evidence will be appended after verification.

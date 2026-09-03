# Aikido Medium/High triage — 2026-09-03

Baseline: current `DebateLab/main` and `https://thinkfy.net` feeds. Scope is all
58 Medium/High findings returned by Aikido: 39 confirmed remediation targets,
18 stale/non-actionable findings, and one finding requiring live validation.
This ledger records implemented remediations and intended dispositions. No item
is claimed closed until its deployment and post-deployment Aikido scan are
recorded. The patch received an independent Codex security regression review on
2026-09-03; the reviewer found no remaining authorization or transaction bypass.

## Confirmed remediation targets

These findings remain open until the corresponding code, dependency, container,
or database change is deployed and a fresh Aikido scan confirms the result.

### AI pentest findings (23)

| Aikido IDs | Severity | Location / boundary | Remediation and entrypoint evidence | Remediation commit | Reviewer | Post-scan |
|---|---|---|---|---|---|---|
| 618498550, 618498635 | Medium | ZaloPay callback and subscription grant | Missing signing configuration fails closed; checkout persists a server-owned order and callback settlement locks and applies it exactly once. | `d570abe5` | Independent Codex security review, 2026-09-03 | pending deployment |
| 618498612, 618498611 | Medium | Course reader and LMS learner projection | Entitlement is checked before content projection; locked lessons and unavailable native documents are redacted before serialization. | `6523445e` | Independent Codex security review, 2026-09-03 | pending deployment |
| 618498617, 618498633 | Medium | Club workspace and activity routes/actions | Real session, active membership/staff role, course relationship, lifecycle, entitlement, and prerequisite checks precede reads/writes. | `6523445e`, `64311684` | Independent Codex security review, 2026-09-03 | pending deployment |
| 618498573, 618498587 | Medium | Duel judgment prompt and repair path | Canonical JSON evidence is isolated from system policy; result IDs/quotes are validated, and only server-owned transcription artifacts can influence grading. | `9cea363e`, `ee4acc0e` | Independent Codex security review, 2026-09-03 | pending deployment |
| 618498593, 618498631, 618498654 | Medium | Practice analysis API, attempts, and XP/context persistence | A service-role-only transaction creates server IDs and charges once; topic, duration, organization context, and refunds are server-derived/revalidated. | `ee4acc0e` | Independent Codex security review, 2026-09-03 | pending deployment |
| 618498594 | Medium | Duel share-code room loader | Nonparticipants receive only the lobby preview; full room speeches, media, and judging data require creator/participant membership. | `6523445e` | Independent Codex security review, 2026-09-03 | pending deployment |
| 618498562, 618498548 | Medium | Cross-course activity access and lifecycle actions | One guard protects reads/start/complete; completion requires the caller's exact in-progress attempt and is replay-safe. | `64311684` | Independent Codex security review, 2026-09-03 | pending deployment |
| 618498528 | Medium | Assigned IELTS mock listening projection | Learner structures serialize no listening script/source transcript; privileged grading/admin structures remain separate. | `6523445e` | Independent Codex security review, 2026-09-03 | pending deployment |
| 618498558, 618498534, 618498651 | Medium | Guardian consent routes and analytics | Exact unexpired token consumption and age-state transitions are atomic; guardian URLs and sensitive properties are centrally redacted. | `86d8022c`, `9cea363e` | Independent Codex security review, 2026-09-03 | pending deployment |
| 618498565, 618498648 | Medium | IELTS completion and assigned-start actions | Partial uniqueness and idempotent writes prevent concurrent attempts and duplicate adaptive evidence. | `64311684` | Independent Codex security review, 2026-09-03 | pending deployment |
| 618498568, 618498589 | Medium | Campaign audience approval and send worker | Current email, locale, global/scope/template consent, and suppression state are re-read immediately before dispatch. | `9cea363e` | Independent Codex security review, 2026-09-03 | pending deployment |
| 618498603 | Medium | Browser practice-session draft restore | Draft/handoff ownership must exactly match the authenticated user; all local practice state is cleared on account transitions/sign-out. | `9cea363e` | Independent Codex security review, 2026-09-03 | pending deployment |

### Dependency advisories (15)

| Aikido IDs | Severity | Location | Remediation and evidence | Remediation commit | Reviewer | Post-scan |
|---|---|---|---|---|---|---|
| 618475694, 618475714, 618475707 | Medium | Web dependency tree (`zod`) | Direct Zod and the scoped Vercel CLI Zod 4 path resolve to 4.5.0; Zod 3 consumers remain untouched. | `593bd00a` | Independent Codex security review, 2026-09-03 | pending deployment |
| 618474747 | Medium | Web lockfile (`baseline-browser-mapping`) | The affected path resolves to 2.11.0. | `593bd00a` | Independent Codex security review, 2026-09-03 | pending deployment |
| 618475627, 618475618 | Medium | `services/embedding-api/requirements.txt` (`transformers`) | Transformers resolves to 5.14.0; the image imports cleanly and preserves the embedding service contract. | `593bd00a` | Independent Codex security review, 2026-09-03 | pending deployment |
| 618474877, 618474896, 618474914, 618474491 | Medium | Web dependency tree (`dompurify`) | All affected paths resolve to 3.4.13. | `593bd00a` | Independent Codex security review, 2026-09-03 | pending deployment |
| 618475151 | Medium | Web dependency tree (`katex`) | Direct KaTeX resolves to 0.18.2 and the production build succeeds. | `593bd00a` | Independent Codex security review, 2026-09-03 | pending deployment |
| 618474673 | Medium | Web dependency tree (`@ungap/structured-clone`) | The affected path resolves to 1.3.1. | `593bd00a` | Independent Codex security review, 2026-09-03 | pending deployment |
| 618475446 | Medium | `services/embedding-api/requirements.txt` (`numpy`) | NumPy resolves to 2.4.5; image import and `pip check` succeed. | `593bd00a` | Independent Codex security review, 2026-09-03 | pending deployment |
| 618475490 | Medium | Web dependency tree (`postal-mime`) | The scoped Resend path resolves to 2.7.6 and email suites pass. | `593bd00a` | Independent Codex security review, 2026-09-03 | pending deployment |
| 618475512 | Medium | Web dependency tree (`posthog-js`) | PostHog resolves to 1.391.7 and analytics/privacy tests pass. | `593bd00a` | Independent Codex security review, 2026-09-03 | pending deployment |

### Container finding (1)

| Aikido ID | Severity | Location | Remediation and evidence | Remediation commit | Reviewer | Post-scan |
|---|---|---|---|---|---|---|
| 618475637 | Medium | Grafana bug-router Docker image | The Python 3.12 service runs as UID/GID 10001; the read-only-root image check and all 66 router tests pass. | `593bd00a` | Independent Codex security review, 2026-09-03 | pending deployment |

## Reviewed stale or non-actionable findings

Each item must be individually reviewed in Aikido with this ledger and the
specific evidence below. A recorded source revision is evidence, not an Aikido
closure; `post_scan: pending` remains authoritative.

| Aikido ID | Severity | Location | Verdict | Entrypoint/trust evidence | Intended disposition | Evidence revision | Reviewer | Post-scan |
|---|---|---|---|---|---|---|---|---|
| 618498542 | High | `apps/web/src/lib/dev-auth-bypass.ts` | Stale finding | The bypass helper and deployable callers are absent; the negative boundary test is the only remaining textual reference and no development identity is accepted by shipped routes. | Ignore individually only after a remote branch scan confirms absence. | `6523445e` | Independent Codex security review, 2026-09-03 | pending |
| 618498530 | High | `apps/web/src/lib/email/admin-template-auth.ts` | Stale finding | `DEV_ADMIN_BYPASS` and synthetic service-role authorization are absent; admin operations require a real persisted admin. | Ignore individually only after a remote branch scan confirms absence. | `6523445e` | Independent Codex security review, 2026-09-03 | pending |
| 619204735 | High | `apps/web/src/app/actions/admin-clubs.ts:338` | False positive | The value is a Supabase Storage object key built from a database-created club UUID and MIME-allowlisted extension; it is not an OS path and has no filesystem traversal capability. | Ignore individually with SUPABASE-OBJECT-KEY evidence. | `e61c7110` | Independent Codex security review, 2026-09-03 | pending |
| 618477555 | Medium | `apps/web/src/lib/ai/benchmarks/study-attestation.ts` | Accepted operator boundary | Explicit benchmark/attestation tooling; operator or integrity-checked manifest path, no HTTP or queue entrypoint. | Ignore individually with OPERATOR-CLI evidence. | `e61c7110` | Independent Codex security review, 2026-09-03 | pending |
| 618477561 | Medium | `apps/web/src/lib/ai/benchmarks/study-attestation.ts` | Accepted operator boundary | Explicit benchmark/attestation tooling; operator or integrity-checked manifest path, no HTTP or queue entrypoint. | Ignore individually with OPERATOR-CLI evidence. | `e61c7110` | Independent Codex security review, 2026-09-03 | pending |
| 618477570 | Medium | `apps/web/src/scripts/ai-grading-benchmark-attestation.ts` | Accepted operator boundary | Explicit script entrypoint; operator-controlled path, no HTTP or queue entrypoint. | Ignore individually with OPERATOR-CLI evidence. | `e61c7110` | Independent Codex security review, 2026-09-03 | pending |
| 618477572 | Medium | `apps/web/src/scripts/upload-faro-source-maps.mjs` | Accepted operator boundary | Explicit release/operator script; path is supplied by trusted deployment context, not a request or queue. | Ignore individually with OPERATOR-CLI evidence. | `e61c7110` | Independent Codex security review, 2026-09-03 | pending |
| 618477575 | Medium | `scripts/ai/gemini-live-benchmark.mjs` | Accepted operator boundary | Explicit benchmark CLI; operator-controlled inputs and no deployable request entrypoint. | Ignore individually with OPERATOR-CLI evidence. | `e61c7110` | Independent Codex security review, 2026-09-03 | pending |
| 618477580 | Medium | `scripts/ci/checks/no-inline-supabase.ts` | Accepted operator boundary | CI check invoked by trusted repository automation; no runtime entrypoint. | Ignore individually with OPERATOR-CLI evidence. | `e61c7110` | Independent Codex security review, 2026-09-03 | pending |
| 618477597 | Medium | `scripts/ci/checks/rls-coverage.ts` | Accepted operator boundary | CI check invoked by trusted repository automation; no runtime entrypoint. | Ignore individually with OPERATOR-CLI evidence. | `e61c7110` | Independent Codex security review, 2026-09-03 | pending |
| 618477600 | Medium | `scripts/ci/run-critical-coverage.ts:29` | Accepted operator boundary | CI runner path under trusted automation; no HTTP or queue entrypoint. | Ignore individually with OPERATOR-CLI evidence. | `e61c7110` | Independent Codex security review, 2026-09-03 | pending |
| 618477601 | Medium | `scripts/ci/run-critical-coverage.ts:32` | Accepted operator boundary | CI runner path under trusted automation; no HTTP or queue entrypoint. | Ignore individually with OPERATOR-CLI evidence. | `e61c7110` | Independent Codex security review, 2026-09-03 | pending |
| 618477612 | Medium | `scripts/ielts/import-format-showcase.ts` | Accepted operator boundary | Explicit import CLI; operator-controlled input, no HTTP or queue entrypoint. | Ignore individually with OPERATOR-CLI evidence. | `e61c7110` | Independent Codex security review, 2026-09-03 | pending |
| 618477613 | Medium | `scripts/import-truong-teen-corpus.ts:41` | Accepted operator boundary | Explicit corpus import CLI; operator-controlled input, no HTTP or queue entrypoint. | Ignore individually with OPERATOR-CLI evidence. | `e61c7110` | Independent Codex security review, 2026-09-03 | pending |
| 618477614 | Medium | `scripts/import-truong-teen-corpus.ts:42` | Accepted operator boundary | Explicit corpus import CLI; operator-controlled input, no HTTP or queue entrypoint. | Ignore individually with OPERATOR-CLI evidence. | `e61c7110` | Independent Codex security review, 2026-09-03 | pending |
| 618477621 | Medium | `scripts/normalize-truong-teen-corpus.ts` | Accepted operator boundary | Explicit corpus normalization CLI; operator-controlled input, no HTTP or queue entrypoint. | Ignore individually with OPERATOR-CLI evidence. | `e61c7110` | Independent Codex security review, 2026-09-03 | pending |
| 618477627 | Medium | `services/ai-grading-worker/src/acoustic-preprocessor-cli.ts` | Accepted operator boundary | Explicit worker-operator CLI; paths are operator-controlled and the process has no HTTP or queue entrypoint beyond the invoking OS account. | Ignore individually with OPERATOR-CLI evidence. | `e61c7110` | Independent Codex security review, 2026-09-03 | pending |
| 618475939 | High | Production Supabase session/preferences | Accepted browser-readable cookie boundary | Supabase browser/SSR session refresh requires browser-readable session cookies; protected operations verify `getUser()`. Preference cookies are non-secret. | Ignore individually with documented cookie-boundary evidence; do not redesign as a BFF. | `e61c7110` | Independent Codex security review, 2026-09-03 | pending |

## HSTS requiring live validation

| Aikido ID | Severity | Location | Verdict | Entrypoint/trust evidence | Intended disposition | Evidence revision | Reviewer | Post-scan |
|---|---|---|---|---|---|---|---|---|
| 619203120 | High | `https://thinkfy.net` edge/domain responses | Stale finding pending rescan | Read-only validation on 2026-09-03 found `strict-transport-security: max-age=63072000; includeSubDomains; preload` on the HTTPS apex redirect, `www` redirect, `/en`, the authentication redirect, and a nonexistent-path redirect. No application matcher gap was reproduced. | Request a fresh authenticated domain scan and close as stale only when that scan agrees; do not suppress preemptively. | live edge evidence; no code change | Independent Codex security review, 2026-09-03 | pending |

## Disposition evidence codes

- **OPERATOR-CLI:** explicit operator or CI entrypoint; paths originate from
  operator-controlled arguments, environment, or integrity-checked manifests;
  no HTTP or queue entrypoint and no extra capability beyond the OS account.
- **SUPABASE-OBJECT-KEY:** opaque Storage object names, not OS paths; ownership,
  bucket, ETag/version, and RLS checks are the relevant boundary.

## Verification record

- Clean npm installation, changed-file lint, web TypeScript checking, the
  production Next.js build, design audit/token tests, and all 78 repository test
  suites passed.
- Focused payment, practice, IELTS assignment/adaptive/review, email, draft
  ownership, AI judgment, authorization, and migration-contract tests passed.
- Critical coverage passed (52 tests and all configured thresholds).
- The embedding image imports NumPy 2.4.5, Transformers 5.14.0, and
  Sentence Transformers 5.6.0 with a clean `pip check`.
- The Grafana router image runs as UID/GID 10001 with a read-only root
  filesystem; its complete suite passed (66 tests).
- A local Aikido SAST/secrets scan of the changed security-critical backend and
  migration files returned zero issues. The changed client set repeated one
  known object-key warning for practice audio at
  `practice/feedback/feedback-client.tsx`: the key is the authenticated user UUID
  plus server-created attempt UUID and is protected by Storage RLS; it is not an
  operating-system path.
- Full-repository lint still reports pre-existing errors in untouched IELTS,
  teacher, benchmark, and ingestion files; every changed TypeScript/TSX file
  lints cleanly.
- The current npm advisory database reports 14 findings (4 low, 4 moderate,
  6 high) outside the 15 dependency IDs in this Aikido remediation baseline.
  They remain a separate dependency refresh; no broad override was introduced
  into this scoped patch.
- Local database migration/concurrency execution is pending because the local
  Supabase stack could not mount the Colima Docker socket. No production database
  was contacted. The migrations have focused static contract tests and require
  an authorized staging apply/concurrency run before deployment.

Production deployment, migrations, Aikido ignores, and post-deployment scans are
separately authorized operations. This ledger does not authorize them.

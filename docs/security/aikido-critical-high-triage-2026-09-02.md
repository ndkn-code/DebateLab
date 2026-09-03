# Aikido Critical/High triage — 2026-09-02

Baseline: `DebateLab/main` at `8aa69c015bc08c08c71223c5face314093272980`.
Scope: all 64 open Critical/High findings returned by the Aikido MCP on 2026-09-02
(7 Critical, 57 High). Medium and Low findings are deferred. Each closure must be
reviewed individually; this ledger does not authorize a blanket suppression.

`Closure revision` is intentionally `pending` until the remediation commit exists.
After that commit is created, its hash must replace `pending` before any Aikido
disposition is submitted.

## Confirmed vulnerabilities

| Aikido ID | Severity | Location | Verdict | Evidence / remediation | Closure revision |
|---|---|---|---|---|---|
| 618475559 | Critical | `services/embedding-api/requirements.txt` | Confirmed | Pin `sentence-transformers==5.6.0`; retain Python 3.11, model, dimensions, normalization, and request contract. | pending |
| 618475423 | Critical | `package-lock.json` | Confirmed | Pin Next.js 16.3.3 and refresh only the required lock entries. | pending |
| 618475569 | Critical | `services/embedding-api/requirements.txt` | Confirmed | Pin `starlette==1.0.1` through a compatible FastAPI release. | pending |
| 618475580 | Critical | `services/grafana-bug-router/requirements.txt` | Confirmed | Pin `starlette==1.0.1` through a compatible FastAPI release. | pending |
| 618475408 | Critical | `package-lock.json` | Confirmed | Pin Next.js 16.3.3 and refresh only the required lock entries. | pending |
| 618476048 | Critical | `apps/web/src/app/api/dev/auth-bypass/route.ts:126` | Confirmed | Remove the deployable bypass endpoint; the redirect sink no longer exists and the route returns 404. | pending |
| 618476045 | Critical | `apps/web/src/app/api/dev/auth-bypass/route.ts:97` | Confirmed | Remove the deployable bypass endpoint; the redirect sink no longer exists and the route returns 404. | pending |
| 618475289 | High | `package-lock.json` | Confirmed | Pin Next.js 16.3.3. | pending |
| 618475305 | High | `package-lock.json` | Confirmed | Pin Next.js 16.3.3. | pending |
| 618475379 | High | `package-lock.json` | Confirmed | Pin Next.js 16.3.3. | pending |
| 618475339 | High | `package-lock.json` | Confirmed | Pin Next.js 16.3.3. | pending |
| 618477548 | High | `apps/web/src/components/feedback/session-result-dashboard.tsx:715` | Confirmed | Replace raw HTML injection with an allowlisted `RichNoteNode[]` parser and React renderer. | pending |
| 618498542 | High | `apps/web/src/lib/dev-auth-bypass.ts` | Confirmed | Remove the synthetic identity, cookie, helpers, callers, and QA endpoint; all deployed modes require a real session. | pending |
| 618498530 | High | `apps/web/src/lib/email/admin-template-auth.ts` | Confirmed | Remove `DEV_ADMIN_BYPASS` from all authorization and service-role selection; require persisted admin authorization. | pending |
| 618474797 | High | `package-lock.json` | Confirmed | Resolve the affected `@vercel/queue` copy of `brace-expansion` to 5.0.9. | pending |
| 618474573 | High | `package-lock.json` | Confirmed | Pin Next.js 16.3.3. | pending |
| 618475645 | High | `services/embedding-api/requirements.txt` | Confirmed | Pin `transformers==5.10.1`, within sentence-transformers 5.6.0's supported range. | pending |
| 618474627 | High | `package-lock.json` | Confirmed | Resolve Sharp and its Linux optional binaries to 0.35.3 / libvips 1.3.2. | pending |

## Reviewed non-actionable findings

Evidence codes:

- **CORPUS-METADATA** — the matched value is a normal `source_match_key` corpus
  identifier, not authentication material or a credential.
- **FIXED-DESTINATION** — the destination is produced by a closed resolver whose
  outputs are fixed internal paths or the fixed Thinkfy support email; no user input
  reaches `window.location.href` as a URL.
- **OPERATOR-CLI** — the file is an explicitly invoked operator CLI. Paths come from
  operator-controlled arguments, environment, or integrity-checked manifests; there
  is no HTTP or queue entrypoint and no privilege beyond the invoking OS account.
- **SUPABASE-OBJECT-KEY** — the sink is a Supabase Storage object operation, not an OS
  filesystem operation. The opaque key is generated from authenticated UUIDs,
  returned by ownership/RLS-protected records, or loaded from integrity-checked
  benchmark manifests. Existing bucket, ownership, RLS, ETag, and version checks are
  the relevant security boundary; filesystem normalization would change valid object
  names without addressing a traversal capability.

| Aikido ID | Severity | Location | Verdict | Evidence | Closure revision |
|---|---|---|---|---|---|
| 618475918 | High | `data/corpus/truong-teen-2025.seed.normalized.json:1865` | False positive | CORPUS-METADATA | pending |
| 618476053 | High | `apps/web/src/components/ielts/coach/IeltsCoachShell.tsx:420` | False positive | FIXED-DESTINATION | pending |
| 618477628 | High | `services/ai-grading-worker/src/acoustic-preprocessor-cli.ts:60` | Accepted operator boundary | OPERATOR-CLI | pending |
| 618477629 | High | `services/ai-grading-worker/src/acoustic-preprocessor-cli.ts:96` | Accepted operator boundary | OPERATOR-CLI | pending |
| 618477631 | High | `services/ai-grading-worker/src/acoustic-preprocessor-cli.ts:107` | Accepted operator boundary | OPERATOR-CLI | pending |
| 618477632 | High | `services/ai-grading-worker/src/acoustic-preprocessor-cli.ts:120` | Accepted operator boundary | OPERATOR-CLI | pending |
| 618477634 | High | `services/ai-grading-worker/src/acoustic-preprocessor-cli.ts:132` | Accepted operator boundary | OPERATOR-CLI | pending |
| 618477637 | High | `services/ai-grading-worker/src/operational-evidence-cli.ts:76` | Accepted operator boundary | OPERATOR-CLI | pending |
| 618476031 | High | `apps/web/src/app/[locale]/(protected)/practice/feedback/feedback-client.tsx:85` | False positive | SUPABASE-OBJECT-KEY | pending |
| 618476033 | High | `apps/web/src/app/actions/admin-clubs.ts:322` | False positive | SUPABASE-OBJECT-KEY | pending |
| 618476034 | High | `apps/web/src/app/actions/club-homework.ts:334` | False positive | SUPABASE-OBJECT-KEY | pending |
| 618476038 | High | `apps/web/src/app/actions/club-homework.ts:300` | False positive | SUPABASE-OBJECT-KEY | pending |
| 618476040 | High | `apps/web/src/app/actions/shared-lms-materials.ts:82` | False positive | SUPABASE-OBJECT-KEY | pending |
| 618476041 | High | `apps/web/src/app/api/cron/homework-cleanup/route.ts:54` | False positive | SUPABASE-OBJECT-KEY | pending |
| 618476043 | High | `apps/web/src/app/api/cron/lms-material-cleanup/route.ts:59` | False positive | SUPABASE-OBJECT-KEY | pending |
| 618476050 | High | `apps/web/src/app/api/mobile/practice-transcriptions/route.ts:295` | False positive | SUPABASE-OBJECT-KEY | pending |
| 618476051 | High | `apps/web/src/app/api/practice-transcriptions/finalize/route.ts:174` | False positive | SUPABASE-OBJECT-KEY | pending |
| 618476057 | High | `apps/web/src/lib/ai/grading/steps.ts:260` | False positive | SUPABASE-OBJECT-KEY | pending |
| 618476058 | High | `apps/web/src/lib/api/class-lms/material-pipeline/service.ts:150` | False positive | SUPABASE-OBJECT-KEY | pending |
| 618476059 | High | `apps/web/src/lib/api/class-lms/material-pipeline/service.ts:214` | False positive | SUPABASE-OBJECT-KEY | pending |
| 618476060 | High | `apps/web/src/lib/api/class-lms/material-pipeline/service.ts:233` | False positive | SUPABASE-OBJECT-KEY | pending |
| 618476062 | High | `apps/web/src/lib/api/class-lms/material-pipeline/service.ts:261` | False positive | SUPABASE-OBJECT-KEY | pending |
| 618476064 | High | `apps/web/src/lib/api/class-lms/material-pipeline/service.ts:287` | False positive | SUPABASE-OBJECT-KEY | pending |
| 618476066 | High | `apps/web/src/lib/api/class-lms/material-pipeline/service.ts:303` | False positive | SUPABASE-OBJECT-KEY | pending |
| 618476067 | High | `apps/web/src/lib/api/class-lms/material-pipeline/service.ts:395` | False positive | SUPABASE-OBJECT-KEY | pending |
| 618476068 | High | `apps/web/src/lib/api/class-lms/materials-repository.ts:662` | False positive | SUPABASE-OBJECT-KEY | pending |
| 618476070 | High | `apps/web/src/lib/api/class-lms/student-weekly-repository.ts:98` | False positive | SUPABASE-OBJECT-KEY | pending |
| 618476072 | High | `apps/web/src/lib/api/club-homework.ts:115` | False positive | SUPABASE-OBJECT-KEY | pending |
| 618476075 | High | `apps/web/src/lib/api/ielts/capture-client.ts:106` | False positive | SUPABASE-OBJECT-KEY | pending |
| 618476078 | High | `apps/web/src/lib/api/ielts/gradebook-repository.ts:1075` | False positive | SUPABASE-OBJECT-KEY | pending |
| 618476079 | High | `apps/web/src/lib/api/ielts/results-repository.ts:404` | False positive | SUPABASE-OBJECT-KEY | pending |
| 618476080 | High | `apps/web/src/lib/api/resources.ts:51` | False positive | SUPABASE-OBJECT-KEY | pending |
| 618476082 | High | `apps/web/src/lib/api/resources.ts:113` | False positive | SUPABASE-OBJECT-KEY | pending |
| 618476083 | High | `apps/web/src/lib/api/resources.ts:119` | False positive | SUPABASE-OBJECT-KEY | pending |
| 618476084 | High | `apps/web/src/lib/api/resources.ts:137` | False positive | SUPABASE-OBJECT-KEY | pending |
| 618476085 | High | `apps/web/src/lib/api/resources.ts:159` | False positive | SUPABASE-OBJECT-KEY | pending |
| 618476086 | High | `apps/web/src/lib/ielts/question-media/upload.ts:83` | False positive | SUPABASE-OBJECT-KEY | pending |
| 618476089 | High | `apps/web/src/lib/ielts/speaking-scorer/service.ts:178` | False positive | SUPABASE-OBJECT-KEY | pending |
| 618476094 | High | `apps/web/src/scripts/ai-grading-benchmarks-import.ts:196` | False positive | SUPABASE-OBJECT-KEY | pending |
| 618476095 | High | `apps/web/src/scripts/ai-grading-benchmarks-import.ts:246` | False positive | SUPABASE-OBJECT-KEY | pending |
| 618476099 | High | `apps/web/src/scripts/ai-grading-release-gate.ts:233` | False positive | SUPABASE-OBJECT-KEY | pending |
| 618476102 | High | `apps/web/src/scripts/ai-grading-release-gate.ts:272` | False positive | SUPABASE-OBJECT-KEY | pending |
| 618476104 | High | `scripts/stt-repair-shadow-eval.ts:70` | False positive | SUPABASE-OBJECT-KEY | pending |
| 618476108 | High | `services/ai-grading-worker/src/benchmark-executor.ts:1027` | False positive | SUPABASE-OBJECT-KEY | pending |
| 618476111 | High | `services/lms-material-worker/src/processor.mjs:134` | False positive | SUPABASE-OBJECT-KEY | pending |
| 618476113 | High | `services/lms-material-worker/src/processor.mjs:151` | False positive | SUPABASE-OBJECT-KEY | pending |

## Acceptance record

Acceptance completed on 2026-09-02/03 against the clean remediation worktree:

- Focused security coverage passed: local-admin seeder (2 tests), fail-closed auth
  boundary (3 tests), rich-note XSS regression coverage, and embedding API contract
  coverage (3 tests).
- The required web gates passed: design-system audit, design-system tests, full lint,
  web typecheck, production Next.js build, and critical coverage thresholds. The build
  route manifest contains no `/api/dev/auth-bypass` route.
- `npm ci` and the targeted dependency-tree check passed with Next.js 16.3.3,
  `eslint-config-next` 16.3.3, Sharp 0.35.3, libvips 1.3.2, and the affected
  `@vercel/queue` `brace-expansion` instance at 5.0.9. A Linux x64 container loaded
  Sharp and processed an image successfully.
- Both Python images built cleanly and passed `pip check`. The Grafana bug router's
  full suite passed (66 tests). The embedding container runs as a dedicated non-root
  user and its model caches are writable by that user.
- The embedding service uses Torch 2.7.1 rather than the plan's requested 2.5.1.
  Runtime verification proved Torch 2.5.1 cannot import Transformers 5.10.1 because
  the required `torch.float8_e8m0fnu` symbol is absent. Torch 2.7.1 is therefore the
  minimum tested compatibility correction needed to keep the service operational.
- Real-model compatibility was measured with `AITeamVN/Vietnamese_Embedding` over 20
  fixed English/Vietnamese debate sentences. The old and new stacks both produced
  finite normalized `(20, 1024)` vectors; matching-vector mean/minimum cosine and
  top-five-neighbor mean/minimum preservation were all 1.0 (20/20 exact top-five
  sets). An HTTP acceptance run also rejected an unauthenticated warmup with 401,
  loaded the real model, and returned two normalized 1024-dimensional vectors while
  preserving request ID `acceptance-en-vi-001`.
- A local Aikido scan covered all changed security-relevant files. Its reports matched
  the reviewed SUPABASE-OBJECT-KEY and OPERATOR-CLI categories, except for one newly
  detected root-container finding in the embedding image; that finding was fixed by
  adding the dedicated runtime user, and the affected/new-file rescan returned zero
  issues.
- An independent security review of the reconciled patch found no actionable auth,
  authorization, stored-XSS, seeder, or behavior-regression findings.
- `npm test` ran 78 suites: 77 passed and `test:ielts-adaptive` failed at the pre-existing
  `matching_headings` fixture validation in
  `apps/web/src/lib/ielts/adaptive/evidence.test.ts:137`. Re-running that suite in a
  detached worktree at the untouched baseline revision reproduced the identical
  failure, so it is not caused by this remediation.
- The local seeded-login smoke workflow could not be exercised because no local
  Supabase instance or local credentials were available. The seeder's loopback-only
  and required-credential behavior is covered by its focused tests, and deployed
  authorization paths fail closed without a real session.
- A server-side Aikido branch scan remains a post-push check; this worktree has not
  been pushed or deployed. The 46 non-actionable dispositions must each cite this
  ledger, the final closure revision, and their individual evidence code.

As an intentionally separate concern, `npm audit` currently reports seven High
advisories outside the 64-item Aikido scope (including transitive Browserslist,
Fast URI, Hono, ip-address, js-yaml, PostCSS, and protobufjs findings). They were not
folded into this targeted lockfile update because the approved plan explicitly
deferred unrelated upgrades.

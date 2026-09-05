# PDF question import: engineering verification — 2026-09-04

The organization PDF import received an engineering audit and corrective changes across
its existing web routes, private worker, SQL authorization and workbench. The checked
implementation is a **workbench** surface. It is not yet cleared for production launch:
full-app gates remain blocked by unrelated checkout errors, and the live provider,
retention/deletion operations and compliance review still need launch evidence.

No production migration, paid provider request, deployment, commit or staging was performed.
The existing conflicted `apps/web/src/lib/api/ielts/results-repository.ts` was preserved;
its SHA-256 remained `b67211f14170684190d8b7a7f867a49af78645a028ae56da91b1ae9dc852b00c`.
Other ongoing checkout work was preserved. This is a feature engineering review, not a
formal repository-wide security certification.

## Corrections

- **Authority and isolation.** Upload/finalize/retry bind the active actor, organization,
  batch, material and version. Rights attestation must match the current version. Server
  flags independently gate all three existing routes and the private worker. Revoked
  teachers and learners cannot read question bank content or keys. Ordinary teachers can
  read published active bank items; lead-only keys remain separate. A source-document
  policy dependency that accidentally hid published items was removed from the bank policy;
  the item lifecycle is maintained atomically by the source-action RPC.
- **Quota and idempotency.** Entitlement locks serialize reservations; released reservations
  are reused, consumption stays in the original month, and concurrency counts unfinished
  work across month boundaries. Persisting a result reconciles actual page/question totals
  atomically. Duplicate worker delivery does not create duplicate drafts. Legacy browser
  quota mutation RPC execution is revoked.
- **Provider recovery.** PDF size, header, encryption and page checks run before paid work.
  The original hash is checked and retained. A durable pre-submission marker prevents
  automatic duplicate paid submissions after a lost response. Known jobs are polled on
  retry; ready imports recover material completion without reparsing. Nested v2 results,
  errors and usage are normalized. Usage is stored before candidate normalization can fail.
- **Review/publication.** Recursive answer-field removal separates learner payloads from
  private keys. All extracted questions begin as drafts. Objective keys must be confirmed
  after edits, subjective items remain reviewable, and rejected questions are persisted.
  Publication validates scope, module/skill, required options/visuals and each listening
  document's own ready audio binding. Receipts bind exact IDs and collection; final receipt
  replay and partial publication are supported. The browser recovers receipt collections
  across reloads instead of creating a second collection.
- **Source lifecycle.** Quarantine/deletion affects only the source batch's derivatives,
  even when several batches share a collection. Restore retains the prior state; deletion
  is final. A private cleanup command validates leases, bindings and paths, removes local
  artifacts, scrubs content and records completion. Multiple PDFs get unique tombstones.
- **Workbench.** Explicit organization selection, resumable recent imports, role-aware
  approval, retry identities, all-upload registration before finalization, dirty-review
  protection, editable type/skill/options/stimulus and advanced payload JSON, localized
  labels and partial publication selection were corrected. Local source preview follows
  the selected document; a reselected file is checked against the stored hash.

## Verification evidence

| Check | Result and boundary |
| --- | --- |
| `npm run test:lms-question-import` | **41 passed**: 16 web contract/adapter/access tests and 25 worker tests. Added to the root aggregate test discovery. |
| Existing IELTS/LMS scripts | **23 scripts passed**, covering data model, scoring, question registry, authoring, mocks, security contracts, audio, review, plans, results, learner/home/capture, assignments, LMS pilot/material pipeline, adaptive contracts, prediction and scorer suites. Study-plan and material-pipeline suites were repeated after their final edits. |
| SQL migrations | Enum migration and organization-bank migration applied to an isolated local Supabase Postgres 17 container with the baseline schema. The final bank read policy was then applied and retested. No production database used. |
| SQL behavior + structural contract | **Passed** actual authenticated/service-role RPC and RLS assertions: quota rollover/retry, missing/forged keys, removed/foreign/student access, publication replay/partial completion, quarantine/restore/delete and audit retention. Tests roll back fixtures. |
| Concurrency | Separate concurrent `psql` processes returned one new claim and one replay; one 12-page/1-job reservation existed. Concurrent publication returned one item twice, with one item and one receipt stored. Parent independently inspected counts. Explicit held-lock overlap was not instrumented; this is not a load test. |
| PDF inspection | Real minimal text PDF, blank scanned PDF and 101-page PDF exercised `unpdf`; invalid/encrypted inputs were rejected. No copyrighted exam fixtures used. |
| Worker recovery | Actual production worker path with fake provider/Supabase boundaries tested persisted-job reuse, ambiguous submission, pending retries, failure/usage capture, source binding and completion recovery. |
| UI | CUA exercised the real workbench bundled with real tokens/fonts in an isolated component harness. All **32** EN/VI × light/dark × upload/review × 1280×720, 1440×900, 768×1024, 390×844 combinations had document scroll width ≤ client width. Keyboard acceptance, edits, rejection, submission and demo publication were exercised. The processing pulse includes the reduced-motion utility; OS media emulation was not run. |
| Design gates | `npm run audit:design-system` and `npm run test:design-system` **passed**. |
| Focused lint/typecheck | **Passed** for the import workbench/adapter/access/contracts and changed material-pipeline code. |
| Function boundary | No-new-Vercel-Functions gate **passed**; no new endpoint or baseline exemption added. |
| Full lint | **Blocked by existing errors**: mock page complexity, `WritingTaskRenderer` complexity, gradebook repository length, writing-response repository complexity and the untouched results-repository merge conflict. 5 errors / 12 warnings. |
| Full web typecheck | **Blocked by existing merge markers** in the untouched results repository. |

Transient command logs are in `/tmp/thinkfy-question-import-audit/`. Durable regression
sources are `supabase/tests/20260904000200_question_import_behavior.sql`, the companion
organization-bank contract, `apps/web/src/lib/api/class-lms/question-imports/*.test.ts`,
and `services/lms-material-worker/src/question-import*.test.mjs`.

## Remaining launch work

1. Run an authenticated browser → Storage → queue → real LlamaParse → review → bank flow
   with approved original text/scanned/listening/visual examples after baseline compile
   blockers are resolved. The component harness and fake provider tests do not establish
   production OCR accuracy, actual latency, billing, or queue delivery behavior.
2. Evaluate and pin a dated parser version. Validate every imported type against its final
   assessment renderer/scorer shape, especially diagrams, maps, completion blanks and
   Academic Task 1. SQL enforces core validity and review gates; it does not prove all
   type-specific structures are usable. Advanced JSON editing is currently required for
   complex corrections. Provider images are not automatically imported into durable media.
3. Operationalize the private cleanup command, provider deletion confirmation, invoice
   reconciliation, dead-letter recovery and ambiguous-submission reconciliation. Monitor
   jobs near the material lease window; this patch does not add lease heartbeats. A failed
   provider job retains its ID and requires an operator decision before a new paid parse.
4. Complete the vendor DPA, processing region/subprocessor review, Vietnam privacy and
   cross-border-transfer review, organization rights terms and copyright notice procedure.
   The upload attestation and `disable_cache` setting alone do not establish legal authority,
   zero retention or deletion. The vendor describes `disable_cache` as bypassing result
   caching in its [v2 create reference](https://developers.api.llamaindex.ai/api/python/resources/parsing/methods/create/).

See [the operations runbook](../lms/question-import-operations.md) for the flags, cleanup
command and recovery procedure. Keep the feature/compliance launch flags disabled until
these gates have concrete evidence.

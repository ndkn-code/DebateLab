# AI analysis and knowledge platform rollout

The centralized model layer is used by normal application code immediately.
Durable grading is a separate cutover and stays disabled unless
`AI_DURABLE_WORKFLOWS_ENABLED=true`.

## What must exist before durable or evidence-adjudicated grading is enabled

1. Apply `supabase/migrations/20260829100000_ai_durable_workflows.sql` to the
   target environment, then apply
   `supabase/migrations/20260829110000_ai_knowledge_platform.sql` and
   `supabase/migrations/20260829120000_ai_knowledge_operations.sql`. Regenerate
   Supabase types afterward. All three migrations are forward-only.
2. Confirm the `ai_workflow_runs` row-level-security policy lets a learner read
   only their own runs and lets only the service role create or update runs.
   Confirm that benchmark labels, knowledge ingestion, and grading-authoritative
   retrieval are service-role-only.
3. Configure the target Vercel environment with:
   - `AI_DURABLE_WORKFLOWS_ENABLED=false` until every check below passes
   - `IELTS_EVIDENCE_ADJUDICATION_ENABLED=false` until the pinned benchmark
     gate passes
   - `CRON_SECRET`
   - `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
   - `GROQ_API_KEY` for live grading
   - `VOYAGE_API_KEY` for the English debate and IELTS collections
   - `AZURE_SPEECH_KEY` and `AZURE_SPEECH_REGION` for pronunciation evidence
   - the queue/workflow credentials already required by the project, including
     `VERCEL_QUEUE_API_TOKEN` where the queue client requires it
4. Import only rights-cleared sources. Grading-authoritative items must be
   approved and backed by official or qualified examiner/adjudicator sources.
   Publish an immutable collection version and record that version on every
   grading result.
5. Populate a source-separated locked benchmark. Do not include knowledge from
   the same source in both the retrieval corpus and the evaluation split.
6. Deploy a preview and leave production unchanged.

## Corpus operations

Start from the checked-in **candidate** manifests in
`apps/web/src/scripts/manifests/`; they intentionally contain placeholders,
not examiner labels or copied transcripts. Use Exa/Gemini only to prepare a
manifest for public/de-identified research, then independently verify every
source, locator, rights status, and derived insight before it becomes approved.

Create a draft (this does not embed or expose it to learners):

```bash
npm run ai:knowledge-ingest -w @thinkfy/web -- \
  --manifest src/scripts/manifests/ai-knowledge-candidate.template.json \
  --submitted-by <importer-profile-uuid>
```

An independent admin reviews source/item candidates through the generic admin
API (`GET/PATCH /api/admin/ai-knowledge`). After every item and source is
approved and rights-cleared, embed and atomically publish with a different
reviewer identity:

```bash
npm run ai:knowledge-ingest -w @thinkfy/web -- \
  --manifest <verified-manifest.json> \
  --submitted-by <importer-profile-uuid> \
  --reviewer-id <different-reviewer-profile-uuid> \
  --embed --publish
```

The importer never mutates the active version: each manifest targets a future
integer version, and publication switches the collection in one transaction.
The runtime retrieves that exact active version (or an explicitly pinned
version for a benchmark replay). A benchmark source is blocked from becoming
active retrieval evidence, so a holdout cannot leak into prompts.

## Preview smoke test

Run one item of each kind in preview: debate analysis, IELTS Speaking, and IELTS
Writing. For each item, verify:

- only one `ai_workflow_runs` row and one external workflow run are created;
- a duplicate submission or queue delivery does not start duplicate grading;
- status progresses through `queued`/`starting`, `running`, and `completed`;
- the domain result is persisted before optional replanning or enrichment;
- a forced transient provider failure retries and then succeeds;
- a fatal input failure becomes `failed` and is not retried forever;
- the reconciliation cron recovers a deliberately stale launch reservation;
- on Vercel Hobby, the reconciliation cron is a once-daily safety sweep because
  Hobby projects cannot schedule more frequent cron runs. Queue and Workflow
  retries remain the primary recovery path. Use a Pro plan or an authenticated
  external scheduler if recovery of orphaned launches must happen within minutes;
- the learner cannot read another learner's workflow row.

For Speaking, deliberately remove the Azure credential for one preview run and
verify that grading completes with limited pronunciation confidence rather than
claiming examiner-equivalent precision.

## Grading benchmark gate

Pin the exact grader and corpus versions, then run:

```bash
AI_GRADING_GATE_VERSION=<grader-version> \
AI_GRADING_GATE_CORPUS_VERSION=<collection-version> \
npm run ai:grading-gate -w @thinkfy/web
```

The command fails closed when credentials, labels, evaluations, or version pins
are missing. It also fails unless the configured benchmark reaches the release
thresholds for half-band agreement, quadratic weighted kappa, group bias,
repeatability, schema validity, evidence authority, and workflow reliability.
Never use AI-derived annotations as benchmark ground truth.

## Production cutover

Enable `IELTS_EVIDENCE_ADJUDICATION_ENABLED=true` only after the pinned grading
gate passes. Enable `AI_DURABLE_WORKFLOWS_ENABLED=true` only after the separate
workflow preview checks pass. The switches are independent: the first restores
the prior one-pass scorer; the second restores the legacy queue execution path.
Do not roll back either forward-only database migration or delete versioned
evidence.

## Internal retrieval

Debate and IELTS retrieval use collection-isolated 1,024-dimensional vector
spaces plus the service-role-only lexical search RPC. English collections are
pinned to `voyage-4-large`; changing embedding models requires a new collection
version and re-embedding, never an environment override. Typed knowledge tools
return evidence IDs, source locators, collection versions, relevance, and
limitations. External Exa and Gemini are research-time tools only and are not
runtime dependencies for grading. Live student data must not be sent to Gemini.

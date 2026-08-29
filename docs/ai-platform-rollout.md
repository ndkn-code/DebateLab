# AI analysis platform rollout

The centralized model layer is used by normal application code immediately.
Durable grading is a separate cutover and stays disabled unless
`AI_DURABLE_WORKFLOWS_ENABLED=true`.

## What must exist before durable grading is enabled

1. Apply `supabase/migrations/20260829100000_ai_durable_workflows.sql` to the
   target environment and regenerate Supabase types afterward.
2. Confirm the `ai_workflow_runs` row-level-security policy lets a learner read
   only their own runs and lets only the service role create or update runs.
3. Configure the target Vercel environment with:
   - `AI_DURABLE_WORKFLOWS_ENABLED=true`
   - `CRON_SECRET`
   - the existing Supabase service-role variables
   - the existing model-provider keys (`GEMINI_API_KEY` or `GEMINI_API_KEYS`,
     plus configured fallback-provider keys)
   - the queue/workflow credentials already required by the project, including
     `VERCEL_QUEUE_API_TOKEN` where the queue client requires it
4. Deploy a preview and leave production unchanged.

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

## Production cutover

Enable the flag for production only after the preview checks pass. Keep the
legacy queue path available for rollback. Rollback is performed by setting
`AI_DURABLE_WORKFLOWS_ENABLED=false`; do not roll back the forward-only database
migration.

## Internal retrieval

Debate knowledge retrieval fuses semantic candidates with the service-role-only
lexical search RPC. IELTS rubrics/exemplars and learner history use the same
`searchKnowledge` evidence envelope. External Exa is not a runtime dependency
for grading, and no paid Exa account is required.

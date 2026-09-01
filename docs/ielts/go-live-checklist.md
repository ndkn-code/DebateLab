# IELTS rollout checklist

Last verified: 2026-09-01. IELTS is already learner- and teacher-visible in
production. Durable grading runs on private Cloud Run + Pub/Sub; it does not use
Vercel Workflow, Vercel Queues, or a Vercel grading cron.

## Verified production paths

- [x] Teacher IELTS workspace is class-scoped and accessible to an assigned
  class manager.
- [x] Teacher Writing review publishes separately versioned teacher rationale;
  the learner sees the teacher-confirmed score while AI evidence is preserved.
- [x] IELTS Coach is product-isolated, uses confirmed teacher scores ahead of
  provisional AI scores, and launches a specific safe mock task.
- [x] The Coach question bank contains 48 published, first-party,
  answer-key-free prompts (13 original plus 35 module/part-specific additions).
  Production routing distinguishes Academic and General Training Writing and
  Speaking Parts 1-3.
- [x] The one-time Google AI consent is shared across Debate and IELTS Coach on
  the current device. With consent, IELTS Coach tries Gemini 3.5 Flash-Lite
  first; without consent it remains Groq-only.
- [x] Speaking recording, upload, transcription, scoring, persistence, polling,
  and learner feedback complete through the GCP worker. The verified run made
  one provider call and produced one durable run.
- [x] A full Academic simulation can submit Listening, Reading, and both frozen
  Writing tasks. A partial overall band is not shown while a required skill is
  pending.
- [x] Duplicate delivery, stale claim, bounded retry, checkpoint replay,
  unauthorized identity, and no-new-Vercel-function contracts are covered by
  automated tests.
- [x] Production mock questions are safe first-party content and carry no
  grading-authoritative labels or learner-visible answer keys before submission.

## Code gates for the next release

- [x] Completion now requires a current score for every frozen Writing task,
  including a matching published teacher revision when teacher authority is
  used. One Task 2 result can no longer complete a two-task simulation.
- [x] Front-facing IELTS Coach fallback uses `qwen/qwen3.8-27b` first and
  `openai/gpt-oss-20b` second. The production check on commit `7d612313` recovered
  from a Gemini timeout and GPT-OSS schema rejection with a valid Qwen
  structured response in 3.3 seconds, then launched the exact Academic Task 1
  mock URL. IELTS grading remains on the separate Groq/GCP path.
- [x] A Groq JSON-mode validation rejection receives one bounded repair inside
  the existing fenced provider phase before fallback. Transport and timeout
  failures still skip repair and move to the next declared candidate.
- [x] Simulation Writing messages are published in deterministic task order and
  remain independently idempotent.
- [x] Complete repository validation: all 75 test suites pass, TypeScript passes,
  and the production build generates 189 pages.
- [x] Production commit `84a107c1` and private Cloud Run revision
  `ai-grading-worker-00007-g9v` passed a full Academic simulation on
  2026-09-01. Both Writing tasks scored in one durable run and one delivery
  each; Task 1 used one provider attempt and Task 2 succeeded on its bounded
  second JSON attempt. The attempt completed only after both scores landed.
- [x] Non-disruptive rollback readiness is verified: the
  `AI_GRADING_BACKEND=legacy` kill switch exists, the previous production web
  deployment is Ready, and prior private Cloud Run revisions remain Ready.
- [ ] Perform an authorized traffic-switch rehearsal of the web-dispatch and
  Cloud Run rollback controls during a maintenance window.

## Content and accuracy gates

- [ ] Have an independent reviewer approve and rights-clear the draft IELTS
  collection version. The importer cannot approve its own work.
- [ ] Publish the approved immutable collection version. Until then, runtime
  retrieval stays on the safe legacy/local fallback.
- [ ] Create a protected, source-separated benchmark containing all four human
  criterion labels. Public official examples discovered so far publish useful
  overall scores and examiner commentary but not four numeric criterion labels,
  so they are coaching locators rather than benchmark ground truth.
- [ ] Pass the locked grading thresholds in `docs/ai-platform-rollout.md` before
  enabling `IELTS_EVIDENCE_ADJUDICATION_ENABLED`.
- [ ] Configure Azure Speech in the Cloud Run runtime and verify acoustic
  pronunciation evidence. Without it, Speaking remains usable but correctly
  reports limited pronunciation confidence.
- [ ] Confirm Voyage credentials before publishing the English collections.
  Voyage is not required for the current safe fallback retrieval path.

## Kill switches and rollback

- `AI_GRADING_BACKEND=legacy` stops new GCP grading dispatch without deleting
  saved runs or checkpoints.
- `IELTS_EVIDENCE_ADJUDICATION_ENABLED=false` keeps the uncalibrated
  evidence-adjudication stage off.
- Roll the private Cloud Run service back to its previous image if worker
  behavior is unsafe. Do not roll back forward-only migrations or delete
  immutable evidence.
- If the IELTS product itself must be hidden, disable the existing IELTS product
  flag and redeploy. Debate remains isolated.

## Human decisions still required

- A second person must perform corpus rights/content approval.
- A qualified human-labelled criterion benchmark is required to substantiate
  examiner-quality accuracy. Document discovery alone cannot prove that claim.
- Azure and Voyage accounts/secrets must be funded and configured by an account
  owner if those optional quality layers are to be activated.

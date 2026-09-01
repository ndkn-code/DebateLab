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
- [x] A Groq rate limit on the primary IELTS scorer advances inside the same
  fenced provider phase to `openai/gpt-oss-20b`, a fast Groq-only fallback.
- [x] Simulation Writing messages are published in deterministic task order and
  remain independently idempotent.
- [x] Complete repository validation: all 75 test suites pass, TypeScript passes,
  and the production build generates 189 pages.
- [ ] Deploy the reviewed web commit and private worker image, then repeat one
  two-task Writing smoke test and confirm one result per task with no duplicate
  provider calls.
- [ ] Rehearse `AI_GRADING_BACKEND=legacy` and the prior Cloud Run revision as
  separate web-dispatch and worker rollback controls.

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

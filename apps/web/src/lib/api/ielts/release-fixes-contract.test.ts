import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "../../supabase/migrations/20260829220000_ai_ielts_release_fixes.sql",
  ),
  "utf8",
);
const coachRuntimeFix = readFileSync(
  resolve(
    process.cwd(),
    "../../supabase/migrations/20260831120000_ai_provider_ielts_coach_output_type.sql",
  ),
  "utf8",
);
const knowledgeDraftClaimFix = readFileSync(
  resolve(
    process.cwd(),
    "../../supabase/migrations/20260831130000_fix_ai_knowledge_draft_claim.sql",
  ),
  "utf8",
);
const knowledgeVectorGuardFix = readFileSync(
  resolve(
    process.cwd(),
    "../../supabase/migrations/20260831140000_fix_ai_knowledge_vector_guard.sql",
  ),
  "utf8",
);
const mockKnowledgeImporter = readFileSync(
  resolve(process.cwd(), "src/scripts/ai-knowledge-prepare-ielts-mocks.ts"),
  "utf8",
);
const releaseKnowledgeImporter = readFileSync(
  resolve(process.cwd(), "src/scripts/ai-knowledge-prepare-ielts-release.ts"),
  "utf8",
);
const releaseCorpus = readFileSync(
  resolve(process.cwd(), "src/lib/ai/knowledge/ielts-release-corpus.ts"),
  "utf8",
);
const teacherWorkspaceRollout = readFileSync(
  resolve(
    process.cwd(),
    "../../supabase/migrations/20260831150000_enable_ielts_teacher_workspace.sql",
  ),
  "utf8",
);

test("AI telemetry constraint preserves every runtime output type", () => {
  for (const outputType of [
    "rebuttal",
    "practice_judging",
    "duel_judging",
    "coach_chat",
    "coach_deep_review",
    "coach_metadata",
    "coach_title",
    "coach_visual_prompt",
    "coach_visual_planner",
    "ielts_writing_score",
    "ielts_speaking_score",
    "ielts_writing_score_adjudication",
    "ielts_speaking_score_adjudication",
    "ielts_micro_item_drafts",
    "stt_transcript_repair",
    "admin_ai_insights",
    "onboarding_feedback",
    "phoneme_report",
  ]) {
    assert.match(migration, new RegExp(`'${outputType}'`));
  }
});

test("release SQL keeps retry, simulation, identity, and retention at DB boundary", () => {
  assert.match(
    migration,
    /create or replace function public\.retry_ielts_scoring_workflow/,
  );
  assert.match(migration, /private\.is_assigned_class_teacher/);
  assert.match(migration, /workflow_attempt_count < 3/);
  assert.match(migration, /manual_retry_count >= 1/);
  assert.match(migration, /ielts_scoring_retry_events/);
  assert.match(migration, /validate_ielts_simulation_section_order/);
  assert.match(migration, /Listening \(1\), Reading \(2\), Writing \(3\)/);
  assert.match(migration, /validate_ielts_criterion_evidence_identity/);
  assert.match(migration, /IELTS_EVIDENCE_IDENTITY_MISMATCH/);
  assert.match(
    migration,
    /references public\.ielts_attempts\(id\) on delete restrict/,
  );
  assert.match(
    migration,
    /references public\.writing_responses\(id\) on delete restrict/,
  );
});

test("coach runtime SQL admits telemetry and completes against canonical conversation columns", () => {
  assert.match(coachRuntimeFix, /'ielts_coach_contract'/);
  assert.match(
    coachRuntimeFix,
    /create or replace function public\.complete_ai_coach_turn/,
  );
  assert.match(coachRuntimeFix, /set updated_at = now\(\)/);
  assert.doesNotMatch(coachRuntimeFix, /set message_count|last_message_at/);
  assert.match(coachRuntimeFix, /to service_role/);
});

test("knowledge draft claim avoids output-column shadowing and remains private", () => {
  assert.match(
    knowledgeDraftClaimFix,
    /on conflict on constraint ai_knowledge_collection_versions_pkey/,
  );
  assert.doesNotMatch(
    knowledgeDraftClaimFix,
    /on conflict \(collection_id, version\)/,
  );
  assert.match(knowledgeDraftClaimFix, /set search_path = ''/);
  assert.match(knowledgeDraftClaimFix, /from public, anon, authenticated/);
  assert.match(knowledgeDraftClaimFix, /to service_role/);
});

test("knowledge vector guard accesses only fields belonging to each trigger table", () => {
  assert.match(
    knowledgeVectorGuardFix,
    /if tg_table_name = 'ai_knowledge_items' then/,
  );
  assert.match(
    knowledgeVectorGuardFix,
    /elsif tg_table_name = 'ai_knowledge_collections' then/,
  );
  assert.doesNotMatch(
    knowledgeVectorGuardFix,
    /tg_table_name = 'ai_knowledge_items'\s+and/,
  );
  assert.match(knowledgeVectorGuardFix, /set search_path = ''/);
  assert.match(knowledgeVectorGuardFix, /from public, anon, authenticated/);
});

test("IELTS mock importer is coaching-only, review-gated, and cannot publish", () => {
  assert.match(mockKnowledgeImporter, /coach_recommendable: true/);
  assert.match(mockKnowledgeImporter, /usableFor: \["coaching"\]/);
  assert.match(mockKnowledgeImporter, /reviewStatus: "needs_review"/);
  assert.match(mockKnowledgeImporter, /submittedBy: null/);
  assert.match(mockKnowledgeImporter, /notOfficialIelts: true/);
  assert.doesNotMatch(mockKnowledgeImporter, /publishAiKnowledgeVersion/);
  assert.doesNotMatch(
    mockKnowledgeImporter,
    /\.select\([\s\S]*?(?:answer|explanation|response)/,
  );
});

test("IELTS release corpus keeps mocks separate from review-gated official calibration", () => {
  assert.match(releaseCorpus, /usableFor: \["coaching"\]/);
  assert.match(releaseCorpus, /notOfficialIelts: true/);
  assert.match(releaseCorpus, /authorityTier: "official"/);
  assert.match(releaseCorpus, /rightsStatus: "requires_review"/);
  assert.match(releaseCorpus, /reviewStatus: "needs_review"/);
  assert.match(releaseCorpus, /usableFor: \["grading", "coaching"\]/);
  assert.match(releaseCorpus, /adjacentBandDistinction/);
  assert.match(releaseCorpus, /fullResponseStored: false/);
  assert.match(releaseCorpus, /derivedOnly: true/);
  assert.match(releaseCorpus, /rubricVersion/);
  assert.match(releaseCorpus, /transcriptStored: false/);
  assert.match(releaseCorpus, /permittedExcerptStored: false/);
  assert.match(releaseCorpus, /benchmarkEligible: false/);
});

test("IELTS release importer cannot read protected answers or publish a draft", () => {
  assert.match(
    releaseKnowledgeImporter,
    /collectionVersion: z\.number\(\)\.int\(\)\.min\(4\)/,
  );
  assert.match(releaseKnowledgeImporter, /coach_recommendable: true/);
  assert.match(releaseKnowledgeImporter, /submittedBy: null/);
  assert.match(releaseKnowledgeImporter, /embeddingBatchSize: 20/);
  assert.match(releaseKnowledgeImporter, /embeddingBatchDelayMs: 31_000/);
  assert.match(releaseKnowledgeImporter, /embeddingBatchRetryAttempts: 2/);
  assert.match(releaseKnowledgeImporter, /embeddingBatchRetryDelayMs: 65_000/);
  assert.match(
    releaseKnowledgeImporter,
    /draft_needs_independent_review_and_rights_clearance/,
  );
  assert.doesNotMatch(releaseKnowledgeImporter, /publishAiKnowledgeVersion/);
  assert.doesNotMatch(
    releaseKnowledgeImporter,
    /\.select\([\s\S]*?(?:answer_key|explanation|learner_response|teacher_feedback|protected_label)/,
  );
});

test("teacher workspace rollout is IELTS-class scoped and preserves explicit flags", () => {
  assert.match(teacherWorkspaceRollout, /c\.program_type = 'ielts'/);
  assert.match(teacherWorkspaceRollout, /c\.status = 'active'/);
  assert.match(teacherWorkspaceRollout, /c\.club_id is not null/);
  assert.match(teacherWorkspaceRollout, /scope', 'ielts_class_only'/);
  assert.match(teacherWorkspaceRollout, /after insert on public\.classes/);
  assert.match(teacherWorkspaceRollout, /do nothing/);
  assert.doesNotMatch(teacherWorkspaceRollout, /class_id\s*,\s*null/);
  assert.match(teacherWorkspaceRollout, /from public, anon, authenticated/);
});

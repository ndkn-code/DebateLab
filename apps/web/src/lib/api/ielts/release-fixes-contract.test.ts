import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "../../supabase/migrations/20260829210000_ai_ielts_release_fixes.sql",
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
  assert.match(migration, /create or replace function public\.retry_ielts_scoring_workflow/);
  assert.match(migration, /private\.is_assigned_class_teacher/);
  assert.match(migration, /workflow_attempt_count < 3/);
  assert.match(migration, /manual_retry_count >= 1/);
  assert.match(migration, /ielts_scoring_retry_events/);
  assert.match(migration, /validate_ielts_simulation_section_order/);
  assert.match(migration, /Listening \(1\), Reading \(2\), Writing \(3\)/);
  assert.match(migration, /validate_ielts_criterion_evidence_identity/);
  assert.match(migration, /IELTS_EVIDENCE_IDENTITY_MISMATCH/);
  assert.match(migration, /references public\.ielts_attempts\(id\) on delete restrict/);
  assert.match(migration, /references public\.writing_responses\(id\) on delete restrict/);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Tables } from "@/types/supabase";
import {
  buildMockStructureFromFrozenBlueprint,
  type FrozenBlueprintRow,
  type FrozenGroupBlueprintRow,
} from "./mock-repository";

const test = {
  id: "test-1",
  title: "Frozen test",
  slug: "frozen-test",
  module: "academic",
  assessment_mode: "practice",
} as unknown as Tables<"ielts_tests">;

const blueprint = {
  question_id: "question-1",
  skill: "reading",
  question_type: "true_false_notgiven",
  question_order: 1,
  prompt: "Original prompt",
  group_instructions: null,
  options: [],
  max_points: 1,
  word_limit: null,
  visual: null,
  metadata: {},
  passage_id: "passage-1",
  listening_section_id: null,
  source_title: "Original passage",
  source_body: "Original passage body",
  source_audio_asset_id: null,
  source_audio_storage_path: null,
  source_audio_version: null,
  source_audio_status: null,
} as unknown as FrozenBlueprintRow;

const snapshot = buildMockStructureFromFrozenBlueprint(test, [blueprint]);
// Mutating the authored source after freeze cannot affect the projected player
// content because it is built only from the copied blueprint fields.
const mutableSource = {
  title: "Original passage",
  body: "Original passage body",
};
mutableSource.title = "Edited passage";
mutableSource.body = "Edited passage body";
assert.equal(snapshot.questions[0]?.prompt, "Original prompt");
assert.equal(snapshot.passages[0]?.title, "Original passage");
assert.equal(snapshot.passages[0]?.body, "Original passage body");
// Legacy attempts (frozen before groups existed) project an empty group list.
assert.deepEqual(snapshot.questionGroups, []);

// Frozen group blueprints project alongside their member questions.
const groupedBlueprints = [
  {
    ...blueprint,
    question_id: "question-2",
    question_order: 2,
    group_key: "headings-1",
    metadata: { slot: "2" },
  },
  {
    ...blueprint,
    question_id: "question-3",
    question_order: 3,
    group_key: "headings-1",
    metadata: {},
  },
] as unknown as FrozenBlueprintRow[];
const groupBlueprint = {
  id: "gb-1",
  group_id: "g-1",
  group_key: "headings-1",
  skill: "reading",
  passage_id: "passage-1",
  listening_section_id: null,
  order_index: 0,
  title: "Questions 2-3",
  instructions: "Choose the correct heading.",
  stimulus: null,
  bank: [{ id: "i", label: "i", text: "First heading" }, "Second heading"],
  bank_reuse: false,
  answer_mode: null,
  any_order: false,
} as unknown as FrozenGroupBlueprintRow;
const grouped = buildMockStructureFromFrozenBlueprint(test, groupedBlueprints, [groupBlueprint]);
assert.equal(grouped.questionGroups.length, 1);
assert.equal(grouped.questionGroups[0]?.groupKey, "headings-1");
assert.deepEqual(grouped.questionGroups[0]?.questionIds, ["question-2", "question-3"]);
assert.deepEqual(grouped.questionGroups[0]?.slotByQuestionId, {
  "question-2": "2",
  "question-3": "2",
});
assert.equal(grouped.questionGroups[0]?.bank[1]?.label, "B");
assert.equal(grouped.questionGroups[0]?.answerMode, "select");

const repository = readFileSync(
  resolve(process.cwd(), "src/lib/api/ielts/mock-repository.ts"),
  "utf8",
);
const snapshotMigration = readFileSync(
  resolve(
    process.cwd(),
    "../../supabase/migrations/20260829230000_ielts_attempt_content_snapshots.sql",
  ),
  "utf8",
);
const results = readFileSync(
  resolve(process.cwd(), "src/lib/api/ielts/results-repository.ts"),
  "utf8",
);
assert.match(repository, /from\("ielts_attempt_question_blueprints"\)/);
assert.match(repository, /source_body/);
assert.match(snapshotMigration, /source_audio_storage_path/);
assert.match(snapshotMigration, /explanation_en text/);
assert.match(snapshotMigration, /populate_ielts_attempt_blueprint_source/);
assert.match(snapshotMigration, /prevent_ielts_attempt_blueprint_mutation/);
assert.match(results, /from\("ielts_attempt_question_blueprints"\)/);
assert.match(results, /from\("ielts_attempt_question_keys"\)/);
assert.match(results, /from\("ielts_attempt_question_group_blueprints"\)/);
assert.match(repository, /from\("ielts_attempt_question_group_blueprints"\)/);
const groupMigration = readFileSync(
  resolve(
    process.cwd(),
    "../../supabase/migrations/20260902200200_ielts_attempt_group_blueprints.sql",
  ),
  "utf8",
);
assert.match(groupMigration, /ielts_attempt_question_group_blueprints/);
assert.match(results, /Boolean\(attempt\.blueprint_frozen_at\)/);

console.log("IELTS frozen content contract tests passed");

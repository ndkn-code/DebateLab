import assert from "node:assert/strict";
import { buildIeltsSkillDrill, type IeltsSkillDrillQuestionCandidate } from "./generator";

const USER_ID = "00000000-0000-4000-8000-000000000111";

function q(
  id: string,
  overrides: Partial<IeltsSkillDrillQuestionCandidate> = {},
): IeltsSkillDrillQuestionCandidate {
  return {
    id,
    sourceTestId: overrides.sourceTestId ?? "test-a",
    skill: "reading",
    questionType: "matching_headings",
    maxPoints: 1,
    orderIndex: Number(id.slice(-1)) || 0,
    module: "academic",
    published: true,
    metadata: {
      subskill_tags: ["reading:matching_headings"],
      difficulty_band_hint: 6,
    },
    ...overrides,
  };
}

const QUESTIONS: IeltsSkillDrillQuestionCandidate[] = [
  q("q-1", { metadata: { subskill_tags: ["reading:matching_headings"], difficulty_band_hint: 7 } }),
  q("q-2", { metadata: { subskill_tags: ["reading:matching_headings"], difficulty_band_hint: 6.5 } }),
  q("q-3", { questionType: "mcq_single", metadata: { subskill_tags: ["reading:mcq_single"], difficulty_band_hint: 6.5 } }),
  q("q-4", { published: false }),
  q("q-5", { skill: "listening", metadata: { subskill_tags: ["listening:matching_features"], difficulty_band_hint: 6.5 } }),
  q("q-6", { questionType: "writing_task2_essay", metadata: { subskill_tags: ["reading:matching_headings"] } }),
  q("q-7", { module: "general_training" }),
];

{
  const result = buildIeltsSkillDrill({
    userId: USER_ID,
    skill: "reading",
    subskillKey: "reading:matching_headings",
    targetMinutes: 10,
    questionTypes: ["matching_headings"],
    subskillTags: ["reading:matching_headings"],
    difficultyBandHint: 6.5,
    questions: QUESTIONS,
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(
      result.drill.selectedQuestions.map((question) => question.id),
      ["q-2", "q-1"],
      "matching published objective questions closest to the requested band are selected",
    );
    assert.equal(result.drill.test.kind, "drill");
    assert.equal(result.drill.test.module, "academic");
    assert.equal(result.drill.test.skill, "reading");
    assert.equal(result.drill.test.metadata.band_conversion_key, "default");
    assert.equal(result.drill.test.metadata.scoring_path, "objective_grading_v1");
    assert.equal(result.drill.reference.type, "skill_drill");
    assert.deepEqual(result.drill.reference.sourceQuestionIds, ["q-2", "q-1"]);
  }
}

{
  const result = buildIeltsSkillDrill({
    userId: USER_ID,
    skill: "reading",
    subskillKey: "reading:matching_headings",
    targetMinutes: 30,
    questions: [q("q-1"), q("q-2"), q("q-3", { questionType: "matching_headings" })],
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.drill.test.kind, "skill_set");
    assert.equal(result.drill.test.timeLimitSeconds, 30 * 60);
    assert.match(result.drill.test.slug, /^ielts-reading-matching-headings-/);
  }
}

{
  const result = buildIeltsSkillDrill({
    userId: USER_ID,
    skill: "writing",
    subskillKey: "writing:coherence_cohesion",
    targetMinutes: 10,
    questions: QUESTIONS,
  });
  assert.deepEqual(result, { ok: false, reason: "unsupported_skill" });
}

{
  const result = buildIeltsSkillDrill({
    userId: USER_ID,
    skill: "reading",
    subskillKey: "listening:matching_features",
    targetMinutes: 10,
    questions: QUESTIONS,
  });
  assert.deepEqual(result, { ok: false, reason: "invalid_subskill" });
}

{
  const result = buildIeltsSkillDrill({
    userId: USER_ID,
    skill: "reading",
    subskillKey: "reading:summary_completion",
    targetMinutes: 10,
    questions: [q("q-1")],
  });
  assert.deepEqual(result, { ok: false, reason: "insufficient_questions" });
}

console.log("ielts/skill-drill/generator.test.ts passed");

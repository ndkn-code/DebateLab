import assert from "node:assert/strict";
import { parseInput } from "@/lib/api/boundary";
import { CreateIeltsQuestionSchema } from "@/lib/api/ielts/question-schema";
import {
  AdaptiveQuestionMetadataSchema,
  IeltsAdaptiveEvidenceSchema,
  deriveIeltsSkillStates,
  toIeltsSkillStateUpsert,
} from "./evidence";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const SOURCE_ID = "22222222-2222-4222-8222-222222222222";
const TEST_ID = "33333333-3333-4333-8333-333333333333";

{
  const metadata = AdaptiveQuestionMetadataSchema.parse({
    subskill_tags: ["reading:matching_headings"],
    difficulty_band_hint: 6.5,
    track_c_tags: ["today_queue", "reading:priority"],
    learn_activity_weight: 0.75,
    importId: "cambridge-19",
  });
  assert.deepEqual(metadata.subskill_tags, ["reading:matching_headings"]);
  assert.equal(metadata.difficulty_band_hint, 6.5);
  assert.equal(metadata.importId, "cambridge-19");
}

assert.throws(() =>
  AdaptiveQuestionMetadataSchema.parse({
    subskill_tags: ["reading matching headings"],
  }),
);

assert.throws(() =>
  AdaptiveQuestionMetadataSchema.parse({
    difficulty_band_hint: 6.25,
  }),
);

{
  const question = parseInput(CreateIeltsQuestionSchema, {
    testId: TEST_ID,
    skill: "reading",
    questionType: "matching_headings",
    prompt: "Choose the correct heading.",
    correctAnswer: "A",
    metadata: {
      subskill_tags: ["reading:matching_headings"],
      difficulty_band_hint: 6,
    },
  });
  assert.deepEqual(question.metadata.subskill_tags, ["reading:matching_headings"]);
}

assert.throws(() =>
  parseInput(CreateIeltsQuestionSchema, {
    testId: TEST_ID,
    skill: "reading",
    questionType: "matching_headings",
    prompt: "Choose the correct heading.",
    correctAnswer: "A",
    metadata: { difficulty_band_hint: 6.25 },
  }),
);

const firstEvidence = parseInput(IeltsAdaptiveEvidenceSchema, {
  userId: USER_ID,
  subskillKey: "reading:matching_headings",
  skill: "reading",
  module: "academic",
  questionType: "matching_headings",
  evidenceType: "objective_response",
  evidenceValue: 0.4,
  bandEstimate: 5,
  confidence: 0.7,
  sourceTable: "ielts_question_responses",
  sourceId: SOURCE_ID,
  reasonEn: "Missed headings that depended on main-idea paraphrase.",
  reasonVi: "Sai câu ghép tiêu đề cần nhận diện diễn đạt tương đương.",
  createdAt: "2026-06-20T10:00:00.000Z",
});

const secondEvidence = parseInput(IeltsAdaptiveEvidenceSchema, {
  ...firstEvidence,
  evidenceValue: 0.9,
  bandEstimate: 6.5,
  confidence: 0.8,
  sourceId: "44444444-4444-4444-8444-444444444444",
  reasonEn: "Recent drill was first-try correct.",
  reasonVi: "Bài luyện gần nhất làm đúng ngay lần đầu.",
  createdAt: "2026-06-21T10:00:00.000Z",
});

{
  const states = deriveIeltsSkillStates([secondEvidence, firstEvidence]);
  assert.equal(states.length, 1);
  const state = states[0];
  assert.equal(state.subskillKey, "reading:matching_headings");
  assert.equal(state.masteryScore, 0.54);
  assert.equal(state.bandEstimate, 6);
  assert.equal(state.evidenceCount, 2);
  assert.equal(state.lastEvidenceAt, "2026-06-21T10:00:00.000Z");
  assert.equal(state.explanation.reasonVi, "Bài luyện gần nhất làm đúng ngay lần đầu.");
  assert.equal(state.weaknessWeight, 0.076);

  const upsert = toIeltsSkillStateUpsert(state);
  assert.equal(upsert.user_id, USER_ID);
  assert.equal(upsert.subskill_key, "reading:matching_headings");
  assert.equal(upsert.mastery_score, 0.54);
  assert.equal(upsert.band_estimate, 6);
  assert.equal(upsert.evidence_count, 2);
}

assert.throws(() =>
  parseInput(IeltsAdaptiveEvidenceSchema, {
    ...firstEvidence,
    subskillKey: "listening:matching_headings",
  }),
);

console.log("IELTS adaptive evidence tests passed");

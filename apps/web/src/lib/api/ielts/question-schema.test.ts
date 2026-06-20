/**
 * Unit tests for the canonical question+key boundary schema (WS-1.1). Run under tsx.
 */
import assert from "node:assert/strict";
import { parseInput } from "@/lib/api/boundary";
import {
  CreateIeltsQuestionSchema,
  UpdateIeltsQuestionSchema,
  questionCategory,
  toCreateQuestionArgs,
  toUpdateQuestionArgs,
} from "./question-schema";

const TID = "11111111-1111-4111-8111-111111111111";
const QID = "22222222-2222-4222-8222-222222222222";

// category mapping
assert.equal(questionCategory("true_false_notgiven"), "objective");
assert.equal(questionCategory("writing_task2_essay"), "writing");
assert.equal(questionCategory("speaking_part1"), "speaking");

// TRUE/FALSE/NOT GIVEN normalizes a loose token + sets correctAnswer
{
  const q = parseInput(CreateIeltsQuestionSchema, {
    testId: TID,
    skill: "reading",
    questionType: "true_false_notgiven",
    prompt: "Wolves were absent for over fifty years.",
    correctAnswer: "f",
    explanationEn: "Para 2 says forty years.",
  });
  assert.equal(q.correctAnswer, "FALSE");
  assert.equal(q.explanationEn, "Para 2 says forty years.");
  const args = toCreateQuestionArgs(q);
  assert.equal(args.p_test_id, TID);
  assert.equal(args.p_skill, "reading");
  assert.equal(args.p_correct_answer, "FALSE");
}

// invalid TF/NG token is rejected
assert.throws(() =>
  parseInput(CreateIeltsQuestionSchema, {
    testId: TID,
    skill: "reading",
    questionType: "true_false_notgiven",
    prompt: "X",
    correctAnswer: "maybe",
  }),
);

// mcq_single requires >= 2 options
assert.throws(() =>
  parseInput(CreateIeltsQuestionSchema, {
    testId: TID,
    skill: "reading",
    questionType: "mcq_single",
    prompt: "Pick one",
    options: ["only"],
    correctAnswer: "only",
  }),
);

// mcq_multi splits a pipe string into a deduped array
{
  const q = parseInput(CreateIeltsQuestionSchema, {
    testId: TID,
    skill: "listening",
    questionType: "mcq_multi",
    prompt: "Choose two",
    options: "A|B|C|D",
    correctAnswer: "B|D",
  });
  assert.deepEqual(q.correctAnswer, ["B", "D"]);
  assert.deepEqual(q.options, ["A", "B", "C", "D"]);
}

// completion accept-variants split + answer kept verbatim
{
  const q = parseInput(CreateIeltsQuestionSchema, {
    testId: TID,
    skill: "reading",
    questionType: "summary_completion",
    prompt: "Reintroducing the predator triggered a ____.",
    correctAnswer: "trophic cascade",
    acceptVariants: "trophic-cascade|trophic cascades",
    wordLimit: 2,
  });
  assert.equal(q.correctAnswer, "trophic cascade");
  assert.deepEqual(q.acceptVariants, ["trophic-cascade", "trophic cascades"]);
  assert.equal(q.wordLimit, 2);
}

// writing: no objective answer, model + examiner notes retained
{
  const q = parseInput(CreateIeltsQuestionSchema, {
    testId: TID,
    skill: "writing",
    questionType: "writing_task2_essay",
    prompt: "Discuss both views…",
    modelAnswer: "A band-9 essay…",
    examinerNotes: { task: "Both views addressed", grammar: "Near error-free" },
  });
  assert.deepEqual(q.correctAnswer, {});
  assert.equal(q.modelAnswer, "A band-9 essay…");
  assert.equal(q.examinerNotes.task, "Both views addressed");
}

// skill/type consistency is enforced
assert.throws(() =>
  parseInput(CreateIeltsQuestionSchema, {
    testId: TID,
    skill: "reading",
    questionType: "writing_task2_essay",
    prompt: "X",
  }),
);
// a reading question may not link a listening section
assert.throws(() =>
  parseInput(CreateIeltsQuestionSchema, {
    testId: TID,
    skill: "reading",
    questionType: "true_false_notgiven",
    prompt: "X",
    correctAnswer: "TRUE",
    listeningSectionId: QID,
  }),
);

// update schema requires a question id and maps it
{
  const u = parseInput(UpdateIeltsQuestionSchema, {
    questionId: QID,
    testId: TID,
    skill: "reading",
    questionType: "yes_no_notgiven",
    prompt: "Claim",
    correctAnswer: "y",
  });
  assert.equal(u.correctAnswer, "YES");
  const args = toUpdateQuestionArgs(u);
  assert.equal(args.p_question_id, QID);
  assert.equal(args.p_correct_answer, "YES");
}

console.log("IELTS question-schema tests passed");

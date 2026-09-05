import assert from "node:assert/strict";
import test from "node:test";
import { IELTS_QUESTION_TYPES } from "@/lib/api/ielts/schema";
import { normalizeQuestionDraft } from "./normalizer";

test("accepts every supported IELTS question type", () => {
  for (const questionType of IELTS_QUESTION_TYPES) {
    const skill = questionType.startsWith("writing_")
      ? "writing"
      : questionType.startsWith("speaking_")
        ? "speaking"
        : "reading";
    const result = normalizeQuestionDraft(
      { questionType, prompt: "Original prompt", answer: "A", page: 2 },
      { skill, variant: "academic" },
    );
    assert.equal(result.questionType, questionType);
    assert.equal(
      result.validationIssues.some(
        (issue) => issue.code === "unsupported_question_type",
      ),
      false,
    );
  }
});

test("maps provider labels and preserves the raw source type", () => {
  const result = normalizeQuestionDraft(
    {
      type: "True / False / Not Given",
      prompt: "The statement agrees with the passage.",
      correctAnswer: "true",
    },
    { skill: "reading", variant: "general_training" },
  );
  assert.equal(result.questionType, "true_false_notgiven");
  assert.equal(result.rawQuestionType, "true_false_not_given");
});

test("keeps unsupported types in review instead of making them publishable", () => {
  const result = normalizeQuestionDraft(
    { type: "essay puzzle", prompt: "Explain." },
    { skill: "reading", variant: "academic" },
  );
  assert.equal(result.questionType, "short_answer");
  assert.equal(result.validationIssues[0]?.code, "unsupported_question_type");
});

test("missing objective keys require explicit teacher confirmation", () => {
  const result = normalizeQuestionDraft(
    { type: "matching_sentence_endings", prompt: "Match the ending." },
    { skill: "reading", variant: "academic" },
  );
  assert.equal(result.requiresTeacherConfirmation, true);
  assert.equal(
    result.validationIssues.some((issue) => issue.code === "needs_answer"),
    true,
  );
});

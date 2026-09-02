import assert from "node:assert/strict";
import test from "node:test";

import { ieltsWritingModelOutputSchema } from "@/lib/scoring/ielts-writing/result-schema";

import {
  countIeltsWritingWords,
  decideSpeakingEvidence,
  decideWritingLowEvidence,
} from "./index";

const CRITERIA = [
  "taskResponse",
  "coherenceCohesion",
  "lexicalResource",
  "grammaticalRangeAccuracy",
] as const;

test("whitespace and punctuation-only Writing input is no attempt at Band 0", () => {
  for (const response of ["", "   \n\t ", "...?! — ‘ ’", "，。！？"]) {
    const decision = decideWritingLowEvidence(response);
    assert.equal(decision.kind, "deterministic_score");
    assert.equal(decision.reason, "no_attempt");
    assert.equal(decision.wordCount, 0);
    assert.equal(decision.output.criteria.taskResponse.band, 0);
    assert.doesNotThrow(() =>
      ieltsWritingModelOutputSchema.parse(decision.output),
    );
  }
});

test("1–20 words receive Band 1 across every criterion", () => {
  for (const response of ["Hello", "one two three", "Một bài viết rất ngắn."]) {
    const decision = decideWritingLowEvidence(response);
    assert.equal(decision.kind, "deterministic_score");
    assert.equal(decision.reason, "one_to_twenty_words");
    for (const criterion of CRITERIA) {
      assert.equal(decision.output.criteria[criterion].band, 1);
      assert.match(decision.output.criteria[criterion].rationale, /EN:/);
      assert.match(decision.output.criteria[criterion].rationale, /VI:/);
    }
    assert.ok(decision.output.overallSummary.length > 0);
    assert.ok(decision.output.vietnameseSummary?.length);
  }
});

test("Unicode and Vietnamese words are counted without counting punctuation", () => {
  assert.equal(countIeltsWritingWords("Xin chào, Việt Nam!"), 4);
  assert.equal(countIeltsWritingWords("café naïve résumé"), 3);
  assert.equal(countIeltsWritingWords("１２３ học tập"), 3);
  assert.equal(countIeltsWritingWords("… — !!!"), 0);
});

test("20 words is Band 1 while 21 words has no deterministic score", () => {
  const twenty = Array.from({ length: 20 }, (_, index) => `w${index}`).join(
    " ",
  );
  const twentyOne = `${twenty} w20`;
  const atBoundary = decideWritingLowEvidence(twenty);
  const overBoundary = decideWritingLowEvidence(twentyOne);

  assert.equal(atBoundary.kind, "deterministic_score");
  assert.equal(atBoundary.wordCount, 20);
  assert.equal(atBoundary.output.criteria.lexicalResource.band, 1);
  assert.equal(overBoundary.kind, "requires_full_assessment");
  assert.equal(overBoundary.wordCount, 21);
  assert.equal(overBoundary.output, null);
});

test("the contract never guesses Bands 2–3 or content classifications", () => {
  for (const response of [
    "twenty one words require a complete assessment and the function must not infer language copying relevance memorization or any band from text",
    "đây là một câu trả lời dài hơn hai mươi từ và cần được đánh giá đầy đủ thay vì tự động đoán band hai hoặc ba",
  ]) {
    const decision = decideWritingLowEvidence(response);
    assert.equal(decision.kind, "requires_full_assessment");
    assert.equal(decision.output, null);
    assert.equal("language" in decision, false);
    assert.equal("copied" in decision, false);
    assert.equal("memorized" in decision, false);
  }
});

test("empty or punctuation-only ASR requests retry/manual review with no band", () => {
  for (const transcript of ["", "  \n ", "...?!"]) {
    const decision = decideSpeakingEvidence(transcript);
    assert.equal(decision.kind, "retry_or_manual_review");
    assert.equal(decision.reason, "empty_asr_is_ambiguous");
    assert.equal(decision.band, null);
    assert.equal(decision.nextAction, "retry_asr_then_manual_review");
  }
});

test("nonempty ASR still receives no direct Speaking band", () => {
  const decision = decideSpeakingEvidence(
    "I enjoy reading because it helps me understand new perspectives.",
  );
  assert.equal(decision.kind, "requires_speaking_assessment");
  assert.equal(decision.transcriptWordCount, 10);
  assert.equal(decision.band, null);
  assert.equal(decision.nextAction, "continue_audio_and_criterion_assessment");
});

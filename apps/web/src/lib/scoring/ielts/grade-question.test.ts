import assert from "node:assert/strict";
import { gradeQuestion } from "./grade-question";
import type { IeltsAnswerKey } from "@/lib/ielts/question-types/types";

// ── multi-blank completion: partial credit, not fully correct ────────────────
{
  const key: IeltsAnswerKey = {
    blanks: {
      "1": { mode: "text", accept: ["photosynthesis"] },
      "2": { mode: "text", accept: ["water"] },
    },
  };
  const verdict = gradeQuestion(
    { wordLimit: 1 },
    key,
    { values: { "1": "photosynthesis", "2": "wrong" } },
  );
  assert.equal(verdict.awardedPoints, 1);
  assert.equal(verdict.maxPoints, 2);
  assert.equal(verdict.isCorrect, false);
  assert.equal(verdict.blanks["1"].correct, true);
  assert.equal(verdict.blanks["2"].correct, false);
}

// ── all blanks correct → isCorrect true ──────────────────────────────────────
{
  const key: IeltsAnswerKey = {
    blanks: {
      a: { mode: "select", accept: ["x"] },
      b: { mode: "multi_select", accept: ["p", "q"], select: 2 },
    },
  };
  const verdict = gradeQuestion(
    { wordLimit: null },
    key,
    { values: { a: "x", b: ["q", "p"] } },
  );
  assert.equal(verdict.awardedPoints, 3);
  assert.equal(verdict.maxPoints, 3);
  assert.equal(verdict.isCorrect, true);
}

// ── missing answers default to wrong ─────────────────────────────────────────
{
  const key: IeltsAnswerKey = { blanks: { "0": { mode: "select", accept: ["a"] } } };
  const verdict = gradeQuestion({ wordLimit: null }, key, { values: {} });
  assert.equal(verdict.awardedPoints, 0);
  assert.equal(verdict.isCorrect, false);
}

// ── degenerate empty key → maxPoints 0, never "correct" ──────────────────────
{
  const verdict = gradeQuestion({ wordLimit: null }, { blanks: {} }, { values: {} });
  assert.equal(verdict.maxPoints, 0);
  assert.equal(verdict.isCorrect, false);
}

console.log("scoring/ielts/grade-question tests passed");

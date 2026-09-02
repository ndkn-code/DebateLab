import assert from "node:assert/strict";
import {
  assignQuestionNumbers,
  countQuestionNumbers,
  formatQuestionRange,
  formatQuestionsHeading,
  resolveNumberSpan,
} from "./numbering";

const q = (id: string, extra: Record<string, unknown> = {}) => ({ id, ...extra });

// formatQuestionRange
assert.equal(formatQuestionRange(7, 7), "7");
assert.equal(formatQuestionRange(21, 22), "21–22");
assert.equal(formatQuestionsHeading(1, 5), "Questions 1–5");
assert.equal(formatQuestionsHeading(7, 7), "Question 7");

// Sequential across parts; numberSpan consumes N numbers and offsets the rest.
const parts = [
  { questions: [q("a"), q("b"), q("c")] },
  { questions: [q("d", { numberSpan: 2 }), q("e"), q("f", { metadata: { numberSpan: 3 } })] },
  { questions: [q("g")] },
];
const numbers = assignQuestionNumbers(parts);
assert.deepEqual(numbers.get("a"), { questionId: "a", start: 1, end: 1, label: "1" });
assert.deepEqual(numbers.get("c"), { questionId: "c", start: 3, end: 3, label: "3" });
assert.deepEqual(numbers.get("d"), { questionId: "d", start: 4, end: 5, label: "4–5" });
assert.deepEqual(numbers.get("e"), { questionId: "e", start: 6, end: 6, label: "6" });
assert.deepEqual(numbers.get("f"), { questionId: "f", start: 7, end: 9, label: "7–9" });
assert.deepEqual(numbers.get("g"), { questionId: "g", start: 10, end: 10, label: "10" });
assert.equal(countQuestionNumbers(parts), 10);

// startAt offsets everything ("21–22" for a two-letter mcq_multi in Section 3).
const late = assignQuestionNumbers([{ questions: [q("x", { numberSpan: 2 }), q("y")] }], 21);
assert.equal(late.get("x")?.label, "21–22");
assert.equal(late.get("y")?.label, "23");

// Span resolution: explicit wins over metadata; junk → 1; duplicates keep first.
assert.equal(resolveNumberSpan({ id: "s", numberSpan: 2, metadata: { numberSpan: 4 } }), 2);
assert.equal(resolveNumberSpan({ id: "s", numberSpan: null, metadata: { numberSpan: 4 } }), 4);
assert.equal(resolveNumberSpan({ id: "s", numberSpan: 0 }), 1);
assert.equal(resolveNumberSpan({ id: "s", metadata: { numberSpan: "two" } }), 1);
assert.equal(resolveNumberSpan({ id: "s" }), 1);
const dup = assignQuestionNumbers([{ questions: [q("a"), q("a"), q("b")] }]);
assert.equal(dup.get("a")?.start, 1);
assert.equal(dup.get("b")?.start, 2);

console.log("numbering.test.ts ok");

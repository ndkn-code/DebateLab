import assert from "node:assert/strict";
import { gradeBlank } from "./grade-blank";
import type { BlankKey } from "@/lib/ielts/question-types/types";

// ── select ───────────────────────────────────────────────────────────────────
const sel: BlankKey = { mode: "select", accept: ["b"] };
assert.deepEqual(gradeBlank(sel, "b", null), { awarded: 1, max: 1, correct: true });
assert.deepEqual(gradeBlank(sel, "a", null), { awarded: 0, max: 1, correct: false });
assert.deepEqual(gradeBlank(sel, "", null), { awarded: 0, max: 1, correct: false });
assert.deepEqual(gradeBlank(sel, undefined, null), { awarded: 0, max: 1, correct: false });
assert.deepEqual(gradeBlank(sel, " b ", null), { awarded: 1, max: 1, correct: true }); // trimmed
// points override
assert.deepEqual(gradeBlank({ mode: "select", accept: ["x"], points: 2 }, "x", null), {
  awarded: 2,
  max: 2,
  correct: true,
});

// ── multi_select ─────────────────────────────────────────────────────────────
const multi: BlankKey = { mode: "multi_select", accept: ["a", "c"], select: 2 };
assert.deepEqual(gradeBlank(multi, ["a", "c"], null), { awarded: 2, max: 2, correct: true });
assert.deepEqual(gradeBlank(multi, ["c", "a"], null), { awarded: 2, max: 2, correct: true }); // order-free
assert.deepEqual(gradeBlank(multi, ["a", "b"], null), { awarded: 1, max: 2, correct: false }); // partial
assert.deepEqual(gradeBlank(multi, ["a"], null), { awarded: 1, max: 2, correct: false });
assert.deepEqual(gradeBlank(multi, ["a", "c", "d"], null), { awarded: 0, max: 2, correct: false }); // over-selection
assert.deepEqual(gradeBlank(multi, ["a", "a", "c"], null), { awarded: 2, max: 2, correct: true }); // dedup
assert.deepEqual(gradeBlank(multi, [], null), { awarded: 0, max: 2, correct: false });
assert.deepEqual(gradeBlank(multi, "a", null), { awarded: 0, max: 2, correct: false }); // wrong shape → []
// select defaults to accept length
assert.deepEqual(gradeBlank({ mode: "multi_select", accept: ["a", "b"] }, ["a", "b"], null), {
  awarded: 2,
  max: 2,
  correct: true,
});

// ── text ─────────────────────────────────────────────────────────────────────
const text: BlankKey = { mode: "text", accept: ["the moon", "moon"] };
assert.deepEqual(gradeBlank(text, "The Moon", null), { awarded: 1, max: 1, correct: true });
assert.deepEqual(gradeBlank(text, "sun", null), { awarded: 0, max: 1, correct: false });
assert.deepEqual(gradeBlank(text, "", null), { awarded: 0, max: 1, correct: false });
assert.deepEqual(gradeBlank(text, ["array"], null), { awarded: 0, max: 1, correct: false }); // wrong shape → ""
// word limit: "the moon" is 2 words; a 1-word limit fails it even though it matches
assert.deepEqual(gradeBlank(text, "the moon", 1), { awarded: 0, max: 1, correct: false });
assert.deepEqual(gradeBlank(text, "moon", 1), { awarded: 1, max: 1, correct: true });
// numeric tolerance
assert.deepEqual(gradeBlank({ mode: "text", accept: ["3.0"] }, "3", null), {
  awarded: 1,
  max: 1,
  correct: true,
});

console.log("scoring/ielts/grade-blank tests passed");

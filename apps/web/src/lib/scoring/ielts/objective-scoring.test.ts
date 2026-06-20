import assert from "node:assert/strict";
import {
  isObjectiveType,
  scoreObjectiveAnswer,
  type IeltsQuestionType,
  type ObjectiveKey,
  type ObjectiveQuestion,
} from "./objective-scoring";

function q(
  question_type: IeltsQuestionType,
  max_points = 1,
  word_limit: number | null = null,
): ObjectiveQuestion {
  return { question_type, max_points, word_limit };
}
function key(correct_answer: unknown, accept_variants: unknown = []): ObjectiveKey {
  return { correct_answer, accept_variants };
}
const score = scoreObjectiveAnswer;

// ---- isObjectiveType -------------------------------------------------------
for (const t of [
  "mcq_single", "mcq_multi", "true_false_notgiven", "yes_no_notgiven",
  "matching_headings", "matching_information", "matching_features",
  "sentence_completion", "summary_completion",
  "note_table_form_flowchart_completion", "short_answer",
  "diagram_label", "map_plan_label",
] as const) {
  assert.equal(isObjectiveType(t), true, `objective: ${t}`);
}
for (const t of [
  "writing_task1_academic", "writing_task2_essay", "speaking_part1",
] as const) {
  assert.equal(isObjectiveType(t), false, `non-objective: ${t}`);
}

// ---- exact choice ----------------------------------------------------------
assert.deepEqual(score(q("mcq_single"), key("b"), { value: "b" }), {
  isCorrect: true, awardedPoints: 1, maxPoints: 1,
});
assert.deepEqual(score(q("mcq_single"), key("b"), "B"), {
  isCorrect: true, awardedPoints: 1, maxPoints: 1,
}); // case-insensitive, bare string envelope
assert.equal(score(q("mcq_single"), key("b"), { value: "c" }).isCorrect, false);
assert.equal(score(q("mcq_single"), key("b"), {}).isCorrect, false); // no response
assert.equal(score(q("mcq_single"), key("a", ["A.", "(a)"]), "(A)").isCorrect, true); // variant
assert.equal(score(q("matching_headings"), key("iii"), "iii").isCorrect, true);
assert.equal(score(q("matching_information"), key("C"), "c").isCorrect, true);
assert.equal(score(q("matching_features"), key("B"), "b").isCorrect, true);
assert.equal(score(q("map_plan_label"), key("F"), "f").isCorrect, true);

// ---- truth value (TFNG / YNNG) --------------------------------------------
assert.equal(score(q("true_false_notgiven"), key("true"), "T").isCorrect, true);
assert.equal(score(q("true_false_notgiven"), key("not_given"), "Not Given").isCorrect, true);
assert.equal(score(q("true_false_notgiven"), key("true"), "yes").isCorrect, false); // yes != true
assert.equal(score(q("yes_no_notgiven"), key("yes"), "Y").isCorrect, true);
assert.equal(score(q("yes_no_notgiven"), key("no"), "no").isCorrect, true);
assert.equal(score(q("yes_no_notgiven"), key("yes"), {}).isCorrect, false); // no response

// ---- text gap (variant-tolerant, word-limit aware) -------------------------
assert.equal(score(q("short_answer"), key("photosynthesis"), " Photosynthesis ").isCorrect, true);
assert.equal(
  score(q("sentence_completion"), key("global warming", ["climate change"]), "Climate Change").isCorrect,
  true,
);
assert.equal(score(q("summary_completion"), key("rivers"), "lakes").isCorrect, false);
assert.equal(score(q("note_table_form_flowchart_completion"), key("12"), "12").isCorrect, true);
assert.equal(score(q("diagram_label"), key("valve"), "valve").isCorrect, true);
assert.equal(score(q("short_answer"), key("x"), "").isCorrect, false); // empty string
assert.equal(score(q("short_answer"), key("x"), { value: "   " }).isCorrect, false); // whitespace only
assert.equal(score(q("short_answer"), key("x"), {}).isCorrect, false); // missing
// "NO MORE THAN TWO WORDS": three words is rejected even if it contains the answer.
assert.equal(
  score(q("sentence_completion", 1, 2), key("two words"), "far too many words").isCorrect,
  false,
);
assert.equal(score(q("sentence_completion", 1, 2), key("two words"), "two words").isCorrect, true);
assert.equal(score(q("short_answer"), key(null), "anything").isCorrect, false); // no key

// ---- multi-choice (per-correct credit, over-selection penalty) -------------
const multi = q("mcq_multi", 2);
assert.deepEqual(score(multi, key(["a", "c"]), { values: ["a", "c"] }), {
  isCorrect: true, awardedPoints: 2, maxPoints: 2,
}); // both correct
assert.deepEqual(score(multi, key(["a", "c"]), ["a", "b"]), {
  isCorrect: false, awardedPoints: 1, maxPoints: 2,
}); // one right, one wrong
assert.deepEqual(score(multi, key(["a", "c"]), ["a", "c", "d"]), {
  isCorrect: false, awardedPoints: 1, maxPoints: 2,
}); // over-selected: 2 hits − 1 over = 1
assert.deepEqual(score(multi, key(["a", "c"]), ["b", "d"]), {
  isCorrect: false, awardedPoints: 0, maxPoints: 2,
}); // none right
assert.deepEqual(score(multi, key([]), ["a"]), {
  isCorrect: false, awardedPoints: 0, maxPoints: 2,
}); // empty key
assert.deepEqual(score(multi, key(["a", "c"]), {}), {
  isCorrect: false, awardedPoints: 0, maxPoints: 2,
}); // no selection

// ---- non-objective + max_points clamping -----------------------------------
assert.deepEqual(score(q("writing_task2_essay"), key("x"), "essay"), {
  isCorrect: false, awardedPoints: 0, maxPoints: 1,
});
assert.equal(score(q("mcq_single", -3), key("a"), "a").maxPoints, 0); // clamp negative
assert.equal(score(q("mcq_single", Number.NaN), key("a"), "a").maxPoints, 0); // clamp NaN
assert.equal(score(q("mcq_single", 2.9), key("a"), "a").awardedPoints, 2); // trunc

console.log("scoring/ielts/objective-scoring tests passed");

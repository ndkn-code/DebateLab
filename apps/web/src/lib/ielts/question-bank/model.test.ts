import assert from "node:assert/strict";
import { normalizeBankFilters, promptExcerpt } from "./model";

assert.deepEqual(normalizeBankFilters({ page: "-2", search: "  map label  ", difficulty: " HARD " }), {
  page: 1,
  search: "map label",
  difficulty: "hard",
  skill: undefined,
  questionType: undefined,
  testId: undefined,
  subskillTag: undefined,
});
assert.equal(normalizeBankFilters({ page: "oops" }).page, 1);
assert.equal(promptExcerpt("  A   short\nquestion  "), "A short question");
assert.equal(promptExcerpt("one two three four", 12), "one two…");

console.log("ielts/question-bank/model.test.ts passed");

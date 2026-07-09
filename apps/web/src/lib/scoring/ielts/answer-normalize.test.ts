import assert from "node:assert/strict";
import {
  extractValue,
  extractValues,
  isAnsweredResponse,
  normalizeBoolean,
  normalizeChoice,
  normalizeText,
  toAnswerStrings,
  wordCount,
} from "./answer-normalize";

// normalizeText: trim, collapse internal whitespace, lowercase.
assert.equal(normalizeText("  Hello   World "), "hello world");
assert.equal(normalizeText("Photosynthesis"), "photosynthesis");
assert.equal(normalizeText("\tA\nB\t"), "a b");

// normalizeChoice: drop everything but [a-z0-9].
assert.equal(normalizeChoice(" B "), "b");
assert.equal(normalizeChoice("iii"), "iii");
assert.equal(normalizeChoice("Not Given"), "notgiven");
assert.equal(normalizeChoice("(A)"), "a");

// normalizeBoolean: synonyms canonicalize; yes/no stay distinct from true/false.
for (const [input, expected] of [
  ["TRUE", "true"], ["t", "true"], ["False", "false"], ["F", "false"],
  ["Yes", "yes"], ["y", "yes"], ["NO", "no"], ["n", "no"],
  ["NG", "notgiven"], ["Not Given", "notgiven"], ["not_given", "notgiven"],
  ["notgiven", "notgiven"],
] as const) {
  assert.equal(normalizeBoolean(input), expected, `normalizeBoolean(${input})`);
}
assert.equal(normalizeBoolean("maybe"), "maybe"); // unknown passthrough
assert.notEqual(normalizeBoolean("yes"), normalizeBoolean("true"));

// extractValue: scalars + common envelopes; array/empty object -> null.
assert.equal(extractValue("b"), "b");
assert.equal(extractValue(3), "3");
assert.equal(extractValue(true), "true");
assert.equal(extractValue({ value: "x" }), "x");
assert.equal(extractValue({ selected: "y" }), "y");
assert.equal(extractValue({ answer: "z" }), "z");
assert.equal(extractValue({ text: "t" }), "t");
assert.equal(extractValue({ value: 7 }), "7");
assert.equal(extractValue(null), null);
assert.equal(extractValue(undefined), null);
assert.equal(extractValue({}), null);
assert.equal(extractValue({ nope: "v" }), null);
assert.equal(extractValue(["a"]), null); // arrays aren't single values

// extractValues: arrays + list envelopes + single fallback.
assert.deepEqual(extractValues(["a", "b"]), ["a", "b"]);
assert.deepEqual(extractValues([1, 2, null, "c"]), ["1", "2", "c"]);
assert.deepEqual(extractValues({ values: ["a", "c"] }), ["a", "c"]);
assert.deepEqual(extractValues({ selected: ["x"] }), ["x"]);
assert.deepEqual(extractValues({ answers: ["m", "n"] }), ["m", "n"]);
assert.deepEqual(extractValues("solo"), ["solo"]);
assert.deepEqual(extractValues({ value: "one" }), ["one"]);
assert.deepEqual(extractValues(null), []);
assert.deepEqual(extractValues({}), []);

// isAnsweredResponse: scalar, IELTS answer envelopes, capture envelopes, blanks.
assert.equal(isAnsweredResponse(" answer "), true);
assert.equal(isAnsweredResponse("   "), false);
assert.equal(isAnsweredResponse({ value: "b" }), true);
assert.equal(isAnsweredResponse({ value: "" }), false);
assert.equal(isAnsweredResponse({ selected: [] }), false);
assert.equal(isAnsweredResponse({ selected: ["a"] }), true);
assert.equal(isAnsweredResponse({ values: { "0": "" } }), false);
assert.equal(isAnsweredResponse({ values: { "0": ["", "c"] } }), true);
assert.equal(isAnsweredResponse({ essay: "  first draft  " }), true);
assert.equal(isAnsweredResponse({ speakingResponseId: null, audioStoragePath: null }), false);
assert.equal(isAnsweredResponse(null), false);
assert.equal(isAnsweredResponse(undefined), false);

// toAnswerStrings: null, scalar, array, nested array, object envelope.
assert.deepEqual(toAnswerStrings(null), []);
assert.deepEqual(toAnswerStrings(undefined), []);
assert.deepEqual(toAnswerStrings("answer"), ["answer"]);
assert.deepEqual(toAnswerStrings(["a", "b"]), ["a", "b"]);
assert.deepEqual(toAnswerStrings([["a"], "b"]), ["a", "b"]);
assert.deepEqual(toAnswerStrings({ value: "v" }), ["v"]);
assert.deepEqual(toAnswerStrings({ 0: "a", 1: "b" }), ["a", "b"]);
assert.deepEqual(toAnswerStrings({ 0: ["Sri Lanka", "sri lanka"] }), [
  "Sri Lanka",
  "sri lanka",
]);
assert.deepEqual(toAnswerStrings({}), []);

// wordCount: empty, single, multiple, padded.
assert.equal(wordCount(""), 0);
assert.equal(wordCount("   "), 0);
assert.equal(wordCount("river"), 1);
assert.equal(wordCount("two words"), 2);
assert.equal(wordCount("  a  b   c "), 3);

console.log("scoring/ielts/answer-normalize tests passed");

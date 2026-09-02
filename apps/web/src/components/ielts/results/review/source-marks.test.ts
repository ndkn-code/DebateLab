import assert from "node:assert/strict";
import {
  buildSourceParagraphs,
  normalizeMarks,
  paragraphRanges,
  sourceMarkId,
} from "./source-marks";

// ---- paragraphRanges ---------------------------------------------------------
assert.deepEqual(paragraphRanges("One.\n\nTwo.\n\n\n  Three.  "), [
  { start: 0, end: 4 },
  { start: 6, end: 10 },
  { start: 15, end: 21 },
]);
// No blank lines → one paragraph per line.
assert.deepEqual(paragraphRanges("A: hi\nB: hello"), [
  { start: 0, end: 5 },
  { start: 6, end: 14 },
]);
assert.deepEqual(paragraphRanges("   \n\n  "), []);

// ---- normalizeMarks ------------------------------------------------------------
// Out-of-range offsets are clamped to the text.
assert.deepEqual(normalizeMarks([{ questionId: "c", start: -3, end: 99 }], 10), [
  { questionId: "c", start: 0, end: 10 },
]);
assert.deepEqual(
  normalizeMarks(
    [
      { questionId: "b", start: 5, end: 8 },
      { questionId: "a", start: 2, end: 6 },
      { questionId: "empty", start: 4, end: 4 },
      { questionId: "inside", start: 3, end: 5 },
    ],
    10,
  ),
  [
    { questionId: "a", start: 2, end: 6 },
    // A mark fully inside an earlier one is dropped; a partial overlap is
    // trimmed to start where the earlier mark ends.
    { questionId: "b", start: 6, end: 8 },
  ],
);

// ---- buildSourceParagraphs -------------------------------------------------------
const text = "The cat sat.\n\nOn the mat, quietly.";
const paragraphs = buildSourceParagraphs(text, [
  { questionId: "q1", start: 4, end: 7 },
  { questionId: "q2", start: 21, end: 24 },
]);
assert.equal(paragraphs.length, 2);
assert.deepEqual(paragraphs[0].segments, [
  { kind: "text", text: "The " },
  { kind: "mark", text: "cat", questionId: "q1", first: true },
  { kind: "text", text: " sat." },
]);
assert.deepEqual(paragraphs[1].segments, [
  { kind: "text", text: "On the " },
  { kind: "mark", text: "mat", questionId: "q2", first: true },
  { kind: "text", text: ", quietly." },
]);
// Re-joining segments reproduces the trimmed paragraph text exactly.
for (const paragraph of paragraphs) {
  assert.equal(
    paragraph.segments.map((s) => s.text).join(""),
    text.slice(paragraph.start, paragraph.end),
  );
}

// A mark spanning a paragraph boundary is split; only the first piece anchors.
const spanning = buildSourceParagraphs("ab\n\ncd", [{ questionId: "x", start: 1, end: 5 }]);
assert.deepEqual(
  spanning.map((p) => p.segments),
  [
    [
      { kind: "text", text: "a" },
      { kind: "mark", text: "b", questionId: "x", first: true },
    ],
    [
      { kind: "mark", text: "c", questionId: "x", first: false },
      { kind: "text", text: "d" },
    ],
  ],
);

// No marks → plain text segments only; markup characters survive untouched.
assert.deepEqual(buildSourceParagraphs("<b>&amp;</b>", []), [
  { start: 0, end: 12, segments: [{ kind: "text", text: "<b>&amp;</b>" }] },
]);

assert.equal(sourceMarkId("q-1"), "ans-q-1");

console.log("ielts/results/review/source-marks tests passed");

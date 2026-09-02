import assert from "node:assert/strict";
import {
  IeltsQuestionMetadataSchema,
  parseQuestionMetadata,
} from "./metadata";

// Non-objects and empty input degrade to {}.
assert.deepEqual(parseQuestionMetadata(null), {});
assert.deepEqual(parseQuestionMetadata("x"), {});
assert.deepEqual(parseQuestionMetadata([1]), {});

// Known fields parse with defaults; unknown keys pass through.
{
  const meta = parseQuestionMetadata({
    slot: "3",
    numberSpan: 2,
    allowNumber: true,
    selectCount: 2,
    cueCard: { topic: "Describe a place", bullets: ["where it is"] },
    letter: { recipient: "a neighbour", register: "semi_formal", bullets: ["why"] },
    subskill_tags: ["listening.form"],
    importId: "abc",
  });
  assert.equal(meta.slot, "3");
  assert.equal(meta.numberSpan, 2);
  assert.equal(meta.allowNumber, true);
  assert.equal(meta.selectCount, 2);
  assert.equal(meta.cueCard?.prepSeconds, 60);
  assert.equal(meta.cueCard?.speakSeconds, 120);
  assert.equal(meta.letter?.register, "semi_formal");
  assert.deepEqual(meta.subskill_tags, ["listening.form"]);
  assert.equal(meta.importId, "abc");
}

// A malformed known field is dropped on its own; the rest survives.
{
  const meta = parseQuestionMetadata({
    slot: 7, // wrong type
    numberSpan: 2,
    cueCard: { topic: "", bullets: [] }, // invalid
    origin: "original",
  });
  assert.equal(meta.slot, undefined);
  assert.equal(meta.numberSpan, 2);
  assert.equal(meta.cueCard, undefined);
  assert.equal(meta.origin, "original");
}

// Strict schema rejects what the tolerant parser drops.
assert.equal(IeltsQuestionMetadataSchema.safeParse({ slot: 7 }).success, false);
assert.equal(IeltsQuestionMetadataSchema.safeParse({ numberSpan: 0 }).success, false);
assert.equal(
  IeltsQuestionMetadataSchema.safeParse({ letter: { recipient: "x", register: "casual", bullets: ["a"] } })
    .success,
  false,
);
assert.equal(IeltsQuestionMetadataSchema.safeParse({ anything: { nested: true } }).success, true);

console.log("metadata.test: ok");

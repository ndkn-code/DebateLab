import assert from "node:assert/strict";
import test from "node:test";
import {
  escapeVocabSearch,
  normalizeStringList,
  normalizeVocabFilters,
  normalizeVocabInput,
  parseStringList,
} from "./model";

test("normalizes filters and clamps invalid pages", () => {
  assert.deepEqual(
    normalizeVocabFilters({
      subject: "other",
      bandTag: " 6.5 ",
      topicTag: " education ",
      search: " climate   change ",
      page: "-4",
    }),
    {
      subject: "all",
      bandTag: "6.5",
      topicTag: "education",
      search: "climate change",
      page: 1,
    },
  );
});

test("normalizes nullable fields and de-duplicates arrays case-insensitively", () => {
  const value = normalizeVocabInput({
    term: "  salient  ",
    subject: "ielts",
    partOfSpeech: " ",
    phonetic: null,
    definitionEn: " important ",
    synonyms: ["notable", " Notable ", ""],
    collocations: [],
    topicTags: ["Writing", "writing"],
    bandTag: " 7.0 ",
    source: "",
  });
  assert.equal(value.term, "salient");
  assert.equal(value.partOfSpeech, null);
  assert.deepEqual(value.synonyms, ["notable"]);
  assert.deepEqual(value.topicTags, ["Writing"]);
  assert.equal(value.bandTag, "7.0");
});

test("parses comma/newline lists and sanitizes PostgREST search syntax", () => {
  assert.deepEqual(parseStringList("climate, policy\nClimate"), [
    "climate",
    "policy",
  ]);
  assert.equal(escapeVocabSearch("50%_(test), ok"), "50 test ok");
  assert.deepEqual(normalizeStringList([" a ", "A", "b"]), ["a", "b"]);
});

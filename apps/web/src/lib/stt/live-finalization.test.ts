import assert from "node:assert/strict";
import test from "node:test";
import {
  appendTranscriptSegment,
  buildFinalizedSpeech,
} from "./live-finalization";

test("uses an interim-only transcript when finalization times out", () => {
  const result = buildFinalizedSpeech({
    finalizedTranscript: "",
    interimTranscript: "This is still an interim result",
    finalizedByProvider: false,
    timedOut: true,
  });
  assert.equal(result.transcript, "This is still an interim result");
  assert.equal(result.status, "interim_fallback");
  assert.equal(result.metadata.timedOut, true);
});

test("joins final segments with the last interim segment", () => {
  const result = buildFinalizedSpeech({
    finalizedTranscript: "First complete segment. Second complete segment.",
    interimTranscript: "Last buffered segment.",
    finalizedByProvider: false,
    timedOut: true,
  });
  assert.equal(
    result.transcript,
    "First complete segment. Second complete segment. Last buffered segment."
  );
  assert.equal(result.status, "interim_fallback");
});

test("provider-finalized transcript does not add a duplicate interim", () => {
  const result = buildFinalizedSpeech({
    finalizedTranscript: "The complete final sentence",
    interimTranscript: "The complete final sentence",
    finalizedByProvider: true,
    timedOut: false,
  });
  assert.equal(result.transcript, "The complete final sentence");
  assert.equal(result.status, "finalized");
});

test("appendTranscriptSegment ignores repeated final messages", () => {
  assert.equal(
    appendTranscriptSegment("A complete segment", "A complete segment"),
    "A complete segment"
  );
});

test("returns no_speech when neither final nor interim text exists", () => {
  const result = buildFinalizedSpeech({
    finalizedTranscript: "",
    interimTranscript: "",
    finalizedByProvider: false,
    timedOut: false,
  });
  assert.equal(result.status, "no_speech");
  assert.equal(result.transcript, "");
});

test("reports timeout when finalized text exists but flush does not respond", () => {
  const result = buildFinalizedSpeech({
    finalizedTranscript: "Already finalized text",
    interimTranscript: "",
    finalizedByProvider: false,
    timedOut: true,
  });
  assert.equal(result.status, "timeout");
});

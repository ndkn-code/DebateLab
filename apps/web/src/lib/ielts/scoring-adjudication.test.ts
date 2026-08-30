import assert from "node:assert/strict";

import {
  adjacentBands,
  createStagedGradingMetadata,
  ieltsSpeakingAdjudicationOutputSchema,
  isIeltsEvidenceAdjudicationEnabled,
  sanitizeLearnerGradingMetadata,
} from "./scoring-adjudication";

const originalFlag = process.env.IELTS_EVIDENCE_ADJUDICATION_ENABLED;
delete process.env.IELTS_EVIDENCE_ADJUDICATION_ENABLED;
assert.equal(isIeltsEvidenceAdjudicationEnabled(), false);
process.env.IELTS_EVIDENCE_ADJUDICATION_ENABLED = "true";
assert.equal(isIeltsEvidenceAdjudicationEnabled(), true);
if (originalFlag === undefined) {
  delete process.env.IELTS_EVIDENCE_ADJUDICATION_ENABLED;
} else {
  process.env.IELTS_EVIDENCE_ADJUDICATION_ENABLED = originalFlag;
}

assert.deepEqual(adjacentBands([6.2, 7.8]), [5.5, 6, 6.5, 7.5, 8, 8.5]);
assert.deepEqual(adjacentBands([0, 9]), [0, 0.5, 8.5, 9]);

const limited = createStagedGradingMetadata({
  evidence: [],
  runId: "run-1",
  provisionalTraceId: "p",
  adjudicationTraceId: "a",
  acousticEvidenceAvailable: false,
  retrievalSkippedReason: "rpc_unavailable",
});
assert.equal(limited.confidence, "limited");
assert.deepEqual(limited.limitations, [
  "no_approved_adjacent_band_evidence",
  "retrieval:rpc_unavailable",
  "pronunciation_acoustic_evidence_unavailable",
]);
assert.equal(limited.runId, "run-1");
assert.deepEqual(
  sanitizeLearnerGradingMetadata({
    ...limited,
    protected_label: { criteria: { pronunciation: 9 } },
  }),
  limited,
);
assert.equal(sanitizeLearnerGradingMetadata({}), null);

const boundaryRationale =
  "LOWER_BOUNDARY: clears 6. UPPER_BOUNDARY: does not clear 7. EVIDENCE: approved example e1.";
const adjudication = {
  criteria: {
    fluencyCoherence: { band: 6.5, rationale: boundaryRationale },
    lexicalResource: { band: 6.5, rationale: boundaryRationale },
    grammaticalRangeAccuracy: { band: 6, rationale: boundaryRationale },
    pronunciation: { band: 6, rationale: boundaryRationale },
  },
  overallSummary: "Boundary-based result.",
  strengths: [],
  improvements: [],
  excerptFeedback: [],
};
assert.equal(
  ieltsSpeakingAdjudicationOutputSchema.safeParse(adjudication).success,
  true,
);
assert.equal(
  ieltsSpeakingAdjudicationOutputSchema.safeParse({
    ...adjudication,
    criteria: {
      ...adjudication.criteria,
      pronunciation: { band: 6, rationale: "Generic rationale only." },
    },
  }).success,
  false,
);

console.log("IELTS scoring adjudication tests passed");

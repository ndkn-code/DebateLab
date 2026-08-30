import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";

import {
  GradingResultDetails,
  gradingPresentationFromResult,
  parseLearnerGradingMetadata,
} from "./GradingResultDetails";

const metadata = {
  runId: "metadata-run-id",
  gradingVersion: "evidence-adjudicated-v1",
  corpusVersion: "12",
  confidence: "limited",
  limitations: [
    "pronunciation_acoustic_evidence_unavailable",
    "retrieval:rpc_unavailable",
  ],
  evidenceReferences: [
    {
      sourceId: "protected-source-id",
      version: "4",
      itemType: "band_descriptor",
      score: 0.91,
      reviewStatus: "approved",
      sourceLocator: "Official rubric, speaking descriptor 6",
      authorityTier: "official",
      rightsStatus: "approved_for_excerpt",
      protectedBenchmarkLabel: "must-not-render",
    },
    {
      version: "5",
      itemType: "private_calibration_example",
      reviewStatus: "candidate",
    },
  ],
  provisionalTraceId: "provider-trace-one",
  adjudicationTraceId: "provider-trace-two",
};

const parsed = parseLearnerGradingMetadata(metadata);
assert.ok(parsed);
assert.equal(parsed.gradingVersion, "evidence-adjudicated-v1");
assert.equal(parsed.evidenceReferences.length, 2);
assert.deepEqual(parsed.evidenceReferences[0], {
  version: "4",
  itemType: "band_descriptor",
  reviewStatus: "approved",
  sourceLocator: "Official rubric, speaking descriptor 6",
  authorityTier: "official",
  rightsStatus: "approved_for_excerpt",
});
assert.equal("sourceId" in parsed.evidenceReferences[0], false);

const withWorkflowId = gradingPresentationFromResult({
  grading_metadata: metadata,
  workflowRunId: "stale-workflow-run-id",
  runId: "ambiguous-top-level-id",
});
assert.equal(withWorkflowId?.retrySafeRunId, "metadata-run-id");

const explicitWorkflowFallback = gradingPresentationFromResult({
  grading_metadata: { ...metadata, runId: undefined },
  workflowRunId: "workflow-run-id",
  runId: "ambiguous-top-level-id",
});
assert.equal(explicitWorkflowFallback?.retrySafeRunId, "workflow-run-id");

const withoutWorkflowId = gradingPresentationFromResult({
  gradingMetadata: { ...metadata, runId: undefined },
  runId: "ambiguous-top-level-id",
});
assert.equal(withoutWorkflowId?.retrySafeRunId, null);
assert.equal(gradingPresentationFromResult({ status: "scored" }), null);
assert.equal(
  parseLearnerGradingMetadata({ ...metadata, confidence: "certain" }),
  null,
);
const oversized = parseLearnerGradingMetadata({
  ...metadata,
  limitations: Array.from({ length: 20 }, (_, index) => `limit-${index}`),
  evidenceReferences: Array.from({ length: 40 }, (_, index) => ({
    version: String(index),
    itemType: "rubric",
    reviewStatus: "approved",
  })),
});
assert.equal(oversized?.limitations.length, 8);
assert.equal(oversized?.evidenceReferences.length, 20);

const markup = renderToStaticMarkup(
  <GradingResultDetails
    criteria={[
      {
        key: "pronunciation",
        label: "Pronunciation",
        band: 6.5,
        rationale: "Generally clear, with occasional strain.",
      },
    ]}
    metadata={parsed}
    retrySafeRunId="retry-safe-run-id"
    status="scored"
  />,
);
assert.match(markup, /Pronunciation confidence is limited/);
assert.match(markup, /retry-safe-run-id/);
assert.match(markup, /Official source/);
assert.match(markup, /Approved excerpt/);
assert.match(markup, /Official rubric, speaking descriptor 6/);
assert.doesNotMatch(markup, /protected-source-id/);
assert.doesNotMatch(markup, /must-not-render/);
assert.doesNotMatch(markup, /provider-trace/);
assert.doesNotMatch(markup, /private_calibration_example/);

const vietnameseMarkup = renderToStaticMarkup(
  <GradingResultDetails
    criteria={[
      {
        key: "pronunciation",
        label: "Phát âm",
        band: null,
        rationale: null,
      },
    ]}
    locale="vi"
    metadata={parsed}
    retrySafeRunId="metadata-run-id"
    status="scoring"
  />,
);
assert.match(vietnameseMarkup, /Rà soát điểm/);
assert.match(vietnameseMarkup, /Đang chấm/);
assert.match(vietnameseMarkup, /Độ tin cậy về phát âm bị giới hạn/);

for (const status of [
  "pending",
  "scoring",
  "scored",
  "overridden",
  "failed",
] as const) {
  const statusMarkup = renderToStaticMarkup(
    <GradingResultDetails
      criteria={[]}
      metadata={parsed}
      retrySafeRunId="metadata-run-id"
      status={status}
    />,
  );
  assert.match(statusMarkup, /Score review/);
}

console.log("IELTS learner grading result details tests passed");

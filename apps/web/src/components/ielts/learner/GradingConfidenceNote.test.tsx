import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";

import {
  GradingConfidenceNote,
  gradingConfidencePresentation,
} from "./GradingConfidenceNote";

const metadata = {
  gradingVersion: "evidence-adjudicated-v1",
  corpusVersion: "2",
  confidence: "limited" as const,
  limitations: [
    "pronunciation_acoustic_evidence_unavailable",
    "retrieval:rpc_unavailable",
    "retrieval:timeout",
  ],
  evidenceReferences: [],
};

assert.deepEqual(gradingConfidencePresentation(metadata, "en").limitations, [
  "Pronunciation confidence is limited because an acoustic analysis was not available.",
  "Some approved scoring references could not be retrieved.",
]);

const markup = renderToStaticMarkup(
  <GradingConfidenceNote metadata={metadata} locale="en" />,
);
assert.match(markup, /Confidence: Limited/);
assert.match(markup, /Pronunciation confidence is limited/);
assert.doesNotMatch(markup, /pronunciation_acoustic_evidence_unavailable/);

const vietnameseMarkup = renderToStaticMarkup(
  <GradingConfidenceNote metadata={metadata} locale="vi" />,
);
assert.match(vietnameseMarkup, /Độ tin cậy: Giới hạn/);
assert.match(vietnameseMarkup, /Độ tin cậy về phát âm bị giới hạn/);

console.log("IELTS grading confidence note tests passed");

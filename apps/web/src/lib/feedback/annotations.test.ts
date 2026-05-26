import assert from "node:assert/strict";
import {
  locateTranscriptAnnotations,
  normalizeTranscriptAnnotations,
} from "@/lib/feedback/annotations";

const normalized = normalizeTranscriptAnnotations([
  {
    quote: "Cảm ơn đội bạn.",
    speaker: "ai",
    tag: "clash",
    severity: "improvement",
    feedback: "Needs a better answer.",
    suggestion: "Answer the actual clash.",
  },
  {
    quote: "Cảm ơn đội bạn đã có những luận điểm rất rõ ràng.",
    speaker: "ai",
    tag: "clash",
    severity: "improvement",
    feedback: "Needs a better answer.",
    suggestion: "Anchor this on an actual clash.",
  },
  {
    quote: "Kính thưa ban giám khảo và quý vị khán giả.",
    speaker: "user",
    tag: "stance",
    severity: "strength",
    feedback: "Opening etiquette is not a substantive argument.",
    suggestion: "Quote the claim after the greeting instead.",
  },
  {
    quote:
      "Hello Vậy là rồi điều màn hình là không ghi âm được Đối mặt với một cái lý độc hại",
    speaker: "user",
    tag: "claim",
    severity: "strength",
    feedback: "Anchors the burden.",
    suggestion: "Remove the noisy opening words.",
  },
  {
    quote: "AI chủ động ở đây quét siêu dữ liệu",
    speaker: "user",
    tag: "claim",
    severity: "improvement",
    feedback: "This is the real mechanism clash.",
    suggestion: "Add thresholds and safeguards.",
  },
  {
    quote: "AI chủ động ở đây quét siêu dữ liệu",
    speaker: "user",
    tag: "logic",
    severity: "improvement",
    feedback: "Duplicate should be removed.",
    suggestion: "Duplicate should be removed.",
  },
]);

assert.equal(normalized.length, 1);
assert.equal(normalized[0].quote, "AI chủ động ở đây quét siêu dữ liệu");
assert.equal(normalized[0].tag, "stance");

assert.equal(
  locateTranscriptAnnotations("Kính thưa ban giám khảo và quý vị khán giả.", [
    {
      quote: "Kính thưa ban giám khảo và quý vị khán giả.",
      speaker: "user",
      tag: "stance",
      severity: "strength",
      feedback: "Opening etiquette is not a substantive argument.",
      suggestion: "Quote the claim after the greeting instead.",
    },
  ]).length,
  0
);

console.log("Transcript annotation normalization tests passed");

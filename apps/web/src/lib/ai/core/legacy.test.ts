import assert from "node:assert/strict";
import { DebateFeedbackEnvelopeSchema } from "./legacy";

const base = {
  content: { score: 10, claimClarity: 2, evidenceSupport: 2, logicCoherence: 3, counterArgument: 3 },
  structure: { score: 8, introduction: 2, bodyOrganization: 3, conclusion: 3 },
  language: { score: 8, vocabulary: 3, grammar: 3, fluency: 2 },
  persuasion: { score: 3, audienceAwareness: 1, impactfulness: 2 },
  totalScore: 29,
  overallBand: "Novice",
  summary: "A specific summary.",
  strengths: ["One strength"],
  improvements: ["One improvement"],
  sampleArguments: ["One example"],
};

assert.equal(DebateFeedbackEnvelopeSchema.safeParse(base).success, false);
assert.equal(DebateFeedbackEnvelopeSchema.safeParse({
  ...base,
  detailedFeedback: {
    contentFeedback: "Specific content feedback.",
    structureFeedback: "Specific structure feedback.",
    languageFeedback: "Specific language feedback.",
    persuasionFeedback: "Specific persuasion feedback.",
  },
}).success, true);

console.log("core legacy feedback schema passed");

import assert from "node:assert/strict";

import { buildAnalysisPrompt } from "@/lib/prompts";
import { englishDebateInput } from "@/lib/practice-analysis/__fixtures__/english-debate";
import {
  buildEnglishDebateKnowledgeQuery,
  createEnglishDebateKnowledgeMetadata,
  formatEnglishDebateKnowledgeContext,
  retrieveEnglishDebateKnowledge,
  retrievePracticeDebateKnowledge,
  shouldUseEnglishDebateKnowledge,
  summarizeEnglishDebateKnowledge,
} from "./english-debate";
import type { KnowledgeResult } from "./contracts";

const result = (context: string, sourceId: string): KnowledgeResult => ({
  collection: "debate",
  context,
  evidence: [
    {
      sourceId,
      version: "7",
      itemType: "adjudication_pattern",
      highlight: "Approved debate pattern",
      score: 0.9,
      reviewStatus: "approved",
      authorityTier: "qualified_adjudicator",
      rightsStatus: "approved_for_derived_use",
      usableFor: ["grading", "coaching"],
    },
  ],
  data: null,
  cacheKey: null,
  cacheHit: false,
  latencyMs: 2,
});

assert.equal(
  shouldUseEnglishDebateKnowledge({ language: "en", practiceTrack: "debate" }),
  true,
);
assert.equal(
  shouldUseEnglishDebateKnowledge({ language: "vi", practiceTrack: "debate" }),
  false,
);
assert.equal(
  shouldUseEnglishDebateKnowledge({
    language: "en",
    practiceTrack: "speaking",
  }),
  false,
);

const query = buildEnglishDebateKnowledgeQuery({
  purpose: "grading",
  topic: "This House would ban phones in schools",
  side: "proposition",
  format: "WSDC opening",
  transcript:
    "Phones disrupt attention because students receive notifications.",
  roundsText: ["The opposition says phones help safety."],
});
assert.match(query, /Motion:/);
assert.match(query, /Recent round context/);

const englishPrompt = buildAnalysisPrompt(englishDebateInput);
assert.match(englishPrompt, /English competitive-debate practice/);
assert.doesNotMatch(englishPrompt, /Debate Format: Trường Teen-style/);
const vietnamesePrompt = buildAnalysisPrompt({
  ...englishDebateInput,
  practiceLanguage: "vi",
});
assert.match(
  vietnamesePrompt,
  /Debate Format: Trường Teen-style practice round/,
);

const formatted = formatEnglishDebateKnowledgeContext({
  patterns: result("[pattern-1] Mechanism and impact", "pattern-1"),
  rebuttalAndWeighing: result(
    "[rebuttal-1] Compare educational harms",
    "rebuttal-1",
  ),
});
assert.match(formatted.contextBlock, /Retrieved English Debate Calibration/);
assert.equal(formatted.evidence.length, 2);
assert.deepEqual(formatted.provenance.versions, ["7"]);
assert.deepEqual(summarizeEnglishDebateKnowledge(formatted), {
  enabled: true,
  retrievedCount: 2,
  candidateCount: 2,
  skippedReason: undefined,
  topScore: 0.9,
  relevanceGatePassed: true,
});
assert.deepEqual(createEnglishDebateKnowledgeMetadata(formatted), {
  corpusRagEnabled: true,
  corpusRagSkippedReason: undefined,
  corpusRetrievalLogId: null,
  corpusRetrievalLatencyMs: null,
  retrievedCorpusItemIds: ["pattern-1", "rebuttal-1"],
  retrievedCorpusCount: 2,
  candidateCorpusItemIds: ["pattern-1", "rebuttal-1"],
  candidateCorpusCount: 2,
  corpusRagTopSimilarity: 0.9,
  corpusRagAvgTop3Similarity: null,
  corpusRagItemsAboveThresholdCount: 2,
  corpusRagRelevanceGatePassed: true,
  corpusRagRelevanceThresholds: null,
  corpusRetrievalCacheHit: false,
  corpusRetrievalCacheKey: null,
  knowledgeCollection: "debate.en.competitive",
  knowledgeCorpusVersions: ["7"],
  knowledgeEvidence: formatted.evidence,
});

void (async () => {
  const calls: string[] = [];
  const retrieved = await retrieveEnglishDebateKnowledge(
    {
      purpose: "grading",
      language: "en",
      practiceTrack: "debate",
      topic: "Motion",
      transcript: "Student speech",
      sourceRoute: "english-debate-test",
    },
    {
      findPatterns: async () => {
        calls.push("patterns");
        return result("Pattern", "pattern");
      },
      findRebuttalAndWeighing: async () => {
        calls.push("rebuttal");
        return result("Rebuttal", "rebuttal");
      },
    },
  );
  assert.deepEqual(new Set(calls), new Set(["patterns", "rebuttal"]));
  assert.equal(retrieved?.provenance.collection, "debate.en.competitive");

  const vietnamese = await retrieveEnglishDebateKnowledge(
    {
      purpose: "grading",
      language: "vi",
      practiceTrack: "debate",
      topic: "Motion",
      transcript: "Bài nói",
      sourceRoute: "english-debate-test",
    },
    {
      findPatterns: async () => {
        throw new Error("Vietnamese must not call English retrieval");
      },
      findRebuttalAndWeighing: async () => {
        throw new Error("Vietnamese must not call English retrieval");
      },
    },
  );
  assert.equal(vietnamese, null);

  const englishSelection = await retrievePracticeDebateKnowledge(
    {
      purpose: "grading",
      language: "en",
      practiceTrack: "debate",
      topic: "Motion",
      transcript: "Student speech",
      sourceRoute: "english-debate-test",
    },
    async () => {
      throw new Error("English must not use Vietnamese legacy retrieval");
    },
    async () => formatted,
  );
  assert.equal(englishSelection.kind, "english");

  let legacyCalls = 0;
  const vietnameseSelection = await retrievePracticeDebateKnowledge(
    {
      purpose: "grading",
      language: "vi",
      practiceTrack: "debate",
      topic: "Motion",
      transcript: "Bài nói",
      sourceRoute: "english-debate-test",
    },
    async () => {
      legacyCalls += 1;
      return "legacy-truong-teen";
    },
    async () => null,
  );
  assert.equal(vietnameseSelection.kind, "legacy");
  assert.equal(vietnameseSelection.knowledge, "legacy-truong-teen");
  assert.equal(legacyCalls, 1);
})();

console.log("English debate knowledge adapter tests passed.");

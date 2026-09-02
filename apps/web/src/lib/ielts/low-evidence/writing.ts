import { z } from "zod";

import {
  ieltsWritingModelOutputSchema,
  type IeltsWritingModelOutput,
} from "@/lib/scoring/ielts-writing/result-schema";

export const IELTS_WRITING_LOW_EVIDENCE_RULE_VERSION =
  "official-writing-band-descriptors-2023-low-evidence" as const;

const summarySchema = z
  .object({
    en: z.string().min(1).max(1_000),
    vi: z.string().min(1).max(1_000),
  })
  .strict();

const deterministicWritingDecisionSchema = z
  .object({
    kind: z.literal("deterministic_score"),
    reason: z.enum(["no_attempt", "one_to_twenty_words"]),
    ruleVersion: z.literal(IELTS_WRITING_LOW_EVIDENCE_RULE_VERSION),
    wordCount: z.number().int().min(0).max(20),
    output: ieltsWritingModelOutputSchema,
    summary: summarySchema,
  })
  .strict();

const fullAssessmentWritingDecisionSchema = z
  .object({
    kind: z.literal("requires_full_assessment"),
    reason: z.literal("more_than_twenty_words"),
    ruleVersion: z.literal(IELTS_WRITING_LOW_EVIDENCE_RULE_VERSION),
    wordCount: z.number().int().min(21),
    output: z.null(),
    summary: summarySchema,
  })
  .strict();

export const writingLowEvidenceDecisionSchema = z.discriminatedUnion("kind", [
  deterministicWritingDecisionSchema,
  fullAssessmentWritingDecisionSchema,
]);

export type WritingLowEvidenceDecision = z.infer<
  typeof writingLowEvidenceDecisionSchema
>;

/**
 * Counts Unicode lexical tokens while ignoring whitespace and punctuation-only
 * input. Vietnamese syllables separated by spaces count as separate words.
 */
export function countIeltsWritingWords(value: string): number {
  const normalized = value.normalize("NFKC").trim();
  if (!normalized) return 0;
  const segmenter = new Intl.Segmenter("und", { granularity: "word" });
  return [...segmenter.segment(normalized)].filter(
    (segment) => segment.isWordLike,
  ).length;
}

function criterionRationale(band: 0 | 1) {
  if (band === 0) {
    return "EN: No assessable response was submitted, so the 2023 descriptor rule assigns Band 0. VI: Không có câu trả lời có thể đánh giá, vì vậy quy tắc mô tả năm 2023 xếp Band 0.";
  }
  return "EN: The response contains 1–20 words, so the 2023 descriptor rule assigns Band 1 for this criterion. VI: Câu trả lời có từ 1–20 từ, vì vậy quy tắc mô tả năm 2023 xếp Band 1 cho tiêu chí này.";
}

function deterministicOutput(params: {
  band: 0 | 1;
  summary: { en: string; vi: string };
}): IeltsWritingModelOutput {
  const score = {
    band: params.band,
    rationale: criterionRationale(params.band),
  };
  return ieltsWritingModelOutputSchema.parse({
    criteria: {
      taskResponse: score,
      coherenceCohesion: score,
      lexicalResource: score,
      grammaticalRangeAccuracy: score,
    },
    overallSummary: params.summary.en,
    inlineCorrections: [],
    paragraphFeedback: [],
    modelAnswer:
      "No model answer is generated for this deterministic low-evidence result.",
    vietnameseSummary: params.summary.vi,
  });
}

/**
 * Applies only the explicit 2023 low-evidence rule. It does not estimate Bands
 * 2–3 or classify language, memorization, copying, relevance, or quality.
 */
export function decideWritingLowEvidence(
  response: string,
): WritingLowEvidenceDecision {
  const wordCount = countIeltsWritingWords(response);
  if (wordCount === 0) {
    const summary = {
      en: "No assessable response was submitted. This deterministic practice result is Band 0 across all four Writing criteria.",
      vi: "Không có câu trả lời có thể đánh giá. Kết quả luyện tập xác định này là Band 0 cho cả bốn tiêu chí Writing.",
    };
    return writingLowEvidenceDecisionSchema.parse({
      kind: "deterministic_score",
      reason: "no_attempt",
      ruleVersion: IELTS_WRITING_LOW_EVIDENCE_RULE_VERSION,
      wordCount,
      output: deterministicOutput({ band: 0, summary }),
      summary,
    });
  }
  if (wordCount <= 20) {
    const summary = {
      en: `The response contains ${wordCount} ${wordCount === 1 ? "word" : "words"}. Under the 2023 low-evidence rule, this deterministic practice result is Band 1 across all four Writing criteria.`,
      vi: `Câu trả lời có ${wordCount} từ. Theo quy tắc về bài làm có ít bằng chứng năm 2023, kết quả luyện tập xác định này là Band 1 cho cả bốn tiêu chí Writing.`,
    };
    return writingLowEvidenceDecisionSchema.parse({
      kind: "deterministic_score",
      reason: "one_to_twenty_words",
      ruleVersion: IELTS_WRITING_LOW_EVIDENCE_RULE_VERSION,
      wordCount,
      output: deterministicOutput({ band: 1, summary }),
      summary,
    });
  }
  return writingLowEvidenceDecisionSchema.parse({
    kind: "requires_full_assessment",
    reason: "more_than_twenty_words",
    ruleVersion: IELTS_WRITING_LOW_EVIDENCE_RULE_VERSION,
    wordCount,
    output: null,
    summary: {
      en: "The response has more than 20 words. No deterministic low-evidence band applies; it requires full criterion-based assessment.",
      vi: "Câu trả lời có hơn 20 từ. Không áp dụng band xác định theo quy tắc ít bằng chứng; bài cần được đánh giá đầy đủ theo từng tiêu chí.",
    },
  });
}

import { z } from "zod";

import { countIeltsWritingWords } from "./writing";

const summarySchema = z
  .object({
    en: z.string().min(1).max(1_000),
    vi: z.string().min(1).max(1_000),
  })
  .strict();

export const speakingEvidenceDecisionSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("retry_or_manual_review"),
      reason: z.literal("empty_asr_is_ambiguous"),
      transcriptWordCount: z.literal(0),
      band: z.null(),
      nextAction: z.literal("retry_asr_then_manual_review"),
      summary: summarySchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("requires_speaking_assessment"),
      reason: z.literal("transcript_has_lexical_evidence"),
      transcriptWordCount: z.number().int().positive(),
      band: z.null(),
      nextAction: z.literal("continue_audio_and_criterion_assessment"),
      summary: summarySchema,
    })
    .strict(),
]);

export type SpeakingEvidenceDecision = z.infer<
  typeof speakingEvidenceDecisionSchema
>;

/** Empty ASR is a capture/transcription ambiguity and can never become a band. */
export function decideSpeakingEvidence(
  asrTranscript: string,
): SpeakingEvidenceDecision {
  const transcriptWordCount = countIeltsWritingWords(asrTranscript);
  if (transcriptWordCount === 0) {
    return speakingEvidenceDecisionSchema.parse({
      kind: "retry_or_manual_review",
      reason: "empty_asr_is_ambiguous",
      transcriptWordCount,
      band: null,
      nextAction: "retry_asr_then_manual_review",
      summary: {
        en: "The transcript contains no lexical evidence. This may be an ASR or audio-capture failure, so no Speaking band is assigned; retry transcription, then request manual review if it remains empty.",
        vi: "Bản chép lời không có dữ liệu từ vựng. Đây có thể là lỗi nhận dạng giọng nói hoặc thu âm, nên không xếp band Speaking; hãy thử chép lời lại rồi chuyển sang kiểm tra thủ công nếu vẫn trống.",
      },
    });
  }
  return speakingEvidenceDecisionSchema.parse({
    kind: "requires_speaking_assessment",
    reason: "transcript_has_lexical_evidence",
    transcriptWordCount,
    band: null,
    nextAction: "continue_audio_and_criterion_assessment",
    summary: {
      en: "The transcript contains lexical evidence, but text alone cannot determine a Speaking band. Continue with audio and criterion-based assessment.",
      vi: "Bản chép lời có dữ liệu từ vựng, nhưng chỉ văn bản không thể xác định band Speaking. Hãy tiếp tục đánh giá dựa trên âm thanh và từng tiêu chí.",
    },
  });
}

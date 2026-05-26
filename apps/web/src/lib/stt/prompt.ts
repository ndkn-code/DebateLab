import type { PracticeTranscriptionArtifact } from "@thinkfy/shared/practice";

export function createTranscriptionQualityMetadata(
  transcription: PracticeTranscriptionArtifact | null | undefined
) {
  if (!transcription) return null;
  const selectedAlternative = transcription.alternatives?.find(
    (alternative) => alternative.selected
  );
  const shadowAlternative = transcription.alternatives?.find(
    (alternative) => alternative.provider === "groq" && !alternative.selected
  );
  return {
    provider: transcription.provider,
    model: transcription.model,
    confidence: transcription.confidence,
    wordCount: transcription.wordCount,
    warnings: transcription.warnings,
    sttSelectedProvider: selectedAlternative?.provider ?? transcription.provider,
    sttShadowProvider: shadowAlternative?.provider ?? null,
    sttShadowRejectedReason:
      shadowAlternative?.qualityFlags?.[0] ??
      shadowAlternative?.errorCode ??
      null,
    selectedRequestId: transcription.requestId,
    audioStoragePath: transcription.audioStoragePath,
    normalizationHints: transcription.normalizationHints ?? [],
    alternativeProviders:
      transcription.alternatives?.map((alternative) => ({
        provider: alternative.provider,
        model: alternative.model,
        selected: alternative.selected,
        confidence: alternative.confidence,
        requestId: alternative.requestId,
        errorCode: alternative.errorCode,
        qualityFlags: alternative.qualityFlags ?? [],
        wordCount: alternative.transcript
          .trim()
          .split(/\s+/)
          .filter(Boolean).length,
      })) ?? [],
  };
}

export function buildSttJudgeGuardrailBlock(
  transcription: PracticeTranscriptionArtifact | null | undefined
) {
  if (!transcription) return "";
  const hints = (transcription.normalizationHints ?? [])
    .slice(0, 10)
    .map((hint) => `- "${hint.raw}" may mean "${hint.normalized}" (${hint.reason})`)
    .join("\n");
  const warnings = transcription.warnings.length
    ? transcription.warnings.join(", ")
    : "none";

  return `\n## Speech-To-Text Quality Context
This transcript may include automatic speech-to-text artifacts. The selected transcript provider is ${transcription.provider} (${transcription.model}). Warnings: ${warnings}.
${hints ? `Possible normalized STT hints:\n${hints}` : ""}

Judging rules for STT uncertainty:
- Do not penalize the Language score for likely ASR spelling artifacts, code-switched English acronyms, or proper nouns when the intended debate meaning is recoverable from context.
- Do not claim the student mispronounced a word unless pronunciation/audio evidence is explicitly available. In this text-only analysis, call it a transcript clarity issue or possible STT artifact instead.
- When quoting annotations, quote the selected transcript exactly. If a normalized hint affected the quote, keep the quote short and focus feedback on argument clarity, mechanism, weighing, or structure rather than pronunciation.
- If a claim remains impossible to understand even after these hints, you may penalize clarity, but state that the transcript may be uncertain.`;
}

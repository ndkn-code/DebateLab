/**
 * Pure helpers for the Speaking task surface — covered by speaking-guidance.test.ts.
 */
import {
  DEFAULT_CUE_CARD_PREP_SECONDS,
  DEFAULT_CUE_CARD_SPEAK_SECONDS,
  type IeltsCueCard,
} from "@/lib/ielts/question-types/metadata";

/** i18n key (under `ielts.player`) for the per-part guidance line. */
export function speakingGuidanceKey(questionType: string): string {
  if (questionType === "speaking_part1") return "speaking.part1Hint";
  if (questionType === "speaking_part2_cuecard") return "speaking.part2Hint";
  if (questionType === "speaking_part3") return "speaking.part3Hint";
  return "speaking.intro";
}

export function isCueCardQuestionType(questionType: string): boolean {
  return questionType === "speaking_part2_cuecard";
}

/** `m:ss` for a countdown / elapsed display (never negative, no NaN). */
export function formatCountdown(totalSeconds: number): string {
  const safe = Number.isFinite(totalSeconds)
    ? Math.max(0, Math.floor(totalSeconds))
    : 0;
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/** 0–100 elapsed fraction for a progress bar (clamped; 0 when untimed). */
export function elapsedPercent(currentSeconds: number, totalSeconds: number): number {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return 0;
  if (!Number.isFinite(currentSeconds)) return 0;
  return Math.max(0, Math.min(100, (currentSeconds / totalSeconds) * 100));
}

export interface CueCardTiming {
  isCueCard: boolean;
  cueCard: IeltsCueCard | null;
  prepSeconds: number;
  speakSeconds: number;
}

/** Part 2 timing from the authored card, with exam defaults when it is missing. */
export function cueCardTiming(question: {
  questionType: string;
  cueCard: IeltsCueCard | null;
}): CueCardTiming {
  const isCueCard = isCueCardQuestionType(question.questionType);
  const cueCard = isCueCard ? question.cueCard : null;
  return {
    isCueCard,
    cueCard,
    prepSeconds: cueCard?.prepSeconds ?? DEFAULT_CUE_CARD_PREP_SECONDS,
    speakSeconds: cueCard?.speakSeconds ?? DEFAULT_CUE_CARD_SPEAK_SECONDS,
  };
}

/** The bits of renderer context the Speaking surface cares about. */
export function speakingCaptureContext(
  context: { attemptId: string; assessmentMode: string } | undefined,
): { attemptId: string | null; isSimulation: boolean } {
  return {
    attemptId: context?.attemptId ?? null,
    isSimulation: context?.assessmentMode === "simulation",
  };
}

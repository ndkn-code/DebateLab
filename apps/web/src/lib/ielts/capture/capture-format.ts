/**
 * Pure helpers for the in-mock Writing/Speaking capture surfaces (WS-5.2).
 *
 * The renderers persist a small draft envelope through the player's response map
 * (so essays + the in-flight scoring id survive part/section navigation), poll
 * the async scorers, and present the returned band/criteria/feedback. Keeping the
 * parsing + formatting here makes it framework-free and unit-tested; the React
 * components stay thin.
 */
import type { Json } from "@/types/supabase";

/** IELTS word count = whitespace-separated tokens (mirrors `countEssayWords`). */
export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Recommended minimum essay length per writing task type (exam guidance). */
const WRITING_RECOMMENDED_MIN_WORDS: Record<string, number> = {
  writing_task1_academic: 150,
  writing_task1_general: 150,
  writing_task2_essay: 250,
};

export function recommendedMinWords(questionType: string): number {
  return WRITING_RECOMMENDED_MIN_WORDS[questionType] ?? 150;
}

/** A response whose AI marking has settled (band + feedback are present). */
export function isScoredStatus(status: string): boolean {
  return status === "scored" || status === "overridden";
}

/** A response still moving through the async scorer (keep polling). */
export function isPendingStatus(status: string): boolean {
  return status === "pending" || status === "scoring";
}

/** Display a 0–9 band to one decimal, or an em dash when not yet scored. */
export function formatBand(band: number | null): string {
  return band === null ? "—" : band.toFixed(1);
}

function asRecord(value: Json): Record<string, Json> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, Json>)
    : null;
}

/**
 * Pull the overall examiner summary from a Writing `criteria_feedback` /
 * Speaking `feedback` envelope, preferring the Vietnamese summary for `vi`.
 */
export function extractFeedbackSummary(
  feedback: Json,
  locale: string,
): string | null {
  const record = asRecord(feedback);
  if (!record) return null;
  if (locale === "vi") {
    const vi = record.vietnameseSummary;
    if (typeof vi === "string" && vi.trim()) return vi.trim();
  }
  const summary = record.summary;
  return typeof summary === "string" && summary.trim() ? summary.trim() : null;
}

/** Whether a persisted `phoneme_report` carries real Azure assessment detail. */
export function hasPhonemeDetail(report: Json): boolean {
  return asRecord(report)?.status === "scored";
}

/** Draft envelope persisted for a Writing task in the player response map. */
export interface WritingCaptureValue {
  essay: string;
  writingResponseId: string | null;
}

export function parseWritingCaptureValue(value: unknown): WritingCaptureValue {
  const record =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  return {
    essay: typeof record.essay === "string" ? record.essay : "",
    writingResponseId:
      typeof record.writingResponseId === "string"
        ? record.writingResponseId
        : null,
  };
}

/** Draft envelope persisted for a Speaking task in the player response map. */
export interface SpeakingCaptureValue {
  speakingResponseId: string | null;
  audioStoragePath: string | null;
}

export function parseSpeakingCaptureValue(value: unknown): SpeakingCaptureValue {
  const record =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  return {
    speakingResponseId:
      typeof record.speakingResponseId === "string"
        ? record.speakingResponseId
        : null,
    audioStoragePath:
      typeof record.audioStoragePath === "string"
        ? record.audioStoragePath
        : null,
  };
}

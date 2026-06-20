/**
 * Contract between the Speaking scorer (WS-3.2) and the phoneme analyzer
 * (WS-3.3). WS-3.3 writes the typed `speaking_responses.phoneme_report` jsonb
 * (Azure Speech Pronunciation Assessment: accuracy / fluency / completeness /
 * prosody + per-word/per-phoneme detail). This module extracts the compact
 * signal the Pronunciation criterion consumes, so WS-3.2 can be built + merged
 * BEFORE WS-3.3: when the report is the empty default (`{}`) this returns null
 * and Pronunciation is judged from the transcript/audio alone; once WS-3.3 fills
 * it, the same Pronunciation band reflects the phoneme evidence. Pure + tested.
 */
import type { Json } from "@/types/supabase";

/** Compact pronunciation signal the scorer prompt consumes (the WS-3.3 seam). */
export interface SpeakingPronunciationSignal {
  /** Azure overall pronunciation score (0-100), when available. */
  pronunciationScore: number | null;
  accuracyScore: number | null;
  fluencyScore: number | null;
  completenessScore: number | null;
  prosodyScore: number | null;
  /** Words the phoneme analysis flagged as mispronounced/omitted. */
  mispronouncedWords: string[];
}

const MAX_FLAGGED_WORDS = 25;

function asRecord(value: Json | null | undefined): Record<string, Json> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, Json>)
    : null;
}

function asScore(value: Json | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Words array entry → flagged word string, if the entry signals an error. */
function flaggedWord(entry: Json): string | null {
  const record = asRecord(entry);
  if (!record) return null;
  const word = typeof record.word === "string" ? record.word.trim() : "";
  if (!word) return null;
  const errorType =
    typeof record.errorType === "string" ? record.errorType : null;
  const accuracy = asScore(record.accuracyScore);
  const hasError =
    (errorType != null && errorType !== "None") ||
    (accuracy != null && accuracy < 60);
  return hasError ? word : null;
}

function collectMispronouncedWords(report: Record<string, Json>): string[] {
  const words = report.words;
  if (!Array.isArray(words)) return [];
  const flagged: string[] = [];
  for (const entry of words) {
    const word = flaggedWord(entry);
    if (word) flagged.push(word);
    if (flagged.length >= MAX_FLAGGED_WORDS) break;
  }
  return flagged;
}

/**
 * Extract the pronunciation signal from a `phoneme_report` jsonb. Returns null
 * when there is no usable signal (empty default, or shape we don't recognize),
 * so the scorer falls back to transcript-only Pronunciation judgement.
 */
export function extractPronunciationSignal(
  phonemeReport: Json | null | undefined,
): SpeakingPronunciationSignal | null {
  const report = asRecord(phonemeReport);
  if (!report) return null;

  const signal: SpeakingPronunciationSignal = {
    pronunciationScore: asScore(report.pronunciationScore),
    accuracyScore: asScore(report.accuracyScore),
    fluencyScore: asScore(report.fluencyScore),
    completenessScore: asScore(report.completenessScore),
    prosodyScore: asScore(report.prosodyScore),
    mispronouncedWords: collectMispronouncedWords(report),
  };

  const hasAnyScore =
    signal.pronunciationScore != null ||
    signal.accuracyScore != null ||
    signal.fluencyScore != null ||
    signal.completenessScore != null ||
    signal.prosodyScore != null;

  return hasAnyScore || signal.mispronouncedWords.length > 0 ? signal : null;
}

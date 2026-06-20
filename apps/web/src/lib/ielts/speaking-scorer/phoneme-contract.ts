/**
 * Contract between the Speaking scorer (WS-3.2) and the phoneme analyzer
 * (WS-3.3). WS-3.3 OWNS the typed `speaking_responses.phoneme_report` shape
 * (Azure Speech Pronunciation Assessment: overall accuracy / fluency /
 * completeness / prosody + composite PronScore, plus per-word/per-phoneme
 * detail). This module reads that canonical report (via WS-3.3's
 * `parsePhonemeReport`) and extracts the compact signal the Pronunciation
 * criterion consumes.
 *
 * WS-3.2 can run BEFORE WS-3.3 (or before Azure creds exist): the report is then
 * the empty default and this returns null, so Pronunciation is judged from the
 * transcript alone; once WS-3.3 fills it, the same Pronunciation band reflects
 * the phoneme evidence. Pure + tested.
 */
import type { Json } from "@/types/supabase";
import {
  isScoredPhonemeReport,
  parsePhonemeReport,
  type PhonemeReport,
  type WordScore,
} from "@/lib/scoring/ielts-pronunciation/phoneme-report";

/** Compact pronunciation signal the scorer prompt consumes (the WS-3.3 seam). */
export interface SpeakingPronunciationSignal {
  /** Azure composite pronunciation score (0-100). */
  pronunciationScore: number | null;
  accuracyScore: number | null;
  fluencyScore: number | null;
  completenessScore: number | null;
  prosodyScore: number | null;
  /** Words the phoneme analysis flagged as mispronounced/omitted. */
  mispronouncedWords: string[];
}

const MAX_FLAGGED_WORDS = 25;
const WORD_ACCURACY_FLOOR = 60;

/** A word is "flagged" when Azure marks an error or its accuracy is low. */
function collectMispronouncedWords(words: WordScore[]): string[] {
  const flagged: string[] = [];
  for (const entry of words) {
    const word = entry.word.trim();
    if (!word) continue;
    const hasError =
      (entry.errorType !== "" && entry.errorType !== "None") ||
      entry.accuracy < WORD_ACCURACY_FLOOR;
    if (hasError) flagged.push(word);
    if (flagged.length >= MAX_FLAGGED_WORDS) break;
  }
  return flagged;
}

/**
 * Extract the pronunciation signal from a stored `phoneme_report` jsonb (or an
 * already-parsed report). Returns null when the report carries no real
 * assessment (the empty default, or any unrecognized payload), so the scorer
 * falls back to transcript-only Pronunciation judgement.
 */
export function extractPronunciationSignal(
  phonemeReport: Json | PhonemeReport | null | undefined,
): SpeakingPronunciationSignal | null {
  const report = parsePhonemeReport(phonemeReport);
  if (!isScoredPhonemeReport(report) || !report.overall) return null;
  return {
    pronunciationScore: report.overall.pronunciation,
    accuracyScore: report.overall.accuracy,
    fluencyScore: report.overall.fluency,
    completenessScore: report.overall.completeness,
    prosodyScore: report.overall.prosody,
    mispronouncedWords: collectMispronouncedWords(report.words),
  };
}

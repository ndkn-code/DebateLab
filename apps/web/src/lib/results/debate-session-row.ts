import {
  DEFAULT_PRACTICE_LANGUAGE,
  coercePracticeLanguage,
} from "@/lib/practice-language";
import type { DebateSession } from "@/types";

export const FULL_SESSION_SELECT =
  "id, created_at, topic_id, practice_topic_key, topic_title, topic_category, topic_category_key, topic_difficulty, side, practice_track, practice_language, mode, prep_time, speech_time, transcript, feedback, duration_seconds, prep_notes, ai_difficulty, rounds";
export const BASE_SESSION_SELECT =
  "id, created_at, topic_title, topic_category, topic_difficulty, side, mode, prep_time, speech_time, transcript, feedback, duration_seconds";

export function isSessionSchemaCompatibilityError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String(error.code) : "";
  const message = "message" in error ? String(error.message) : "";
  return (
    code === "42703" ||
    code === "PGRST204" ||
    message.includes("Could not find") ||
    message.includes("schema cache") ||
    message.includes("column")
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToDebateSession(row: any): DebateSession {
  return {
    id: row.id,
    date: row.created_at,
    topic: {
      id: row.practice_topic_key ?? row.topic_id ?? row.id,
      topicKey: row.practice_topic_key ?? row.topic_id ?? row.id,
      categoryKey: row.topic_category_key,
      title: row.topic_title,
      category: row.topic_category,
      difficulty: row.topic_difficulty ?? "intermediate",
    },
    side: row.side,
    practiceTrack:
      row.practice_track ??
      row.practiceTrack ??
      row.feedback?.practiceTrack ??
      "debate",
    practiceLanguage: coercePracticeLanguage(
      row.practice_language ?? row.practiceLanguage ?? row.feedback?.practiceLanguage,
      DEFAULT_PRACTICE_LANGUAGE
    ),
    mode: row.mode,
    prepTime: row.prep_time,
    speechTime: row.speech_time,
    transcript: row.transcript,
    feedback: row.feedback,
    duration: row.duration_seconds,
    prepNotes: row.prep_notes,
    aiDifficulty: row.ai_difficulty,
    rounds: row.rounds,
  };
}

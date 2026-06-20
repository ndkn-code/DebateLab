/**
 * Identifiers + plumbing constants for the IELTS Speaking scorer (WS-3.2).
 *
 * The scorer reuses the repo's async machinery — Vercel Queue + the
 * practice-analysis retry-guard — but is fully isolated from the debate
 * `practice_attempts`/`analysis_jobs` substrate: the job lifecycle lives on the
 * typed `speaking_responses` row (its `status` + `updated_at`), so debate stays
 * byte-identical and IELTS bands land in typed columns (masterplan §2.7, §7).
 * Mirrors the Writing scorer constants.
 */

/** Versioned prompt-bundle identity (bumped when the rubric/prompt changes). */
export const IELTS_SPEAKING_SCORER_BUNDLE_KEY = "ielts_speaking_scorer";
export const IELTS_SPEAKING_SCORER_BUNDLE_VERSION = 1;

/** Vercel Queue topic for async Speaking scoring (separate from debate). */
export const IELTS_SPEAKING_ANALYSIS_QUEUE_TOPIC = "ielts-speaking-analysis";

/** Telemetry tags for `ai_provider_requests`. */
export const IELTS_SPEAKING_SCORE_SOURCE_ROUTE = "/api/queues/ielts-speaking";
export const IELTS_SPEAKING_SCORE_OUTPUT_TYPE = "ielts_speaking_score";

/**
 * Storage bucket the candidate's uploaded audio lives in. Reuses the existing
 * practice-audio bucket (IELTS speaking audio is namespaced by path); the STT
 * layer downloads from here by `audio_storage_path`.
 */
export const IELTS_SPEAKING_AUDIO_BUCKET = "practice-audio" as const;

/**
 * A `speaking_responses` row stuck in `scoring` longer than this (no
 * `updated_at` progress) is treated as a crashed worker and reclaimed on
 * redelivery. STT + scoring can run longer than Writing, hence the wider window.
 */
export const IELTS_SPEAKING_STALE_SCORING_MS = 5 * 60 * 1000;

/** Max scoring deliveries before a response is failed terminally. */
export const IELTS_SPEAKING_MAX_ATTEMPTS = 3;

/** Queue message for one Speaking-response scoring job. */
export interface IeltsSpeakingQueueMessage {
  speakingResponseId: string;
  userId: string;
  /** Audio duration (seconds), when the recorder reported it — informs fluency. */
  durationSeconds?: number;
}

/** Per-response idempotency key (dedupes enqueues across bundle versions). */
export function createIeltsSpeakingIdempotencyKey(
  speakingResponseId: string,
): string {
  return `ielts-speaking:${speakingResponseId}:v${IELTS_SPEAKING_SCORER_BUNDLE_VERSION}`;
}

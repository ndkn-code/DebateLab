/**
 * Identifiers + plumbing constants for the IELTS Writing scorer (WS-3.1).
 *
 * The scorer reuses the repo's async machinery — Vercel Queue + the
 * practice-analysis retry-guard — but is fully isolated from the debate
 * `practice_attempts`/`analysis_jobs` substrate: the job lifecycle lives on the
 * typed `writing_responses` row (its `status` + `updated_at`), so debate stays
 * byte-identical and IELTS bands land in typed columns (masterplan §2.7, §7).
 */

/** Versioned prompt-bundle identity (bumped when the rubric/prompt changes). */
export const IELTS_WRITING_SCORER_BUNDLE_KEY = "ielts_writing_scorer";
export const IELTS_WRITING_SCORER_BUNDLE_VERSION = 1;

/** Vercel Queue topic for async Writing scoring (separate from debate). */
export const IELTS_WRITING_ANALYSIS_QUEUE_TOPIC = "ielts-writing-analysis";

/** Telemetry tags for `ai_provider_requests`. */
export const IELTS_WRITING_SCORE_SOURCE_ROUTE = "/api/queues/ielts-writing";
export const IELTS_WRITING_SCORE_OUTPUT_TYPE = "ielts_writing_score";

/**
 * A `writing_responses` row stuck in `scoring` longer than this (no `updated_at`
 * progress) is treated as a crashed worker and reclaimed on redelivery.
 */
export const IELTS_WRITING_STALE_SCORING_MS = 3 * 60 * 1000;

/** Max scoring deliveries before a response is failed terminally. */
export const IELTS_WRITING_MAX_ATTEMPTS = 3;

/** Queue message for one Writing-response scoring job. */
export interface IeltsWritingQueueMessage {
  writingResponseId: string;
  userId: string;
}

/** Per-response idempotency key (dedupes enqueues across bundle versions). */
export function createIeltsWritingIdempotencyKey(writingResponseId: string): string {
  return `ielts-writing:${writingResponseId}:v${IELTS_WRITING_SCORER_BUNDLE_VERSION}`;
}

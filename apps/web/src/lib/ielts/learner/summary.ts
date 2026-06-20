/**
 * Pure attempt-summary helpers for the IELTS learner shell (WS-5.1).
 *
 * The learner home shows a learner's recent sittings with their bands. The DB
 * read (lib/api/ielts/learner-repository.ts) fetches the raw rows under RLS;
 * this module stitches attempts ↔ their test ↔ their band score and shapes a
 * serialisable, view-ready summary. No DB or React here, so it is unit-tested
 * in isolation.
 */
import type { Database, Tables } from "@/types/supabase";

type IeltsModule = Database["public"]["Enums"]["ielts_module"];
type IeltsAttemptStatus = Database["public"]["Enums"]["ielts_attempt_status"];

export type AttemptRow = Pick<
  Tables<"ielts_attempts">,
  "id" | "test_id" | "module" | "status" | "attempt_number" | "started_at" | "submitted_at"
>;
export type AttemptTestRow = Pick<Tables<"ielts_tests">, "id" | "title" | "slug">;
export type AttemptBandRow = Pick<
  Tables<"attempt_band_scores">,
  | "attempt_id"
  | "overall_band"
  | "listening_band"
  | "reading_band"
  | "writing_band"
  | "speaking_band"
>;

export interface IeltsSkillBands {
  listening: number | null;
  reading: number | null;
  writing: number | null;
  speaking: number | null;
}

export interface IeltsAttemptSummary {
  attemptId: string;
  testId: string;
  testTitle: string;
  testSlug: string;
  module: IeltsModule;
  status: IeltsAttemptStatus;
  attemptNumber: number;
  startedAt: string;
  submittedAt: string | null;
  overallBand: number | null;
  skillBands: IeltsSkillBands;
  resultsHref: string;
}

/** Render a band as the canonical one-decimal IELTS string ("6.5"), or an em dash. */
export function formatBand(band: number | null | undefined): string {
  return band === null || band === undefined ? "—" : band.toFixed(1);
}

/** True once the sitting is over (so its review/bands are meaningful to show). */
export function isAttemptComplete(status: IeltsAttemptStatus): boolean {
  return status !== "in_progress";
}

function skillBands(band: AttemptBandRow | undefined): IeltsSkillBands {
  return {
    listening: band?.listening_band ?? null,
    reading: band?.reading_band ?? null,
    writing: band?.writing_band ?? null,
    speaking: band?.speaking_band ?? null,
  };
}

function toAttemptSummary(
  attempt: AttemptRow,
  testById: Map<string, AttemptTestRow>,
  bandByAttempt: Map<string, AttemptBandRow>,
): IeltsAttemptSummary {
  const test = testById.get(attempt.test_id);
  const band = bandByAttempt.get(attempt.id);
  return {
    attemptId: attempt.id,
    testId: attempt.test_id,
    testTitle: test?.title ?? "IELTS mock",
    testSlug: test?.slug ?? "",
    module: attempt.module,
    status: attempt.status,
    attemptNumber: attempt.attempt_number,
    startedAt: attempt.started_at,
    submittedAt: attempt.submitted_at,
    overallBand: band?.overall_band ?? null,
    skillBands: skillBands(band),
    resultsHref: `/ielts/attempts/${attempt.id}/results`,
  };
}

/**
 * Stitch attempts with their test + band rows into view-ready summaries, newest
 * sitting first (by start time, then attempt number).
 */
export function summarizeAttempts(
  attempts: AttemptRow[],
  tests: AttemptTestRow[],
  bands: AttemptBandRow[],
): IeltsAttemptSummary[] {
  const testById = new Map(tests.map((test) => [test.id, test]));
  const bandByAttempt = new Map(bands.map((band) => [band.attempt_id, band]));
  return attempts
    .map((attempt) => toAttemptSummary(attempt, testById, bandByAttempt))
    .sort((a, b) => {
      if (a.startedAt !== b.startedAt) return a.startedAt < b.startedAt ? 1 : -1;
      return b.attemptNumber - a.attemptNumber;
    });
}

/** The most recent completed attempt's overall band, for the home headline. */
export function latestOverallBand(summaries: IeltsAttemptSummary[]): number | null {
  for (const summary of summaries) {
    if (isAttemptComplete(summary.status) && summary.overallBand !== null) {
      return summary.overallBand;
    }
  }
  return null;
}

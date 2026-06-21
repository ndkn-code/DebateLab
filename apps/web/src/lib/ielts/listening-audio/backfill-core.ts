/**
 * Aggregate Listening-audio backfill orchestration (WS-1.3 / Wave 6.3 C1).
 *
 * Given the sections that need audio and a per-section generator, run each and
 * classify the outcome. Per-section faults are CAPTURED, never rethrown, so one
 * bad section can't abort the batch — the summary tells the admin exactly what
 * generated, what is queued on missing credentials, and what failed.
 *
 * Pure (all IO injected via `deps`) so the classification + aggregation is unit
 * tested without a database, storage, or a TTS provider.
 */
import type { GenerateListeningAudioResult } from "./generate";

export type BackfillOutcome = "generated" | "skipped" | "queued" | "failed";

export interface BackfillSectionResult {
  sectionId: string;
  outcome: BackfillOutcome;
  /** Providers blocking synthesis when `queued`. */
  missingProviders: string[];
  /** Error message when `failed`. */
  error?: string;
}

export interface BackfillSummary {
  total: number;
  generated: number;
  skipped: number;
  queued: number;
  failed: number;
  /** Distinct providers blocking any queued section (e.g. `["google"]`). */
  missingProviders: string[];
  sections: BackfillSectionResult[];
}

export interface BackfillTarget {
  id: string;
}

export interface BackfillDeps {
  /** Sections to (re)generate, in order. */
  sections: readonly BackfillTarget[];
  /** Generate one section; resolves with its result or rejects on a real fault. */
  generate: (sectionId: string) => Promise<GenerateListeningAudioResult>;
  /** Treat a rejection as a queue (missing creds) rather than a failure. */
  isQueueError?: (error: unknown) => boolean;
}

/** Map a successful generator result to a backfill outcome. */
function classify(result: GenerateListeningAudioResult): BackfillOutcome {
  if (result.queued) return "queued";
  if (result.skipped) return "skipped";
  if (result.status === "ready") return "generated";
  // pending/generating without the queue flag means it didn't reach ready.
  return "failed";
}

/**
 * Run the backfill over the injected sections, capturing each outcome. Never
 * throws for a per-section problem: a rejection is recorded as `queued` (when
 * `isQueueError` matches a missing-credentials fault) or `failed` otherwise.
 */
export async function runListeningAudioBackfill(
  deps: BackfillDeps,
): Promise<BackfillSummary> {
  const isQueueError = deps.isQueueError ?? (() => false);
  const sections: BackfillSectionResult[] = [];

  for (const target of deps.sections) {
    try {
      const result = await deps.generate(target.id);
      sections.push({
        sectionId: target.id,
        outcome: classify(result),
        missingProviders: result.missingProviders ?? [],
      });
    } catch (error) {
      sections.push({
        sectionId: target.id,
        outcome: isQueueError(error) ? "queued" : "failed",
        missingProviders: [],
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const tally = (outcome: BackfillOutcome): number =>
    sections.filter((s) => s.outcome === outcome).length;

  return {
    total: sections.length,
    generated: tally("generated"),
    skipped: tally("skipped"),
    queued: tally("queued"),
    failed: tally("failed"),
    missingProviders: [...new Set(sections.flatMap((s) => s.missingProviders))],
    sections,
  };
}

/**
 * Backfill audio for existing Listening sections (WS-1.3 / Wave 6.3 C1).
 *
 * Server-only wrapper that wires the real section selector + per-section
 * generator into the pure {@link runListeningAudioBackfill} orchestrator. Used
 * by the admin "generate all missing audio" action and any one-off backfill of
 * already-authored sections (e.g. the demo mock, whose sections shipped
 * script-only). Synthesis + storage run under the service-role client.
 */
import "server-only";
import { createTypedAdminClient } from "@/lib/supabase/admin";
import type { IeltsDbClient } from "@/lib/api/ielts/client";
import { listSectionsNeedingAudio } from "@/lib/api/ielts/audio-repository";
import { generateListeningSectionAudio } from "./generate";
import { isMissingProviderConfigError } from "./provider-availability";
import { runListeningAudioBackfill, type BackfillSummary } from "./backfill-core";
import type { TurnSynthesizer } from "./synthesize";

export interface BackfillListeningAudioOptions {
  /** Limit to one test; omit/null to backfill every test's sections. */
  testId?: string | null;
  /** Regenerate even sections that already have ready audio. */
  force?: boolean;
  /** Service-role client; defaults to {@link createTypedAdminClient}. */
  client?: IeltsDbClient;
  /** Per-turn synthesizer; defaults to the real TTS layer. */
  synth?: TurnSynthesizer;
}

/**
 * Backfill audio for every Listening section that needs it — no linked asset, or
 * one that is not yet `ready` — scoped to one test or all tests. Idempotent
 * (unchanged ready sections are skipped) and resilient: per-section faults are
 * captured into the summary, and sections needing an unconfigured provider are
 * queued, so the batch never throws for those cases.
 */
export async function backfillListeningSectionAudio(
  options: BackfillListeningAudioOptions = {},
): Promise<BackfillSummary> {
  const admin = options.client ?? createTypedAdminClient();
  const targets = await listSectionsNeedingAudio(options.testId ?? null, admin, {
    includeReady: options.force ?? false,
  });

  return runListeningAudioBackfill({
    sections: targets.map((target) => ({ id: target.id })),
    generate: (sectionId) =>
      generateListeningSectionAudio(sectionId, {
        client: admin,
        synth: options.synth,
        force: options.force,
      }),
    isQueueError: isMissingProviderConfigError,
  });
}

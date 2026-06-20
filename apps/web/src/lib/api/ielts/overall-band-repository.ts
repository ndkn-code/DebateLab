import "server-only";

import { createTypedAdminClient } from "@/lib/supabase/admin";
import { computeOverallBand } from "@/lib/scoring/ielts/overall-band";

/**
 * Recompute and persist the cross-skill `attempt_band_scores.overall_band`
 * (WS-2.2 — the results layer owns the overall, per the note in
 * band-scores-repository.ts). Reads the four per-skill bands already written by
 * the objective grader (R/L) and the Writing/Speaking scorers (W/S), then writes
 * the official §6 overall (mean of the four, half-band rounded — provisional
 * while some skills are still null).
 *
 * Idempotent: any skill-scoring path (objective grade, Writing recompute,
 * Speaking recompute) calls this after writing its own band, so the persisted
 * overall always reflects every skill landed so far. Service-role — the same
 * server-authoritative model as the other attempt/score writers.
 */
type TypedAdminClient = ReturnType<typeof createTypedAdminClient>;

export async function recomputeAttemptOverallBand(
  admin: TypedAdminClient,
  attemptId: string,
  userId: string,
): Promise<number | null> {
  const { data: row, error: readError } = await admin
    .from("attempt_band_scores")
    .select("listening_band, reading_band, writing_band, speaking_band")
    .eq("attempt_id", attemptId)
    .maybeSingle();
  if (readError) {
    throw new Error(`recomputeAttemptOverallBand(read): ${readError.message}`);
  }

  const { band } = computeOverallBand({
    listening: row?.listening_band ?? null,
    reading: row?.reading_band ?? null,
    writing: row?.writing_band ?? null,
    speaking: row?.speaking_band ?? null,
  });

  const now = new Date().toISOString();
  const { error } = await admin.from("attempt_band_scores").upsert(
    {
      attempt_id: attemptId,
      user_id: userId,
      overall_band: band,
      computed_at: now,
      updated_at: now,
    },
    { onConflict: "attempt_id" },
  );
  if (error) {
    throw new Error(`recomputeAttemptOverallBand(write): ${error.message}`);
  }
  return band;
}

import "server-only";

import { createTypedAdminClient } from "@/lib/supabase/admin";
import { writingOverallBand } from "@/lib/scoring/ielts-writing/band-math";

/**
 * Roll a scored attempt's Task 1 + Task 2 bands into the per-attempt
 * `attempt_band_scores.writing_band` (WS-3.1) using the official Task-2-weighted
 * overall. Only the `writing_band` is written here; the other skill bands and
 * the cross-skill `overall_band` are owned by the results layer (WS-2.2).
 */
type TypedAdminClient = ReturnType<typeof createTypedAdminClient>;

export async function recomputeAttemptWritingBand(
  admin: TypedAdminClient,
  attemptId: string,
  userId: string,
): Promise<number | null> {
  const { data: rows } = await admin
    .from("writing_responses")
    .select("task_number, task_band")
    .eq("attempt_id", attemptId)
    .in("status", ["scored", "overridden"]);

  const task1Band =
    rows?.find((row) => row.task_number === 1)?.task_band ?? null;
  const task2Band =
    rows?.find((row) => row.task_number === 2)?.task_band ?? null;

  const writingBand = writingOverallBand({ task1Band, task2Band });
  if (writingBand == null) return null;

  const now = new Date().toISOString();
  const { error } = await admin
    .from("attempt_band_scores")
    .upsert(
      {
        attempt_id: attemptId,
        user_id: userId,
        writing_band: writingBand,
        updated_at: now,
      },
      { onConflict: "attempt_id" },
    );
  if (error) {
    throw new Error(`recomputeAttemptWritingBand failed: ${error.message}`);
  }
  return writingBand;
}

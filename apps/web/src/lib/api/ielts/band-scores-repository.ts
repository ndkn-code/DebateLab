import "server-only";

import { createTypedAdminClient } from "@/lib/supabase/admin";
import { writingOverallBand } from "@/lib/scoring/ielts-writing/band-math";
import { attemptSpeakingBand } from "@/lib/scoring/ielts-speaking/band-math";
import { recomputeAttemptOverallBand } from "./overall-band-repository";
import { recomputeEffectiveAttemptScores } from "./teacher-review-repository";
import {
  evaluateSimulationCompletion,
  resolveRequiredWritingCompletion,
} from "@/lib/ielts/simulation-completion";

/**
 * Roll a scored attempt's Task 1 + Task 2 bands into the per-attempt
 * `attempt_band_scores.writing_band` (WS-3.1) using the official Task-2-weighted
 * overall. Only the `writing_band` is written here; the other skill bands and
 * the cross-skill `overall_band` are owned by the results layer (WS-2.2).
 */
type TypedAdminClient = ReturnType<typeof createTypedAdminClient>;

type SimulationBandRow = {
  listening_band: number | null;
  reading_band: number | null;
  writing_band: number | null;
  speaking_band: number | null;
  overall_band: number | null;
};

function isSimulationComplete(
  bands: SimulationBandRow | null,
  writingRequired: boolean,
  requiredWritingReady: boolean,
  effectiveWritingBand: number | null,
): boolean {
  return evaluateSimulationCompletion({
    listeningBand: bands?.listening_band ?? null,
    readingBand: bands?.reading_band ?? null,
    writingBand: requiredWritingReady ? effectiveWritingBand : null,
    writingRequired,
    speakingBand: bands?.speaking_band ?? null,
    overallBand: bands?.overall_band ?? null,
  }).attemptComplete;
}

/** Mark a submitted simulation complete once R/L and required Writing exist. */
export async function completeSimulationAttemptIfReady(
  admin: TypedAdminClient,
  attemptId: string,
): Promise<boolean> {
  const [
    { data: attempt, error: attemptError },
    { data: bands, error: bandError },
  ] = await Promise.all([
    admin
      .from("ielts_attempts")
      .select("status, assessment_mode")
      .eq("id", attemptId)
      .maybeSingle(),
    admin
      .from("attempt_band_scores")
      .select(
        "listening_band, reading_band, writing_band, speaking_band, overall_band",
      )
      .eq("attempt_id", attemptId)
      .maybeSingle(),
  ]);
  if (attemptError)
    throw new Error(
      `completeSimulationAttemptIfReady(attempt): ${attemptError.message}`,
    );
  if (bandError)
    throw new Error(
      `completeSimulationAttemptIfReady(bands): ${bandError.message}`,
    );
  if (
    !attempt ||
    attempt.assessment_mode !== "simulation" ||
    (attempt.status !== "submitted" && attempt.status !== "scoring")
  ) {
    return false;
  }

  const { data: blueprints, error: blueprintError } = await admin
    .from("ielts_attempt_question_blueprints")
    .select("question_id")
    .eq("attempt_id", attemptId)
    .eq("skill", "writing");
  if (blueprintError) {
    throw new Error(
      `completeSimulationAttemptIfReady(blueprints): ${blueprintError.message}`,
    );
  }
  const requiredWritingQuestionIds = (blueprints ?? []).map(
    (row) => row.question_id,
  );
  const writingRequired = requiredWritingQuestionIds.length > 0;
  let requiredWritingReady = !writingRequired;
  let effectiveWritingBand = writingRequired
    ? null
    : (bands?.writing_band ?? null);

  if (writingRequired) {
    const { data: responses, error: responseError } = await admin
      .from("writing_responses")
      .select("id, question_id, task_number, revision, status, task_band")
      .eq("attempt_id", attemptId)
      .in("question_id", requiredWritingQuestionIds);
    if (responseError) {
      throw new Error(
        `completeSimulationAttemptIfReady(responses): ${responseError.message}`,
      );
    }
    const responseIds = (responses ?? []).map((row) => row.id);
    let publishedReviews: Array<{
      writing_response_id: string | null;
      revision: number;
      task_band: number | null;
    }> = [];
    if (responseIds.length > 0) {
      const { data: reviews, error: reviewError } = await admin
        .from("ielts_teacher_reviews")
        .select("writing_response_id, revision, task_band")
        .eq("attempt_id", attemptId)
        .eq("review_kind", "writing")
        .eq("status", "published")
        .in("writing_response_id", responseIds);
      if (reviewError) {
        throw new Error(
          `completeSimulationAttemptIfReady(reviews): ${reviewError.message}`,
        );
      }
      publishedReviews = reviews ?? [];
    }

    const completion = resolveRequiredWritingCompletion({
      requiredQuestionIds: requiredWritingQuestionIds,
      responses: (responses ?? []).map((row) => ({
        id: row.id,
        questionId: row.question_id,
        taskNumber: row.task_number,
        revision: row.revision,
        status: row.status,
        taskBand: row.task_band,
      })),
      publishedReviews: publishedReviews.flatMap((review) =>
        review.writing_response_id
          ? [
              {
                writingResponseId: review.writing_response_id,
                revision: review.revision,
                taskBand: review.task_band,
              },
            ]
          : [],
      ),
    });
    requiredWritingReady = completion.ready;
    effectiveWritingBand = completion.writingBand;
  }

  if (
    !isSimulationComplete(
      bands,
      writingRequired,
      requiredWritingReady,
      effectiveWritingBand,
    )
  ) {
    return false;
  }

  const now = new Date().toISOString();
  const { error } = await admin
    .from("ielts_attempts")
    .update({ status: "completed", completed_at: now, updated_at: now })
    .eq("id", attemptId)
    .in("status", ["submitted", "scoring"]);
  if (error)
    throw new Error(
      `completeSimulationAttemptIfReady(update): ${error.message}`,
    );
  return true;
}

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
  const { error } = await admin.from("attempt_band_scores").upsert(
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

  // Fold the new Writing band into the cross-skill overall (WS-2.2).
  await recomputeAttemptOverallBand(admin, attemptId, userId);
  // Refresh the teacher/LMS projection when AI scoring completes after a
  // partial review. Complete published teacher bands remain authoritative;
  // only missing AI portions change.
  await recomputeEffectiveAttemptScores(admin, attemptId);
  await completeSimulationAttemptIfReady(admin, attemptId);
  return writingBand;
}

/**
 * Roll a scored attempt's per-part Speaking bands into the per-attempt
 * `attempt_band_scores.speaking_band` (WS-3.2) — the mean of the scored parts,
 * half-band rounded (a full Speaking test spans Parts 1/2/3). Only the
 * `speaking_band` is written here; cross-skill `overall_band` is owned by the
 * results layer (WS-2.2).
 */
export async function recomputeAttemptSpeakingBand(
  admin: TypedAdminClient,
  attemptId: string,
  userId: string,
): Promise<number | null> {
  const { data: rows } = await admin
    .from("speaking_responses")
    .select("speaking_band")
    .eq("attempt_id", attemptId)
    .in("status", ["scored", "overridden"]);

  const partBands = (rows ?? [])
    .map((row) => row.speaking_band)
    .filter((band): band is number => band != null);

  const speakingBand = attemptSpeakingBand(partBands);
  if (speakingBand == null) return null;

  const now = new Date().toISOString();
  const { error } = await admin.from("attempt_band_scores").upsert(
    {
      attempt_id: attemptId,
      user_id: userId,
      speaking_band: speakingBand,
      updated_at: now,
    },
    { onConflict: "attempt_id" },
  );
  if (error) {
    throw new Error(`recomputeAttemptSpeakingBand failed: ${error.message}`);
  }

  // Fold the new Speaking band into the cross-skill overall (WS-2.2) — mirrors
  // the Writing path so finishing Speaking keeps the stored overall_band current.
  await recomputeAttemptOverallBand(admin, attemptId, userId);
  await recomputeEffectiveAttemptScores(admin, attemptId);
  return speakingBand;
}

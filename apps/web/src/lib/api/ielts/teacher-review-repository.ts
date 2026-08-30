import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { computeOverallBand } from "@/lib/scoring/ielts/overall-band";
import { attemptSpeakingBand } from "@/lib/scoring/ielts-speaking/band-math";
import { writingOverallBand } from "@/lib/scoring/ielts-writing/band-math";
import {
  isHalfBand,
  type TeacherBands,
  type TeacherReviewKind,
  type TeacherReviewStatus,
} from "@/lib/ielts/teacher/rubric";

export type TeacherReviewDbClient = SupabaseClient;

export interface TeacherReviewInput {
  clubId: string;
  classId: string;
  attemptId: string;
  writingResponseId?: string;
  speakingResponseId?: string;
  expectedRevision: number;
  bands: TeacherBands;
  reviewerNote?: string | null;
}

export interface TeacherReviewRow {
  id: string;
  attempt_id: string;
  user_id: string;
  club_id: string;
  class_id: string;
  assignment_id: string | null;
  writing_response_id: string | null;
  speaking_response_id: string | null;
  review_kind: TeacherReviewKind;
  rubric_key: string;
  rubric_version: number;
  revision: number;
  status: TeacherReviewStatus;
  task_number: number | null;
  part_number: number | null;
  task_response_band: number | null;
  coherence_cohesion_band: number | null;
  lexical_resource_band: number | null;
  grammar_band: number | null;
  fluency_coherence_band: number | null;
  pronunciation_band: number | null;
  task_band: number | null;
  skill_band: number | null;
  reviewer_id: string;
  reviewer_note: string | null;
  returned_note: string | null;
  revision_granted: number | null;
  revision_consumed_at: string | null;
  published_at: string | null;
  returned_at: string | null;
  created_at: string;
  updated_at: string;
}

function asDb(client: unknown): TeacherReviewDbClient {
  return client as TeacherReviewDbClient;
}

export function validateReviewBands(bands: TeacherBands): void {
  for (const [key, value] of Object.entries(bands)) {
    if (value !== null && value !== undefined && !isHalfBand(value)) {
      throw new Error(`${key} must be an IELTS half-band between 0 and 9`);
    }
  }
}

function eventPayload(review: Record<string, unknown>) {
  return {
    reviewKind: review.review_kind,
    revision: review.revision,
    taskNumber: review.task_number,
    partNumber: review.part_number,
    bands: {
      taskResponse: review.task_response_band,
      coherenceCohesion: review.coherence_cohesion_band,
      lexicalResource: review.lexical_resource_band,
      grammaticalRangeAccuracy: review.grammar_band,
      fluencyCoherence: review.fluency_coherence_band,
      pronunciation: review.pronunciation_band,
      task: review.task_band,
      skill: review.skill_band,
    },
  };
}

function scalarReviewBands(bands: TeacherBands) {
  return {
    p_task_response: bands.taskResponse ?? bands.taskAchievement ?? null,
    p_coherence_cohesion: bands.coherenceCohesion ?? null,
    p_lexical_resource: bands.lexicalResource ?? null,
    p_grammar: bands.grammaticalRangeAccuracy ?? null,
    p_fluency_coherence: bands.fluencyCoherence ?? null,
    p_pronunciation: bands.pronunciation ?? null,
  };
}

export async function appendTeacherReviewEvent(
  client: unknown,
  params: {
    review: TeacherReviewRow | Record<string, unknown>;
    actorId: string;
    eventType: "created" | "updated" | "published" | "returned" | "revision_submitted";
    fromStatus?: TeacherReviewStatus | null;
    toStatus?: TeacherReviewStatus | null;
  },
): Promise<void> {
  const review = params.review as Record<string, unknown>;
  const { error } = await asDb(client).from("ielts_teacher_review_events").insert({
    review_id: review.id,
    attempt_id: review.attempt_id,
    actor_id: params.actorId,
    event_type: params.eventType,
    from_status: params.fromStatus ?? null,
    to_status: params.toStatus ?? null,
    revision: review.revision,
    payload: eventPayload(review),
  });
  if (error) throw new Error(`appendTeacherReviewEvent: ${error.message}`);
}

export async function upsertTeacherReview(
  sessionClient: unknown,
  adminClient: unknown,
  params: TeacherReviewInput & { reviewerId: string; assignmentId?: string | null },
): Promise<TeacherReviewRow> {
  validateReviewBands(params.bands);
  const result = await asDb(sessionClient).rpc("save_ielts_teacher_review", {
    p_attempt_id: params.attemptId, p_class_id: params.classId, p_club_id: params.clubId,
    p_expected_revision: params.expectedRevision,
    p_writing_response_id: params.writingResponseId ?? null, p_speaking_response_id: params.speakingResponseId ?? null,
    ...scalarReviewBands(params.bands),
    p_reviewer_note: params.reviewerNote ?? null, p_actor_id: params.reviewerId,
  });
  if (result.error || !result.data) throw new Error(`upsertTeacherReview: ${result.error?.message ?? "no review returned"}`);
  return (Array.isArray(result.data) ? result.data[0] : result.data) as TeacherReviewRow;
}

export async function loadReviewForActor(client: unknown, reviewId: string, actorId: string): Promise<TeacherReviewRow> {
  const { data, error } = await asDb(client).from("ielts_teacher_reviews").select("*").eq("id", reviewId).eq("reviewer_id", actorId).maybeSingle();
  if (error) throw new Error(`loadReviewForActor: ${error.message}`);
  if (!data || data.reviewer_id !== actorId) throw new Error("IELTS review not found");
  return data as TeacherReviewRow;
}

export async function loadReviewForManager(client: unknown, reviewId: string, classId: string, clubId: string): Promise<TeacherReviewRow> {
  const { data, error } = await asDb(client).from("ielts_teacher_reviews").select("*").eq("id", reviewId).eq("class_id", classId).eq("club_id", clubId).neq("status", "draft").maybeSingle();
  if (error) throw new Error(`loadReviewForManager: ${error.message}`);
  if (!data || data.status === "draft") throw new Error("IELTS review not found");
  return data as TeacherReviewRow;
}

export async function publishTeacherReview(client: unknown, adminClient: unknown, review: TeacherReviewRow, actorId: string): Promise<TeacherReviewRow> {
  void adminClient;
  const result = await asDb(client).rpc("publish_ielts_teacher_review", { p_review_id: review.id, p_actor_id: actorId });
  if (result.error || !result.data) throw new Error(`publishTeacherReview: ${result.error?.message ?? "review changed concurrently"}`);
  return (Array.isArray(result.data) ? result.data[0] : result.data) as TeacherReviewRow;
}

export async function returnTeacherReview(client: unknown, adminClient: unknown, review: TeacherReviewRow, actorId: string, note?: string | null): Promise<TeacherReviewRow> {
  void adminClient;
  const result = await asDb(client).rpc("return_ielts_teacher_review", { p_review_id: review.id, p_note: note?.trim() || null, p_actor_id: actorId });
  if (result.error || !result.data) throw new Error(`returnTeacherReview: ${result.error?.message ?? "review changed concurrently"}`);
  return (Array.isArray(result.data) ? result.data[0] : result.data) as TeacherReviewRow;
}

type ScoreLoad = { ai: Record<string, number | null | undefined>; reviews: TeacherReviewRow[] };
function scoreBands(load: ScoreLoad) {
  const writing = load.reviews.filter((row) => row.review_kind === "writing");
  const speaking = load.reviews.filter((row) => row.review_kind === "speaking");
  const teacherWriting = teacherWritingBand(writing);
  const teacherSpeaking = teacherSpeakingBand(speaking);
  return { bands: { listening: load.ai.listening_band ?? null, reading: load.ai.reading_band ?? null, writing: teacherWriting ?? load.ai.writing_band ?? null, speaking: teacherSpeaking ?? load.ai.speaking_band ?? null }, source: teacherSource(writing.length + speaking.length, teacherWriting, teacherSpeaking) };
}
function teacherWritingBand(rows: TeacherReviewRow[]) { const task1 = rows.find((row) => row.task_number === 1)?.task_band ?? null; const task2 = rows.find((row) => row.task_number === 2)?.task_band ?? null; return task1 !== null && task2 !== null ? writingOverallBand({ task1Band: task1, task2Band: task2 }) : null; }
function teacherSpeakingBand(rows: TeacherReviewRow[]) { const bands = [1, 2, 3].map((part) => rows.find((row) => row.part_number === part)?.skill_band ?? null); return bands.every((band) => band !== null) ? attemptSpeakingBand(bands as number[]) : null; }
function teacherSource(reviewCount: number, writing: number | null, speaking: number | null): "ai" | "mixed" { return reviewCount > 0 && (writing !== null || speaking !== null) ? "mixed" : "ai"; }

export async function recomputeEffectiveAttemptScores(adminClient: unknown, attemptId: string): Promise<void> {
  const db = asDb(adminClient);
  const { data: attempt, error: attemptError } = await db.from("ielts_attempts").select("id, user_id, club_id, class_id").eq("id", attemptId).maybeSingle();
  if (attemptError || !attempt) throw new Error(`recomputeEffectiveAttemptScores(attempt): ${attemptError?.message ?? "not found"}`);
  const [aiBand, reviews] = await Promise.all([
    db.from("attempt_band_scores").select("listening_band, reading_band, writing_band, speaking_band").eq("attempt_id", attemptId).maybeSingle(),
    db.from("ielts_teacher_reviews").select("*").eq("attempt_id", attemptId).eq("status", "published"),
  ]);
  if (aiBand.error || reviews.error) throw new Error("recomputeEffectiveAttemptScores: failed to load attempt scores");
  const scored = scoreBands({ ai: (aiBand.data ?? {}) as Record<string, number | null | undefined>, reviews: (reviews.data ?? []) as TeacherReviewRow[] });
  const bands = scored.bands;
  const overall = computeOverallBand(bands);
  const result = await db.from("ielts_effective_attempt_scores").upsert({
    attempt_id: attemptId,
    user_id: attempt.user_id,
    class_id: attempt.class_id,
    club_id: attempt.club_id,
    listening_band: bands.listening,
    reading_band: bands.reading,
    writing_band: bands.writing,
    speaking_band: bands.speaking,
    overall_band: overall.presentCount === 4 ? overall.band : null,
    provisional_band: overall.band,
    overall_is_provisional: overall.presentCount !== 4,
    score_source: scored.source,
    computed_at: new Date().toISOString(),
  }, { onConflict: "attempt_id" });
  if (result.error) throw new Error(`recomputeEffectiveAttemptScores(write): ${result.error.message}`);
}

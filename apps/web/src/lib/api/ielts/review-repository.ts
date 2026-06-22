/**
 * Shared IELTS review scheduler repository (WS-6.0.4).
 *
 * Track D creates items from learner mistakes and feedback. Track C reads due
 * items for the daily plan. Rating math is pure TypeScript; persistence goes
 * through a service-role-only RPC so the item update and append-only event are
 * recorded atomically.
 */
import "server-only";
import { parseInput } from "@/lib/api/boundary";
import type { Json, Tables, TablesInsert } from "@/types/supabase";
import {
  IELTS_REVIEW_STATES,
  createReviewItemSchedule,
  rateReviewItem,
  type IeltsReviewScheduleState,
} from "@/lib/ielts/review";
import {
  CreateIeltsReviewItemSchema,
  DueIeltsReviewItemsQuerySchema,
  RateIeltsReviewItemSchema,
} from "@/lib/ielts/review/schema";
import { resolveIeltsClient, type IeltsDbClient } from "./client";
import { recordIeltsReviewResultEvidence } from "./review-evidence";

export type IeltsReviewItem = Tables<"ielts_review_items">;
export type IeltsReviewEvent = Tables<"ielts_review_events">;

function toReviewState(state: string): IeltsReviewScheduleState["state"] {
  if (IELTS_REVIEW_STATES.includes(state as IeltsReviewScheduleState["state"])) {
    return state as IeltsReviewScheduleState["state"];
  }
  throw new Error(`Unknown IELTS review state: ${state}`);
}

function toScheduleState(item: IeltsReviewItem): IeltsReviewScheduleState {
  return {
    algorithm: item.algorithm,
    state: toReviewState(item.state),
    easeFactor: item.ease_factor,
    intervalDays: item.interval_days,
    repetitions: item.repetitions,
    lapses: item.lapses,
    difficulty: item.difficulty,
    stability: item.stability,
    retrievability: item.retrievability,
    dueAt: new Date(item.due_at),
    lastReviewedAt: item.last_reviewed_at ? new Date(item.last_reviewed_at) : null,
  };
}

function toReviewItemInsert(
  input: ReturnType<typeof CreateIeltsReviewItemSchema.parse>,
): TablesInsert<"ielts_review_items"> {
  const schedule = createReviewItemSchedule({
    algorithm: input.algorithm,
    dueAt: input.dueAt,
  });
  return {
    user_id: input.userId,
    source_type: input.sourceType,
    source_id: input.sourceId ?? null,
    source_key: input.sourceKey,
    skill: input.skill,
    focus_area: input.focusArea,
    review_kind: input.reviewKind,
    question_id: input.questionId ?? null,
    activity_id: input.activityId ?? null,
    activity_attempt_id: input.activityAttemptId ?? null,
    question_response_id: input.questionResponseId ?? null,
    writing_response_id: input.writingResponseId ?? null,
    speaking_response_id: input.speakingResponseId ?? null,
    prompt_en: input.prompt.en,
    prompt_vi: input.prompt.vi,
    answer_en: input.answer?.en ?? null,
    answer_vi: input.answer?.vi ?? null,
    atom_payload: input.atomPayload as Json,
    algorithm: schedule.algorithm,
    state: schedule.state,
    difficulty: schedule.difficulty,
    stability: schedule.stability,
    retrievability: schedule.retrievability,
    ease_factor: schedule.easeFactor,
    interval_days: schedule.intervalDays,
    repetitions: schedule.repetitions,
    lapses: schedule.lapses,
    due_at: schedule.dueAt.toISOString(),
    metadata: input.metadata as Json,
  };
}

function isUniqueViolation(error: { code?: string }): boolean {
  return error.code === "23505";
}

function assertRateable(item: IeltsReviewItem): void {
  if (item.state === "archived" || item.state === "mastered" || item.state === "suspended") {
    throw new Error(`rateIeltsReviewItem failed: item is ${item.state}`);
  }
}

export async function getIeltsReviewItemBySourceKey(
  userId: string,
  sourceKey: string,
  client?: IeltsDbClient,
): Promise<IeltsReviewItem | null> {
  const supabase = await resolveIeltsClient(client);
  const { data, error } = await supabase
    .from("ielts_review_items")
    .select()
    .eq("user_id", userId)
    .eq("source_key", sourceKey)
    .maybeSingle();
  if (error) throw new Error(`getIeltsReviewItemBySourceKey failed: ${error.message}`);
  return data;
}

export async function createIeltsReviewItem(
  raw: unknown,
  client?: IeltsDbClient,
): Promise<IeltsReviewItem> {
  const input = parseInput(CreateIeltsReviewItemSchema, raw);
  const supabase = await resolveIeltsClient(client);
  const { data, error } = await supabase
    .from("ielts_review_items")
    .insert(toReviewItemInsert(input))
    .select()
    .single();

  if (!error) return data;
  if (!isUniqueViolation(error)) {
    throw new Error(`createIeltsReviewItem failed: ${error.message}`);
  }

  const existing = await getIeltsReviewItemBySourceKey(input.userId, input.sourceKey, supabase);
  if (!existing) {
    throw new Error("createIeltsReviewItem failed: duplicate source key but no row returned");
  }
  return existing;
}

export async function getIeltsReviewItem(
  reviewItemId: string,
  client?: IeltsDbClient,
): Promise<IeltsReviewItem | null> {
  const supabase = await resolveIeltsClient(client);
  const { data, error } = await supabase
    .from("ielts_review_items")
    .select()
    .eq("id", reviewItemId)
    .maybeSingle();
  if (error) throw new Error(`getIeltsReviewItem failed: ${error.message}`);
  return data;
}

export async function listDueIeltsReviewItems(
  raw: unknown,
  client?: IeltsDbClient,
): Promise<IeltsReviewItem[]> {
  const input = parseInput(DueIeltsReviewItemsQuerySchema, raw);
  const dueAt = input.dueAt ?? new Date();
  const supabase = await resolveIeltsClient(client);
  const { data, error } = await supabase
    .from("ielts_review_items")
    .select()
    .eq("user_id", input.userId)
    .in("state", input.states)
    .lte("due_at", dueAt.toISOString())
    .order("due_at", { ascending: true })
    .limit(input.limit);
  if (error) throw new Error(`listDueIeltsReviewItems failed: ${error.message}`);
  return data ?? [];
}

/**
 * Exact count of due review items (head-only), so the home "reviews due" badge
 * reflects the true total rather than a capped list length.
 */
export async function countDueIeltsReviewItems(
  raw: unknown,
  client?: IeltsDbClient,
): Promise<number> {
  const input = parseInput(DueIeltsReviewItemsQuerySchema, raw);
  const dueAt = input.dueAt ?? new Date();
  const supabase = await resolveIeltsClient(client);
  const { count, error } = await supabase
    .from("ielts_review_items")
    .select("id", { count: "exact", head: true })
    .eq("user_id", input.userId)
    .in("state", input.states)
    .lte("due_at", dueAt.toISOString());
  if (error) throw new Error(`countDueIeltsReviewItems failed: ${error.message}`);
  return count ?? 0;
}

export async function rateIeltsReviewItem(
  raw: unknown,
  client?: IeltsDbClient,
): Promise<IeltsReviewItem> {
  const input = parseInput(RateIeltsReviewItemSchema, raw);
  const supabase = await resolveIeltsClient(client);
  const item = await getIeltsReviewItem(input.reviewItemId, supabase);
  if (!item) throw new Error("rateIeltsReviewItem failed: item not found");
  assertRateable(item);

  const result = rateReviewItem(toScheduleState(item), {
    rating: input.rating,
    now: input.reviewedAt,
    targetTestDate: input.targetTestDate ?? null,
  });

  const { data, error } = await supabase.rpc("record_ielts_review_rating", {
    p_review_item_id: item.id,
    p_rating: input.rating,
    p_quality_grade: result.qualityGrade,
    p_next_state: result.next.state,
    p_next_due_at: result.next.dueAt.toISOString(),
    p_next_interval_days: result.next.intervalDays,
    p_next_ease_factor: result.next.easeFactor,
    p_next_repetitions: result.next.repetitions,
    p_next_lapses: result.next.lapses,
    p_next_difficulty: result.next.difficulty,
    p_next_stability: result.next.stability,
    p_next_retrievability: result.next.retrievability,
    p_reviewed_at: result.reviewedAt.toISOString(),
    p_is_correct: input.isCorrect ?? null,
    p_response_ms: input.responseMs ?? null,
    p_plan_item_id: input.planItemId ?? null,
    p_activity_attempt_id: input.activityAttemptId ?? null,
    p_metadata: input.metadata as Json,
  });
  if (error) throw new Error(`rateIeltsReviewItem failed: ${error.message}`);
  if (!data) throw new Error("rateIeltsReviewItem failed: no row returned");

  await recordIeltsReviewResultEvidence({
    client: supabase,
    item,
    rating: input.rating,
    qualityGrade: result.qualityGrade,
    reviewedAt: result.reviewedAt,
    responseMs: input.responseMs,
    isCorrect: input.isCorrect ?? null,
  });

  return data;
}

/**
 * Question-groups repository (format-variety pass). Canonical create / update /
 * upsert / delete + admin reads for `ielts_question_groups`, plus the sibling
 * loader the questions repository uses to run `assertQuestionFitsGroup`.
 * RLS-enforced (admin session or injected service-role client), like the
 * passages repository.
 */
import "server-only";
import { parseInput } from "@/lib/api/boundary";
import type { Json, Tables } from "@/types/supabase";
import { resolveIeltsClient, type IeltsDbClient } from "./client";
import {
  CreateQuestionGroupSchema,
  UpdateQuestionGroupSchema,
  toGroupInsert,
  toGroupUpdate,
} from "./question-group-schema";
import type { GroupSiblingLike } from "./question-group-fit";

export type IeltsQuestionGroup = Tables<"ielts_question_groups">;

/** One canonical create path for `ielts_question_groups`. */
export async function createQuestionGroup(
  raw: unknown,
  client?: IeltsDbClient,
): Promise<IeltsQuestionGroup> {
  const input = parseInput(CreateQuestionGroupSchema, raw);
  const supabase = await resolveIeltsClient(client);
  const { data, error } = await supabase
    .from("ielts_question_groups")
    .insert(toGroupInsert(input))
    .select()
    .single();
  if (error) throw new Error(`createQuestionGroup failed: ${error.message}`);
  return data;
}

/** Full-replace update (all fields re-validated); stamps `updated_at`. */
export async function updateQuestionGroup(
  raw: unknown,
  client?: IeltsDbClient,
): Promise<IeltsQuestionGroup> {
  const input = parseInput(UpdateQuestionGroupSchema, raw);
  const supabase = await resolveIeltsClient(client);
  const { data, error } = await supabase
    .from("ielts_question_groups")
    .update({ ...toGroupUpdate(input), updated_at: new Date().toISOString() })
    .eq("id", input.groupId)
    .eq("test_id", input.testId)
    .select()
    .single();
  if (error) throw new Error(`updateQuestionGroup failed: ${error.message}`);
  return data;
}

/**
 * Create-or-replace by the natural key `(test_id, group_key)` — the fixture
 * importer's idempotent path. Member questions keep linking by group_key.
 */
export async function upsertQuestionGroupByKey(
  raw: unknown,
  client?: IeltsDbClient,
): Promise<IeltsQuestionGroup> {
  const input = parseInput(CreateQuestionGroupSchema, raw);
  const supabase = await resolveIeltsClient(client);
  const { data, error } = await supabase
    .from("ielts_question_groups")
    .upsert(
      { ...toGroupInsert(input), updated_at: new Date().toISOString() },
      { onConflict: "test_id,group_key" },
    )
    .select()
    .single();
  if (error) throw new Error(`upsertQuestionGroupByKey failed: ${error.message}`);
  return data;
}

export async function deleteQuestionGroup(
  groupId: string,
  client?: IeltsDbClient,
): Promise<void> {
  const supabase = await resolveIeltsClient(client);
  const { error } = await supabase.from("ielts_question_groups").delete().eq("id", groupId);
  if (error) throw new Error(`deleteQuestionGroup failed: ${error.message}`);
}

export async function listQuestionGroupsByTest(
  testId: string,
  client?: IeltsDbClient,
): Promise<IeltsQuestionGroup[]> {
  const supabase = await resolveIeltsClient(client);
  const { data, error } = await supabase
    .from("ielts_question_groups")
    .select()
    .eq("test_id", testId)
    .order("order_index", { ascending: true })
    .order("group_key", { ascending: true });
  if (error) throw new Error(`listQuestionGroupsByTest failed: ${error.message}`);
  return data ?? [];
}

export async function getQuestionGroupByKey(
  testId: string,
  groupKey: string,
  client?: IeltsDbClient,
): Promise<IeltsQuestionGroup | null> {
  const supabase = await resolveIeltsClient(client);
  const { data, error } = await supabase
    .from("ielts_question_groups")
    .select()
    .eq("test_id", testId)
    .eq("group_key", groupKey)
    .maybeSingle();
  if (error) throw new Error(`getQuestionGroupByKey failed: ${error.message}`);
  return data;
}

/**
 * The group's current member questions (display order) with their SECRET keys,
 * for the fit check only. Never returned to a client — callers are the
 * canonical create/update path. `excludeQuestionId` drops the row being updated.
 */
export async function loadGroupSiblings(
  testId: string,
  groupKey: string,
  excludeQuestionId: string | null,
  client?: IeltsDbClient,
): Promise<GroupSiblingLike[]> {
  const supabase = await resolveIeltsClient(client);
  let query = supabase
    .from("ielts_questions")
    .select("id, metadata, order_index, ielts_question_keys(correct_answer)")
    .eq("test_id", testId)
    .eq("group_key", groupKey)
    .order("order_index", { ascending: true });
  if (excludeQuestionId) query = query.neq("id", excludeQuestionId);
  const { data, error } = await query;
  if (error) throw new Error(`loadGroupSiblings failed: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: row.id,
    metadata: row.metadata,
    correctAnswer: (row.ielts_question_keys?.correct_answer ?? null) as Json | null,
    orderIndex: row.order_index,
  }));
}

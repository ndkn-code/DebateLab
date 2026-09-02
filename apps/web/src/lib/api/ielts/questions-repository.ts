/**
 * Questions repository (WS-1.1). The single canonical create/update path for the
 * item bank: both go through the `*_ielts_question_with_key` RPCs so the
 * non-secret question and its SECRET key row are written in ONE transaction
 * (data-access §8). Deletes cascade to the key; reads here never expose keys.
 *
 * When the question names a `groupKey` that resolves to an
 * `ielts_question_groups` row, the pure fit check (`assertQuestionFitsGroup`)
 * runs before the RPC so a question can never be saved into a set it cannot
 * render or grade in.
 */
import { parseInput } from "@/lib/api/boundary";
import type { Tables } from "@/types/supabase";
import { resolveIeltsClient, type IeltsDbClient } from "./client";
import { assertQuestionFitsGroup } from "./question-group-fit";
import { getQuestionGroupByKey, loadGroupSiblings } from "./question-groups-repository";
import {
  CreateIeltsQuestionSchema,
  UpdateIeltsQuestionSchema,
  toCreateQuestionArgs,
  toUpdateQuestionArgs,
  type NormalizedQuestionInput,
} from "./question-schema";

export type IeltsQuestion = Tables<"ielts_questions">;

async function assertFitsGroupIfAny(
  input: NormalizedQuestionInput,
  questionId: string | null,
  supabase: IeltsDbClient,
): Promise<void> {
  if (!input.groupKey) return;
  const group = await getQuestionGroupByKey(input.testId, input.groupKey, supabase);
  if (!group) return;
  const siblings = await loadGroupSiblings(input.testId, input.groupKey, questionId, supabase);
  assertQuestionFitsGroup(input, group, siblings);
}

/** Canonical create: question + secret key, atomic via RPC. */
export async function createQuestion(
  raw: unknown,
  client?: IeltsDbClient,
): Promise<IeltsQuestion> {
  const input = parseInput(CreateIeltsQuestionSchema, raw);
  const supabase = await resolveIeltsClient(client);
  await assertFitsGroupIfAny(input, null, supabase);
  const { data, error } = await supabase.rpc(
    "create_ielts_question_with_key",
    toCreateQuestionArgs(input),
  );
  if (error) throw new Error(`createQuestion failed: ${error.message}`);
  if (!data) throw new Error("createQuestion failed: no row returned");
  return data;
}

/** Canonical update: question + secret key, atomic via RPC. */
export async function updateQuestion(
  raw: unknown,
  client?: IeltsDbClient,
): Promise<IeltsQuestion> {
  const input = parseInput(UpdateIeltsQuestionSchema, raw);
  const supabase = await resolveIeltsClient(client);
  await assertFitsGroupIfAny(input, input.questionId, supabase);
  const { data, error } = await supabase.rpc(
    "update_ielts_question_with_key",
    toUpdateQuestionArgs(input),
  );
  if (error) throw new Error(`updateQuestion failed: ${error.message}`);
  if (!data) throw new Error("updateQuestion failed: no row returned");
  return data;
}

export async function deleteQuestion(questionId: string, client?: IeltsDbClient): Promise<void> {
  const supabase = await resolveIeltsClient(client);
  const { error } = await supabase.from("ielts_questions").delete().eq("id", questionId);
  if (error) throw new Error(`deleteQuestion failed: ${error.message}`);
}

export async function listQuestionsByTest(
  testId: string,
  client?: IeltsDbClient,
): Promise<IeltsQuestion[]> {
  const supabase = await resolveIeltsClient(client);
  const { data, error } = await supabase
    .from("ielts_questions")
    .select()
    .eq("test_id", testId)
    .order("order_index", { ascending: true });
  if (error) throw new Error(`listQuestionsByTest failed: ${error.message}`);
  return data ?? [];
}

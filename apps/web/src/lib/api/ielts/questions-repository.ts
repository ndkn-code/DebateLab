/**
 * Questions repository (WS-1.1). The single canonical create/update path for the
 * item bank: both go through the `*_ielts_question_with_key` RPCs so the
 * non-secret question and its SECRET key row are written in ONE transaction
 * (data-access §8). Deletes cascade to the key; reads here never expose keys.
 */
import { parseInput } from "@/lib/api/boundary";
import type { Tables } from "@/types/supabase";
import { resolveIeltsClient, type IeltsDbClient } from "./client";
import {
  CreateIeltsQuestionSchema,
  UpdateIeltsQuestionSchema,
  toCreateQuestionArgs,
  toUpdateQuestionArgs,
} from "./question-schema";

export type IeltsQuestion = Tables<"ielts_questions">;

/** Canonical create: question + secret key, atomic via RPC. */
export async function createQuestion(
  raw: unknown,
  client?: IeltsDbClient,
): Promise<IeltsQuestion> {
  const input = parseInput(CreateIeltsQuestionSchema, raw);
  const supabase = await resolveIeltsClient(client);
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

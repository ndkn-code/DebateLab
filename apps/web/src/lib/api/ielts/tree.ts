/**
 * Full IELTS test tree loader (WS-1.1) — test + passages + listening sections +
 * questions joined to their (admin-only) keys. Powers the authoring editor and
 * the version snapshot. Reads keys, so it is admin/service-role only by RLS.
 */
import type { Tables } from "@/types/supabase";
import { resolveIeltsClient, type IeltsDbClient } from "./client";

export type QuestionKey = Tables<"ielts_question_keys">;
export type QuestionWithKey = Tables<"ielts_questions"> & { key: QuestionKey | null };

export interface IeltsTestTree {
  test: Tables<"ielts_tests">;
  passages: Tables<"passages">[];
  listeningSections: Tables<"listening_sections">[];
  questions: QuestionWithKey[];
}

async function loadKeysByQuestion(
  supabase: IeltsDbClient,
  questionIds: string[],
): Promise<Map<string, QuestionKey>> {
  if (questionIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from("ielts_question_keys")
    .select()
    .in("question_id", questionIds);
  if (error) throw new Error(`getIeltsTestTree (keys) failed: ${error.message}`);
  return new Map((data ?? []).map((key) => [key.question_id, key]));
}

export async function getIeltsTestTree(
  testId: string,
  client?: IeltsDbClient,
): Promise<IeltsTestTree | null> {
  const supabase = await resolveIeltsClient(client);
  const { data: test, error } = await supabase
    .from("ielts_tests")
    .select()
    .eq("id", testId)
    .maybeSingle();
  if (error) throw new Error(`getIeltsTestTree failed: ${error.message}`);
  if (!test) return null;

  const [passagesRes, sectionsRes, questionsRes] = await Promise.all([
    supabase.from("passages").select().eq("test_id", testId).order("order_index"),
    supabase
      .from("listening_sections")
      .select()
      .eq("test_id", testId)
      .order("section_number"),
    supabase.from("ielts_questions").select().eq("test_id", testId).order("order_index"),
  ]);
  const firstError = passagesRes.error ?? sectionsRes.error ?? questionsRes.error;
  if (firstError) throw new Error(`getIeltsTestTree failed: ${firstError.message}`);

  const questions = questionsRes.data ?? [];
  const keysById = await loadKeysByQuestion(
    supabase,
    questions.map((q) => q.id),
  );
  return {
    test,
    passages: passagesRes.data ?? [],
    listeningSections: sectionsRes.data ?? [],
    questions: questions.map((q) => ({ ...q, key: keysById.get(q.id) ?? null })),
  };
}

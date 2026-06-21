/**
 * Typed reads for the mock engine (WS-2.1). All access goes through the typed
 * server client (the `<Database>` generic schema-checks every select) and is
 * RLS-respecting: content is visible only when its test is published; attempt
 * rows are SELECT-own. Answer keys are NOT read here — grading reads them with
 * the service-role client (lib/api/ielts/grade-attempt.ts).
 */
import { createTypedServerClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/supabase";
import type { IeltsSkill } from "@/lib/ielts/mock-blueprint";
import type { IeltsQuestionView } from "@/lib/ielts/question-contract";
import { toQuestionView } from "./mock-schema";

const QUESTION_COLUMNS =
  "id, skill, question_type, order_index, group_key, group_instructions, prompt, options, max_points, word_limit, visual, metadata, passage_id, listening_section_id";

export interface MockStructure {
  test: Tables<"ielts_tests">;
  passages: Tables<"passages">[];
  listeningSections: Tables<"listening_sections">[];
  audioAssets: Tables<"audio_assets">[];
  questions: IeltsQuestionView[];
}

export interface AttemptState {
  attempt: Tables<"ielts_attempts">;
  sections: Tables<"ielts_attempt_sections">[];
  responses: Tables<"ielts_question_responses">[];
  bandScore: Tables<"attempt_band_scores"> | null;
}

/** Load a published test's full structure for the player (null if not visible). */
export async function loadMockStructure(
  testId: string,
): Promise<MockStructure | null> {
  const supabase = await createTypedServerClient();
  const { data: test, error } = await supabase
    .from("ielts_tests")
    .select()
    .eq("id", testId)
    .maybeSingle();
  if (error) throw new Error(`loadMockStructure(test): ${error.message}`);
  if (!test) return null;

  const [passages, listeningSections, audioAssets, questions] = await Promise.all([
    supabase.from("passages").select().eq("test_id", testId).order("order_index"),
    supabase
      .from("listening_sections")
      .select()
      .eq("test_id", testId)
      .order("section_number"),
    supabase.from("audio_assets").select().eq("test_id", testId),
    supabase
      .from("ielts_questions")
      .select(QUESTION_COLUMNS)
      .eq("test_id", testId)
      .order("order_index"),
  ]);

  for (const result of [passages, listeningSections, audioAssets, questions]) {
    if (result.error) throw new Error(`loadMockStructure: ${result.error.message}`);
  }

  return {
    test,
    passages: passages.data ?? [],
    listeningSections: listeningSections.data ?? [],
    audioAssets: audioAssets.data ?? [],
    questions: (questions.data ?? []).map(toQuestionView),
  };
}

/** Distinct skills that have authored questions in a test (drives the blueprint). */
export async function getSkillsWithContent(testId: string): Promise<IeltsSkill[]> {
  const supabase = await createTypedServerClient();
  const { data, error } = await supabase
    .from("ielts_questions")
    .select("skill")
    .eq("test_id", testId);
  if (error) throw new Error(`getSkillsWithContent: ${error.message}`);
  return [...new Set((data ?? []).map((row) => row.skill))];
}

/** Load a learner's own attempt + its sections, responses and band score. */
export async function loadAttemptState(
  attemptId: string,
): Promise<AttemptState | null> {
  const supabase = await createTypedServerClient();
  const { data: attempt, error } = await supabase
    .from("ielts_attempts")
    .select()
    .eq("id", attemptId)
    .maybeSingle();
  if (error) throw new Error(`loadAttemptState(attempt): ${error.message}`);
  if (!attempt) return null;

  const [sections, responses, bandScore] = await Promise.all([
    supabase
      .from("ielts_attempt_sections")
      .select()
      .eq("attempt_id", attemptId)
      .order("section_order"),
    supabase.from("ielts_question_responses").select().eq("attempt_id", attemptId),
    supabase
      .from("attempt_band_scores")
      .select()
      .eq("attempt_id", attemptId)
      .maybeSingle(),
  ]);

  if (sections.error) throw new Error(`loadAttemptState(sections): ${sections.error.message}`);
  if (responses.error) throw new Error(`loadAttemptState(responses): ${responses.error.message}`);
  if (bandScore.error) throw new Error(`loadAttemptState(band): ${bandScore.error.message}`);

  return {
    attempt,
    sections: sections.data ?? [],
    responses: responses.data ?? [],
    bandScore: bandScore.data,
  };
}

import "server-only";

import type { Tables } from "@/types/supabase";
import { resolveIeltsClient, type IeltsDbClient } from "@/lib/api/ielts/client";
import type { MicroDraftSourceContext } from "./model";
import type { MicroDraftSubskillOption } from "./schema";

async function loadOptionalPassage(
  supabase: IeltsDbClient,
  passageId: string | null,
): Promise<Tables<"passages"> | null> {
  if (!passageId) return null;
  const { data, error } = await supabase
    .from("passages")
    .select()
    .eq("id", passageId)
    .maybeSingle();
  if (error) throw new Error(`loadQuestionSource (passage) failed: ${error.message}`);
  return data;
}

async function loadOptionalListeningSection(
  supabase: IeltsDbClient,
  sectionId: string | null,
): Promise<Tables<"listening_sections"> | null> {
  if (!sectionId) return null;
  const { data, error } = await supabase
    .from("listening_sections")
    .select()
    .eq("id", sectionId)
    .maybeSingle();
  if (error) {
    throw new Error(`loadQuestionSource (listening section) failed: ${error.message}`);
  }
  return data;
}

async function loadSubskillOptions(
  supabase: IeltsDbClient,
  skill: Tables<"ielts_questions">["skill"],
): Promise<MicroDraftSubskillOption[]> {
  const { data, error } = await supabase
    .from("ielts_subskills")
    .select("key, skill, label_en, label_vi, kind, question_type, tags")
    .eq("skill", skill)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(`loadQuestionSource (subskills) failed: ${error.message}`);
  return (data ?? []).map((row) => ({
    key: row.key,
    skill: row.skill,
    labelEn: row.label_en,
    labelVi: row.label_vi,
    kind: row.kind,
    questionType: row.question_type,
    tags: row.tags ?? [],
  }));
}

function resolveSourceText(params: {
  question: Tables<"ielts_questions">;
  key: Tables<"ielts_question_keys">;
  passage: Tables<"passages"> | null;
  listeningSection: Tables<"listening_sections"> | null;
}): string {
  return (
    params.passage?.body ??
    params.listeningSection?.script ??
    params.key.model_answer ??
    params.question.prompt
  );
}

export async function loadQuestionSource(
  questionId: string,
  client?: IeltsDbClient,
): Promise<MicroDraftSourceContext> {
  const supabase = await resolveIeltsClient(client);
  const { data: question, error } = await supabase
    .from("ielts_questions")
    .select()
    .eq("id", questionId)
    .maybeSingle();
  if (error) throw new Error(`loadQuestionSource failed: ${error.message}`);
  if (!question) throw new Error("IELTS question not found");

  const { data: key, error: keyError } = await supabase
    .from("ielts_question_keys")
    .select()
    .eq("question_id", questionId)
    .maybeSingle();
  if (keyError) throw new Error(`loadQuestionSource (key) failed: ${keyError.message}`);
  if (!key) {
    throw new Error("Generate micro-items requires an existing answer key.");
  }

  const [passage, listeningSection, subskills] = await Promise.all([
    loadOptionalPassage(supabase, question.passage_id),
    loadOptionalListeningSection(supabase, question.listening_section_id),
    loadSubskillOptions(supabase, question.skill),
  ]);

  return {
    testId: question.test_id,
    questionId: question.id,
    passageId: question.passage_id,
    listeningSectionId: question.listening_section_id,
    skill: question.skill,
    questionType: question.question_type,
    prompt: question.prompt,
    groupInstructions: question.group_instructions,
    sourceText: resolveSourceText({ question, key, passage, listeningSection }),
    correctAnswer: key.correct_answer,
    acceptVariants: key.accept_variants,
    explanationEn: key.explanation_en,
    explanationVi: key.explanation_vi,
    modelAnswer: key.model_answer,
    subskills,
  };
}

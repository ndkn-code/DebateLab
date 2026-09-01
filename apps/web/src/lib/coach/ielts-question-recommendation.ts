import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

type IeltsSkill = "listening" | "reading" | "writing" | "speaking";
type Row = Record<string, unknown>;

export interface IeltsQuestionRecommendation {
  questionId: string;
  testId: string;
  testSlug: string;
  skill: IeltsSkill;
  questionType: string;
  title: string;
  prompt: string;
  criteria: string[];
  resourceId: string;
}

function record(value: unknown): Row {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Row)
    : {};
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function words(value: string) {
  return new Set(
    value
      .normalize("NFKC")
      .toLowerCase()
      .split(/[^\p{L}\p{N}_]+/u)
      .filter((item) => item.length >= 3),
  );
}

function normalizeTest(value: unknown): Row {
  if (Array.isArray(value)) return record(value[0]);
  return record(value);
}

function normalizeCandidate(
  row: Row,
  skill: IeltsSkill,
  criterion: string,
): IeltsQuestionRecommendation | null {
  const test = normalizeTest(row.ielts_tests);
  const metadata = record(row.metadata);
  const questionId = typeof row.id === "string" ? row.id : "";
  const testId = typeof row.test_id === "string" ? row.test_id : "";
  const testSlug = typeof test.slug === "string" ? test.slug : "";
  const prompt = typeof row.prompt === "string" ? row.prompt.trim() : "";
  const questionType =
    typeof row.question_type === "string" ? row.question_type : "";
  if (!questionId || !testId || !testSlug || !prompt || !questionType) {
    return null;
  }
  const criteria = [
    ...strings(metadata.coach_criteria),
    ...strings(metadata.subskill_tags),
  ];
  return {
    questionId,
    testId,
    testSlug,
    skill,
    questionType,
    title:
      typeof test.title === "string"
        ? test.title
        : `${skill} ${criterion} practice`,
    prompt: prompt.slice(0, 500),
    criteria,
    resourceId: `ielts-practice:${skill}:${criterion}:${testSlug}:${questionId}`,
  };
}

function scoreCandidate(params: {
  item: IeltsQuestionRecommendation;
  criterion: string;
  message: string;
}) {
  const queryWords = words(`${params.criterion} ${params.message}`);
  const candidateWords = words(
    `${params.item.questionType} ${params.item.criteria.join(" ")} ${params.item.prompt}`,
  );
  let score = params.item.criteria.includes(params.criterion) ? 20 : 0;
  for (const word of queryWords) if (candidateWords.has(word)) score += 1;
  return score;
}

/**
 * Finds one learner-safe published question. The query never selects
 * `ielts_question_keys`, model answers, explanations, or another learner's data.
 * Failure is non-fatal: the coach falls back to its generic practice library.
 */
export async function findIeltsQuestionRecommendation(params: {
  supabase: SupabaseClient;
  skill: IeltsSkill;
  criterion: string;
  message: string;
}): Promise<IeltsQuestionRecommendation | null> {
  try {
    const result = await params.supabase
      .from("ielts_questions")
      .select(
        "id, test_id, skill, question_type, prompt, metadata, ielts_tests!inner(id, slug, title, status, assessment_mode)",
      )
      .eq("skill", params.skill)
      .contains("metadata", { coach_recommendable: true })
      .eq("ielts_tests.status", "published")
      .eq("ielts_tests.assessment_mode", "practice")
      .order("order_index", { ascending: true })
      .limit(80);
    if (result.error) return null;
    const ranked = ((result.data ?? []) as unknown as Row[])
      .map((row) => normalizeCandidate(row, params.skill, params.criterion))
      .filter((item): item is IeltsQuestionRecommendation => item !== null)
      .map((item) => ({
        item,
        score: scoreCandidate({
          item,
          criterion: params.criterion,
          message: params.message,
        }),
      }))
      .sort(
        (left, right) =>
          right.score - left.score ||
          left.item.questionId.localeCompare(right.item.questionId),
      );
    return ranked[0]?.item ?? null;
  } catch {
    return null;
  }
}

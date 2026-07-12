import type { Database, Json, Tables } from "@/types/supabase";

export const BANK_PAGE_SIZE = 24;

export type BankSkill = Database["public"]["Enums"]["ielts_skill"];
export type BankQuestionType = Database["public"]["Enums"]["ielts_question_type"];

export interface BankFilters {
  skill?: BankSkill;
  questionType?: BankQuestionType;
  testId?: string;
  difficulty?: string;
  subskillTag?: string;
  search?: string;
  page: number;
}

export interface BankQuestionCard {
  id: string;
  testId: string;
  testTitle: string;
  skill: BankSkill;
  questionType: BankQuestionType;
  difficulty: string | null;
  subskillTags: string[];
  prompt: string;
  promptExcerpt: string;
  maxPoints: number;
  orderIndex: number;
}

function clean(value: string | string[] | undefined): string | undefined {
  const first = Array.isArray(value) ? value[0] : value;
  const normalized = first?.trim();
  return normalized ? normalized.slice(0, 160) : undefined;
}

export function normalizeBankFilters(input: Record<string, string | string[] | undefined>): BankFilters {
  const pageValue = Number.parseInt(clean(input.page) ?? "1", 10);
  return {
    skill: clean(input.skill) as BankSkill | undefined,
    questionType: clean(input.questionType) as BankQuestionType | undefined,
    testId: clean(input.testId),
    difficulty: clean(input.difficulty)?.toLowerCase(),
    subskillTag: clean(input.subskillTag),
    search: clean(input.search),
    page: Number.isFinite(pageValue) ? Math.max(1, Math.min(pageValue, 10_000)) : 1,
  };
}

export function promptExcerpt(prompt: string, limit = 180): string {
  const flat = prompt.replace(/\s+/g, " ").trim();
  if (flat.length <= limit) return flat;
  const slice = flat.slice(0, Math.max(1, limit - 1));
  const boundary = slice.lastIndexOf(" ");
  return `${slice.slice(0, boundary > 0 ? boundary : slice.length).trimEnd()}…`;
}

export function metadataRecord(metadata: Json): Record<string, Json | undefined> {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? metadata as Record<string, Json | undefined>
    : {};
}

export function metadataTags(metadata: Json): string[] {
  const value = metadataRecord(metadata).subskill_tags;
  return Array.isArray(value) ? value.filter((tag): tag is string => typeof tag === "string") : [];
}

type QuestionRow = Tables<"ielts_questions"> & { ielts_tests: { title: string } | null };

export function toBankQuestionCard(question: QuestionRow): BankQuestionCard {
  const metadata = metadataRecord(question.metadata);
  return {
    id: question.id,
    testId: question.test_id,
    testTitle: question.ielts_tests?.title ?? "Untitled test",
    skill: question.skill,
    questionType: question.question_type,
    difficulty: typeof metadata.difficulty === "string" ? metadata.difficulty : null,
    subskillTags: metadataTags(question.metadata),
    prompt: question.prompt,
    promptExcerpt: promptExcerpt(question.prompt),
    maxPoints: question.max_points,
    orderIndex: question.order_index,
  };
}

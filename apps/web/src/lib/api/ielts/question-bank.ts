import "server-only";
import { isDevAdminBypassEnabled } from "@/lib/dev-admin-bypass";
import { createTypedServerClient } from "@/lib/supabase/server";
import { createTypedAdminClient } from "@/lib/supabase/admin";
import type { Tables } from "@/types/supabase";
import { BANK_PAGE_SIZE, metadataRecord, metadataTags, toBankQuestionCard, type BankFilters, type BankQuestionCard } from "@/lib/ielts/question-bank/model";
import type { IeltsDbClient } from "./client";

export interface BankFacets {
  skills: string[];
  questionTypes: string[];
  difficulties: string[];
  subskillTags: string[];
  tests: Array<{ id: string; title: string }>;
}

export interface BankQuestionDetail {
  question: Tables<"ielts_questions"> & { ielts_tests: { title: string } | null };
  key: Tables<"ielts_question_keys"> | null;
}

async function verifyAdmin(client?: IeltsDbClient): Promise<IeltsDbClient> {
  if (client) return client;
  if (isDevAdminBypassEnabled()) return createTypedAdminClient();
  const supabase = await createTypedServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") throw new Error("Forbidden");
  return supabase;
}

export async function listBankQuestions(filters: BankFilters, client?: IeltsDbClient): Promise<{ questions: BankQuestionCard[]; count: number; page: number; pageSize: number; pageCount: number }> {
  const supabase = await verifyAdmin(client);
  let query = supabase.from("ielts_questions")
    .select("*, ielts_tests!inner(title)", { count: "exact" })
    .order("title", { referencedTable: "ielts_tests", ascending: true })
    .order("order_index", { ascending: true })
    .order("id", { ascending: true });
  if (filters.skill) query = query.eq("skill", filters.skill);
  if (filters.questionType) query = query.eq("question_type", filters.questionType);
  if (filters.testId) query = query.eq("test_id", filters.testId);
  if (filters.difficulty) query = query.eq("metadata->>difficulty", filters.difficulty);
  if (filters.subskillTag) query = query.contains("metadata", { subskill_tags: [filters.subskillTag] });
  if (filters.search) query = query.ilike("prompt", `%${filters.search.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`);
  const from = (filters.page - 1) * BANK_PAGE_SIZE;
  const { data, error, count } = await query.range(from, from + BANK_PAGE_SIZE - 1);
  if (error) throw new Error(`listBankQuestions failed: ${error.message}`);
  const total = count ?? 0;
  return { questions: (data ?? []).map(toBankQuestionCard), count: total, page: filters.page, pageSize: BANK_PAGE_SIZE, pageCount: Math.max(1, Math.ceil(total / BANK_PAGE_SIZE)) };
}

export async function getBankQuestion(id: string, client?: IeltsDbClient): Promise<BankQuestionDetail | null> {
  const supabase = await verifyAdmin(client);
  const [{ data: question, error }, { data: key, error: keyError }] = await Promise.all([
    supabase.from("ielts_questions").select("*, ielts_tests(title)").eq("id", id).maybeSingle(),
    supabase.from("ielts_question_keys").select().eq("question_id", id).maybeSingle(),
  ]);
  if (error || keyError) throw new Error(`getBankQuestion failed: ${(error ?? keyError)?.message}`);
  return question ? { question, key } : null;
}

export async function getBankFacets(client?: IeltsDbClient): Promise<BankFacets> {
  const supabase = await verifyAdmin(client);
  const [questionsResult, testsResult] = await Promise.all([
    supabase.from("ielts_questions").select("skill,question_type,metadata").limit(1000),
    supabase.from("ielts_tests").select("id,title").order("title").limit(500),
  ]);
  if (questionsResult.error || testsResult.error) throw new Error(`getBankFacets failed: ${(questionsResult.error ?? testsResult.error)?.message}`);
  const rows = questionsResult.data ?? [];
  const unique = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b));
  return {
    skills: unique(rows.map(row => row.skill)),
    questionTypes: unique(rows.map(row => row.question_type)),
    difficulties: unique(rows.flatMap(row => { const value = metadataRecord(row.metadata).difficulty; return typeof value === "string" ? [value] : []; })),
    subskillTags: unique(rows.flatMap(row => metadataTags(row.metadata))),
    tests: testsResult.data ?? [],
  };
}

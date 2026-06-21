import "server-only";

import {
  IELTS_FIRST_TEXT_ACTIVITY_TYPES,
  IeltsTextActivityContentSchema,
  toIeltsLearnAtom,
} from "@/lib/ielts/learn/text-activities";
import type { Json, Tables } from "@/types/supabase";
import { resolveIeltsClient, type IeltsDbClient } from "./client";

const QUICK_DIAGNOSTIC_LIMIT = 12;
const LEARN_ATOM_LIMIT = 80;

type IeltsTestRow = Tables<"ielts_tests">;
type ActivityRow = Pick<
  Tables<"activities">,
  "id" | "activity_type" | "content" | "duration_minutes" | "is_archived"
>;

export interface IeltsDiagnosticTestSummary {
  id: string;
  slug: string;
  title: string;
  module: IeltsTestRow["module"];
  writingTask2QuestionId: string | null;
  speakingPart2QuestionId: string | null;
}

export interface AvailableIeltsLearnAtom {
  activityId: string;
  atom: ReturnType<typeof toIeltsLearnAtom>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function metadataFlag(metadata: Json, key: string): boolean {
  return isRecord(metadata) && metadata[key] === true;
}

function hasQuickDiagnosticShape(
  rows: Array<{ skill: string; question_type: string }>,
): boolean {
  const skills = new Set(rows.map((row) => row.skill));
  const types = new Set(rows.map((row) => row.question_type));
  return (
    skills.has("listening") &&
    skills.has("reading") &&
    types.has("writing_task2_essay") &&
    types.has("speaking_part2_cuecard")
  );
}

function questionIdForType(
  rows: Array<{ id: string; question_type: string }>,
  questionType: string,
): string | null {
  return rows.find((row) => row.question_type === questionType)?.id ?? null;
}

export function ieltsLearnAtomKey(atom: AvailableIeltsLearnAtom["atom"]): string {
  return [
    atom.activityType,
    atom.skill,
    atom.questionIds.join(","),
    atom.rendererTags.join(","),
  ].join("|");
}

export async function findQuickDiagnosticTest(
  client?: IeltsDbClient,
): Promise<IeltsDiagnosticTestSummary | null> {
  const supabase = await resolveIeltsClient(client);
  const { data: tests, error } = await supabase
    .from("ielts_tests")
    .select("*")
    .eq("status", "published")
    .eq("kind", "full_mock")
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(QUICK_DIAGNOSTIC_LIMIT);
  if (error) throw new Error(`findQuickDiagnosticTest(tests): ${error.message}`);
  const candidates = tests ?? [];
  if (candidates.length === 0) return null;

  const { data: questions, error: questionError } = await supabase
    .from("ielts_questions")
    .select("id, test_id, skill, question_type")
    .in("test_id", candidates.map((test) => test.id));
  if (questionError) {
    throw new Error(`findQuickDiagnosticTest(questions): ${questionError.message}`);
  }

  const questionsByTest = new Map<
    string,
    Array<{ id: string; skill: string; question_type: string }>
  >();
  for (const question of questions ?? []) {
    const rows = questionsByTest.get(question.test_id) ?? [];
    rows.push({
      id: question.id,
      skill: question.skill,
      question_type: question.question_type,
    });
    questionsByTest.set(question.test_id, rows);
  }

  const test = candidates
    .filter((candidate) =>
      hasQuickDiagnosticShape(questionsByTest.get(candidate.id) ?? []),
    )
    .sort((left, right) => {
      const leftFlag =
        metadataFlag(left.metadata, "diagnostic") ||
        metadataFlag(left.metadata, "quick_diagnostic") ||
        left.slug.includes("diagnostic");
      const rightFlag =
        metadataFlag(right.metadata, "diagnostic") ||
        metadataFlag(right.metadata, "quick_diagnostic") ||
        right.slug.includes("diagnostic");
      if (leftFlag !== rightFlag) return leftFlag ? -1 : 1;
      return right.created_at.localeCompare(left.created_at);
    })[0];

  return test
    ? {
        id: test.id,
        slug: test.slug,
        title: test.title,
        module: test.module,
        writingTask2QuestionId: questionIdForType(
          questionsByTest.get(test.id) ?? [],
          "writing_task2_essay",
        ),
        speakingPart2QuestionId: questionIdForType(
          questionsByTest.get(test.id) ?? [],
          "speaking_part2_cuecard",
        ),
      }
    : null;
}

export async function listAvailableIeltsLearnAtoms(
  client?: IeltsDbClient,
): Promise<AvailableIeltsLearnAtom[]> {
  const supabase = await resolveIeltsClient(client);
  const { data, error } = await supabase
    .from("activities")
    .select("id, activity_type, content, duration_minutes, is_archived")
    .in("activity_type", [...IELTS_FIRST_TEXT_ACTIVITY_TYPES])
    .or("is_archived.is.null,is_archived.eq.false")
    .limit(LEARN_ATOM_LIMIT);
  if (error) throw new Error(`listAvailableIeltsLearnAtoms: ${error.message}`);

  return ((data ?? []) as ActivityRow[]).flatMap((row) => {
    const parsed = IeltsTextActivityContentSchema.safeParse(row.content);
    if (!parsed.success) return [];
    const atom = toIeltsLearnAtom(parsed.data);
    return [
      {
        activityId: row.id,
        atom: {
          ...atom,
          estimatedMinutes: row.duration_minutes ?? atom.estimatedMinutes,
        },
      },
    ];
  });
}

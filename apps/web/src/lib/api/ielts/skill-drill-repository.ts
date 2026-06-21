import "server-only";

import { randomUUID } from "node:crypto";
import {
  buildIeltsSkillDrill,
  type IeltsSkillDrillGeneration,
  type IeltsSkillDrillPlanReference,
  type IeltsSkillDrillQuestionCandidate,
} from "@/lib/ielts/skill-drill/generator";
import type { IeltsGeneratedStudyPlanItem } from "@/lib/ielts/study-plan";
import type { Json, Tables, TablesInsert } from "@/types/supabase";
import type { IeltsDbClient } from "./client";

const BANK_QUESTION_LIMIT = 200;

type SourceTest = Pick<Tables<"ielts_tests">, "id" | "status" | "module" | "metadata">;
type SourceQuestion = Tables<"ielts_questions"> & { ielts_tests: SourceTest | null };
type QuestionKey = Tables<"ielts_question_keys">;

export interface MaterializedSkillDrillTest {
  id: string;
  slug: string;
  title: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isGeneratedDrillMetadata(metadata: Json): boolean {
  return (
    isRecord(metadata) &&
    (metadata.generated_kind === "b2c_skill_drill" ||
      metadata.generated_by === "ielts_skill_drill_v1")
  );
}

function mergeMetadata(metadata: Json, extra: Record<string, Json>): Json {
  return {
    ...(isRecord(metadata) ? metadata : {}),
    ...extra,
  } as Json;
}

function toCandidate(row: SourceQuestion): IeltsSkillDrillQuestionCandidate {
  return {
    id: row.id,
    sourceTestId: row.test_id,
    skill: row.skill,
    questionType: row.question_type,
    maxPoints: row.max_points,
    orderIndex: row.order_index,
    module: row.ielts_tests?.module ?? "academic",
    published: row.ielts_tests?.status === "published",
    metadata: row.metadata,
  };
}

async function findExistingDrill(
  client: IeltsDbClient,
  slug: string,
): Promise<MaterializedSkillDrillTest | null> {
  const { data, error } = await client
    .from("ielts_tests")
    .select("id, slug, title")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`skillDrill(existing): ${error.message}`);
  return data;
}

async function loadBankQuestions(
  client: IeltsDbClient,
  reference: IeltsSkillDrillPlanReference,
): Promise<SourceQuestion[]> {
  let query = client
    .from("ielts_questions")
    .select(
      "*, ielts_tests!inner(id, status, module, metadata)",
    )
    .eq("skill", reference.skill)
    .eq("ielts_tests.status", "published")
    .eq("ielts_tests.module", reference.module)
    .order("order_index", { ascending: true })
    .limit(BANK_QUESTION_LIMIT);

  if (reference.questionTypes.length > 0) {
    query = query.in("question_type", reference.questionTypes);
  }

  const { data, error } = await query;
  if (error) throw new Error(`skillDrill(bank questions): ${error.message}`);
  return ((data ?? []) as unknown as SourceQuestion[]).filter(
    (row) => !isGeneratedDrillMetadata(row.ielts_tests?.metadata ?? null),
  );
}

async function loadKeys(
  client: IeltsDbClient,
  questionIds: string[],
): Promise<Map<string, QuestionKey>> {
  if (questionIds.length === 0) return new Map();
  const { data, error } = await client
    .from("ielts_question_keys")
    .select()
    .in("question_id", questionIds);
  if (error) throw new Error(`skillDrill(keys): ${error.message}`);
  return new Map((data ?? []).map((row) => [row.question_id, row]));
}

async function insertRows<T extends keyof TablesInsertMap>(
  client: IeltsDbClient,
  table: T,
  rows: TablesInsertMap[T][],
): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await client.from(table).insert(rows as never[]);
  if (error) throw new Error(`skillDrill(insert ${String(table)}): ${error.message}`);
}

type TablesInsertMap = {
  audio_assets: TablesInsert<"audio_assets">;
  passages: TablesInsert<"passages">;
  listening_sections: TablesInsert<"listening_sections">;
  ielts_questions: TablesInsert<"ielts_questions">;
  ielts_question_keys: TablesInsert<"ielts_question_keys">;
};

function orderedUnique<T>(values: readonly (T | null)[]): T[] {
  const seen = new Set<T>();
  const result: T[] = [];
  for (const value of values) {
    if (value === null || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

async function clonePassages(params: {
  client: IeltsDbClient;
  testId: string;
  sourceIds: string[];
}): Promise<Map<string, string>> {
  if (params.sourceIds.length === 0) return new Map();
  const { data, error } = await params.client
    .from("passages")
    .select()
    .in("id", params.sourceIds);
  if (error) throw new Error(`skillDrill(passages): ${error.message}`);
  const byId = new Map((data ?? []).map((row) => [row.id, row]));
  const map = new Map<string, string>();
  const inserts = params.sourceIds.flatMap((sourceId, index) => {
    const row = byId.get(sourceId);
    if (!row) return [];
    const id = randomUUID();
    map.set(sourceId, id);
    return [
      {
        id,
        test_id: params.testId,
        order_index: index,
        title: row.title,
        body: row.body,
        word_count: row.word_count,
        genre: row.genre,
        metadata: mergeMetadata(row.metadata, { source_passage_id: sourceId }),
      },
    ];
  });
  await insertRows(params.client, "passages", inserts);
  return map;
}

async function cloneAudioAssets(params: {
  client: IeltsDbClient;
  testId: string;
  sourceIds: string[];
}): Promise<Map<string, string>> {
  if (params.sourceIds.length === 0) return new Map();
  const { data, error } = await params.client
    .from("audio_assets")
    .select()
    .in("id", params.sourceIds);
  if (error) throw new Error(`skillDrill(audio): ${error.message}`);
  const byId = new Map((data ?? []).map((row) => [row.id, row]));
  const map = new Map<string, string>();
  const inserts = params.sourceIds.flatMap((sourceId) => {
    const row = byId.get(sourceId);
    if (!row) return [];
    const id = randomUUID();
    map.set(sourceId, id);
    return [
      {
        id,
        test_id: params.testId,
        kind: row.kind,
        script: row.script,
        voice: row.voice,
        accent: row.accent,
        tts_provider: row.tts_provider,
        storage_path: row.storage_path,
        duration_seconds: row.duration_seconds,
        status: row.status,
        version: row.version,
        metadata: mergeMetadata(row.metadata, { source_audio_asset_id: sourceId }),
      },
    ];
  });
  await insertRows(params.client, "audio_assets", inserts);
  return map;
}

async function cloneListeningSections(params: {
  client: IeltsDbClient;
  testId: string;
  sourceIds: string[];
}): Promise<Map<string, string>> {
  if (params.sourceIds.length === 0) return new Map();
  const { data, error } = await params.client
    .from("listening_sections")
    .select()
    .in("id", params.sourceIds);
  if (error) throw new Error(`skillDrill(listening): ${error.message}`);
  const byId = new Map((data ?? []).map((row) => [row.id, row]));
  const audioIds = orderedUnique((data ?? []).map((row) => row.audio_asset_id));
  const audioMap = await cloneAudioAssets({
    client: params.client,
    testId: params.testId,
    sourceIds: audioIds,
  });
  const map = new Map<string, string>();
  const inserts = params.sourceIds.flatMap((sourceId, index) => {
    const row = byId.get(sourceId);
    if (!row) return [];
    const id = randomUUID();
    map.set(sourceId, id);
    return [
      {
        id,
        test_id: params.testId,
        section_number: index + 1,
        order_index: index,
        title: row.title,
        script: row.script,
        accent: row.accent,
        audio_asset_id: row.audio_asset_id ? audioMap.get(row.audio_asset_id) ?? null : null,
        speakers: row.speakers,
        metadata: mergeMetadata(row.metadata, { source_listening_section_id: sourceId }),
      },
    ];
  });
  await insertRows(params.client, "listening_sections", inserts);
  return map;
}

async function createDrillTest(params: {
  client: IeltsDbClient;
  drill: IeltsSkillDrillGeneration;
  sourceRows: SourceQuestion[];
  keysBySourceId: Map<string, QuestionKey>;
}): Promise<MaterializedSkillDrillTest> {
  const testId = randomUUID();
  const now = new Date().toISOString();
  const { data: test, error } = await params.client
    .from("ielts_tests")
    .insert({
      id: testId,
      slug: params.drill.test.slug,
      title: params.drill.test.title,
      kind: params.drill.test.kind,
      module: params.drill.test.module,
      skill: params.drill.test.skill,
      status: "published",
      time_limit_seconds: params.drill.test.timeLimitSeconds,
      description: `Targeted ${params.drill.test.skill} practice generated from the IELTS item bank.`,
      published_at: now,
      metadata: params.drill.test.metadata as Json,
      created_at: now,
      updated_at: now,
    })
    .select("id, slug, title")
    .single();

  if (error) {
    const existing = await findExistingDrill(params.client, params.drill.test.slug);
    if (existing) return existing;
    throw new Error(`skillDrill(test): ${error.message}`);
  }

  try {
    const sourceById = new Map(params.sourceRows.map((row) => [row.id, row]));
    const selectedRows = params.drill.selectedQuestions.flatMap((question) => {
      const row = sourceById.get(question.id);
      return row ? [row] : [];
    });
    const passageMap = await clonePassages({
      client: params.client,
      testId,
      sourceIds: orderedUnique(selectedRows.map((row) => row.passage_id)),
    });
    const listeningMap = await cloneListeningSections({
      client: params.client,
      testId,
      sourceIds: orderedUnique(selectedRows.map((row) => row.listening_section_id)),
    });

    const questionIdBySource = new Map<string, string>();
    const questionInserts: TablesInsert<"ielts_questions">[] = selectedRows.map(
      (row, index) => {
        const id = randomUUID();
        questionIdBySource.set(row.id, id);
        return {
          id,
          test_id: testId,
          passage_id: row.passage_id ? passageMap.get(row.passage_id) ?? null : null,
          listening_section_id: row.listening_section_id
            ? listeningMap.get(row.listening_section_id) ?? null
            : null,
          skill: row.skill,
          question_type: row.question_type,
          order_index: index,
          group_key: row.group_key,
          group_instructions: row.group_instructions,
          prompt: row.prompt,
          options: row.options,
          max_points: row.max_points,
          word_limit: row.word_limit,
          visual: row.visual,
          metadata: mergeMetadata(row.metadata, {
            source_question_id: row.id,
            source_test_id: row.test_id,
            generated_by: "ielts_skill_drill_v1",
          }),
        };
      },
    );
    await insertRows(params.client, "ielts_questions", questionInserts);

    const keyInserts: TablesInsert<"ielts_question_keys">[] = selectedRows.map((row) => {
      const key = params.keysBySourceId.get(row.id);
      const questionId = questionIdBySource.get(row.id);
      if (!key || !questionId) throw new Error("skillDrill(keys): selected question is missing a key");
      return {
        question_id: questionId,
        correct_answer: key.correct_answer,
        accept_variants: key.accept_variants,
        explanation_en: key.explanation_en,
        explanation_vi: key.explanation_vi,
        model_answer: key.model_answer,
        examiner_notes: key.examiner_notes,
      };
    });
    await insertRows(params.client, "ielts_question_keys", keyInserts);
  } catch (error) {
    await params.client.from("ielts_tests").delete().eq("id", testId);
    throw error;
  }

  return test;
}

export async function materializeIeltsSkillDrill(params: {
  client: IeltsDbClient;
  userId: string;
  reference: IeltsSkillDrillPlanReference;
}): Promise<MaterializedSkillDrillTest | null> {
  const sourceRows = await loadBankQuestions(params.client, params.reference);
  const result = buildIeltsSkillDrill({
    userId: params.userId,
    skill: params.reference.skill,
    subskillKey: params.reference.subskillKey,
    targetMinutes: params.reference.targetMinutes,
    module: params.reference.module,
    questionTypes: params.reference.questionTypes,
    subskillTags: params.reference.subskillTags,
    difficultyBandHint: params.reference.difficultyBandHint,
    questions: sourceRows.map(toCandidate),
  });
  if (!result.ok) return null;

  const existing = await findExistingDrill(params.client, result.drill.test.slug);
  if (existing) return existing;

  const selectedIds = result.drill.selectedQuestions.map((question) => question.id);
  const keysBySourceId = await loadKeys(params.client, selectedIds);
  if (keysBySourceId.size < selectedIds.length) return null;

  return createDrillTest({ client: params.client, drill: result.drill, sourceRows, keysBySourceId });
}

export async function materializeSkillDrillsForItems(params: {
  client: IeltsDbClient;
  userId: string;
  items: readonly IeltsGeneratedStudyPlanItem[];
}): Promise<Map<string, MaterializedSkillDrillTest>> {
  const result = new Map<string, MaterializedSkillDrillTest>();
  for (const item of params.items) {
    if (item.reference.type !== "skill_drill") continue;
    if (result.has(item.reference.drillKey)) continue;
    const test = await materializeIeltsSkillDrill({
      client: params.client,
      userId: params.userId,
      reference: item.reference,
    });
    if (test) result.set(item.reference.drillKey, test);
  }
  return result;
}

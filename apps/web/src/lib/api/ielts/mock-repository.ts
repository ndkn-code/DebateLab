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
import {
  parseQuestionGroupView,
  type IeltsQuestionGroupRowLike,
  type IeltsQuestionGroupView,
} from "@/lib/ielts/question-types/groups";
import { toQuestionView } from "./mock-schema";

const QUESTION_COLUMNS =
  "id, skill, question_type, order_index, group_key, group_instructions, prompt, options, max_points, word_limit, visual, metadata, passage_id, listening_section_id";

export interface MockStructure {
  test: Tables<"ielts_tests">;
  passages: Array<Pick<Tables<"passages">, "id" | "title" | "body" | "order_index">>;
  listeningSections: Array<
    Omit<
      Pick<Tables<"listening_sections">, "id" | "title" | "script" | "section_number" | "order_index" | "audio_asset_id">,
      "script"
    > & { script: string | null }
  >;
  audioAssets: Array<
    Pick<Tables<"audio_assets">, "id" | "status" | "version" | "storage_path">
  >;
  questions: IeltsQuestionView[];
  /**
   * Set-level question groups (shared banks, summary/table/flow-chart/diagram
   * stimuli) ordered by `order_index`. Empty for legacy tests/attempts.
   */
  questionGroups: IeltsQuestionGroupView[];
}

/** Group columns read from `ielts_question_groups` (live) for the player. */
export type LiveGroupRow = Pick<
  Tables<"ielts_question_groups">,
  | "id"
  | "group_key"
  | "skill"
  | "passage_id"
  | "listening_section_id"
  | "order_index"
  | "title"
  | "instructions"
  | "stimulus"
  | "bank"
  | "bank_reuse"
  | "answer_mode"
  | "any_order"
>;

/** Group columns read from the per-attempt snapshot. */
export type FrozenGroupBlueprintRow = Pick<
  Tables<"ielts_attempt_question_group_blueprints">,
  | "id"
  | "group_id"
  | "group_key"
  | "skill"
  | "passage_id"
  | "listening_section_id"
  | "order_index"
  | "title"
  | "instructions"
  | "stimulus"
  | "bank"
  | "bank_reuse"
  | "answer_mode"
  | "any_order"
>;

const GROUP_COLUMNS =
  "id, group_key, skill, passage_id, listening_section_id, order_index, title, instructions, stimulus, bank, bank_reuse, answer_mode, any_order";
const FROZEN_GROUP_COLUMNS = `${GROUP_COLUMNS}, group_id`;

/**
 * Pure projection: group rows + the test's questions (already in display
 * order) → renderer-facing group views. Members are the questions sharing the
 * row's `group_key`; groups are ordered by `order_index`.
 */
export function buildQuestionGroups(
  rows: readonly IeltsQuestionGroupRowLike[],
  questions: readonly IeltsQuestionView[],
): IeltsQuestionGroupView[] {
  const membersByKey = new Map<string, IeltsQuestionView[]>();
  for (const question of questions) {
    if (!question.groupKey) continue;
    const list = membersByKey.get(question.groupKey) ?? [];
    list.push(question);
    membersByKey.set(question.groupKey, list);
  }
  return [...rows]
    .sort((a, b) => a.order_index - b.order_index)
    .map((row) =>
      parseQuestionGroupView(
        row,
        // The view already carries the parsed `metadata.slot`; re-wrap it so the
        // shared slot resolver (which reads metadata) sees the same value.
        (membersByKey.get(row.group_key) ?? []).map((question) => ({
          id: question.id,
          metadata: question.slot ? { slot: question.slot } : {},
        })),
      ),
    );
}

export interface AttemptState {
  attempt: Tables<"ielts_attempts">;
  sections: Tables<"ielts_attempt_sections">[];
  responses: Tables<"ielts_question_responses">[];
  bandScore: Tables<"attempt_band_scores"> | null;
  /** Frozen content used by the player after a snapshot-backed attempt starts. */
  structure?: MockStructure;
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

  const [passages, listeningSections, audioAssets, questions, groups] = await Promise.all([
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
    supabase
      .from("ielts_question_groups")
      .select(GROUP_COLUMNS)
      .eq("test_id", testId)
      .order("order_index"),
  ]);

  for (const result of [passages, listeningSections, audioAssets, questions, groups]) {
    if (result.error) throw new Error(`loadMockStructure: ${result.error.message}`);
  }

  const questionViews = (questions.data ?? []).map(toQuestionView);
  return {
    test,
    passages: passages.data ?? [],
    // Listening scripts are grading material, never learner material.
    listeningSections: (listeningSections.data ?? []).map((section) => ({
      ...section,
      script: null,
    })),
    audioAssets: audioAssets.data ?? [],
    questions: questionViews,
    questionGroups: buildQuestionGroups(
      (groups.data ?? []) as LiveGroupRow[],
      questionViews,
    ),
  };
}

export type FrozenBlueprintRow = Pick<
  Tables<"ielts_attempt_question_blueprints">,
  | "id"
  | "question_id"
  | "skill"
  | "question_type"
  | "question_order"
  | "group_key"
  | "group_instructions"
  | "prompt"
  | "options"
  | "max_points"
  | "word_limit"
  | "visual"
  | "metadata"
  | "passage_id"
  | "listening_section_id"
  | "source_title"
  | "source_body"
  | "source_audio_asset_id"
  | "source_audio_storage_path"
  | "source_audio_version"
  | "source_audio_status"
  | "test_id"
  | "source_updated_at"
>;

function questionFromFrozenBlueprint(row: FrozenBlueprintRow): IeltsQuestionView {
  return toQuestionView({
    id: row.question_id,
    skill: row.skill,
    question_type: row.question_type,
    order_index: row.question_order,
    group_key: row.group_key,
    group_instructions: row.group_instructions,
    prompt: row.prompt,
    options: row.options,
    max_points: row.max_points,
    word_limit: row.word_limit,
    visual: row.visual,
    metadata: row.metadata,
    passage_id: row.passage_id,
    listening_section_id: row.listening_section_id,
  });
}

/** Pure projection used by the loader and regression-tested without a DB. */
export function buildMockStructureFromFrozenBlueprint(
  test: Tables<"ielts_tests">,
  blueprints: FrozenBlueprintRow[],
  groupBlueprints: FrozenGroupBlueprintRow[] = [],
): MockStructure {
  const passages = new Map<
    string,
    Pick<Tables<"passages">, "id" | "title" | "body" | "order_index">
  >();
  const listeningSections = new Map<string, MockStructure["listeningSections"][number]>();
  const audioAssets = new Map<
    string,
    Pick<Tables<"audio_assets">, "id" | "status" | "version" | "storage_path">
  >();
  const questions = blueprints.map(questionFromFrozenBlueprint);
  for (const row of blueprints) {
    if (row.passage_id && row.source_body !== null) {
      passages.set(row.passage_id, {
        id: row.passage_id,
        title: row.source_title ?? "",
        body: row.source_body,
        order_index: row.question_order,
      });
    }
    if (row.listening_section_id && row.source_body !== null) {
      if (!listeningSections.has(row.listening_section_id)) {
        listeningSections.set(row.listening_section_id, {
          id: row.listening_section_id,
          title: row.source_title,
          script: null,
          section_number: row.question_order,
          order_index: row.question_order,
          audio_asset_id: row.source_audio_asset_id,
        });
      }
      if (row.source_audio_asset_id) {
        audioAssets.set(row.source_audio_asset_id, {
          id: row.source_audio_asset_id,
          status: row.source_audio_status as Tables<"audio_assets">["status"],
          version: row.source_audio_version ?? 1,
          storage_path: row.source_audio_storage_path,
        });
      }
    }
  }
  return {
    test,
    passages: [...passages.values()].sort((a, b) => a.order_index - b.order_index),
    listeningSections: [...listeningSections.values()].sort(
      (a, b) => a.order_index - b.order_index,
    ),
    audioAssets: [...audioAssets.values()],
    questions,
    questionGroups: buildQuestionGroups(groupBlueprints, questions),
  };
}

/**
 * Load the immutable structure belonging to an attempt. Frozen attempts never
 * read mutable question, passage, listening, or audio rows. Legacy attempts
 * fall back to the published test structure for compatibility.
 */
export async function loadAttemptStructure(
  attemptId: string,
): Promise<MockStructure | null> {
  const supabase = await createTypedServerClient();
  const { data: attempt, error: attemptError } = await supabase
    .from("ielts_attempts")
    .select("id, test_id, blueprint_frozen_at")
    .eq("id", attemptId)
    .maybeSingle();
  if (attemptError) throw new Error(`loadAttemptStructure(attempt): ${attemptError.message}`);
  if (!attempt) return null;

  if (!attempt.blueprint_frozen_at) return loadMockStructure(attempt.test_id);

  const [testResult, blueprintResult, groupResult] = await Promise.all([
    supabase.from("ielts_tests").select().eq("id", attempt.test_id).maybeSingle(),
    supabase
      .from("ielts_attempt_question_blueprints")
      .select(
        "id, question_id, skill, question_type, question_order, group_key, group_instructions, prompt, options, max_points, word_limit, visual, metadata, passage_id, listening_section_id, source_title, source_body, source_audio_asset_id, source_audio_storage_path, source_audio_version, source_audio_status, test_id, source_updated_at",
      )
      .eq("attempt_id", attemptId)
      .order("question_order"),
    supabase
      .from("ielts_attempt_question_group_blueprints")
      .select(FROZEN_GROUP_COLUMNS)
      .eq("attempt_id", attemptId)
      .order("order_index"),
  ]);
  if (testResult.error) throw new Error(`loadAttemptStructure(test): ${testResult.error.message}`);
  if (blueprintResult.error)
    throw new Error(`loadAttemptStructure(blueprint): ${blueprintResult.error.message}`);
  if (groupResult.error)
    throw new Error(`loadAttemptStructure(groups): ${groupResult.error.message}`);
  if (!testResult.data) return null;
  const blueprints = (blueprintResult.data ?? []) as FrozenBlueprintRow[];
  if (blueprints.length === 0) throw new Error("loadAttemptStructure: frozen blueprint missing");
  // Legacy attempts (frozen before groups existed) simply have no group rows.
  const groupBlueprints = (groupResult.data ?? []) as FrozenGroupBlueprintRow[];

  return buildMockStructureFromFrozenBlueprint(testResult.data, blueprints, groupBlueprints);
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

  const [sections, responses, bandScore, structure] = await Promise.all([
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
    loadAttemptStructure(attemptId),
  ]);

  if (sections.error) throw new Error(`loadAttemptState(sections): ${sections.error.message}`);
  if (responses.error) throw new Error(`loadAttemptState(responses): ${responses.error.message}`);
  if (bandScore.error) throw new Error(`loadAttemptState(band): ${bandScore.error.message}`);

  return {
    attempt,
    sections: sections.data ?? [],
    responses: responses.data ?? [],
    bandScore: bandScore.data,
    structure: structure ?? undefined,
  };
}

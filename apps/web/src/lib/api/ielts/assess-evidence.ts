import "server-only";

import { parseInput } from "@/lib/api/boundary";
import {
  AdaptiveQuestionMetadataSchema,
  IeltsAdaptiveEvidenceSchema,
  deriveIeltsSkillStates,
  toIeltsSkillStateUpsert,
  type IeltsAdaptiveEvidence,
} from "@/lib/ielts/adaptive/evidence";
import type { Json, Tables, TablesInsert } from "@/types/supabase";
import type { IeltsDbClient } from "./client";

type QuestionRow = Pick<
  Tables<"ielts_questions">,
  "id" | "skill" | "question_type" | "max_points" | "metadata"
>;
type ObjectiveResponseRow = Pick<
  Tables<"ielts_question_responses">,
  "id" | "question_id" | "awarded_points"
>;
type AttemptRow = Pick<
  Tables<"ielts_attempts">,
  "id" | "user_id" | "test_id" | "module"
>;
type TestRow = Pick<Tables<"ielts_tests">, "id" | "kind" | "metadata">;
type BandRow = Pick<
  Tables<"attempt_band_scores">,
  | "id"
  | "listening_raw"
  | "reading_raw"
  | "listening_band"
  | "reading_band"
  | "writing_band"
  | "speaking_band"
>;
const FALLBACK_SUBSKILL_BY_SKILL = {
  listening: "listening:mcq_single",
  reading: "reading:mcq_single",
  writing: "writing:task_response_task2",
  speaking: "speaking:fluency_coherence",
} as const;

function roundDecimal(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

export function evidenceValueFromBand(band: number): number {
  return roundDecimal(Math.max(0, Math.min(9, band)) / 9, 4);
}

function objectiveEvidenceValue(row: ObjectiveResponseRow, question: QuestionRow): number {
  const maxPoints = Math.max(1, question.max_points);
  return roundDecimal(Math.max(0, row.awarded_points ?? 0) / maxPoints, 4);
}

function metadataTags(question: QuestionRow): string[] {
  const parsed = AdaptiveQuestionMetadataSchema.safeParse(question.metadata ?? {});
  if (!parsed.success) return [];
  return parsed.data.subskill_tags?.filter((tag) => tag.startsWith(`${question.skill}:`)) ?? [];
}

async function resolveSubskillKeys(
  client: IeltsDbClient,
  candidatesByQuestion: Map<string, string[]>,
): Promise<Map<string, string>> {
  const allCandidates = [...new Set([...candidatesByQuestion.values()].flat())];
  if (allCandidates.length === 0) return new Map();

  const { data, error } = await client
    .from("ielts_subskills")
    .select("key")
    .in("key", allCandidates)
    .eq("is_active", true);
  if (error) throw new Error(`resolveSubskillKeys: ${error.message}`);
  const available = new Set((data ?? []).map((row) => row.key));
  const resolved = new Map<string, string>();
  for (const [id, candidates] of candidatesByQuestion) {
    const key = candidates.find((candidate) => available.has(candidate));
    if (key) resolved.set(id, key);
  }
  return resolved;
}

function rowToEvidence(row: Pick<Tables<"ielts_adaptive_evidence">,
  | "user_id"
  | "subskill_key"
  | "skill"
  | "module"
  | "test_kind"
  | "question_type"
  | "criterion"
  | "evidence_type"
  | "evidence_value"
  | "band_estimate"
  | "raw_score"
  | "confidence"
  | "source_table"
  | "source_id"
  | "reason_en"
  | "reason_vi"
  | "created_at"
>): IeltsAdaptiveEvidence {
  return parseInput(IeltsAdaptiveEvidenceSchema, {
    userId: row.user_id,
    subskillKey: row.subskill_key,
    skill: row.skill,
    module: row.module,
    testKind: row.test_kind,
    questionType: row.question_type,
    criterion: row.criterion,
    evidenceType: row.evidence_type,
    evidenceValue: row.evidence_value,
    bandEstimate: row.band_estimate,
    rawScore: row.raw_score,
    confidence: row.confidence,
    sourceTable: row.source_table,
    sourceId: row.source_id,
    reasonEn: row.reason_en,
    reasonVi: row.reason_vi,
    createdAt: row.created_at,
  });
}

async function refreshSkillStates(params: {
  client: IeltsDbClient;
  userId: string;
  module: AttemptRow["module"];
  subskillKeys: string[];
}): Promise<void> {
  const keys = [...new Set(params.subskillKeys)];
  if (keys.length === 0) return;

  const { data, error } = await params.client
    .from("ielts_adaptive_evidence")
    .select(
      "user_id, subskill_key, skill, module, test_kind, question_type, criterion, evidence_type, evidence_value, band_estimate, raw_score, confidence, source_table, source_id, reason_en, reason_vi, created_at",
    )
    .eq("user_id", params.userId)
    .eq("module", params.module)
    .in("subskill_key", keys);
  if (error) throw new Error(`refreshAssessSkillStates(select): ${error.message}`);

  const states = deriveIeltsSkillStates((data ?? []).map(rowToEvidence));
  if (states.length === 0) return;
  const { error: upsertError } = await params.client
    .from("ielts_skill_states")
    .upsert(states.map((state) => toIeltsSkillStateUpsert(state)), {
      onConflict: "user_id,module,subskill_key",
    });
  if (upsertError) {
    throw new Error(`refreshAssessSkillStates(upsert): ${upsertError.message}`);
  }
}

export async function insertAssessEvidenceRows(params: {
  client: IeltsDbClient;
  rows: TablesInsert<"ielts_adaptive_evidence">[];
  userId: string;
  module: AttemptRow["module"];
}): Promise<void> {
  if (params.rows.length === 0) return;
  const { error } = await params.client.from("ielts_adaptive_evidence").insert(params.rows);
  if (error) throw new Error(`insertAssessEvidenceRows: ${error.message}`);
  await refreshSkillStates({
    client: params.client,
    userId: params.userId,
    module: params.module,
    subskillKeys: params.rows.map((row) => row.subskill_key),
  });
}

function objectiveBandForSkill(
  skill: QuestionRow["skill"],
  band: BandRow,
): number | null {
  if (skill === "listening") return band.listening_band;
  if (skill === "reading") return band.reading_band;
  return null;
}

function objectiveRawForSkill(skill: QuestionRow["skill"], band: BandRow): number | null {
  if (skill === "listening") return band.listening_raw;
  if (skill === "reading") return band.reading_raw;
  return null;
}

export function makeAssessEvidenceInsert(
  parsed: IeltsAdaptiveEvidence,
  metadata: Json,
): TablesInsert<"ielts_adaptive_evidence"> {
  return {
    user_id: parsed.userId,
    subskill_key: parsed.subskillKey,
    skill: parsed.skill,
    module: parsed.module,
    test_kind: parsed.testKind ?? null,
    question_type: parsed.questionType ?? null,
    criterion: parsed.criterion ?? null,
    evidence_type: parsed.evidenceType,
    evidence_value: parsed.evidenceValue,
    band_estimate: parsed.bandEstimate ?? null,
    raw_score: parsed.rawScore ?? null,
    confidence: parsed.confidence,
    source_table: parsed.sourceTable,
    source_id: parsed.sourceId,
    reason_en: parsed.reasonEn,
    reason_vi: parsed.reasonVi,
    metadata,
    created_at: parsed.createdAt,
  };
}

export async function recordIeltsObjectiveAttemptEvidence(params: {
  client: IeltsDbClient;
  attemptId: string;
}): Promise<void> {
  const { client } = params;
  const { data: attempt, error: attemptError } = await client
    .from("ielts_attempts")
    .select("id, user_id, test_id, module")
    .eq("id", params.attemptId)
    .maybeSingle();
  if (attemptError) throw new Error(`recordObjectiveEvidence(attempt): ${attemptError.message}`);
  if (!attempt) return;

  const [testResult, bandResult, questionResult, responseResult] = await Promise.all([
    client.from("ielts_tests").select("id, kind, metadata").eq("id", attempt.test_id).maybeSingle(),
    client
      .from("attempt_band_scores")
      .select("id, listening_raw, reading_raw, listening_band, reading_band, writing_band, speaking_band")
      .eq("attempt_id", attempt.id)
      .maybeSingle(),
    client
      .from("ielts_questions")
      .select("id, skill, question_type, max_points, metadata")
      .eq("test_id", attempt.test_id)
      .in("skill", ["listening", "reading"]),
    client
      .from("ielts_question_responses")
      .select("id, question_id, awarded_points")
      .eq("attempt_id", attempt.id),
  ]);
  if (testResult.error) throw new Error(`recordObjectiveEvidence(test): ${testResult.error.message}`);
  if (bandResult.error) throw new Error(`recordObjectiveEvidence(band): ${bandResult.error.message}`);
  if (questionResult.error) throw new Error(`recordObjectiveEvidence(questions): ${questionResult.error.message}`);
  if (responseResult.error) throw new Error(`recordObjectiveEvidence(responses): ${responseResult.error.message}`);
  if (!testResult.data || !bandResult.data) return;

  const test = testResult.data as TestRow;
  const band = bandResult.data as BandRow;
  const questions = (questionResult.data ?? []) as QuestionRow[];
  const responses = (responseResult.data ?? []) as ObjectiveResponseRow[];
  const questionById = new Map(questions.map((question) => [question.id, question]));
  const candidates = new Map<string, string[]>();
  for (const question of questions) {
    candidates.set(question.id, [
      ...metadataTags(question),
      `${question.skill}:${question.question_type}`,
      FALLBACK_SUBSKILL_BY_SKILL[question.skill],
    ]);
  }
  const subskillByQuestionId = await resolveSubskillKeys(client, candidates);
  const createdAt = new Date().toISOString();

  const rows = responses.flatMap((response) => {
    const question = questionById.get(response.question_id);
    if (!question) return [];
    const bandEstimate = objectiveBandForSkill(question.skill, band);
    const subskillKey = subskillByQuestionId.get(question.id);
    if (bandEstimate == null || !subskillKey) return [];
    const rawScore = objectiveRawForSkill(question.skill, band);
    const parsed = parseInput(IeltsAdaptiveEvidenceSchema, {
      userId: attempt.user_id,
      subskillKey,
      skill: question.skill,
      module: attempt.module,
      testKind: test.kind,
      questionType: question.question_type,
      evidenceType: "objective_response",
      evidenceValue: objectiveEvidenceValue(response, question),
      bandEstimate,
      rawScore: response.awarded_points,
      confidence: 0.58,
      sourceTable: "ielts_question_responses",
      sourceId: response.id,
      reasonEn: `${question.skill} diagnostic response contributed to a provisional band ${bandEstimate.toFixed(1)} signal.`,
      reasonVi: `Câu trả lời chẩn đoán kỹ năng ${question.skill} đóng góp tín hiệu band tạm tính ${bandEstimate.toFixed(1)}.`,
      createdAt,
    });
    return [
      makeAssessEvidenceInsert(parsed, {
        attempt_id: attempt.id,
        test_id: attempt.test_id,
        band_score_id: band.id,
        question_id: question.id,
        skill_raw_score: rawScore,
      } satisfies Json),
    ];
  });

  await insertAssessEvidenceRows({
    client,
    rows,
    userId: attempt.user_id,
    module: attempt.module,
  });
}

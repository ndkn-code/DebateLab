import "server-only";

import type { Json, Tables, TablesInsert } from "@/types/supabase";
import { parseInput } from "@/lib/api/boundary";
import {
  IeltsAdaptiveEvidenceSchema,
  deriveIeltsSkillStates,
  toIeltsSkillStateUpsert,
  type IeltsAdaptiveEvidence,
} from "@/lib/ielts/adaptive/evidence";
import { IeltsSkillSchema } from "@/lib/ielts/adaptive/contracts";
import {
  IELTS_FIRST_TEXT_ACTIVITY_TYPES,
  IeltsTextActivityContentSchema,
  type IeltsTextActivityContent,
} from "@/lib/ielts/learn/text-activities";
import { createTypedAdminClient } from "@/lib/supabase/admin";
import type { IeltsDbClient } from "./client";
import type { IeltsTextActivityScoreResult } from "./learn-activities";

type EvidenceSelectRow = Pick<
  Tables<"ielts_adaptive_evidence">,
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
>;

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function roundDecimal(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function evidenceReason(params: {
  activityType: IeltsTextActivityScoreResult["activityType"];
  score: number;
  maxScore: number;
  subskillKey: string;
}): { en: string; vi: string } {
  const ratio =
    params.maxScore > 0 ? Math.round((params.score / params.maxScore) * 100) : 0;
  return {
    en: `${params.activityType.replaceAll("_", " ")} recorded ${ratio}% for ${params.subskillKey}.`,
    vi: `${params.activityType.replaceAll("_", " ")} ghi nhận ${ratio}% cho ${params.subskillKey}.`,
  };
}

function rowToEvidence(row: EvidenceSelectRow): IeltsAdaptiveEvidence {
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
  userId: string;
  module: IeltsTextActivityContent["module"];
  subskillKeys: string[];
  client: IeltsDbClient;
}): Promise<void> {
  const { data, error } = await params.client
    .from("ielts_adaptive_evidence")
    .select(
      "user_id, subskill_key, skill, module, test_kind, question_type, criterion, evidence_type, evidence_value, band_estimate, raw_score, confidence, source_table, source_id, reason_en, reason_vi, created_at",
    )
    .eq("user_id", params.userId)
    .eq("module", params.module)
    .in("subskill_key", params.subskillKeys);
  if (error) {
    throw new Error(`refreshSkillStates (select): ${error.message}`);
  }

  const states = deriveIeltsSkillStates((data ?? []).map(rowToEvidence));
  if (states.length === 0) return;

  const upserts = states.map((state) => toIeltsSkillStateUpsert(state));
  const { error: upsertError } = await params.client
    .from("ielts_skill_states")
    .upsert(upserts, { onConflict: "user_id,module,subskill_key" });
  if (upsertError) {
    throw new Error(`refreshSkillStates (upsert): ${upsertError.message}`);
  }
}

export async function recordIeltsLearnActivityEvidence(params: {
  userId: string;
  activityId: string;
  attemptId: string;
  content: unknown;
  scoring: IeltsTextActivityScoreResult;
  timeSpentSeconds: number;
}): Promise<void> {
  if (!IELTS_FIRST_TEXT_ACTIVITY_TYPES.includes(params.scoring.activityType)) return;
  const content = parseInput(IeltsTextActivityContentSchema, params.content);
  const admin = createTypedAdminClient();
  const grouped = new Map<
    string,
    Array<IeltsTextActivityScoreResult["sourceScores"][number]>
  >();

  for (const sourceScore of params.scoring.sourceScores) {
    const group = grouped.get(sourceScore.subskillKey) ?? [];
    group.push(sourceScore);
    grouped.set(sourceScore.subskillKey, group);
  }

  const createdAt = new Date().toISOString();
  const rows: TablesInsert<"ielts_adaptive_evidence">[] = [...grouped.entries()].map(
    ([subskillKey, sourceScores]) => {
      const evidenceValue = average(
        sourceScores.map((source) =>
          source.maxPoints > 0 ? source.awardedPoints / source.maxPoints : 0,
        ),
      );
      const skill = parseInput(IeltsSkillSchema, subskillKey.split(":")[0]);
      const rawScore = sourceScores.reduce(
        (sum, source) => sum + source.awardedPoints,
        0,
      );
      const maxScore = sourceScores.reduce((sum, source) => sum + source.maxPoints, 0);
      const reason = evidenceReason({
        activityType: params.scoring.activityType,
        score: rawScore,
        maxScore,
        subskillKey,
      });

      const parsed = parseInput(IeltsAdaptiveEvidenceSchema, {
        userId: params.userId,
        subskillKey,
        skill,
        module: content.module,
        questionType: sourceScores[0]?.questionType ?? null,
        evidenceType: "learn_activity",
        evidenceValue: roundDecimal(evidenceValue, 4),
        rawScore,
        confidence: 0.45,
        sourceTable: "activity_attempts",
        sourceId: params.attemptId,
        reasonEn: reason.en,
        reasonVi: reason.vi,
        createdAt,
      });

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
        metadata: {
          activity_id: params.activityId,
          activity_type: params.scoring.activityType,
          score: rawScore,
          max_score: maxScore,
          source_question_ids: sourceScores.map((source) => source.questionId),
          time_spent_seconds: params.timeSpentSeconds,
        } satisfies Json,
        created_at: parsed.createdAt,
      };
    },
  );

  if (rows.length === 0) return;
  const { error } = await admin.from("ielts_adaptive_evidence").insert(rows);
  if (error) {
    throw new Error(`recordIeltsLearnActivityEvidence: ${error.message}`);
  }

  await refreshSkillStates({
    userId: params.userId,
    module: content.module,
    subskillKeys: [...grouped.keys()],
    client: admin,
  });
}

/**
 * Read-time IELTS band prediction repository (WS-6.1.1).
 *
 * Learner-facing reads stay RLS-own: `ielts_adaptive_evidence`,
 * `ielts_skill_states`, and active `ielts_subskills` are selected through the
 * cookie-bound typed Supabase client. The predictor is pure and lives under
 * `lib/scoring/ielts-prediction`; this file only maps DB rows into evidence
 * observations and validates the shared Track B/C contract at the boundary.
 */
import "server-only";
import {
  DEFAULT_IELTS_TARGET_BAND,
  IeltsBandPredictionSchema,
  type IeltsBandEvidenceSource,
  type IeltsBandPrediction,
  type IeltsModule,
  type LoadIeltsPredictionForPlanning,
  type LoadIeltsPredictionForPlanningOptions,
} from "@/lib/ielts/adaptive/contracts";
import {
  buildIeltsBandPrediction,
  type IeltsPredictionObservation,
  type IeltsPredictionSubskillState,
} from "@/lib/scoring/ielts-prediction";
import type { Tables } from "@/types/supabase";
import { resolveIeltsClient, type IeltsDbClient } from "./client";

const DEFAULT_MODULE: IeltsModule = "academic";
const EVIDENCE_LIMIT = 600;
const STATE_LIMIT = 120;

/**
 * Selection list + row mapping for `ielts_adaptive_evidence`. Exported so the
 * prediction-quality backtest (Wave 6.3 Workstream B) replays the served
 * `weighted-recency-v1` model on EVIDENCE MAPPED IDENTICALLY to this read path —
 * same source/coverage/reliability weighting — instead of a divergent copy.
 */
export const EVIDENCE_COLUMNS =
  "id, skill, module, subskill_key, question_type, criterion, evidence_type, evidence_value, band_estimate, raw_score, confidence, source_table, source_id, reason_en, reason_vi, created_at";
const STATE_COLUMNS =
  "id, skill, module, subskill_key, question_type, criterion, mastery_score, band_estimate, confidence, weakness_weight, evidence_count, last_evidence_at";
const SUBSKILL_COLUMNS = "key, label_en, label_vi, question_type";

export type EvidenceRow = Pick<
  Tables<"ielts_adaptive_evidence">,
  | "id"
  | "skill"
  | "module"
  | "subskill_key"
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
type SkillStateRow = Pick<
  Tables<"ielts_skill_states">,
  | "id"
  | "skill"
  | "module"
  | "subskill_key"
  | "question_type"
  | "criterion"
  | "mastery_score"
  | "band_estimate"
  | "confidence"
  | "weakness_weight"
  | "evidence_count"
  | "last_evidence_at"
>;
export type SubskillRow = Pick<
  Tables<"ielts_subskills">,
  "key" | "label_en" | "label_vi" | "question_type"
>;
type EvidenceType = EvidenceRow["evidence_type"];

export interface LoadIeltsBandPredictionOptions
  extends LoadIeltsPredictionForPlanningOptions {
  asOf?: string;
  client?: IeltsDbClient;
}

const SOURCE_BY_TYPE = {
  mock_result: "full_mock",
  section_result: "skill_mock",
  objective_response: "objective_drill",
  writing_score: "writing_task",
  speaking_score: "speaking_part",
  phoneme_signal: "speaking_part",
  learn_activity: "learn_activity",
  review_result: "learn_activity",
  diagnostic_import: "skill_mock",
  manual_adjustment: "skill_mock",
} satisfies Record<EvidenceType, IeltsBandEvidenceSource>;

const COVERAGE_BY_TYPE = {
  mock_result: 1,
  section_result: 0.85,
  objective_response: 0.55,
  writing_score: 0.75,
  speaking_score: 0.7,
  phoneme_signal: 0.45,
  learn_activity: 0.4,
  review_result: 0.35,
  diagnostic_import: 0.8,
  manual_adjustment: 0.75,
} satisfies Record<EvidenceType, number>;

const LABEL_BY_TYPE = {
  mock_result: "IELTS mock result",
  section_result: "IELTS section result",
  objective_response: "Objective response",
  writing_score: "Writing score",
  speaking_score: "Speaking score",
  phoneme_signal: "Pronunciation signal",
  learn_activity: "Learn activity",
  review_result: "Review result",
  diagnostic_import: "Diagnostic import",
  manual_adjustment: "Teacher adjustment",
} satisfies Record<EvidenceType, string>;

function fallbackLabel(key: string): string {
  const [, tail = key] = key.split(":");
  return tail
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function sourceFor(row: EvidenceRow): IeltsBandEvidenceSource {
  return row.source_table === "practice_attempts"
    ? "debate_prior"
    : SOURCE_BY_TYPE[row.evidence_type];
}

export function mapEvidence(
  row: EvidenceRow,
  labels: ReadonlyMap<string, SubskillRow>,
): IeltsPredictionObservation {
  const source = sourceFor(row);
  const label = labels.get(row.subskill_key)?.label_en ?? fallbackLabel(row.subskill_key);
  const coverage = source === "debate_prior" ? 0.15 : COVERAGE_BY_TYPE[row.evidence_type];
  return {
    skill: row.skill,
    band: source === "debate_prior" ? null : row.band_estimate,
    occurredAt: row.created_at,
    source,
    label: `${LABEL_BY_TYPE[row.evidence_type]} · ${label}`,
    reliability: source === "debate_prior" ? Math.min(row.confidence, 0.15) : row.confidence,
    coverage,
    rawScore: row.raw_score,
    subskillKey: row.subskill_key,
    questionType: row.question_type,
    criterion: row.criterion,
    reasonEn: row.reason_en,
    reasonVi: row.reason_vi,
  };
}

function mapState(
  row: SkillStateRow,
  labels: ReadonlyMap<string, SubskillRow>,
): IeltsPredictionSubskillState {
  const subskill = labels.get(row.subskill_key);
  return {
    skill: row.skill,
    subskillKey: row.subskill_key,
    labelEn: subskill?.label_en ?? fallbackLabel(row.subskill_key),
    labelVi: subskill?.label_vi ?? fallbackLabel(row.subskill_key),
    bandEstimate: row.band_estimate,
    masteryScore: row.mastery_score,
    confidence: row.confidence,
    weaknessWeight: row.weakness_weight,
    evidenceCount: row.evidence_count,
    questionType: row.question_type ?? subskill?.question_type ?? null,
    criterion: row.criterion,
    lastEvidenceAt: row.last_evidence_at,
  };
}

async function loadSubskills(
  client: IeltsDbClient,
  keys: readonly string[],
): Promise<Map<string, SubskillRow>> {
  if (keys.length === 0) return new Map();
  const uniqueKeys = [...new Set(keys)];
  const { data, error } = await client
    .from("ielts_subskills")
    .select(SUBSKILL_COLUMNS)
    .in("key", uniqueKeys);
  if (error) throw new Error(`loadIeltsBandPrediction(subskills): ${error.message}`);
  return new Map(((data ?? []) as SubskillRow[]).map((row) => [row.key, row]));
}

async function loadPredictionRows(
  client: IeltsDbClient,
  userId: string,
  module: IeltsModule,
): Promise<{ evidence: EvidenceRow[]; states: SkillStateRow[] }> {
  const [evidence, states] = await Promise.all([
    client
      .from("ielts_adaptive_evidence")
      .select(EVIDENCE_COLUMNS)
      .eq("user_id", userId)
      .eq("module", module)
      .order("created_at", { ascending: false })
      .limit(EVIDENCE_LIMIT),
    client
      .from("ielts_skill_states")
      .select(STATE_COLUMNS)
      .eq("user_id", userId)
      .eq("module", module)
      .order("weakness_weight", { ascending: false })
      .limit(STATE_LIMIT),
  ]);
  if (evidence.error) {
    throw new Error(`loadIeltsBandPrediction(evidence): ${evidence.error.message}`);
  }
  if (states.error) {
    throw new Error(`loadIeltsBandPrediction(states): ${states.error.message}`);
  }
  return {
    evidence: (evidence.data ?? []) as EvidenceRow[],
    states: (states.data ?? []) as SkillStateRow[],
  };
}

export async function loadIeltsBandPrediction(
  userId: string,
  options: LoadIeltsBandPredictionOptions = {},
): Promise<IeltsBandPrediction> {
  const ieltsModule = options.module ?? DEFAULT_MODULE;
  const targetBand = options.targetBand ?? DEFAULT_IELTS_TARGET_BAND;
  const client = await resolveIeltsClient(options.client);
  const rows = await loadPredictionRows(client, userId, ieltsModule);
  const subskillKeys = [
    ...rows.evidence.map((row) => row.subskill_key),
    ...rows.states.map((row) => row.subskill_key),
  ];
  const subskills = await loadSubskills(client, subskillKeys);
  const prediction = buildIeltsBandPrediction({
    userId,
    module: ieltsModule,
    targetBand,
    asOf: options.asOf,
    observations: rows.evidence.map((row) => mapEvidence(row, subskills)),
    skillStates: rows.states.map((row) => mapState(row, subskills)),
  });
  return IeltsBandPredictionSchema.parse(prediction);
}

export const loadIeltsPredictionForPlanning: LoadIeltsPredictionForPlanning = (
  userId,
  options,
) => loadIeltsBandPrediction(userId, options);

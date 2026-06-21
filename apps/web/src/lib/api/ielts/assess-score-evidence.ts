import "server-only";

import { parseInput } from "@/lib/api/boundary";
import { IeltsAdaptiveEvidenceSchema } from "@/lib/ielts/adaptive/evidence";
import type { Json, Tables } from "@/types/supabase";
import type { IeltsDbClient } from "./client";
import {
  evidenceValueFromBand,
  insertAssessEvidenceRows,
  makeAssessEvidenceInsert,
} from "./assess-evidence";

type AttemptRow = Pick<
  Tables<"ielts_attempts">,
  "id" | "user_id" | "test_id" | "module"
>;
type WritingRow = Pick<
  Tables<"writing_responses">,
  | "id"
  | "attempt_id"
  | "user_id"
  | "question_id"
  | "task_number"
  | "task_response_band"
  | "coherence_cohesion_band"
  | "lexical_resource_band"
  | "grammar_band"
  | "task_band"
  | "scored_at"
>;
type SpeakingRow = Pick<
  Tables<"speaking_responses">,
  | "id"
  | "attempt_id"
  | "user_id"
  | "question_id"
  | "fluency_coherence_band"
  | "lexical_resource_band"
  | "grammar_band"
  | "pronunciation_band"
  | "speaking_band"
  | "scored_at"
>;

const WRITING_CRITERIA = [
  {
    key: (taskNumber: number) =>
      taskNumber === 1
        ? "writing:task_achievement_task1"
        : "writing:task_response_task2",
    criterion: "task_response",
    labelEn: "Task response",
    labelVi: "Trả lời yêu cầu đề",
    band: (row: WritingRow) => row.task_response_band,
  },
  {
    key: () => "writing:coherence_cohesion",
    criterion: "coherence_cohesion",
    labelEn: "Coherence and cohesion",
    labelVi: "Mạch lạc và liên kết",
    band: (row: WritingRow) => row.coherence_cohesion_band,
  },
  {
    key: () => "writing:lexical_resource",
    criterion: "lexical_resource",
    labelEn: "Lexical resource",
    labelVi: "Nguồn từ vựng",
    band: (row: WritingRow) => row.lexical_resource_band,
  },
  {
    key: () => "writing:grammar_range_accuracy",
    criterion: "grammar_range_accuracy",
    labelEn: "Grammatical range and accuracy",
    labelVi: "Độ đa dạng và chính xác ngữ pháp",
    band: (row: WritingRow) => row.grammar_band,
  },
] as const;

const SPEAKING_CRITERIA = [
  {
    key: "speaking:fluency_coherence",
    criterion: "fluency_coherence",
    labelEn: "Fluency and coherence",
    labelVi: "Độ trôi chảy và mạch lạc",
    band: (row: SpeakingRow) => row.fluency_coherence_band,
  },
  {
    key: "speaking:lexical_resource",
    criterion: "lexical_resource",
    labelEn: "Lexical resource",
    labelVi: "Nguồn từ vựng",
    band: (row: SpeakingRow) => row.lexical_resource_band,
  },
  {
    key: "speaking:grammar_range_accuracy",
    criterion: "grammar_range_accuracy",
    labelEn: "Grammatical range and accuracy",
    labelVi: "Độ đa dạng và chính xác ngữ pháp",
    band: (row: SpeakingRow) => row.grammar_band,
  },
  {
    key: "speaking:pronunciation",
    criterion: "pronunciation",
    labelEn: "Pronunciation",
    labelVi: "Phát âm",
    band: (row: SpeakingRow) => row.pronunciation_band,
  },
] as const;

async function loadAttemptForScoredResponse(
  client: IeltsDbClient,
  attemptId: string,
): Promise<AttemptRow | null> {
  const { data, error } = await client
    .from("ielts_attempts")
    .select("id, user_id, test_id, module")
    .eq("id", attemptId)
    .maybeSingle();
  if (error) throw new Error(`loadAttemptForScoredResponse: ${error.message}`);
  return data;
}

export async function recordIeltsWritingScoreEvidence(params: {
  client: IeltsDbClient;
  writingResponseId: string;
}): Promise<void> {
  const { data: row, error } = await params.client
    .from("writing_responses")
    .select(
      "id, attempt_id, user_id, question_id, task_number, task_response_band, coherence_cohesion_band, lexical_resource_band, grammar_band, task_band, scored_at",
    )
    .eq("id", params.writingResponseId)
    .maybeSingle();
  if (error) throw new Error(`recordWritingEvidence(response): ${error.message}`);
  if (!row) return;
  const attempt = await loadAttemptForScoredResponse(params.client, row.attempt_id);
  if (!attempt) return;
  const createdAt = row.scored_at ?? new Date().toISOString();
  const rows = WRITING_CRITERIA.flatMap((criterion) => {
    const band = criterion.band(row);
    if (band == null) return [];
    const parsed = parseInput(IeltsAdaptiveEvidenceSchema, {
      userId: row.user_id,
      subskillKey: criterion.key(row.task_number),
      skill: "writing",
      module: attempt.module,
      testKind: "full_mock",
      questionType: row.task_number === 1 ? "writing_task1_academic" : "writing_task2_essay",
      criterion: criterion.criterion,
      evidenceType: "writing_score",
      evidenceValue: evidenceValueFromBand(band),
      bandEstimate: band,
      rawScore: band,
      confidence: 0.74,
      sourceTable: "writing_responses",
      sourceId: row.id,
      reasonEn: `${criterion.labelEn} was scored at band ${band.toFixed(1)}.`,
      reasonVi: `${criterion.labelVi} được chấm ở band ${band.toFixed(1)}.`,
      createdAt,
    });
    return [
      makeAssessEvidenceInsert(parsed, {
        attempt_id: row.attempt_id,
        question_id: row.question_id,
        task_number: row.task_number,
        task_band: row.task_band,
      } satisfies Json),
    ];
  });

  await insertAssessEvidenceRows({
    client: params.client,
    rows,
    userId: row.user_id,
    module: attempt.module,
  });
}

export async function recordIeltsSpeakingScoreEvidence(params: {
  client: IeltsDbClient;
  speakingResponseId: string;
}): Promise<void> {
  const { data: row, error } = await params.client
    .from("speaking_responses")
    .select(
      "id, attempt_id, user_id, question_id, fluency_coherence_band, lexical_resource_band, grammar_band, pronunciation_band, speaking_band, scored_at",
    )
    .eq("id", params.speakingResponseId)
    .maybeSingle();
  if (error) throw new Error(`recordSpeakingEvidence(response): ${error.message}`);
  if (!row) return;
  const attempt = await loadAttemptForScoredResponse(params.client, row.attempt_id);
  if (!attempt) return;
  const createdAt = row.scored_at ?? new Date().toISOString();
  const rows = SPEAKING_CRITERIA.flatMap((criterion) => {
    const band = criterion.band(row);
    if (band == null) return [];
    const parsed = parseInput(IeltsAdaptiveEvidenceSchema, {
      userId: row.user_id,
      subskillKey: criterion.key,
      skill: "speaking",
      module: attempt.module,
      testKind: "full_mock",
      questionType: "speaking_part2_cuecard",
      criterion: criterion.criterion,
      evidenceType: "speaking_score",
      evidenceValue: evidenceValueFromBand(band),
      bandEstimate: band,
      rawScore: band,
      confidence: 0.72,
      sourceTable: "speaking_responses",
      sourceId: row.id,
      reasonEn: `${criterion.labelEn} was scored at band ${band.toFixed(1)}.`,
      reasonVi: `${criterion.labelVi} được chấm ở band ${band.toFixed(1)}.`,
      createdAt,
    });
    return [
      makeAssessEvidenceInsert(parsed, {
        attempt_id: row.attempt_id,
        question_id: row.question_id,
        speaking_band: row.speaking_band,
      } satisfies Json),
    ];
  });

  await insertAssessEvidenceRows({
    client: params.client,
    rows,
    userId: row.user_id,
    module: attempt.module,
  });
}

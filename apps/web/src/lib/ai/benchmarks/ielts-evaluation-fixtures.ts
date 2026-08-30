import type { IeltsEvaluationInput } from "./ielts-evaluation";

export const validWriting = {
  criteria: {
    taskResponse: { band: 6.25, rationale: "Addresses the task." },
    coherenceCohesion: { band: 6.5, rationale: "Ideas are linked." },
    lexicalResource: { band: 6, rationale: "Adequate range." },
    grammaticalRangeAccuracy: { band: 5.75, rationale: "Some errors." },
  },
  overallSummary: "Bounded fixture.",
  modelAnswer: "A complete model answer.",
};

export const validSpeaking = {
  criteria: {
    fluencyCoherence: { band: 7, rationale: "Generally fluent." },
    lexicalResource: { band: 6.5, rationale: "Good vocabulary." },
    grammaticalRangeAccuracy: { band: 6, rationale: "Meaning is clear." },
    pronunciation: { band: 5.5, rationale: "Mostly intelligible." },
  },
  overallSummary: "Bounded fixture.",
};

/** Small fixtures: boundary bands, every task family, an accent split, and operational outcomes. */
export const IELTS_EVALUATION_FIXTURES: IeltsEvaluationInput = {
  staleBefore: "2026-08-29T12:00:00.000Z",
  observations: [
    {
      benchmarkId: "writing-boundary",
      skill: "ielts_writing",
      criterion: "taskResponse",
      expectedBand: 6.5,
      predictedBand: 6.5,
      taskType: "writing_task2_essay",
    },
    {
      benchmarkId: "writing-low",
      skill: "ielts_writing",
      criterion: "coherenceCohesion",
      expectedBand: 4,
      predictedBand: 4.5,
      taskType: "writing_task1_academic",
      accentGroup: "vi",
    },
    {
      benchmarkId: "writing-high",
      skill: "ielts_writing",
      criterion: "lexicalResource",
      expectedBand: 9,
      predictedBand: 8.5,
      taskType: "writing_task1_general",
    },
    {
      benchmarkId: "speaking-boundary",
      skill: "ielts_speaking",
      criterion: "pronunciation",
      expectedBand: 5.5,
      predictedBand: 5.5,
      taskType: "speaking_part1",
      accentGroup: "vi",
    },
    {
      benchmarkId: "speaking-cuecard",
      skill: "ielts_speaking",
      criterion: "fluencyCoherence",
      expectedBand: 7,
      predictedBand: 6.5,
      taskType: "speaking_part2_cuecard",
    },
    {
      benchmarkId: "speaking-part3",
      skill: "ielts_speaking",
      criterion: "grammaticalRangeAccuracy",
      expectedBand: 8,
      predictedBand: 8,
      taskType: "speaking_part3",
    },
    {
      benchmarkId: "unrelated",
      skill: "debate",
      criterion: "winner",
      expectedBand: 1,
      predictedBand: 1,
      taskType: "debate_judging",
    },
  ],
  schemaValidPredictionCount: 5,
  workflowRuns: [
    {
      id: "complete",
      workflow_kind: "ielts_writing_score",
      status: "completed",
      workflow_attempt_count: 1,
      provider_attempt_count: 1,
      updated_at: "2026-08-29T13:00:00.000Z",
    },
    {
      id: "retried",
      workflow_kind: "ielts_speaking_score",
      status: "completed",
      workflow_attempt_count: 2,
      provider_attempt_count: 3,
      updated_at: "2026-08-29T13:00:00.000Z",
    },
    {
      id: "terminal-failure",
      workflow_kind: "ielts_writing_score",
      status: "failed",
      workflow_attempt_count: 3,
      provider_attempt_count: 3,
      updated_at: "2026-08-29T11:00:00.000Z",
      last_error_code: "RETRYABLE_WORKFLOW_FAILED",
    },
    {
      id: "stranded",
      workflow_kind: "ielts_speaking_score",
      status: "running",
      workflow_attempt_count: 1,
      provider_attempt_count: 1,
      updated_at: "2026-08-29T11:00:00.000Z",
    },
    {
      id: "fresh",
      workflow_kind: "ielts_writing_score",
      status: "queued",
      workflow_attempt_count: 1,
      provider_attempt_count: 0,
      updated_at: "2026-08-29T12:30:00.000Z",
    },
    {
      id: "unrelated",
      workflow_kind: "practice_analysis",
      status: "running",
      workflow_attempt_count: 9,
      provider_attempt_count: 9,
      updated_at: "2020-01-01T00:00:00.000Z",
    },
  ],
  providerRequests: [
    {
      id: "provider-1",
      output_type: "ielts_writing_score",
      status: "success",
      latency_ms: 900,
      estimated_cost_usd: 0.004,
    },
    {
      id: "provider-2",
      output_type: "ielts_speaking_score",
      status: "error",
      latency_ms: 1500,
      estimated_cost_usd: 0.002,
    },
    {
      id: "provider-3",
      output_type: "ielts_speaking_score_adjudication",
      status: "success",
      latency_ms: 3000,
      estimated_cost_usd: "0.006",
    },
    {
      id: "unrelated",
      output_type: "practice_judging",
      status: "error",
      latency_ms: 99999,
      estimated_cost_usd: 99,
    },
  ],
  confidenceLevels: ["high", "medium", "limited", "medium"],
  teacherDeltas: [
    {
      benchmarkId: "writing-boundary",
      skill: "ielts_writing",
      criterion: "taskResponse",
      aiBand: 6.5,
      teacherBand: 6,
    },
    {
      benchmarkId: "writing-low",
      skill: "ielts_writing",
      criterion: "coherenceCohesion",
      aiBand: 4.5,
      teacherBand: 4.5,
    },
    {
      benchmarkId: "speaking-boundary",
      skill: "ielts_speaking",
      criterion: "pronunciation",
      aiBand: 5.5,
      teacherBand: 6,
    },
  ],
};

export const IELTS_INVALID_PREDICTION_FIXTURES: readonly unknown[] = [
  { criteria: { taskResponse: { band: 6, rationale: "Missing criteria." } } },
  {
    criteria: {
      taskResponse: { band: 10, rationale: "Out of range." },
      coherenceCohesion: { band: 6, rationale: "x" },
      lexicalResource: { band: 6, rationale: "x" },
      grammaticalRangeAccuracy: { band: 6, rationale: "x" },
    },
    overallSummary: "x",
    modelAnswer: "x",
  },
];

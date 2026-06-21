import type {
  IeltsBandEstimate,
  IeltsBandPrediction,
  IeltsModule,
  IeltsPredictionSnapshot,
  LoadIeltsPredictionForPlanningOptions,
} from "./types";
import {
  AS_OF,
  FIXTURE_USER_ID,
  fixtureIeltsGoal,
  fixtureIeltsLearnAtoms,
  fixtureIeltsStrengthSignals,
  fixtureIeltsWeaknessSignals,
} from "./fixture-data";

function cloneFixture<T>(value: T): T {
  return structuredClone(value);
}

function estimate(input: {
  band: number | null;
  confidence: number;
  status: IeltsBandEstimate["status"];
  label: string;
  evidencePoints: number;
  source?: IeltsBandEstimate["evidence"][number]["source"];
  rawScore?: number | null;
}): IeltsBandEstimate {
  const lower = input.band == null ? null : Math.max(0, input.band - 0.5);
  const upper = input.band == null ? null : Math.min(9, input.band + 0.5);

  return {
    band: input.band,
    lower,
    upper,
    confidence: input.confidence,
    status: input.status,
    trend: {
      direction: input.evidencePoints > 1 ? "up" : "unknown",
      delta30d: input.evidencePoints > 1 ? 0.25 : null,
      evidencePoints: input.evidencePoints,
      explanation:
        input.evidencePoints > 0
          ? "Recent IELTS evidence supports this estimate."
          : "No IELTS evidence is available yet.",
    },
    evidence:
      input.evidencePoints > 0
        ? [
            {
              source: input.source ?? "full_mock",
              label: input.label,
              band: input.band,
              rawScore: input.rawScore ?? null,
              weight: input.source === "learn_activity" ? 0.35 : 0.8,
              occurredAt: AS_OF,
              explanation: "Fixture evidence for adaptive contract tests.",
            },
          ]
        : [],
    explanation:
      input.evidencePoints > 0
        ? [`${input.label} is the strongest current signal.`]
        : ["Diagnostic needed before showing a predicted band."],
  };
}

export const fixtureIeltsBandPrediction: IeltsBandPrediction = {
  userId: FIXTURE_USER_ID,
  asOf: AS_OF,
  modelVersion: "weighted-recency-v1",
  module: "academic",
  overall: estimate({
    band: 6,
    confidence: 0.62,
    status: "medium_confidence",
    label: "Recent IELTS mock",
    evidencePoints: 4,
  }),
  skills: {
    listening: estimate({
      band: 6,
      confidence: 0.66,
      status: "medium_confidence",
      label: "Listening skill mock",
      evidencePoints: 5,
      rawScore: 27,
    }),
    reading: estimate({
      band: 5.5,
      confidence: 0.7,
      status: "medium_confidence",
      label: "Reading objective drill",
      evidencePoints: 7,
      source: "objective_drill",
    }),
    writing: estimate({
      band: 5.5,
      confidence: 0.58,
      status: "low_confidence",
      label: "Writing Task 2 score",
      evidencePoints: 3,
      source: "writing_task",
    }),
    speaking: estimate({
      band: 6,
      confidence: 0.55,
      status: "low_confidence",
      label: "Speaking Part 2 score",
      evidencePoints: 3,
      source: "speaking_part",
    }),
  },
  weaknesses: fixtureIeltsWeaknessSignals,
  limitations: ["Fixture prediction is not calibrated against live IELTS cohorts."],
  nextBestDiagnostic: {
    required: false,
    skill: null,
    reasonEn: "Enough recent evidence exists for a planning fixture.",
    reasonVi: "Dữ liệu gần đây đủ để dùng cho fixture lập kế hoạch.",
  },
};

export const lowConfidenceIeltsBandPrediction: IeltsBandPrediction = {
  ...fixtureIeltsBandPrediction,
  overall: estimate({
    band: null,
    confidence: 0,
    status: "diagnostic_needed",
    label: "No IELTS evidence",
    evidencePoints: 0,
  }),
  skills: {
    listening: estimate({
      band: null,
      confidence: 0,
      status: "diagnostic_needed",
      label: "No Listening evidence",
      evidencePoints: 0,
    }),
    reading: estimate({
      band: null,
      confidence: 0,
      status: "diagnostic_needed",
      label: "No Reading evidence",
      evidencePoints: 0,
    }),
    writing: estimate({
      band: null,
      confidence: 0,
      status: "diagnostic_needed",
      label: "No Writing evidence",
      evidencePoints: 0,
    }),
    speaking: estimate({
      band: null,
      confidence: 0,
      status: "diagnostic_needed",
      label: "No Speaking evidence",
      evidencePoints: 0,
    }),
  },
  weaknesses: [],
  limitations: ["No IELTS diagnostic evidence is available."],
  nextBestDiagnostic: {
    required: true,
    skill: "full_mock",
    reasonEn: "Start with the quick diagnostic before planning targeted work.",
    reasonVi: "Hãy bắt đầu bằng bài chẩn đoán nhanh trước khi lập kế hoạch.",
  },
};

export const fixtureIeltsPredictionSnapshot: IeltsPredictionSnapshot = {
  snapshotId: "00000000-0000-4000-8000-000000000301",
  userId: FIXTURE_USER_ID,
  generatedAt: AS_OF,
  sourceAttemptIds: ["00000000-0000-4000-8000-000000000401"],
  modelVersion: "weighted-recency-v1",
  module: "academic",
  predictedOverallBand: 6,
  predictedSkillBands: {
    listening: 6,
    reading: 5.5,
    writing: 5.5,
    speaking: 6,
  },
  confidence: 0.62,
  uncertaintyBandHalfSteps: 1,
  weaknesses: fixtureIeltsWeaknessSignals,
  strengths: fixtureIeltsStrengthSignals,
  reasoning: {
    en: "Reading and Writing create the largest target gaps.",
    vi: "Reading và Writing đang tạo khoảng cách lớn nhất so với mục tiêu.",
  },
};

export const emptyHistoryIeltsPredictionSnapshot: IeltsPredictionSnapshot = {
  ...fixtureIeltsPredictionSnapshot,
  snapshotId: "00000000-0000-4000-8000-000000000302",
  sourceAttemptIds: [],
  predictedOverallBand: null,
  predictedSkillBands: {
    listening: null,
    reading: null,
    writing: null,
    speaking: null,
  },
  confidence: 0,
  uncertaintyBandHalfSteps: 0,
  weaknesses: [],
  strengths: [],
  reasoning: {
    en: "Diagnostic needed before prediction.",
    vi: "Cần bài chẩn đoán trước khi dự đoán.",
  },
};

export const ieltsAdaptiveContractFixtures = {
  goal: fixtureIeltsGoal,
  learnAtoms: fixtureIeltsLearnAtoms,
  bandPrediction: fixtureIeltsBandPrediction,
  lowConfidencePrediction: lowConfidenceIeltsBandPrediction,
  predictionSnapshot: fixtureIeltsPredictionSnapshot,
  emptyHistorySnapshot: emptyHistoryIeltsPredictionSnapshot,
};

export type IeltsPredictionFixtureScenario =
  | "standard"
  | "low_confidence_diagnostic";

export type IeltsSnapshotFixtureScenario = "standard" | "empty_history";

export async function loadFixtureIeltsPredictionForPlanning(
  userId = FIXTURE_USER_ID,
  options?: LoadIeltsPredictionForPlanningOptions & {
    scenario?: IeltsPredictionFixtureScenario;
  },
): Promise<IeltsBandPrediction> {
  const source =
    options?.scenario === "low_confidence_diagnostic"
      ? lowConfidenceIeltsBandPrediction
      : fixtureIeltsBandPrediction;
  const prediction = cloneFixture(source);
  prediction.userId = userId;
  prediction.module = options?.module ?? prediction.module;

  if (options?.targetBand != null) {
    prediction.weaknesses = prediction.weaknesses.map((weakness) => ({
      ...weakness,
      targetValue: weakness.targetValue ?? options.targetBand ?? null,
    }));
  }

  return prediction;
}

export function getFixtureIeltsPredictionSnapshot(
  scenario: IeltsSnapshotFixtureScenario = "standard",
  module?: IeltsModule,
): IeltsPredictionSnapshot {
  const snapshot = cloneFixture(
    scenario === "empty_history"
      ? emptyHistoryIeltsPredictionSnapshot
      : fixtureIeltsPredictionSnapshot,
  );
  snapshot.module = module ?? snapshot.module;
  return snapshot;
}

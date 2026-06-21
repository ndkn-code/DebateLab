import assert from "node:assert/strict";
import { buildIeltsBandPrediction } from "./predictor";
import type {
  IeltsPredictionObservation,
  IeltsPredictionSubskillState,
} from "./input.types";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const AS_OF = "2026-06-21T00:00:00.000Z";

function observation(
  skill: IeltsPredictionObservation["skill"],
  band: number | null,
  occurredAt: string,
  source: IeltsPredictionObservation["source"] = "full_mock",
): IeltsPredictionObservation {
  const reliability = source === "objective_drill" ? 0.7 : 1;
  const coverage = source === "objective_drill" ? 0.65 : 1;
  return {
    skill,
    band,
    occurredAt,
    source,
    label: `${skill} evidence`,
    reliability,
    coverage,
    rawScore: band == null ? null : band * 4,
    reasonEn: `${skill} scored evidence.`,
    reasonVi: `Dữ liệu điểm ${skill}.`,
  };
}

{
  const prediction = buildIeltsBandPrediction({
    userId: USER_ID,
    module: "academic",
    asOf: AS_OF,
    observations: [],
  });

  assert.equal(prediction.overall.band, null);
  assert.equal(prediction.overall.status, "diagnostic_needed");
  assert.equal(prediction.nextBestDiagnostic.required, true);
  assert.equal(prediction.nextBestDiagnostic.skill, "full_mock");
  assert.match(prediction.nextBestDiagnostic.reasonVi, /chẩn đoán/);
  assert.match(prediction.limitations[0], /No IELTS evidence/);
}

{
  const prediction = buildIeltsBandPrediction({
    userId: USER_ID,
    module: "academic",
    asOf: AS_OF,
    observations: [
      observation("listening", 6.5, "2026-06-20T00:00:00.000Z"),
      observation("reading", 6.5, "2026-06-20T00:00:00.000Z"),
      observation("writing", 6, "2026-06-20T00:00:00.000Z"),
      observation("speaking", 7, "2026-06-20T00:00:00.000Z"),
    ],
  });

  assert.equal(prediction.modelVersion, "weighted-recency-v1");
  assert.equal(prediction.overall.band, 6.5);
  assert.equal(prediction.overall.lower, 6);
  assert.equal(prediction.overall.upper, 7.5);
  assert.equal(prediction.overall.status, "medium_confidence");
  assert.equal(prediction.nextBestDiagnostic.required, false);
  assert.equal(prediction.skills.speaking.band, 7);
}

{
  const prediction = buildIeltsBandPrediction({
    userId: USER_ID,
    module: "general_training",
    asOf: AS_OF,
    observations: [
      observation("listening", 7, "2026-06-20T00:00:00.000Z"),
      observation("reading", 6.5, "2026-06-20T00:00:00.000Z"),
      observation("writing", 6, "2026-06-20T00:00:00.000Z"),
    ],
  });

  assert.equal(prediction.module, "general_training");
  assert.equal(prediction.overall.band, null);
  assert.equal(prediction.nextBestDiagnostic.skill, "speaking");
  assert.match(prediction.limitations.join(" "), /speaking/);
}

{
  const prediction = buildIeltsBandPrediction({
    userId: USER_ID,
    module: "academic",
    asOf: AS_OF,
    observations: [
      observation("speaking", 7, "2026-06-20T00:00:00.000Z", "debate_prior"),
    ],
  });

  assert.equal(prediction.skills.speaking.band, null);
  assert.equal(prediction.skills.speaking.evidence[0].source, "debate_prior");
  assert.equal(prediction.overall.status, "diagnostic_needed");
}

{
  const prediction = buildIeltsBandPrediction({
    userId: USER_ID,
    module: "academic",
    asOf: AS_OF,
    observations: [
      observation("reading", 5.5, "2026-05-01T00:00:00.000Z"),
      observation("reading", 6, "2026-05-21T00:00:00.000Z"),
      observation("reading", 6.5, "2026-06-20T00:00:00.000Z"),
    ],
  });

  assert.equal(prediction.skills.reading.trend.direction, "up");
  assert.equal(prediction.skills.reading.trend.evidencePoints, 3);
  assert.ok((prediction.skills.reading.trend.delta30d ?? 0) >= 0.25);
}

{
  const stable = buildIeltsBandPrediction({
    userId: USER_ID,
    module: "academic",
    asOf: AS_OF,
    observations: [
      observation("writing", 6, "2026-06-01T00:00:00.000Z", "writing_task"),
      observation("writing", 6, "2026-06-10T00:00:00.000Z", "writing_task"),
      observation("writing", 6, "2026-06-20T00:00:00.000Z", "writing_task"),
    ],
  });
  const volatile = buildIeltsBandPrediction({
    userId: USER_ID,
    module: "academic",
    asOf: AS_OF,
    observations: [
      observation("writing", 4.5, "2026-06-01T00:00:00.000Z", "writing_task"),
      observation("writing", 7.5, "2026-06-10T00:00:00.000Z", "writing_task"),
      observation("writing", 6, "2026-06-20T00:00:00.000Z", "writing_task"),
    ],
  });

  assert.ok(stable.skills.writing.confidence > volatile.skills.writing.confidence);
}

{
  const states: IeltsPredictionSubskillState[] = [
    {
      skill: "reading",
      subskillKey: "reading:matching_headings",
      labelEn: "Matching headings",
      labelVi: "Ghép tiêu đề đoạn",
      bandEstimate: 5,
      masteryScore: 0.42,
      confidence: 0.8,
      weaknessWeight: 0.7,
      evidenceCount: 5,
      questionType: "matching_headings",
    },
    {
      skill: "writing",
      subskillKey: "writing:grammar",
      labelEn: "Grammar",
      labelVi: "Ngữ pháp",
      bandEstimate: 6,
      masteryScore: 0.6,
      confidence: 0.5,
      weaknessWeight: 0.25,
      evidenceCount: 2,
      criterion: "grammar",
    },
  ];
  const prediction = buildIeltsBandPrediction({
    userId: USER_ID,
    module: "academic",
    asOf: AS_OF,
    targetBand: 6.5,
    observations: [
      observation("listening", 7, "2026-06-20T00:00:00.000Z"),
      observation("reading", 5.5, "2026-06-20T00:00:00.000Z"),
      observation("writing", 6, "2026-06-20T00:00:00.000Z"),
      observation("speaking", 7, "2026-06-20T00:00:00.000Z"),
    ],
    skillStates: states,
  });

  assert.equal(prediction.weaknesses[0].key, "reading:matching_headings");
  assert.equal(prediction.weaknesses[0].severity, "critical");
  assert.deepEqual(prediction.weaknesses[0].recommendedActivityFilters.subskillTags, [
    "reading:matching_headings",
  ]);
  assert.ok(prediction.weaknesses.some((signal) => signal.key === "reading:overall_band"));
}

{
  const prediction = buildIeltsBandPrediction({
    userId: USER_ID,
    module: "academic",
    asOf: AS_OF,
    observations: [
      {
        ...observation("listening", 6, "2025-12-01T00:00:00.000Z"),
        reliability: 0.35,
        coverage: 0.4,
      },
    ],
  });

  assert.equal(prediction.skills.listening.status, "low_confidence");
  assert.equal(prediction.skills.listening.lower, 4.5);
  assert.equal(prediction.skills.listening.upper, 7.5);
}

{
  const prediction = buildIeltsBandPrediction({
    userId: USER_ID,
    module: "academic",
    asOf: AS_OF,
    observations: [observation("listening", 0.5, "2026-06-20T00:00:00.000Z")],
  });

  assert.equal(prediction.skills.listening.lower, 0);
  assert.equal(prediction.skills.listening.upper, 1.5);
}

console.log("IELTS weighted-recency prediction tests passed");

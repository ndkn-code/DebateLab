import type { DebateScore } from "@/types/feedback";

export type SkillMetricKey =
  | "clarity"
  | "logic"
  | "rebuttal"
  | "evidence"
  | "delivery";

export interface SkillMetric {
  key: SkillMetricKey;
  value: number;
}

export interface SkillSnapshot {
  metrics: SkillMetric[];
  overallScore: number | null;
  weakestSkill: SkillMetricKey | null;
  strongestSkill: SkillMetricKey | null;
  sourceSessions: number;
}

export interface SkillFeedbackSource {
  feedback: DebateScore | null;
}

export function roundToTenth(value: number) {
  return Math.round(value * 10) / 10;
}

export function normalizeToFive(value: number, max: number) {
  if (!Number.isFinite(value) || max <= 0) return 0;
  return roundToTenth((value / max) * 5);
}

export function computeSkillSnapshot(
  sessions: SkillFeedbackSource[]
): SkillSnapshot {
  const sessionsWithFeedback = sessions.filter(
    (session) => session.feedback?.content && session.feedback?.language
  );

  if (sessionsWithFeedback.length === 0) {
    return {
      metrics: [
        { key: "clarity", value: 0 },
        { key: "logic", value: 0 },
        { key: "rebuttal", value: 0 },
        { key: "evidence", value: 0 },
        { key: "delivery", value: 0 },
      ],
      overallScore: null,
      weakestSkill: null,
      strongestSkill: null,
      sourceSessions: 0,
    };
  }

  let clarityTotal = 0;
  let logicTotal = 0;
  let rebuttalTotal = 0;
  let evidenceTotal = 0;
  let deliveryTotal = 0;

  for (const session of sessionsWithFeedback) {
    const feedback = session.feedback!;
    clarityTotal += normalizeToFive(feedback.content.claimClarity, 10);
    logicTotal += normalizeToFive(feedback.content.logicCoherence, 10);
    rebuttalTotal += normalizeToFive(feedback.content.counterArgument, 10);
    evidenceTotal += normalizeToFive(feedback.content.evidenceSupport, 10);

    const deliveryAverage =
      normalizeToFive(feedback.language.vocabulary, 8) +
      normalizeToFive(feedback.language.grammar, 9) +
      normalizeToFive(feedback.language.fluency, 8);
    deliveryTotal += roundToTenth(deliveryAverage / 3);
  }

  const count = sessionsWithFeedback.length;
  const metrics: SkillMetric[] = [
    { key: "clarity", value: roundToTenth(clarityTotal / count) },
    { key: "logic", value: roundToTenth(logicTotal / count) },
    { key: "rebuttal", value: roundToTenth(rebuttalTotal / count) },
    { key: "evidence", value: roundToTenth(evidenceTotal / count) },
    { key: "delivery", value: roundToTenth(deliveryTotal / count) },
  ];

  const sorted = [...metrics].sort((left, right) => left.value - right.value);
  const overallScore = roundToTenth(
    metrics.reduce((sum, metric) => sum + metric.value, 0) / metrics.length
  );

  return {
    metrics,
    overallScore,
    weakestSkill: sorted[0]?.key ?? null,
    strongestSkill: sorted[sorted.length - 1]?.key ?? null,
    sourceSessions: count,
  };
}

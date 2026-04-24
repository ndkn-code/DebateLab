import type { DebateScore, PracticeTrack } from "@/types/feedback";

export type SkillMetricKey =
  | "clarity"
  | "logic"
  | "rebuttal"
  | "evidence"
  | "delivery";

type TopicDifficulty = "beginner" | "intermediate" | "advanced";
type AiDifficulty = "easy" | "medium" | "hard";

const SKILL_KEYS: SkillMetricKey[] = [
  "clarity",
  "logic",
  "rebuttal",
  "evidence",
  "delivery",
];

const TRACK_SKILL_WEIGHTS: Record<PracticeTrack, Record<SkillMetricKey, number>> = {
  speaking: {
    clarity: 0.32,
    delivery: 0.28,
    logic: 0.22,
    evidence: 0.13,
    rebuttal: 0.05,
  },
  debate: {
    logic: 0.25,
    rebuttal: 0.24,
    evidence: 0.22,
    clarity: 0.17,
    delivery: 0.12,
  },
};

const TOPIC_DIFFICULTY_LEVEL: Record<TopicDifficulty, number> = {
  beginner: -1,
  intermediate: 0,
  advanced: 1,
};

const AI_DIFFICULTY_LEVEL: Record<AiDifficulty, number> = {
  easy: -1,
  medium: 0,
  hard: 1,
};

const TOPIC_CHALLENGE_IMPACT: Record<SkillMetricKey, number> = {
  clarity: 0.14,
  logic: 0.18,
  rebuttal: 0.14,
  evidence: 0.18,
  delivery: 0.06,
};

const AI_CHALLENGE_IMPACT: Record<SkillMetricKey, number> = {
  clarity: 0.06,
  logic: 0.14,
  rebuttal: 0.2,
  evidence: 0.12,
  delivery: 0.04,
};

const MAX_TRACK_WEIGHT_BY_SKILL = SKILL_KEYS.reduce(
  (summary, skill) => {
    summary[skill] = Math.max(
      TRACK_SKILL_WEIGHTS.speaking[skill],
      TRACK_SKILL_WEIGHTS.debate[skill]
    );
    return summary;
  },
  {} as Record<SkillMetricKey, number>
);

const MIN_RECENCY_WEIGHT = 0.2;
const CONFIDENT_EFFECTIVE_SESSIONS = 3;
const LOW_COVERAGE_THRESHOLD = 25;

export interface SkillMetric {
  key: SkillMetricKey;
  rawValue: number;
  challengeAdjustedValue: number;
  value: number;
  effectiveSessions: number;
  coverage: number;
}

export interface SkillSnapshot {
  metrics: SkillMetric[];
  overallScore: number | null;
  weakestSkill: SkillMetricKey | null;
  strongestSkill: SkillMetricKey | null;
  sourceSessions: number;
  confidence: number;
  trackBreakdown: Record<PracticeTrack, number>;
  difficultyBreakdown: {
    topic: Record<TopicDifficulty, number>;
    ai: Record<AiDifficulty | "none", number>;
  };
}

export interface SkillFeedbackSource {
  feedback: DebateScore | null;
  total_score?: number | null;
  totalScore?: number | null;
  created_at?: string | null;
  createdAt?: string | null;
  date?: string | null;
  mode?: string | null;
  duration_seconds?: number | null;
  durationSeconds?: number | null;
  duration?: number | null;
  topic_difficulty?: string | null;
  topicDifficulty?: string | null;
  ai_difficulty?: string | null;
  aiDifficulty?: string | null;
}

export function roundToTenth(value: number) {
  return Math.round(value * 10) / 10;
}

export function normalizeToHundred(value: number, max: number) {
  if (!Number.isFinite(value) || max <= 0) return 0;
  return roundToTenth((value / max) * 100);
}

function emptySkillSnapshot(): SkillSnapshot {
  return {
    metrics: SKILL_KEYS.map((key) => ({
      key,
      rawValue: 0,
      challengeAdjustedValue: 0,
      value: 0,
      effectiveSessions: 0,
      coverage: 0,
    })),
    overallScore: null,
    weakestSkill: null,
    strongestSkill: null,
    sourceSessions: 0,
    confidence: 0,
    trackBreakdown: { speaking: 0, debate: 0 },
    difficultyBreakdown: {
      topic: { beginner: 0, intermediate: 0, advanced: 0 },
      ai: { easy: 0, medium: 0, hard: 0, none: 0 },
    },
  };
}

function readFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeOptional(value: unknown, max: number) {
  const numeric = readFiniteNumber(value);
  if (numeric == null) return null;
  return normalizeToHundred(numeric, max);
}

function inferTrack(feedback: DebateScore): PracticeTrack {
  return feedback.practiceTrack === "speaking" ? "speaking" : "debate";
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function logit(value: number) {
  return Math.log(value / (1 - value));
}

function sigmoid(value: number) {
  return 1 / (1 + Math.exp(-value));
}

function normalizeTopicDifficulty(value: unknown): TopicDifficulty {
  return value === "beginner" || value === "advanced" ? value : "intermediate";
}

function normalizeAiDifficulty(value: unknown): AiDifficulty | "none" {
  if (value === "easy" || value === "medium" || value === "hard") {
    return value;
  }

  return "none";
}

function getTopicDifficulty(session: SkillFeedbackSource) {
  return normalizeTopicDifficulty(
    session.topic_difficulty ?? session.topicDifficulty
  );
}

function getAiDifficulty(session: SkillFeedbackSource) {
  return normalizeAiDifficulty(session.ai_difficulty ?? session.aiDifficulty);
}

function getAiDifficultyLevel(track: PracticeTrack, session: SkillFeedbackSource) {
  if (track !== "debate" || session.mode !== "full") return 0;

  const difficulty = getAiDifficulty(session);
  return difficulty === "none" ? 0 : AI_DIFFICULTY_LEVEL[difficulty];
}

function getChallengeAdjustment(
  track: PracticeTrack,
  skill: SkillMetricKey,
  session: SkillFeedbackSource
) {
  const topicLevel = TOPIC_DIFFICULTY_LEVEL[getTopicDifficulty(session)];
  const aiLevel = getAiDifficultyLevel(track, session);

  return (
    topicLevel * TOPIC_CHALLENGE_IMPACT[skill] +
    aiLevel * AI_CHALLENGE_IMPACT[skill]
  );
}

function applyChallengeAdjustment(score: number, adjustment: number) {
  const normalizedScore = clamp(score / 100, 0.01, 0.99);
  return roundToTenth(sigmoid(logit(normalizedScore) + adjustment) * 100);
}

function getSessionTimestamp(session: SkillFeedbackSource) {
  const raw = session.created_at ?? session.createdAt ?? session.date;
  if (!raw) return null;

  const timestamp = new Date(raw).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function getRecencyWeight(session: SkillFeedbackSource, now = Date.now()) {
  const timestamp = getSessionTimestamp(session);
  if (timestamp == null) return 1;

  const ageDays = Math.max(0, (now - timestamp) / (1000 * 60 * 60 * 24));
  return Math.max(MIN_RECENCY_WEIGHT, Math.min(1, 0.5 ** (ageDays / 30)));
}

function getDurationSeconds(session: SkillFeedbackSource) {
  const raw =
    session.duration_seconds ?? session.durationSeconds ?? session.duration;
  return readFiniteNumber(raw);
}

function getSessionQualityWeight(session: SkillFeedbackSource) {
  const durationSeconds = getDurationSeconds(session);

  if (durationSeconds != null && durationSeconds > 0 && durationSeconds < 120) {
    return 0.5;
  }

  if (
    session.mode === "quick" ||
    (durationSeconds != null && durationSeconds > 0 && durationSeconds < 300)
  ) {
    return 0.75;
  }

  return 1;
}

function getChallengeEvidenceWeight(
  track: PracticeTrack,
  session: SkillFeedbackSource
) {
  const topicLevel = TOPIC_DIFFICULTY_LEVEL[getTopicDifficulty(session)];
  const aiLevel = getAiDifficultyLevel(track, session);

  return clamp(1 + topicLevel * 0.05 + aiLevel * 0.05, 0.9, 1.12);
}

function getSkillScores(feedback: DebateScore) {
  const deliveryValues = [
    normalizeOptional(feedback.language?.vocabulary, 8),
    normalizeOptional(feedback.language?.grammar, 9),
    normalizeOptional(feedback.language?.fluency, 8),
  ].filter((value): value is number => value != null);

  return {
    clarity: normalizeOptional(feedback.content?.claimClarity, 10),
    logic: normalizeOptional(feedback.content?.logicCoherence, 10),
    rebuttal: normalizeOptional(feedback.content?.counterArgument, 10),
    evidence: normalizeOptional(feedback.content?.evidenceSupport, 10),
    delivery:
      deliveryValues.length > 0
        ? roundToTenth(
            deliveryValues.reduce((total, value) => total + value, 0) /
              deliveryValues.length
          )
        : null,
  } satisfies Record<SkillMetricKey, number | null>;
}

function getOverallSkillWeights(trackBreakdown: Record<PracticeTrack, number>) {
  const totalTracks = trackBreakdown.speaking + trackBreakdown.debate;
  const speakingRatio =
    totalTracks > 0 ? trackBreakdown.speaking / totalTracks : 0.5;
  const debateRatio = totalTracks > 0 ? trackBreakdown.debate / totalTracks : 0.5;

  return SKILL_KEYS.reduce(
    (weights, skill) => {
      weights[skill] =
        speakingRatio * TRACK_SKILL_WEIGHTS.speaking[skill] +
        debateRatio * TRACK_SKILL_WEIGHTS.debate[skill];
      return weights;
    },
    {} as Record<SkillMetricKey, number>
  );
}

function pickExtrema(metrics: SkillMetric[]) {
  const supportedMetrics = metrics.filter(
    (metric) => metric.coverage >= LOW_COVERAGE_THRESHOLD
  );
  const candidates =
    supportedMetrics.length > 0
      ? supportedMetrics
      : metrics.filter((metric) => metric.coverage > 0);

  if (candidates.length === 0) {
    return {
      weakestSkill: null,
      strongestSkill: null,
    };
  }

  const sorted = [...candidates].sort((left, right) => left.value - right.value);
  return {
    weakestSkill: sorted[0]?.key ?? null,
    strongestSkill: sorted[sorted.length - 1]?.key ?? null,
  };
}

export function computeSkillSnapshot(
  sessions: SkillFeedbackSource[]
): SkillSnapshot {
  const sessionsWithFeedback = sessions.filter((session) => {
    const hasExplicitScore =
      Object.prototype.hasOwnProperty.call(session, "total_score") ||
      Object.prototype.hasOwnProperty.call(session, "totalScore");
    const score = readFiniteNumber(session.total_score ?? session.totalScore);

    return (
      session.feedback?.content &&
      session.feedback?.language &&
      (!hasExplicitScore || score != null)
    );
  });

  if (sessionsWithFeedback.length === 0) {
    return emptySkillSnapshot();
  }

  const totals = SKILL_KEYS.reduce(
    (summary, key) => {
      summary[key] = {
        weightedScore: 0,
        weightedRawScore: 0,
        weightedDenominator: 0,
        support: 0,
      };
      return summary;
    },
    {} as Record<
      SkillMetricKey,
      {
        weightedScore: number;
        weightedRawScore: number;
        weightedDenominator: number;
        support: number;
      }
    >
  );
  const trackBreakdown: Record<PracticeTrack, number> = {
    speaking: 0,
    debate: 0,
  };
  const difficultyBreakdown: SkillSnapshot["difficultyBreakdown"] = {
    topic: { beginner: 0, intermediate: 0, advanced: 0 },
    ai: { easy: 0, medium: 0, hard: 0, none: 0 },
  };
  let totalEffectiveSessions = 0;

  for (const session of sessionsWithFeedback) {
    const feedback = session.feedback!;
    const track = inferTrack(feedback);
    const topicDifficulty = getTopicDifficulty(session);
    const aiDifficulty = getAiDifficulty(session);
    const recencyWeight = getRecencyWeight(session);
    const sessionQualityWeight = getSessionQualityWeight(session);
    const sessionWeight =
      recencyWeight *
      sessionQualityWeight *
      getChallengeEvidenceWeight(track, session);
    const skillScores = getSkillScores(feedback);

    trackBreakdown[track] += 1;
    difficultyBreakdown.topic[topicDifficulty] += 1;
    difficultyBreakdown.ai[
      track === "debate" && session.mode === "full" ? aiDifficulty : "none"
    ] += 1;
    totalEffectiveSessions += sessionWeight;

    for (const skill of SKILL_KEYS) {
      const skillScore = skillScores[skill];
      if (skillScore == null) continue;

      const trackWeight = TRACK_SKILL_WEIGHTS[track][skill];
      const contributionWeight = sessionWeight * trackWeight;
      const adjustedSkillScore = applyChallengeAdjustment(
        skillScore,
        getChallengeAdjustment(track, skill, session)
      );
      const applicability =
        MAX_TRACK_WEIGHT_BY_SKILL[skill] > 0
          ? trackWeight / MAX_TRACK_WEIGHT_BY_SKILL[skill]
          : 0;

      totals[skill].weightedScore += adjustedSkillScore * contributionWeight;
      totals[skill].weightedRawScore += skillScore * contributionWeight;
      totals[skill].weightedDenominator += contributionWeight;
      totals[skill].support += sessionWeight * applicability;
    }
  }

  const metrics: SkillMetric[] = SKILL_KEYS.map((key) => {
    const summary = totals[key];
    const challengeAdjustedValue =
      summary.weightedDenominator > 0
        ? roundToTenth(summary.weightedScore / summary.weightedDenominator)
        : 0;

    return {
      key,
      rawValue:
        summary.weightedDenominator > 0
          ? roundToTenth(summary.weightedRawScore / summary.weightedDenominator)
          : 0,
      challengeAdjustedValue,
      value: challengeAdjustedValue,
      effectiveSessions: roundToTenth(summary.support),
      coverage: Math.round(
        Math.min(
          100,
          (summary.support / CONFIDENT_EFFECTIVE_SESSIONS) * 100
        )
      ),
    };
  });
  const overallSkillWeights = getOverallSkillWeights(trackBreakdown);
  const supportedMetrics = metrics.filter(
    (metric) => metric.coverage >= LOW_COVERAGE_THRESHOLD
  );
  const coveredMetrics =
    supportedMetrics.length > 0
      ? supportedMetrics
      : metrics.filter((metric) => metric.coverage > 0);
  const overallDenominator = coveredMetrics.reduce(
    (total, metric) => total + overallSkillWeights[metric.key],
    0
  );
  const overallScore =
    overallDenominator > 0
      ? roundToTenth(
          coveredMetrics.reduce(
            (total, metric) =>
              total + metric.value * overallSkillWeights[metric.key],
            0
          ) / overallDenominator
        )
      : null;
  const extrema = pickExtrema(metrics);

  return {
    metrics,
    overallScore,
    weakestSkill: extrema.weakestSkill,
    strongestSkill: extrema.strongestSkill,
    sourceSessions: sessionsWithFeedback.length,
    confidence: Math.round(
      Math.min(
        100,
        (totalEffectiveSessions / (CONFIDENT_EFFECTIVE_SESSIONS + 1)) * 100
      )
    ),
    trackBreakdown,
    difficultyBreakdown,
  };
}

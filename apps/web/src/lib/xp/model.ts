export const XP_PER_LEVEL = 500;
export const MIN_PRACTICE_XP_DURATION_SECONDS = 45;

export type XpCategory =
  | "practice"
  | "lesson"
  | "course"
  | "duel"
  | "assignment"
  | "social"
  | "legacy";

export type XpSourceType =
  | "practice_attempt"
  | "debate_session"
  | "lesson"
  | "activity"
  | "course"
  | "duel"
  | "assignment"
  | "social";

export interface XpBreakdown {
  total: number;
  components: Record<string, number>;
  eligible: boolean;
  reason?: string;
}

type PracticeMode = "quick" | "full";
type TopicDifficulty = "beginner" | "intermediate" | "advanced";
type AiDifficulty = "easy" | "medium" | "hard";

function finiteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function getLevelFromXp(xp: number) {
  return Math.max(1, Math.floor(Math.max(0, xp) / XP_PER_LEVEL) + 1);
}

function sumComponents(components: Record<string, number>) {
  return Object.values(components).reduce((sum, value) => sum + value, 0);
}

export function calculatePracticeXp(input: {
  mode: PracticeMode;
  durationSeconds: number;
  totalScore: number | null | undefined;
  topicDifficulty?: TopicDifficulty | string | null;
  aiDifficulty?: AiDifficulty | string | null;
  previousBestScore?: number | null;
  suspicious?: boolean;
}) {
  const score = finiteNumber(input.totalScore);
  const durationSeconds = Math.max(0, Math.round(input.durationSeconds));

  if (input.suspicious) {
    return {
      total: 0,
      components: {},
      eligible: false,
      reason: "suspicious",
    } satisfies XpBreakdown;
  }

  if (durationSeconds < MIN_PRACTICE_XP_DURATION_SECONDS) {
    return {
      total: 0,
      components: {},
      eligible: false,
      reason: "below_min_duration",
    } satisfies XpBreakdown;
  }

  if (score == null) {
    return {
      total: 0,
      components: {},
      eligible: false,
      reason: "missing_score",
    } satisfies XpBreakdown;
  }

  const safeScore = clampNumber(score, 0, 100);
  const topicDifficulty = input.topicDifficulty ?? "intermediate";
  const aiDifficulty = input.aiDifficulty ?? null;
  const previousBest = finiteNumber(input.previousBestScore);
  const personalBestDelta =
    previousBest == null ? 0 : Math.max(0, safeScore - previousBest);

  const components = {
    completion: input.mode === "full" ? 28 : 20,
    quality: Math.round(safeScore * 0.35),
    topicChallenge:
      topicDifficulty === "advanced"
        ? 10
        : topicDifficulty === "intermediate"
          ? 5
          : 0,
    formatChallenge: input.mode === "full" ? 7 : 0,
    aiChallenge:
      input.mode === "full" && aiDifficulty === "hard"
        ? 5
        : input.mode === "full" && aiDifficulty === "medium"
          ? 2
          : 0,
    personalBest:
      personalBestDelta > 0.5
        ? Math.min(25, 10 + Math.round(personalBestDelta * 2))
        : 0,
  };

  return {
    total: sumComponents(components),
    components,
    eligible: true,
  } satisfies XpBreakdown;
}

export function calculateLessonXp(input: {
  activityType?: string | null;
  score: number | null | undefined;
  maxScore?: number | null;
}) {
  const score = finiteNumber(input.score);
  const maxScore = finiteNumber(input.maxScore);
  const activityType = input.activityType ?? "lesson";

  if (activityType === "lesson") {
    return {
      total: 12,
      components: { completion: 12 },
      eligible: true,
    } satisfies XpBreakdown;
  }

  const ratio =
    score == null || maxScore == null || maxScore <= 0
      ? null
      : clampNumber(score / maxScore, 0, 1);

  if (activityType === "flashcard") {
    const components = {
      completion: 5,
      quality: ratio == null ? 0 : Math.round(ratio * 8),
    };
    return {
      total: sumComponents(components),
      components,
      eligible: true,
    } satisfies XpBreakdown;
  }

  const components = {
    completion: 8,
    quality: ratio == null ? 0 : Math.round(ratio * 17),
  };

  return {
    total: sumComponents(components),
    components,
    eligible: true,
  } satisfies XpBreakdown;
}

export function calculateCourseCompletionXp() {
  return {
    total: 100,
    components: { completion: 100 },
    eligible: true,
  } satisfies XpBreakdown;
}

export function calculateDuelXp(input: {
  result?: "win" | "loss" | "completed" | null;
  integrityStatus?: string | null;
}) {
  if (input.integrityStatus && input.integrityStatus !== "clean") {
    return {
      total: 0,
      components: {},
      eligible: false,
      reason: "integrity_excluded",
    } satisfies XpBreakdown;
  }

  const components = {
    completion: 30,
    result:
      input.result === "win"
        ? 20
        : input.result === "loss"
          ? 10
          : 0,
  };

  return {
    total: sumComponents(components),
    components,
    eligible: true,
  } satisfies XpBreakdown;
}

export function createXpIdempotencyKey(parts: Array<string | number | null | undefined>) {
  return parts
    .map((part) => String(part ?? "none").trim().replaceAll(":", "_"))
    .join(":");
}


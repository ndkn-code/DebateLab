export const IELTS_REVIEW_ALGORITHMS = ["sm2_v1", "fsrs_v1"] as const;
export const IELTS_REVIEW_RATINGS = ["again", "hard", "good", "easy"] as const;
export const IELTS_REVIEW_STATES = [
  "new",
  "learning",
  "review",
  "relearning",
  "suspended",
  "mastered",
  "archived",
] as const;

export type IeltsReviewAlgorithm = (typeof IELTS_REVIEW_ALGORITHMS)[number];
export type IeltsReviewRating = (typeof IELTS_REVIEW_RATINGS)[number];
export type IeltsReviewState = (typeof IELTS_REVIEW_STATES)[number];

export interface IeltsReviewScheduleState {
  algorithm: IeltsReviewAlgorithm;
  state: IeltsReviewState;
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  lapses: number;
  difficulty: number;
  stability: number;
  retrievability: number;
  dueAt: Date;
  lastReviewedAt: Date | null;
}

export interface CreateReviewItemScheduleInput {
  now?: Date;
  dueAt?: Date;
  algorithm?: IeltsReviewAlgorithm;
  easeFactor?: number;
  difficulty?: number;
  stability?: number;
  retrievability?: number;
}

export interface RateReviewItemInput {
  rating: IeltsReviewRating;
  now?: Date;
  targetTestDate?: Date | null;
}

export interface IeltsReviewRatingResult {
  previous: IeltsReviewScheduleState;
  next: IeltsReviewScheduleState;
  qualityGrade: 1 | 3 | 4 | 5;
  reviewedAt: Date;
}

export interface ArchiveReviewCriteria {
  repetitions: number;
  intervalDays: number;
  lapses: number;
  recentRatings: IeltsReviewRating[];
  state?: IeltsReviewState;
}

const DAY_MS = 86_400_000;
const MIN_EASE_FACTOR = 1.3;
const DEFAULT_EASE_FACTOR = 2.5;
const DEFAULT_DIFFICULTY = 5;
const DEFAULT_STABILITY = 0;
const DEFAULT_RETRIEVABILITY = 1;

function roundToThree(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}

function addDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * DAY_MS);
}

function daysUntil(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / DAY_MS;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeScheduleState(
  state: IeltsReviewScheduleState,
): IeltsReviewScheduleState {
  return {
    ...state,
    easeFactor: Math.max(MIN_EASE_FACTOR, roundToThree(state.easeFactor)),
    intervalDays: Math.max(0, roundToThree(state.intervalDays)),
    repetitions: Math.max(0, Math.trunc(state.repetitions)),
    lapses: Math.max(0, Math.trunc(state.lapses)),
    difficulty: clampNumber(roundToThree(state.difficulty), 1, 10),
    stability: Math.max(0, roundToThree(state.stability)),
    retrievability: clampNumber(roundToThree(state.retrievability), 0, 1),
    dueAt: new Date(state.dueAt),
    lastReviewedAt: state.lastReviewedAt ? new Date(state.lastReviewedAt) : null,
  };
}

export function qualityGradeForRating(
  rating: IeltsReviewRating,
): IeltsReviewRatingResult["qualityGrade"] {
  if (rating === "again") return 1;
  if (rating === "hard") return 3;
  if (rating === "good") return 4;
  return 5;
}

export function createReviewItemSchedule(
  input: CreateReviewItemScheduleInput = {},
): IeltsReviewScheduleState {
  const now = input.now ?? new Date();
  return normalizeScheduleState({
    algorithm: input.algorithm ?? "sm2_v1",
    state: "new",
    easeFactor: input.easeFactor ?? DEFAULT_EASE_FACTOR,
    intervalDays: 0,
    repetitions: 0,
    lapses: 0,
    difficulty: input.difficulty ?? DEFAULT_DIFFICULTY,
    stability: input.stability ?? DEFAULT_STABILITY,
    retrievability: input.retrievability ?? DEFAULT_RETRIEVABILITY,
    dueAt: input.dueAt ?? now,
    lastReviewedAt: null,
  });
}

export function computeNextDueAt(params: {
  now: Date;
  intervalDays: number;
  targetTestDate?: Date | null;
}): Date {
  const cappedInterval = params.targetTestDate
    ? Math.min(params.intervalDays, Math.max(0, daysUntil(params.now, params.targetTestDate) - 1))
    : params.intervalDays;
  return addDays(params.now, cappedInterval);
}

function nextEaseFactor(easeFactor: number, grade: number): number {
  if (grade < 3) return Math.max(MIN_EASE_FACTOR, roundToThree(easeFactor - 0.2));
  const missDistance = 5 - grade;
  const delta = 0.1 - missDistance * (0.08 + missDistance * 0.02);
  return Math.max(MIN_EASE_FACTOR, roundToThree(easeFactor + delta));
}

function nextPassingInterval(params: {
  previousIntervalDays: number;
  nextRepetitions: number;
  easeFactor: number;
}): number {
  if (params.nextRepetitions === 1) return 1;
  if (params.nextRepetitions === 2) return 3;
  return Math.max(1, Math.round(params.previousIntervalDays * params.easeFactor));
}

export function rateReviewItem(
  current: IeltsReviewScheduleState,
  input: RateReviewItemInput,
): IeltsReviewRatingResult {
  const previous = normalizeScheduleState(current);
  const reviewedAt = input.now ?? new Date();
  const grade = qualityGradeForRating(input.rating);
  const easeFactor = nextEaseFactor(previous.easeFactor, grade);

  const nextCore =
    grade < 3
      ? {
          repetitions: 0,
          lapses: previous.lapses + 1,
          intervalDays: 0.25,
          state: "relearning" as const,
        }
      : {
          repetitions: previous.repetitions + 1,
          lapses: previous.lapses,
          intervalDays: nextPassingInterval({
            previousIntervalDays: previous.intervalDays,
            nextRepetitions: previous.repetitions + 1,
            easeFactor,
          }),
          state: previous.repetitions + 1 >= 3 ? ("review" as const) : ("learning" as const),
        };

  const nextIntervalDays = roundToThree(nextCore.intervalDays);
  const next = normalizeScheduleState({
    ...previous,
    ...nextCore,
    easeFactor,
    intervalDays: nextIntervalDays,
    dueAt: computeNextDueAt({
      now: reviewedAt,
      intervalDays: nextIntervalDays,
      targetTestDate: input.targetTestDate,
    }),
    lastReviewedAt: reviewedAt,
  });

  return { previous, next, qualityGrade: grade, reviewedAt };
}

export function shouldArchiveReviewItem(criteria: ArchiveReviewCriteria): boolean {
  const state = criteria.state ?? "review";
  const recentPositive = criteria.recentRatings
    .slice(-3)
    .every((rating) => rating === "good" || rating === "easy");
  return (
    state === "review" &&
    criteria.repetitions >= 5 &&
    criteria.intervalDays >= 60 &&
    criteria.lapses === 0 &&
    criteria.recentRatings.length >= 3 &&
    recentPositive
  );
}

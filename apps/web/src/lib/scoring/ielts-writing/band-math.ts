/**
 * IELTS Writing band math (WS-3.1).
 *
 * The official scoring is encoded EXACTLY here (authoring spec §6, masterplan §6):
 *
 *   - Four criteria, each 0-9: Task Response/Achievement (TR/TA), Coherence &
 *     Cohesion (CC), Lexical Resource (LR), Grammatical Range & Accuracy (GRA).
 *   - Task band   = mean of the four criteria, rounded to the nearest half-band.
 *   - Writing overall = (Task 1 × 1/3) + (Task 2 × 2/3), rounded to nearest
 *     half-band — i.e. Task 2 counts double.
 *
 * Half-band rounding (".25 rounds up to .5, .75 rounds up to the next whole")
 * is round-half-up on the half-band grid, provided by the shared, already
 * coverage-gated {@link roundToHalfBand}. This module stays pure so the
 * `scoring/**` coverage threshold (lines ≥90 / fns ≥90 / branches ≥80) is met
 * by its sibling `band-math.test.ts`.
 */
import { roundToHalfBand } from "../round-half-band";

/** The four IELTS Writing criteria, in canonical (display + averaging) order. */
export const WRITING_CRITERIA = [
  "taskResponse",
  "coherenceCohesion",
  "lexicalResource",
  "grammaticalRangeAccuracy",
] as const;

export type WritingCriterionKey = (typeof WRITING_CRITERIA)[number];

/** Per-criterion bands (0-9) for a single Writing task. */
export type WritingCriteriaBands = Record<WritingCriterionKey, number>;

const MIN_BAND = 0;
const MAX_BAND = 9;

function assertScorable(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`);
  }
  if (value < MIN_BAND || value > MAX_BAND) {
    throw new Error(`${label} must be between ${MIN_BAND} and ${MAX_BAND}`);
  }
}

/**
 * Clamp a raw model number into [0, 9] and snap it to the nearest half-band, so
 * every stored criterion/band is a valid IELTS value for the `numeric(2,1)`
 * columns. A model may return e.g. `6.4`; this yields `6.5`.
 */
export function snapToHalfBand(raw: number): number {
  if (!Number.isFinite(raw)) {
    throw new Error("snapToHalfBand: raw must be a finite number");
  }
  const clamped = Math.min(MAX_BAND, Math.max(MIN_BAND, raw));
  return roundToHalfBand(clamped);
}

/**
 * Task band = mean of the four criteria, rounded to the nearest half-band.
 * Inputs must already be valid 0-9 bands (snap them first).
 */
export function taskBandFromCriteria(criteria: WritingCriteriaBands): number {
  let sum = 0;
  for (const key of WRITING_CRITERIA) {
    const value = criteria[key];
    assertScorable(value, `criteria.${key}`);
    sum += value;
  }
  return roundToHalfBand(sum / WRITING_CRITERIA.length);
}

export interface WritingOverallInput {
  /** Task 1 band (0-9), or null/undefined when Task 1 was not scored. */
  task1Band?: number | null;
  /** Task 2 band (0-9), or null/undefined when Task 2 was not scored. */
  task2Band?: number | null;
}

/**
 * Writing overall band:
 *   - Both tasks → (Task 1 × 1/3) + (Task 2 × 2/3), half-band rounded.
 *   - One task only → that task's band (single-task practice has no weighting).
 *   - Neither → null (nothing to score yet).
 *
 * The weighted mean is computed as `(task1 + 2·task2) / 3` so the double-weight
 * is exact before the single half-band rounding step.
 */
export function writingOverallBand(input: WritingOverallInput): number | null {
  const hasTask1 = input.task1Band != null;
  const hasTask2 = input.task2Band != null;

  if (!hasTask1 && !hasTask2) {
    return null;
  }

  if (hasTask1) assertScorable(input.task1Band as number, "task1Band");
  if (hasTask2) assertScorable(input.task2Band as number, "task2Band");

  if (hasTask1 && !hasTask2) {
    return roundToHalfBand(input.task1Band as number);
  }
  if (!hasTask1 && hasTask2) {
    return roundToHalfBand(input.task2Band as number);
  }

  const task1 = input.task1Band as number;
  const task2 = input.task2Band as number;
  return roundToHalfBand((task1 + 2 * task2) / 3);
}

/**
 * Deterministic synthetic learner trajectories (Wave 6.3 Workstream B, item B3).
 * Given a known "true ability" per skill, this generates a chronological stream
 * of practice evidence + mock outcomes with reproducible, seeded noise.
 *
 * This is what lets the harness validate BEFORE any real cohort exists: feed a
 * learner whose truth we control, replay it, and assert the predictor recovers
 * that truth and the metric math computes the known answer. No `Math.random`,
 * no wall clock — same spec + same seed ⇒ byte-identical scenario.
 */
import { IELTS_SKILLS, type IeltsModule, type IeltsSkill } from "@/lib/ielts/adaptive/contracts";
import { computeOverallBand } from "@/lib/scoring/ielts/overall-band";
import { roundToHalfBand } from "@/lib/scoring/round-half-band";
import type { BacktestScenario, MockOutcome } from "./backtest.types";
import type { IeltsBandEvidenceSource } from "@/lib/ielts/adaptive/contracts";
import type { IeltsPredictionObservation } from "./input.types";

const MS_PER_DAY = 86_400_000;

/** A reproducible synthetic learner. */
export interface SyntheticLearnerSpec {
  userId: string;
  module: IeltsModule;
  /** Ground-truth band per skill (what an ideal predictor should recover). */
  trueBands: Record<IeltsSkill, number>;
  targetBand: number;
  targetTestDate?: string;
  /** ISO date/datetime for cycle 0. */
  startDate: string;
  mockCount: number;
  daysBetweenMocks: number;
  observationsPerSkillPerCycle: number;
  /** Band SD of practice-evidence noise (0 ⇒ noiseless). */
  observationNoise: number;
  /** Band SD of mock-measurement noise (0 ⇒ the mock equals true ability). */
  examNoise: number;
  seed: number;
  /** Optional per-skill band improvement added each cycle (a learning curve). */
  driftPerMock?: Partial<Record<IeltsSkill, number>>;
}

/** Mulberry32 — a tiny, fast, fully deterministic PRNG in [0, 1). */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A Box–Muller normal draw with SD `sd`. Returns 0 (no draws) when sd ≤ 0. */
export function gaussianNoise(rng: () => number, sd: number): number {
  if (sd <= 0) return 0;
  const u1 = Math.max(rng(), 1e-12);
  const u2 = rng();
  return sd * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeBand(value: number): number {
  return roundToHalfBand(clamp(value, 0, 9));
}

function trueBandAtCycle(spec: SyntheticLearnerSpec, skill: IeltsSkill, cycle: number): number {
  const drift = spec.driftPerMock?.[skill] ?? 0;
  return clamp(spec.trueBands[skill] + drift * cycle, 0, 9);
}

function practiceSource(skill: IeltsSkill): IeltsBandEvidenceSource {
  if (skill === "writing") return "writing_task";
  if (skill === "speaking") return "speaking_part";
  return "skill_mock";
}

function practiceObservation(
  skill: IeltsSkill,
  band: number,
  occurredAt: string,
): IeltsPredictionObservation {
  return {
    skill,
    band,
    occurredAt,
    source: practiceSource(skill),
    label: `${skill} practice`,
    reliability: 0.9,
    coverage: 0.8,
    rawScore: null,
    reasonEn: `${skill} practice evidence.`,
    reasonVi: `Dữ liệu luyện tập ${skill}.`,
  };
}

function fullMockObservation(
  skill: IeltsSkill,
  band: number,
  occurredAt: string,
): IeltsPredictionObservation {
  return {
    skill,
    band,
    occurredAt,
    source: "full_mock",
    label: `${skill} mock`,
    reliability: 1,
    coverage: 1,
    rawScore: null,
    reasonEn: `${skill} full-mock evidence.`,
    reasonVi: `Dữ liệu thi thử ${skill}.`,
  };
}

function emitCycle(
  rng: () => number,
  spec: SyntheticLearnerSpec,
  cycle: number,
  observations: IeltsPredictionObservation[],
  mocks: MockOutcome[],
): void {
  const startMs = Date.parse(spec.startDate);
  const cycleMs = spec.daysBetweenMocks * MS_PER_DAY;
  const mockMs = startMs + (cycle + 1) * cycleMs;

  for (let j = 0; j < spec.observationsPerSkillPerCycle; j += 1) {
    const frac = (j + 0.5) / spec.observationsPerSkillPerCycle;
    const occurredAt = new Date(mockMs - cycleMs + frac * cycleMs).toISOString();
    for (const skill of IELTS_SKILLS) {
      const band = normalizeBand(
        trueBandAtCycle(spec, skill, cycle) + gaussianNoise(rng, spec.observationNoise),
      );
      observations.push(practiceObservation(skill, band, occurredAt));
    }
  }

  const occurredAt = new Date(mockMs).toISOString();
  const bands = {} as Record<IeltsSkill, number>;
  for (const skill of IELTS_SKILLS) {
    bands[skill] = normalizeBand(
      trueBandAtCycle(spec, skill, cycle) + gaussianNoise(rng, spec.examNoise),
    );
  }
  mocks.push({
    attemptId: `${spec.userId}:mock:${cycle}`,
    occurredAt,
    bands,
    overall: computeOverallBand(bands).band,
  });
  for (const skill of IELTS_SKILLS) {
    observations.push(fullMockObservation(skill, bands[skill], occurredAt));
  }
}

/** Build a deterministic, replayable scenario from a spec. */
export function makeSyntheticScenario(spec: SyntheticLearnerSpec): BacktestScenario {
  const rng = mulberry32(spec.seed);
  const observations: IeltsPredictionObservation[] = [];
  const mocks: MockOutcome[] = [];
  for (let cycle = 0; cycle < spec.mockCount; cycle += 1) {
    emitCycle(rng, spec, cycle, observations, mocks);
  }
  return {
    userId: spec.userId,
    module: spec.module,
    targetBand: spec.targetBand,
    targetTestDate: spec.targetTestDate ?? null,
    observations,
    mocks,
    skillStates: [],
  };
}

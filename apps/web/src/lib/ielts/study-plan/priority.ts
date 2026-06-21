import {
  DEFAULT_IELTS_TARGET_BAND,
  IELTS_SKILLS,
  type IeltsGoalModel,
  type IeltsLearnAtom,
  type IeltsSkill,
  type IeltsWeaknessSignal,
} from "@/lib/ielts/adaptive/contracts";
import { diffCalendarDays } from "./dates";
import type {
  IeltsPlanningPrediction,
  IeltsPlanningPredictionSummary,
  IeltsSkillPriority,
} from "./types";

const MIN_ACTIONABLE_GAP = 0.25;

function isSnapshot(
  prediction: IeltsPlanningPrediction,
): prediction is Extract<IeltsPlanningPrediction, { predictedSkillBands: unknown }> {
  return "predictedSkillBands" in prediction;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function intersects(left: readonly string[], right: readonly string[]): boolean {
  const normalizedRight = new Set(right.map(normalize));
  return left.some((item) => normalizedRight.has(normalize(item)));
}

export function summarizePrediction(
  prediction: IeltsPlanningPrediction,
): IeltsPlanningPredictionSummary {
  if (isSnapshot(prediction)) {
    return {
      sourceId: prediction.snapshotId,
      asOf: prediction.generatedAt,
      overallBand: prediction.predictedOverallBand,
      skillBands: prediction.predictedSkillBands,
      confidence: prediction.confidence,
    };
  }

  return {
    sourceId: `${prediction.modelVersion}:${prediction.asOf}`,
    asOf: prediction.asOf,
    overallBand: prediction.overall.band,
    skillBands: {
      listening: prediction.skills.listening.band,
      reading: prediction.skills.reading.band,
      writing: prediction.skills.writing.band,
      speaking: prediction.skills.speaking.band,
    },
    confidence: prediction.overall.confidence,
  };
}

export function weaknessesForPlanning(
  prediction: IeltsPlanningPrediction,
  override?: IeltsWeaknessSignal[],
): IeltsWeaknessSignal[] {
  if (override) return override;
  return prediction.weaknesses;
}

function targetBandForSkill(goal: IeltsGoalModel, skill: IeltsSkill): number {
  return goal.targetSkillBands[skill] ?? goal.targetOverallBand ?? DEFAULT_IELTS_TARGET_BAND;
}

function severityWeight(weakness: IeltsWeaknessSignal): number {
  if (weakness.severity === "critical") return 1.25;
  if (weakness.severity === "weak") return 1.05;
  return 0.85;
}

function criterionWeight(weakness: IeltsWeaknessSignal): number {
  const values = [
    weakness.key,
    ...Object.values(weakness.recommendedActivityFilters).flat(),
  ].join(" ");
  const text = normalize(values);

  if (text.includes("task2")) return 1.25;
  if (text.includes("pronunciation") || text.includes("phoneme")) return 1.15;
  if (weakness.skill === "writing") return 1.1;
  return 1;
}

function urgencyWeight(goal: IeltsGoalModel, startDate: string): number {
  const daysLeft = diffCalendarDays(startDate, goal.targetTestDate);
  if (daysLeft <= 13) return 1.4;
  if (daysLeft <= 42) return 1.25;
  if (daysLeft <= 120) return 1;
  return 0.85;
}

function skillExamWeight(params: {
  skill: IeltsSkill;
  summary: IeltsPlanningPredictionSummary;
  goal: IeltsGoalModel;
}): number {
  const lowest = Math.min(
    ...IELTS_SKILLS.map((skill) => params.summary.skillBands[skill] ?? 9),
  );
  const current = params.summary.skillBands[params.skill];
  const target = targetBandForSkill(params.goal, params.skill);
  return current === lowest && target - (current ?? target) >= 1 ? 1.15 : 1;
}

function directAtomMatchScore(
  weakness: IeltsWeaknessSignal,
  atom: IeltsLearnAtom,
): number {
  if (weakness.skill !== atom.skill) return 0;
  const filters = weakness.recommendedActivityFilters;
  const atomTags = [atom.focusArea, ...atom.rendererTags, atom.activityType];
  const requested = [
    weakness.key,
    weakness.labelEn,
    ...(filters.questionTypes ?? []),
    ...(filters.criteria ?? []),
    ...(filters.subskillTags ?? []),
  ];

  if (intersects(requested, atomTags)) return 2;
  if (normalize(atom.focusArea).includes(normalize(weakness.labelEn))) return 2;
  if (normalize(weakness.labelEn).includes(normalize(atom.focusArea))) return 2;
  return 1;
}

function recommendedAtomForWeakness(
  weakness: IeltsWeaknessSignal,
  learnAtoms: IeltsLearnAtom[],
): IeltsLearnAtom | null {
  const scored = learnAtoms
    .map((atom) => ({ atom, score: directAtomMatchScore(weakness, atom) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);
  return scored[0]?.atom ?? null;
}

function contentAvailabilityWeight(
  weakness: IeltsWeaknessSignal,
  atom: IeltsLearnAtom | null,
  learnAtoms: IeltsLearnAtom[],
): number {
  if (atom && directAtomMatchScore(weakness, atom) > 1) return 1;
  if (learnAtoms.some((candidate) => candidate.skill === weakness.skill)) return 0.7;
  return 0.35;
}

function focusMultiplier(goal: IeltsGoalModel, skill: IeltsSkill): number {
  if (!goal.focusSkills?.length) return 1;
  return goal.focusSkills.includes(skill) ? 1.15 : 0.12;
}

function gapBands(params: {
  weakness: IeltsWeaknessSignal;
  summary: IeltsPlanningPredictionSummary;
  target: number;
}): number {
  const current =
    params.weakness.currentValue ?? params.summary.skillBands[params.weakness.skill];
  if (current == null) return MIN_ACTIONABLE_GAP;
  return Math.max(MIN_ACTIONABLE_GAP, params.target - current);
}

export function buildSkillPriorities(params: {
  goal: IeltsGoalModel;
  prediction: IeltsPlanningPrediction;
  weaknesses?: IeltsWeaknessSignal[];
  learnAtoms: IeltsLearnAtom[];
  startDate: string;
}): IeltsSkillPriority[] {
  const summary = summarizePrediction(params.prediction);
  const weaknesses = weaknessesForPlanning(params.prediction, params.weaknesses);

  return weaknesses
    .map((weakness) => {
      const target = targetBandForSkill(params.goal, weakness.skill);
      const atom = recommendedAtomForWeakness(weakness, params.learnAtoms);
      const gap = gapBands({ weakness, summary, target });
      const declared = params.goal.focusSkills?.includes(weakness.skill) ?? false;
      const priority =
        gap *
        skillExamWeight({ skill: weakness.skill, summary, goal: params.goal }) *
        criterionWeight(weakness) *
        weakness.confidence *
        severityWeight(weakness) *
        contentAvailabilityWeight(weakness, atom, params.learnAtoms) *
        urgencyWeight(params.goal, params.startDate) *
        focusMultiplier(params.goal, weakness.skill);

      return {
        skill: weakness.skill,
        weaknessKey: weakness.key,
        labelEn: weakness.labelEn,
        labelVi: weakness.labelVi,
        focusArea: weakness.labelEn,
        targetBand: target,
        currentBand: weakness.currentValue ?? summary.skillBands[weakness.skill],
        gapBands: gap,
        priorityScore: Math.round(priority * 10_000) / 10_000,
        isDeclaredFocus: declared,
        isMaintenance: Boolean(params.goal.focusSkills?.length && !declared),
        weakness,
        recommendedAtom: atom,
      };
    })
    .sort((left, right) => right.priorityScore - left.priorityScore);
}

import {
  IELTS_SKILLS,
  type IeltsBandEstimate,
  type IeltsSkill,
  type IeltsWeaknessSeverity,
  type IeltsWeaknessSignal,
} from "@/lib/ielts/adaptive/contracts";
import { roundToHalfBand } from "@/lib/scoring/round-half-band";
import type { IeltsPredictionSubskillState } from "./input.types";

const SKILL_LABELS: Record<IeltsSkill, { en: string; vi: string }> = {
  listening: { en: "Listening", vi: "Nghe" },
  reading: { en: "Reading", vi: "Đọc" },
  writing: { en: "Writing", vi: "Viết" },
  speaking: { en: "Speaking", vi: "Nói" },
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundDecimal(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function normalizeBand(value: number): number {
  return roundToHalfBand(clamp(value, 0, 9));
}

function severityFor(gap: number, weaknessWeight: number): IeltsWeaknessSeverity {
  if (gap >= 1 || weaknessWeight >= 0.65) return "critical";
  if (gap >= 0.5 || weaknessWeight >= 0.35) return "weak";
  return "watch";
}

function weaknessRank(signal: IeltsWeaknessSignal): number {
  const severity = { critical: 3, weak: 2, watch: 1 }[signal.severity];
  const gap = Math.max(0, (signal.targetValue ?? 0) - (signal.currentValue ?? 0));
  return severity * 10 + gap + signal.confidence;
}

function stateWeakness(
  state: IeltsPredictionSubskillState,
  targetBand: number,
): IeltsWeaknessSignal | null {
  const current = state.bandEstimate == null ? null : normalizeBand(state.bandEstimate);
  const gap = current == null ? 0 : Math.max(0, targetBand - current);
  if (gap < 0.5 && state.weaknessWeight < 0.05) return null;
  return {
    skill: state.skill,
    key: state.subskillKey,
    labelEn: state.labelEn,
    labelVi: state.labelVi,
    severity: severityFor(gap, state.weaknessWeight),
    confidence: roundDecimal(clamp(state.confidence, 0, 1), 3),
    evidenceCount: state.evidenceCount,
    currentValue: current,
    targetValue: targetBand,
    reasonEn: `${state.labelEn} is below the target band or carries recent weakness weight.`,
    reasonVi: `${state.labelVi} đang dưới mục tiêu hoặc có tín hiệu yếu gần đây.`,
    recommendedActivityFilters: {
      skill: state.skill,
      questionTypes: state.questionType ? [state.questionType] : undefined,
      criteria: state.criterion ? [state.criterion] : undefined,
      subskillTags: [state.subskillKey],
    },
  };
}

function skillGapWeakness(
  skill: IeltsSkill,
  estimate: IeltsBandEstimate,
  targetBand: number,
): IeltsWeaknessSignal | null {
  if (estimate.band == null || targetBand - estimate.band < 0.5) return null;
  const label = SKILL_LABELS[skill];
  const gap = targetBand - estimate.band;
  return {
    skill,
    key: `${skill}:overall_band`,
    labelEn: `${label.en} band gap`,
    labelVi: `Khoảng cách điểm ${label.vi}`,
    severity: severityFor(gap, 0),
    confidence: estimate.confidence,
    evidenceCount: estimate.evidence.length,
    currentValue: estimate.band,
    targetValue: targetBand,
    reasonEn: `${label.en} is predicted at ${estimate.band}, below the ${targetBand} target.`,
    reasonVi: `${label.vi} đang dự đoán ở ${estimate.band}, thấp hơn mục tiêu ${targetBand}.`,
    recommendedActivityFilters: { skill },
  };
}

export function buildWeaknesses(
  skills: Record<IeltsSkill, IeltsBandEstimate>,
  states: readonly IeltsPredictionSubskillState[],
  targetBand: number,
): IeltsWeaknessSignal[] {
  const subskillSignals = states.flatMap((state) => {
    const signal = stateWeakness(state, targetBand);
    return signal ? [signal] : [];
  });
  const skillSignals = IELTS_SKILLS.flatMap((skill) => {
    const signal = skillGapWeakness(skill, skills[skill], targetBand);
    return signal ? [signal] : [];
  });
  return [...subskillSignals, ...skillSignals]
    .sort((a, b) => weaknessRank(b) - weaknessRank(a) || a.key.localeCompare(b.key))
    .slice(0, 12);
}

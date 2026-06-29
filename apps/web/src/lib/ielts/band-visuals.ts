import {
  DEFAULT_IELTS_TARGET_BAND,
  IELTS_SKILLS,
} from "@/lib/ielts/adaptive/contracts";
import type { IeltsSkillKey, SkillBandRow } from "@/lib/ielts/results/types";

export interface IeltsBandTargets {
  overall: number;
  skills: Partial<Record<IeltsSkillKey, number | null>>;
}

export type TargetDeltaState = "pending" | "gap" | "met";

export interface TargetDeltaView {
  state: TargetDeltaState;
  text: string;
  amount: number | null;
}

export function clampBand(value: number): number {
  return Math.min(9, Math.max(0, value));
}

export function formatBandValue(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toFixed(1)
    : "—";
}

export function bandProgress(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value)
    ? clampBand(value) / 9
    : 0;
}

export function targetBandForSkill(
  targets: IeltsBandTargets | null | undefined,
  skill: IeltsSkillKey,
): number {
  const skillTarget = targets?.skills[skill];
  if (typeof skillTarget === "number" && Number.isFinite(skillTarget)) {
    return skillTarget;
  }
  if (typeof targets?.overall === "number" && Number.isFinite(targets.overall)) {
    return targets.overall;
  }
  return DEFAULT_IELTS_TARGET_BAND;
}

export function normalizeBandTargets(
  targets: Partial<IeltsBandTargets> | null | undefined,
): IeltsBandTargets {
  const overall =
    typeof targets?.overall === "number" && Number.isFinite(targets.overall)
      ? targets.overall
      : DEFAULT_IELTS_TARGET_BAND;

  return {
    overall,
    skills: Object.fromEntries(
      IELTS_SKILLS.map((skill) => [
        skill,
        typeof targets?.skills?.[skill] === "number"
          ? targets.skills[skill]
          : null,
      ]),
    ) as IeltsBandTargets["skills"],
  };
}

export function targetDeltaView(
  band: number | null | undefined,
  target: number | null | undefined,
): TargetDeltaView {
  const safeTarget =
    typeof target === "number" && Number.isFinite(target)
      ? target
      : DEFAULT_IELTS_TARGET_BAND;

  if (typeof band !== "number" || !Number.isFinite(band)) {
    return {
      state: "pending",
      text: `Target ${formatBandValue(safeTarget)}`,
      amount: null,
    };
  }

  const amount = Math.max(0, safeTarget - band);
  if (amount <= 0) {
    return { state: "met", text: "On target", amount: 0 };
  }

  return {
    state: "gap",
    text: `${formatBandValue(amount)} to go`,
    amount,
  };
}

export function buildResultsBandInsight(
  skills: Array<Pick<SkillBandRow, "skill" | "label" | "band">>,
  targets: IeltsBandTargets | null | undefined,
): string {
  const scored = skills.filter(
    (skill): skill is Pick<SkillBandRow, "skill" | "label"> & { band: number } =>
      typeof skill.band === "number" && Number.isFinite(skill.band),
  );

  if (scored.length === 0) {
    return "We'll update this as more skills are scored.";
  }

  const strongest = [...scored].sort((a, b) => b.band - a.band)[0];
  const biggestGap = scored
    .map((skill) => ({
      ...skill,
      gap: Math.max(0, targetBandForSkill(targets, skill.skill) - skill.band),
    }))
    .sort((a, b) => b.gap - a.gap)[0];

  if (biggestGap && biggestGap.gap > 0) {
    if (strongest.skill === biggestGap.skill) {
      return `${biggestGap.label} is your current anchor; the next lift is ${formatBandValue(
        biggestGap.gap,
      )} to go.`;
    }
    return `${strongest.label} is your anchor; ${biggestGap.label} is the clearest place to gain ${formatBandValue(
      biggestGap.gap,
    )}.`;
  }

  return `On target. ${strongest.label} is leading at ${formatBandValue(
    strongest.band,
  )}.`;
}

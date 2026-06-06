import type { PracticeTrack } from "@/types";
import type { SkillMetricKey } from "@/lib/analytics/skill-snapshot";

export interface SkillUiMeta {
  accentHex: string;
  dotClassName: string;
  progressClassName: string;
  softClassName: string;
  chipClassName: string;
  descriptionKey: string;
}

export const SKILL_UI_META: Record<SkillMetricKey, SkillUiMeta> = {
  clarity: {
    accentHex: "#0788A0",
    dotClassName: "bg-primary",
    progressClassName: "bg-primary",
    softClassName: "bg-primary-container",
    chipClassName: "bg-primary-container text-on-surface-variant",
    descriptionKey: "clarity",
  },
  logic: {
    accentHex: "#00B8D9",
    dotClassName: "bg-primary",
    progressClassName: "bg-primary",
    softClassName: "bg-primary-container",
    chipClassName: "bg-primary-container text-on-surface-variant",
    descriptionKey: "logic",
  },
  rebuttal: {
    accentHex: "#FFD166",
    dotClassName: "bg-warning",
    progressClassName: "bg-warning",
    softClassName: "bg-surface-container",
    chipClassName: "bg-surface-container text-on-surface-variant",
    descriptionKey: "rebuttal",
  },
  evidence: {
    accentHex: "#00B8D9",
    dotClassName: "bg-success",
    progressClassName: "bg-success",
    softClassName: "bg-surface-container",
    chipClassName: "bg-surface-container text-on-surface-variant",
    descriptionKey: "evidence",
  },
  delivery: {
    accentHex: "#00B8D9",
    dotClassName: "bg-surface-container-high",
    progressClassName: "bg-surface-container-high",
    softClassName: "bg-surface-container",
    chipClassName: "bg-surface-container text-on-surface-variant",
    descriptionKey: "delivery",
  },
};

export const TRACK_SKILL_ORDER: Record<PracticeTrack, SkillMetricKey[]> = {
  speaking: ["clarity", "logic", "rebuttal", "evidence", "delivery"],
  debate: ["clarity", "logic", "rebuttal", "evidence", "delivery"],
};

export function getSkillKeysForTrack(track: PracticeTrack) {
  return TRACK_SKILL_ORDER[track];
}

export function scoreOutOfHundred(valueOutOfHundred: number) {
  return Math.round(Math.max(0, Math.min(100, valueOutOfHundred)));
}

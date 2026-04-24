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
    accentHex: "#3E78EC",
    dotClassName: "bg-[#3E78EC]",
    progressClassName: "bg-[#3E78EC]",
    softClassName: "bg-[#EEF4FF]",
    chipClassName: "bg-[#EEF4FF] text-[#2157C8]",
    descriptionKey: "clarity",
  },
  logic: {
    accentHex: "#4D86F7",
    dotClassName: "bg-[#4D86F7]",
    progressClassName: "bg-[#4D86F7]",
    softClassName: "bg-[#EEF4FF]",
    chipClassName: "bg-[#EEF4FF] text-[#245FD6]",
    descriptionKey: "logic",
  },
  rebuttal: {
    accentHex: "#F5B942",
    dotClassName: "bg-[#F5B942]",
    progressClassName: "bg-[#F5B942]",
    softClassName: "bg-[#FFF5E2]",
    chipClassName: "bg-[#FFF5E2] text-[#C57F00]",
    descriptionKey: "rebuttal",
  },
  evidence: {
    accentHex: "#34C759",
    dotClassName: "bg-[#34C759]",
    progressClassName: "bg-[#34C759]",
    softClassName: "bg-[#EAF9EF]",
    chipClassName: "bg-[#EAF9EF] text-[#1A9153]",
    descriptionKey: "evidence",
  },
  delivery: {
    accentHex: "#7B61FF",
    dotClassName: "bg-[#7B61FF]",
    progressClassName: "bg-[#7B61FF]",
    softClassName: "bg-[#F1EEFF]",
    chipClassName: "bg-[#F1EEFF] text-[#6245F5]",
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

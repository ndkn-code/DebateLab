import type { CSSProperties } from "react";
import type { IeltsSkill } from "@/lib/ielts/adaptive/contracts";

export type IeltsSkillAccentVars = CSSProperties & {
  "--ielts-skill-accent": string;
  "--ielts-skill-accent-end": string;
  "--ielts-skill-accent-container": string;
  "--ielts-skill-accent-border": string;
  "--ielts-skill-accent-text": string;
};

const SKILL_ACCENT: Record<
  IeltsSkill,
  {
    accent: string;
    end: string;
    text: string;
  }
> = {
  listening: {
    accent: "var(--color-chart-1)",
    end: "var(--color-chart-6)",
    text: "var(--color-chart-6)",
  },
  reading: {
    accent: "var(--color-chart-5)",
    end: "var(--color-chart-2)",
    text: "var(--color-chart-5)",
  },
  writing: {
    accent: "var(--color-chart-7)",
    end: "var(--color-chart-4)",
    text: "var(--color-chart-7)",
  },
  speaking: {
    accent: "var(--color-chart-3)",
    end: "var(--color-chart-1)",
    text: "var(--color-chart-3)",
  },
};

export function skillAccentVars(skill: IeltsSkill): IeltsSkillAccentVars {
  const accent = SKILL_ACCENT[skill];
  return {
    "--ielts-skill-accent": accent.accent,
    "--ielts-skill-accent-end": accent.end,
    "--ielts-skill-accent-container":
      "color-mix(in srgb, var(--ielts-skill-accent) 14%, var(--color-surface-container))",
    "--ielts-skill-accent-border":
      "color-mix(in srgb, var(--ielts-skill-accent) 34%, var(--color-outline-variant))",
    "--ielts-skill-accent-text": accent.text,
  };
}

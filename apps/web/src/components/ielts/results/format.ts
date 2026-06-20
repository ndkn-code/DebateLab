import type { SkillResultStatus } from "@/lib/ielts/results/types";

/** IELTS bands always display to one decimal (6 → "6.0"); null → em dash. */
export function bandText(band: number | null): string {
  return band === null ? "—" : band.toFixed(1);
}

export const STATUS_LABEL: Record<SkillResultStatus, string> = {
  scored: "Scored",
  in_progress: "Scoring…",
  not_attempted: "Not attempted",
};

/** Token classes for a per-skill status pill (semantic tokens only). */
export const STATUS_PILL: Record<SkillResultStatus, string> = {
  scored: "bg-success-container text-success-dim",
  in_progress: "bg-warning-container text-on-warning-container",
  not_attempted: "bg-surface-container-high text-on-surface-variant",
};

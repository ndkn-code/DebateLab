/**
 * Presentation mapping for IELTS subskill mastery levels (WS-6.2.3).
 *
 * The level itself is computed (and unit-tested) in `lib/ielts/learner/learn-path`;
 * this module only maps a level to design-system tokens — Badge variants, the
 * progress tone, and the i18n label sub-key. Semantic tokens only (no raw hex),
 * so the design audit stays green.
 */
import type { MasteryLevel } from "@/lib/ielts/learner/learn-path";

export type MasteryBadgeVariant = "secondary" | "warning" | "info" | "primary" | "success";

export const MASTERY_BADGE_VARIANT: Record<MasteryLevel, MasteryBadgeVariant> = {
  untouched: "secondary",
  focus: "warning",
  building: "info",
  test_ready: "primary",
  mastered: "success",
};

export const MASTERY_PROGRESS_TONE: Record<MasteryLevel, "primary" | "reward" | "success"> = {
  untouched: "primary",
  focus: "primary",
  building: "primary",
  test_ready: "primary",
  mastered: "success",
};

/** i18n sub-key under `dashboard.ielts.learn.mastery`. */
export function masteryLabelKey(level: MasteryLevel): MasteryLevel {
  return level;
}

/** Pick the right-locale subskill label (the dictionary stores both). */
export function subskillLabel(
  mastery: { labelEn: string; labelVi: string },
  locale: string,
): string {
  return locale === "vi" ? mastery.labelVi : mastery.labelEn;
}

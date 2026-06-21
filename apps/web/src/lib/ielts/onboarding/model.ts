import { z } from "zod";
import {
  DEFAULT_IELTS_TARGET_BAND,
  IELTS_SKILLS,
  IeltsFeedbackLanguageSchema,
  IeltsGoalModelSchema,
  IeltsModuleSchema,
  IeltsSkillSchema,
  type IeltsBandPrediction,
  type IeltsGoalModel,
  type IeltsSkill,
} from "@/lib/ielts/adaptive/contracts";
import type { Tables } from "@/types/supabase";

export const IELTS_ONBOARDING_HORIZON_DAYS = 14;
export const IELTS_ONBOARDING_DEFAULT_DAILY_MINUTES = 45;
export const IELTS_ONBOARDING_DEFAULT_STUDY_DAYS = [1, 2, 3, 4, 5] as const;

export const IeltsOnboardingGoalInputSchema = IeltsGoalModelSchema;

export type IeltsOnboardingGoalInput = z.infer<
  typeof IeltsOnboardingGoalInputSchema
>;

export type IeltsOnboardingStep = "welcome" | "goal" | "diagnostic" | "result";

type StudyPlanGoalRow = Pick<
  Tables<"ielts_study_plans">,
  | "module"
  | "target_overall_band"
  | "target_listening_band"
  | "target_reading_band"
  | "target_writing_band"
  | "target_speaking_band"
  | "target_test_date"
  | "focus_skills"
  | "daily_minutes"
  | "study_days"
  | "timezone"
  | "feedback_language"
>;

function isoDateFromUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addUtcDaysToIsoDate(isoDate: string, days: number): string {
  const base = new Date(`${isoDate}T00:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return isoDateFromUtc(base);
}

export function defaultTargetTestDate(todayIso: string): string {
  return addUtcDaysToIsoDate(todayIso, 90);
}

export function defaultIeltsOnboardingGoal(params: {
  todayIso: string;
  timezone: string;
  feedbackLanguage: "en" | "vi";
}): IeltsGoalModel {
  return IeltsGoalModelSchema.parse({
    module: "academic",
    targetOverallBand: DEFAULT_IELTS_TARGET_BAND,
    targetSkillBands: {},
    targetTestDate: defaultTargetTestDate(params.todayIso),
    availability: {
      studyDays: [...IELTS_ONBOARDING_DEFAULT_STUDY_DAYS],
      dailyMinutes: IELTS_ONBOARDING_DEFAULT_DAILY_MINUTES,
      timezone: params.timezone,
      preferredIntensity: "standard",
    },
    feedbackLanguage: params.feedbackLanguage,
  });
}

export function goalFromStudyPlanRow(row: StudyPlanGoalRow): IeltsGoalModel {
  const targetSkillBands: IeltsGoalModel["targetSkillBands"] = {
    listening: row.target_listening_band,
    reading: row.target_reading_band,
    writing: row.target_writing_band,
    speaking: row.target_speaking_band,
  };

  return IeltsGoalModelSchema.parse({
    module: IeltsModuleSchema.parse(row.module),
    targetOverallBand: row.target_overall_band,
    targetSkillBands,
    targetTestDate: row.target_test_date,
    focusSkills: row.focus_skills?.map((skill) => IeltsSkillSchema.parse(skill)),
    availability: {
      studyDays: row.study_days,
      dailyMinutes: row.daily_minutes,
      timezone: row.timezone,
      preferredIntensity: "standard",
    },
    feedbackLanguage: IeltsFeedbackLanguageSchema.parse(row.feedback_language),
  });
}

export function predictionHasOverallEvidence(
  prediction: IeltsBandPrediction,
): boolean {
  return prediction.overall.band !== null && prediction.overall.status !== "diagnostic_needed";
}

export function completedSkillPredictions(
  prediction: IeltsBandPrediction,
): IeltsSkill[] {
  return IELTS_SKILLS.filter((skill) => prediction.skills[skill].band !== null);
}

export function initialOnboardingStep(params: {
  hasGoal: boolean;
  prediction: IeltsBandPrediction;
  requestedStep?: string | null;
}): IeltsOnboardingStep {
  if (!params.hasGoal) return "welcome";
  if (
    params.requestedStep === "result" &&
    completedSkillPredictions(params.prediction).length > 0
  ) {
    return "result";
  }
  if (predictionHasOverallEvidence(params.prediction)) return "result";
  return "diagnostic";
}

export function confidencePercent(confidence: number): number {
  return Math.round(Math.max(0, Math.min(1, confidence)) * 100);
}

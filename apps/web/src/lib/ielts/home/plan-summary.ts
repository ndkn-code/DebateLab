/**
 * Pure plan-summary view-model for the IELTS home (WS-6.2.1).
 *
 * The predicted-band card anchors the prediction against the learner's goal:
 * their target band and a test-date countdown (study-plan-engine.md "IELTS
 * Home" surface). All fields come from the active `ielts_study_plans` row; this
 * module only derives the countdown so the component stays a thin renderer.
 */
import type { Tables } from "@/types/supabase";
import type { IeltsFeedbackLanguage } from "@/lib/ielts/adaptive/contracts";

export type IeltsHomePlanRow = Pick<
  Tables<"ielts_study_plans">,
  "target_overall_band" | "target_test_date" | "feedback_language"
>;

export interface IeltsHomePlanSummary {
  targetOverallBand: number | null;
  targetTestDate: string | null;
  /** Whole days from `today` until the test date; negative once it has passed. */
  testDateInDays: number | null;
  feedbackLanguage: IeltsFeedbackLanguage;
}

const MS_PER_DAY = 86_400_000;

function isoDateToUtcMs(isoDate: string): number | null {
  // Accept full ISO timestamps too, but key off the calendar day only.
  const day = isoDate.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const ms = Date.parse(`${day}T00:00:00.000Z`);
  return Number.isNaN(ms) ? null : ms;
}

/** Whole calendar days from `today` to `target` (both `YYYY-MM-DD`). */
export function daysUntilIsoDate(target: string, today: string): number | null {
  const targetMs = isoDateToUtcMs(target);
  const todayMs = isoDateToUtcMs(today);
  if (targetMs === null || todayMs === null) return null;
  return Math.round((targetMs - todayMs) / MS_PER_DAY);
}

/** Shape the active plan row + today's date into the home plan summary, or null. */
export function buildIeltsHomePlanSummary(params: {
  plan: IeltsHomePlanRow | null;
  today: string;
}): IeltsHomePlanSummary | null {
  if (!params.plan) return null;
  const { plan } = params;
  return {
    targetOverallBand: plan.target_overall_band,
    targetTestDate: plan.target_test_date,
    testDateInDays: plan.target_test_date
      ? daysUntilIsoDate(plan.target_test_date, params.today)
      : null,
    feedbackLanguage:
      plan.feedback_language === "vi" ? "vi" : "en",
  };
}

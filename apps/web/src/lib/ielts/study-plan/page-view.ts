/**
 * Pure view-model for the IELTS study-plan page (WS-6.2.2).
 *
 * Stitches the active plan, its dated items, the due-review queue, the revision
 * log, and the latest Track B prediction into one serialisable, view-ready
 * shape: a 14-day calendar, a weekly forecast, a gap-to-target summary, the
 * review queue split into due/upcoming, the reassessment schedule, and the
 * revision log. Diagnostic-first: a band is only surfaced when the prediction
 * has evidence behind it; otherwise the page shows a "start your diagnostic"
 * state. Section builders live in `./page-view-sections`; types in
 * `./page-view-types` (re-exported). No DB or React here, so it is unit-tested.
 */
import { predictionHasOverallEvidence } from "@/lib/ielts/onboarding/model";
import { diffCalendarDays } from "./dates";
import {
  buildCalendar,
  buildPrediction,
  buildReassessment,
  buildReasoning,
  buildReviewQueue,
  buildWeeklyForecast,
  toRevisionView,
} from "./page-view-sections";
import type {
  BuildIeltsStudyPlanPageViewInput,
  IeltsStudyPlanPageStatus,
  IeltsStudyPlanPageView,
} from "./page-view-types";
import type { IeltsStudyPlanMode } from "./types";

export * from "./page-view-types";

const DEFAULT_HORIZON_DAYS = 14;
const MAX_REVISIONS = 30;

const EMPTY_CALENDAR: IeltsStudyPlanPageView["calendar"] = {
  startDate: "",
  endDate: "",
  horizonDays: 0,
  days: [],
  totalPlannedMinutes: 0,
  totalItemCount: 0,
  overdue: [],
};

/** Mirror the generator's mode thresholds so the page labels the plan the same. */
export function studyPlanModeForDays(daysUntilTest: number): IeltsStudyPlanMode {
  if (daysUntilTest <= 13) return "cram";
  if (daysUntilTest <= 42) return "sprint";
  if (daysUntilTest <= 120) return "standard";
  return "long_horizon";
}

export function buildIeltsStudyPlanPageView(
  input: BuildIeltsStudyPlanPageViewInput,
): IeltsStudyPlanPageView {
  const prediction = buildPrediction(input.prediction, input.goal);
  const reasoning = buildReasoning(input.prediction, input.plan);
  const revisions = [...input.revisions]
    .sort((a, b) => (a.created_at > b.created_at ? -1 : a.created_at < b.created_at ? 1 : 0))
    .slice(0, MAX_REVISIONS)
    .map(toRevisionView);

  // No goal yet → the learner has not onboarded. Send them to create a plan.
  if (!input.plan || !input.goal) {
    return {
      status: "no_plan",
      module: input.plan?.module ?? null,
      goal: input.goal,
      planVersion: input.plan?.plan_version ?? null,
      hasDiagnosticTest: input.hasDiagnosticTest,
      countdown: null,
      prediction,
      reasoning,
      calendar: EMPTY_CALENDAR,
      weeklyForecast: [],
      reviewQueue: buildReviewQueue(input.reviews, input.now, input.todayIso),
      reassessment: { nextReassessmentAt: null, mocks: [] },
      revisions,
    };
  }

  const horizonDays = input.plan.plan_horizon_days || DEFAULT_HORIZON_DAYS;
  const calendar = buildCalendar(input, horizonDays, input.plan.study_days);
  const daysUntilTest = diffCalendarDays(input.todayIso, input.goal.targetTestDate);
  const status: IeltsStudyPlanPageStatus = predictionHasOverallEvidence(input.prediction)
    ? "ready"
    : "needs_diagnostic";

  return {
    status,
    module: input.plan.module,
    goal: input.goal,
    planVersion: input.plan.plan_version,
    hasDiagnosticTest: input.hasDiagnosticTest,
    countdown: {
      testDate: input.goal.targetTestDate,
      daysUntilTest,
      isPastTestDate: daysUntilTest < 0,
      mode: studyPlanModeForDays(daysUntilTest),
    },
    prediction,
    reasoning,
    calendar,
    weeklyForecast: buildWeeklyForecast(calendar.days),
    reviewQueue: buildReviewQueue(input.reviews, input.now, input.todayIso),
    reassessment: buildReassessment(
      input.items,
      input.plan.next_reassessment_at,
      input.todayIso,
    ),
    revisions,
  };
}

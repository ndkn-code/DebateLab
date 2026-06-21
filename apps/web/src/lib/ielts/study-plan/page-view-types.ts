/**
 * View-model types for the IELTS study-plan page (WS-6.2.2).
 *
 * Split from the builder (`page-view.ts`) to keep each module focused; the
 * builder re-exports these so consumers can import everything from `page-view`.
 * The `StudyPlan*Row` aliases are narrow Picks of the DB rows — a full row is
 * structurally assignable to them, so repositories pass full rows directly.
 */
import type {
  IeltsBandPrediction,
  IeltsGoalModel,
  IeltsModule,
  IeltsPlanAtomKind,
  IeltsPredictionStatus,
  IeltsSkill,
  IeltsTrendDirection,
  IeltsWeaknessSeverity,
} from "@/lib/ielts/adaptive/contracts";
import type { Tables } from "@/types/supabase";
import type { IeltsStudyPlanMode } from "./types";

export type StudyPlanRow = Pick<
  Tables<"ielts_study_plans">,
  | "id"
  | "module"
  | "status"
  | "plan_version"
  | "plan_horizon_days"
  | "target_test_date"
  | "target_overall_band"
  | "focus_skills"
  | "study_days"
  | "daily_minutes"
  | "predicted_overall_band"
  | "predicted_listening_band"
  | "predicted_reading_band"
  | "predicted_writing_band"
  | "predicted_speaking_band"
  | "prediction_confidence"
  | "generated_at"
  | "last_replanned_at"
  | "next_reassessment_at"
  | "explanation"
>;

export type StudyPlanItemRow = Pick<
  Tables<"ielts_study_plan_items">,
  | "id"
  | "kind"
  | "status"
  | "scheduled_date"
  | "skill"
  | "focus_area"
  | "estimated_minutes"
  | "priority_score"
  | "rationale_en"
  | "rationale_vi"
  | "source_weakness_keys"
  | "metadata"
>;

export type StudyPlanReviewRow = Pick<
  Tables<"ielts_review_items">,
  "id" | "skill" | "focus_area" | "review_kind" | "prompt_en" | "prompt_vi" | "due_at" | "state"
>;

export type StudyPlanRevisionRow = Pick<
  Tables<"ielts_study_plan_revisions">,
  | "id"
  | "from_version"
  | "to_version"
  | "trigger_type"
  | "trigger_source_type"
  | "summary_en"
  | "summary_vi"
  | "changed_item_count"
  | "created_at"
>;

export interface BuildIeltsStudyPlanPageViewInput {
  plan: StudyPlanRow | null;
  goal: IeltsGoalModel | null;
  items: StudyPlanItemRow[];
  reviews: StudyPlanReviewRow[];
  revisions: StudyPlanRevisionRow[];
  prediction: IeltsBandPrediction;
  /** Learner's "today" as an ISO date (YYYY-MM-DD), already in plan timezone. */
  todayIso: string;
  /** Current instant as an ISO timestamp, for due-review classification. */
  now: string;
  hasDiagnosticTest: boolean;
}

export type IeltsStudyPlanPageStatus = "no_plan" | "needs_diagnostic" | "ready";

export interface IeltsStudyPlanItemView {
  id: string;
  kind: IeltsPlanAtomKind;
  status: string;
  skill: IeltsSkill;
  focusArea: string;
  titleEn: string;
  titleVi: string;
  rationaleEn: string;
  rationaleVi: string;
  estimatedMinutes: number;
  priorityScore: number;
  sourceWeaknessKeys: string[];
  scheduledDate: string;
  isComplete: boolean;
}

export interface IeltsStudyPlanDayView {
  date: string;
  isoWeekday: number;
  isStudyDay: boolean;
  isToday: boolean;
  plannedMinutes: number;
  completedMinutes: number;
  items: IeltsStudyPlanItemView[];
}

export interface IeltsStudyPlanKindTally {
  kind: IeltsPlanAtomKind;
  count: number;
  minutes: number;
}

export interface IeltsStudyPlanSkillTally {
  skill: IeltsSkill;
  count: number;
  minutes: number;
}

export interface IeltsStudyPlanWeekView {
  index: number;
  startDate: string;
  endDate: string;
  studyDayCount: number;
  plannedMinutes: number;
  itemCount: number;
  byKind: IeltsStudyPlanKindTally[];
  bySkill: IeltsStudyPlanSkillTally[];
}

export interface IeltsStudyPlanSkillGapView {
  skill: IeltsSkill;
  predictedBand: number | null;
  targetBand: number | null;
  gapBands: number | null;
  isFocus: boolean;
  status: IeltsPredictionStatus;
}

export interface IeltsStudyPlanWeaknessView {
  key: string;
  skill: IeltsSkill;
  labelEn: string;
  labelVi: string;
  severity: IeltsWeaknessSeverity;
  reasonEn: string;
  reasonVi: string;
  currentBand: number | null;
  targetBand: number | null;
  confidencePercent: number;
}

export interface IeltsStudyPlanReviewView {
  id: string;
  skill: IeltsSkill;
  focusArea: string;
  reviewKind: string;
  promptEn: string;
  promptVi: string;
  dueAt: string;
  isOverdue: boolean;
  state: string;
}

export interface IeltsStudyPlanReassessmentMockView {
  id: string;
  kind: Extract<IeltsPlanAtomKind, "skill_drill" | "mini_mock" | "full_mock">;
  skill: IeltsSkill;
  scheduledDate: string;
  titleEn: string;
  titleVi: string;
  rationaleEn: string;
  rationaleVi: string;
  isPast: boolean;
}

export interface IeltsStudyPlanRevisionView {
  id: string;
  fromVersion: number | null;
  toVersion: number;
  triggerType: string;
  triggerSourceType: string | null;
  summaryEn: string;
  summaryVi: string;
  changedItemCount: number;
  createdAt: string;
}

export interface IeltsStudyPlanPageView {
  status: IeltsStudyPlanPageStatus;
  module: IeltsModule | null;
  goal: IeltsGoalModel | null;
  planVersion: number | null;
  hasDiagnosticTest: boolean;
  countdown: {
    testDate: string;
    daysUntilTest: number;
    isPastTestDate: boolean;
    mode: IeltsStudyPlanMode;
  } | null;
  prediction: {
    overallBand: number | null;
    lower: number | null;
    upper: number | null;
    status: IeltsPredictionStatus;
    confidencePercent: number;
    trendDirection: IeltsTrendDirection;
    asOf: string;
    skills: IeltsStudyPlanSkillGapView[];
  };
  reasoning: {
    planRationaleEn: string | null;
    planRationaleVi: string | null;
    weaknesses: IeltsStudyPlanWeaknessView[];
    nextBestDiagnosticEn: string;
    nextBestDiagnosticVi: string;
    limitations: string[];
  };
  calendar: {
    startDate: string;
    endDate: string;
    horizonDays: number;
    days: IeltsStudyPlanDayView[];
    totalPlannedMinutes: number;
    totalItemCount: number;
    overdue: IeltsStudyPlanItemView[];
  };
  weeklyForecast: IeltsStudyPlanWeekView[];
  reviewQueue: {
    dueCount: number;
    upcomingCount: number;
    due: IeltsStudyPlanReviewView[];
    upcoming: IeltsStudyPlanReviewView[];
  };
  reassessment: {
    nextReassessmentAt: string | null;
    mocks: IeltsStudyPlanReassessmentMockView[];
  };
  revisions: IeltsStudyPlanRevisionView[];
}

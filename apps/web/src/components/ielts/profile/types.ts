import type {
  IeltsPredictionStatus,
  IeltsSkill,
} from "@/lib/ielts/adaptive/contracts";
import type { EffectiveScoreSource } from "@/lib/api/ielts/effective-score-contract";

export type IeltsProfileScoreSource = EffectiveScoreSource | "unknown";

export interface IeltsProfileSkillView {
  skill: IeltsSkill;
  band: number | null;
  lower: number | null;
  upper: number | null;
  target: number;
  confidencePercent: number;
  status: IeltsPredictionStatus;
}

export interface IeltsProfileAttemptView {
  attemptId: string;
  testTitle: string;
  submittedAt: string | null;
  status: string;
  band: number | null;
  scoreSource: IeltsProfileScoreSource;
  resultsHref: string;
}

export interface IeltsTeacherFeedbackView {
  id: string;
  attemptId: string;
  testTitle: string;
  skill: "writing" | "speaking";
  taskLabel: string;
  note: string;
  submittedAt: string | null;
  resultsHref: string;
}

export interface IeltsConsistencyDayView {
  date: string;
  completedMinutes: number;
  completedTasks: number;
  plannedMinutes: number;
  plannedTasks: number;
}

export interface IeltsProfileView {
  identity: {
    firstName: string | null;
  };
  module: "academic" | "general_training";
  target: {
    overallBand: number;
    testDate: string | null;
  };
  estimate: {
    band: number | null;
    lower: number | null;
    upper: number | null;
    confidencePercent: number;
    status: IeltsPredictionStatus;
    source: "ai_provisional";
    asOf: string;
    limitations: string[];
  };
  skills: IeltsProfileSkillView[];
  recentAttempts: IeltsProfileAttemptView[];
  teacherFeedback: IeltsTeacherFeedbackView[];
  consistency: {
    timezone: string;
    dailyMinutesGoal: number;
    currentStreak: number;
    longestStreak: number;
    days: IeltsConsistencyDayView[];
  };
  nextAction: {
    titleEn: string;
    titleVi: string;
    href: string;
    estimatedMinutes: number | null;
  };
}

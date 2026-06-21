import type {
  IeltsBandPrediction,
  IeltsGoalModel,
  IeltsLearnAtom,
  IeltsPlanAtomKind,
  IeltsPredictionSnapshot,
  IeltsSkill,
  IeltsWeaknessSignal,
} from "@/lib/ielts/adaptive/contracts";

export const IELTS_STUDY_PLAN_STATUSES = [
  "active",
  "paused",
  "completed",
  "archived",
] as const;
export type IeltsStudyPlanStatus = (typeof IELTS_STUDY_PLAN_STATUSES)[number];

export const IELTS_PLAN_ITEM_STATUSES = [
  "scheduled",
  "available",
  "started",
  "completed",
  "missed",
  "skipped",
  "cancelled",
] as const;
export type IeltsPlanItemStatus = (typeof IELTS_PLAN_ITEM_STATUSES)[number];

export type IeltsStudyPlanMode =
  | "cram"
  | "sprint"
  | "standard"
  | "long_horizon";

export type IeltsPlanningPrediction =
  | IeltsBandPrediction
  | IeltsPredictionSnapshot;

export type IeltsPlanMetadataValue =
  | string
  | number
  | boolean
  | null
  | string[];
export type IeltsPlanMetadata = Record<string, IeltsPlanMetadataValue>;

export interface IeltsReviewSeed {
  reviewItemId: string;
  skill: IeltsSkill;
  focusArea: string;
  dueAt: string;
  estimatedMinutes?: number;
  priorityScore?: number;
}

export interface IeltsTeacherAssignmentSeed {
  assignmentId: string;
  skill: IeltsSkill;
  focusArea: string;
  scheduledDate: string;
  estimatedMinutes: number;
  kind?: Extract<IeltsPlanAtomKind, "teacher_assignment" | "mini_mock" | "full_mock">;
}

export interface GenerateIeltsStudyPlanInput {
  goal: IeltsGoalModel;
  prediction: IeltsPlanningPrediction;
  weaknesses?: IeltsWeaknessSignal[];
  learnAtoms?: IeltsLearnAtom[];
  dueReviews?: IeltsReviewSeed[];
  teacherAssignments?: IeltsTeacherAssignmentSeed[];
  startDate: string;
  horizonDays?: number;
}

export interface IeltsPlanningPredictionSummary {
  sourceId: string | null;
  asOf: string;
  overallBand: number | null;
  skillBands: Record<IeltsSkill, number | null>;
  confidence: number;
}

export interface IeltsSkillPriority {
  skill: IeltsSkill;
  weaknessKey: string;
  labelEn: string;
  labelVi: string;
  focusArea: string;
  targetBand: number;
  currentBand: number | null;
  gapBands: number;
  priorityScore: number;
  isDeclaredFocus: boolean;
  isMaintenance: boolean;
  weakness: IeltsWeaknessSignal;
  recommendedAtom: IeltsLearnAtom | null;
}

export type IeltsGeneratedPlanReference =
  | { type: "learn_atom"; atom: IeltsLearnAtom }
  | { type: "review_item"; reviewItemId: string }
  | { type: "mock"; testId: string | null }
  | { type: "question"; questionId: string | null }
  | { type: "teacher_assignment"; assignmentId: string };

export interface IeltsGeneratedStudyPlanItem {
  tempId: string;
  scheduledDate: string;
  kind: IeltsPlanAtomKind;
  status: Extract<IeltsPlanItemStatus, "scheduled" | "available">;
  skill: IeltsSkill;
  focusArea: string;
  titleEn: string;
  titleVi: string;
  estimatedMinutes: number;
  priorityScore: number;
  sourceWeaknessKeys: string[];
  rationaleEn: string;
  rationaleVi: string;
  reference: IeltsGeneratedPlanReference;
  metadata: IeltsPlanMetadata;
}

export interface IeltsGeneratedStudyPlanDay {
  date: string;
  isoWeekday: number;
  studyDay: boolean;
  plannedMinutes: number;
  items: IeltsGeneratedStudyPlanItem[];
}

export interface IeltsGeneratedStudyPlan {
  goal: IeltsGoalModel;
  prediction: IeltsPlanningPredictionSummary;
  mode: IeltsStudyPlanMode;
  horizon: {
    startDate: string;
    endDate: string;
    days: number;
  };
  skillPriorities: IeltsSkillPriority[];
  days: IeltsGeneratedStudyPlanDay[];
  items: IeltsGeneratedStudyPlanItem[];
  today: IeltsGeneratedStudyPlanItem[];
  rationale: {
    en: string;
    vi: string;
  };
}

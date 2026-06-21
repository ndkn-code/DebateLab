/**
 * Pure IELTS adaptive-learning contracts shared by Tracks B, C, and D.
 *
 * These types intentionally avoid database imports. Schema cards may persist
 * equivalent shapes later, but downstream feature code can build against this
 * module before any table or repository lands.
 */

export const IELTS_SKILLS = ["listening", "reading", "writing", "speaking"] as const;
export type IeltsSkill = (typeof IELTS_SKILLS)[number];

export const IELTS_MODULES = ["academic", "general_training"] as const;
export type IeltsModule = (typeof IELTS_MODULES)[number];

export const IELTS_FEEDBACK_LANGUAGES = ["en", "vi"] as const;
export type IeltsFeedbackLanguage = (typeof IELTS_FEEDBACK_LANGUAGES)[number];

export const IELTS_ISO_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;
export type IeltsIsoWeekday = (typeof IELTS_ISO_WEEKDAYS)[number];

export const DEFAULT_IELTS_TARGET_BAND = 6.5;

export type IeltsPredictionStatus =
  | "diagnostic_needed"
  | "low_confidence"
  | "medium_confidence"
  | "high_confidence";

export type IeltsTrendDirection = "up" | "down" | "flat" | "unknown";

export type IeltsBandEvidenceSource =
  | "full_mock"
  | "skill_mock"
  | "writing_task"
  | "speaking_part"
  | "objective_drill"
  | "learn_activity"
  | "debate_prior";

export interface IeltsBandEvidence {
  source: IeltsBandEvidenceSource;
  label: string;
  band: number | null;
  rawScore: number | null;
  weight: number;
  occurredAt: string;
  explanation: string;
}

export interface IeltsBandEstimate {
  band: number | null;
  lower: number | null;
  upper: number | null;
  confidence: number;
  status: IeltsPredictionStatus;
  trend: {
    direction: IeltsTrendDirection;
    delta30d: number | null;
    evidencePoints: number;
    explanation: string;
  };
  evidence: IeltsBandEvidence[];
  explanation: string[];
}

export type IeltsWeaknessSeverity = "watch" | "weak" | "critical";

export interface IeltsRecommendedActivityFilters {
  skill: string;
  questionTypes?: string[];
  criteria?: string[];
  subskillTags?: string[];
}

/**
 * Adopted verbatim from Track B's band-prediction research output.
 * Do not add Track C-only fields here; use wrappers or plan-item metadata.
 */
export interface IeltsWeaknessSignal {
  skill: IeltsSkill;
  key: string;
  labelEn: string;
  labelVi: string;
  severity: IeltsWeaknessSeverity;
  confidence: number;
  evidenceCount: number;
  currentValue: number | null;
  targetValue: number | null;
  reasonEn: string;
  reasonVi: string;
  recommendedActivityFilters: IeltsRecommendedActivityFilters;
}

export interface IeltsBandPrediction {
  userId: string;
  asOf: string;
  modelVersion: "weighted-recency-v1";
  module: IeltsModule;
  overall: IeltsBandEstimate;
  skills: Record<IeltsSkill, IeltsBandEstimate>;
  weaknesses: IeltsWeaknessSignal[];
  limitations: string[];
  nextBestDiagnostic: {
    required: boolean;
    skill: IeltsSkill | "full_mock" | null;
    reasonEn: string;
    reasonVi: string;
  };
}

export interface IeltsPredictionSnapshot {
  snapshotId: string;
  userId: string;
  generatedAt: string;
  sourceAttemptIds: string[];
  modelVersion: string;
  module: IeltsModule;
  predictedOverallBand: number | null;
  predictedSkillBands: Record<IeltsSkill, number | null>;
  confidence: number;
  uncertaintyBandHalfSteps: number;
  weaknesses: IeltsWeaknessSignal[];
  strengths: IeltsWeaknessSignal[];
  reasoning: {
    en: string;
    vi: string;
  };
}

export const IELTS_LEARN_ACTIVITY_TYPES = [
  "ielts_vocab_collocation",
  "ielts_paraphrase_transform",
  "ielts_gap_fill",
  "ielts_tfng_reasoning",
  "ielts_scan_detail",
  "ielts_sentence_transform",
  "ielts_cohesion_linker",
  "ielts_listening_micro_clip",
  "ielts_pronunciation_minimal_pair",
  "ielts_reading_skim_scan",
  "ielts_grammar_fix",
  "ielts_strategy_chunk",
  "ielts_speaking_fluency_prompt",
] as const;
export type IeltsLearnActivityType = (typeof IELTS_LEARN_ACTIVITY_TYPES)[number];

export const IELTS_PLAN_ATOM_KINDS = [
  "learn_activity",
  "review",
  "skill_drill",
  "mini_mock",
  "full_mock",
  "writing_submission",
  "speaking_submission",
  "teacher_assignment",
] as const;
export type IeltsPlanAtomKind = (typeof IELTS_PLAN_ATOM_KINDS)[number];

export const IELTS_LEARN_ATOM_SCORING_MODES = [
  "objective",
  "ai_writing",
  "ai_speaking",
  "self_check",
] as const;
export type IeltsLearnAtomScoringMode =
  (typeof IELTS_LEARN_ATOM_SCORING_MODES)[number];

export interface IeltsLearnAtom {
  activityType: IeltsLearnActivityType;
  skill: IeltsSkill;
  focusArea: string;
  estimatedMinutes: number;
  questionIds: string[];
  reviewItemIds?: string[];
  rendererTags: string[];
  scoringMode: IeltsLearnAtomScoringMode;
}

export type IeltsStudyIntensity = "light" | "standard" | "intensive";

export interface IeltsWeeklyAvailability {
  studyDays: IeltsIsoWeekday[];
  dailyMinutes: number;
  timezone: string;
  preferredIntensity?: IeltsStudyIntensity;
}

export type IeltsSkillBandTargets = Partial<Record<IeltsSkill, number | null>>;

export interface IeltsLearnerGoal {
  module: IeltsModule;
  targetOverallBand: number;
  targetSkillBands: IeltsSkillBandTargets;
  targetTestDate: string;
  focusSkills?: IeltsSkill[];
  availability: IeltsWeeklyAvailability;
  feedbackLanguage: IeltsFeedbackLanguage;
}

export type IeltsGoalModel = IeltsLearnerGoal;

export interface LoadIeltsPredictionForPlanningOptions {
  module?: IeltsModule;
  targetBand?: number;
}

export type LoadIeltsPredictionForPlanning = (
  userId: string,
  options?: LoadIeltsPredictionForPlanningOptions,
) => Promise<IeltsBandPrediction>;

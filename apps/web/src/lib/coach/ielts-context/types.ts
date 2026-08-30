import type {
  IeltsFeedbackLanguage,
  IeltsSkill,
} from "@/lib/ielts/adaptive/contracts";

export const IELTS_COACH_CONTEXT_VERSION = "ielts-coach-context-v1" as const;

export type IeltsCoachLocale = IeltsFeedbackLanguage;
export type IeltsCoachScoreAuthority =
  | "objective"
  | "ai_provisional"
  | "teacher_confirmed";

/**
 * Both product and subject are required deliberately. A route that cannot
 * prove its product context must not silently fall back to Debate coaching.
 */
export interface IeltsCoachContextRequest {
  product: "ielts";
  subject: "ielts";
  learnerId: string;
  sessionUserId: string;
  conversationId: string;
  locale: IeltsCoachLocale;
  classId?: string | null;
  maxRecentAttempts?: number;
}

export interface IeltsCoachGoalSource {
  userId: string;
  targetOverallBand: number;
  targetSkillBands?: Partial<Record<IeltsSkill, number>>;
  targetTestDate: string | null;
}

export interface IeltsCoachCriterionSignalSource {
  criterion: string;
  band: number;
  authority: Exclude<IeltsCoachScoreAuthority, "teacher_confirmed">;
  confidence?: number | null;
  gradingVersion?: string | null;
  rubricVersion?: string | null;
}

export interface IeltsCoachAttemptSource {
  attemptId: string;
  userId: string;
  responseId?: string | null;
  responseRevision?: number | null;
  occurredAt: string;
  skill: IeltsSkill;
  questionType?: string | null;
  band: number | null;
  authority: Exclude<IeltsCoachScoreAuthority, "teacher_confirmed">;
  confidence?: number | null;
  gradingVersion?: string | null;
  rubricVersion?: string | null;
  criteria: IeltsCoachCriterionSignalSource[];
}

export interface IeltsCoachPublishedFeedbackSource {
  reviewId: string;
  userId: string;
  classId: string;
  attemptId: string;
  responseId: string;
  responseRevision: number;
  skill: Extract<IeltsSkill, "writing" | "speaking">;
  status: "draft" | "returned" | "published";
  publishedAt: string | null;
  skillBand: number | null;
  criteria: Array<{
    criterion: string;
    band: number;
    rationale?: string | null;
  }>;
  summary: string | null;
}

export interface IeltsCoachAssignedWorkSource {
  assignmentId: string;
  classId: string;
  assignedLearnerId?: string | null;
  subject: "ielts" | "debate" | null;
  publicationStatus: "draft" | "published" | "archived";
  status: "draft" | "active" | "archived";
  title: string;
  skill: IeltsSkill;
  criterion?: string | null;
  questionType?: string | null;
  dueAt: string | null;
  estimatedMinutes?: number | null;
}

export interface IeltsCoachAccessScope {
  learnerId: string;
  activeIeltsClassIds: string[];
}

/**
 * Adapters should use the learner's RLS-bound Supabase session. The builder
 * repeats all ownership/status checks so a faulty adapter still fails closed.
 */
export interface IeltsCoachEvidenceRepository {
  loadAccessScope(learnerId: string): Promise<IeltsCoachAccessScope>;
  loadGoal(learnerId: string): Promise<IeltsCoachGoalSource | null>;
  loadRecentAttempts(
    learnerId: string,
    limit: number,
  ): Promise<IeltsCoachAttemptSource[]>;
  loadPublishedTeacherFeedback(
    learnerId: string,
    attemptIds: string[],
  ): Promise<IeltsCoachPublishedFeedbackSource[]>;
  loadAssignedWork(
    learnerId: string,
    activeIeltsClassIds: string[],
  ): Promise<IeltsCoachAssignedWorkSource[]>;
}

export interface IeltsCoachCriterionSignal {
  criterion: string;
  band: number;
  authority: IeltsCoachScoreAuthority;
  confidence: number | null;
  gradingVersion: string | null;
  rubricVersion: string | null;
  evidenceId: string;
}

export interface IeltsCoachAttemptEvidence {
  attemptId: string;
  responseId: string | null;
  responseRevision: number | null;
  occurredAt: string;
  skill: IeltsSkill;
  questionType: string | null;
  band: number | null;
  authority: IeltsCoachScoreAuthority;
  confidence: number | null;
  gradingVersion: string | null;
  rubricVersion: string | null;
  teacherReviewId: string | null;
  teacherResponseRevision: number | null;
  criteria: IeltsCoachCriterionSignal[];
}

export interface IeltsCoachWeaknessEvidence {
  key: string;
  skill: IeltsSkill;
  criterion: string | null;
  questionType: string | null;
  currentBand: number;
  targetBand: number;
  gapBands: number;
  authority: IeltsCoachScoreAuthority;
  evidenceId: string;
}

export interface IeltsCoachTeacherFeedback {
  reviewId: string;
  attemptId: string;
  skill: Extract<IeltsSkill, "writing" | "speaking">;
  responseRevision: number;
  publishedAt: string;
  summary: string | null;
  criterionFeedback: Array<{ criterion: string; rationale: string }>;
}

export interface IeltsCoachAssignedWork {
  assignmentId: string;
  title: string;
  skill: IeltsSkill;
  criterion: string | null;
  questionType: string | null;
  dueAt: string | null;
  estimatedMinutes: number | null;
  action: {
    type: "start_ielts_assignment";
    assignmentId: string;
  };
}

export interface IeltsCoachLearnerContext {
  version: typeof IELTS_COACH_CONTEXT_VERSION;
  product: "ielts";
  subject: "ielts";
  learnerId: string;
  conversationId: string;
  locale: IeltsCoachLocale;
  classId: string | null;
  goal: {
    targetOverallBand: number;
    targetSkillBands: Partial<Record<IeltsSkill, number>>;
    targetTestDate: string | null;
  } | null;
  recentAttempts: IeltsCoachAttemptEvidence[];
  weaknesses: IeltsCoachWeaknessEvidence[];
  teacherPublishedFeedback: IeltsCoachTeacherFeedback[];
  assignedWork: IeltsCoachAssignedWork[];
  limitations: string[];
}

export type IeltsCoachContextFailureReason =
  | "ambiguous_context"
  | "learner_mismatch"
  | "unauthorized_class"
  | "evidence_unavailable";

export type IeltsCoachContextResult =
  | { ok: true; context: IeltsCoachLearnerContext }
  | {
      ok: false;
      reason: IeltsCoachContextFailureReason;
      retryable: boolean;
    };

export type CoachProductContext = "debate" | "ielts";
export type CoachSubjectContext = "debate" | "ielts";

export interface PersistedCoachConversationContext {
  product: CoachProductContext | null;
  subject: CoachSubjectContext | null;
}

export interface RequestedCoachConversationContext {
  product: CoachProductContext;
  subject: CoachSubjectContext;
}

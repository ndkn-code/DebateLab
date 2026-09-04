import type { IeltsGradebookRow } from "@/lib/api/ielts/gradebook-repository";

export type IeltsSkill = "listening" | "reading" | "writing" | "speaking";
export type WritingTask = "task1" | "task2";
export type CriterionEvidenceStage = "provisional" | "adjudicated";

export interface ReportingPeriod {
  days: 7 | 30 | 90;
  timezone: string;
  start: string;
  end: string;
}

export interface NormalizedCriterionEvidence {
  learnerId: string;
  assignmentId: string;
  responseId: string;
  skill: "writing" | "speaking";
  criterion: string;
  band: number;
  revision: number;
  stage: CriterionEvidenceStage;
  createdAt: string;
  provenance?: "aiProvisional" | "aiAdjudicated" | "teacherConfirmed";
  task?: WritingTask;
  subskill?: string;
}

export interface WeakSubskillInput {
  learnerId: string;
  skill: IeltsSkill;
  subskill: string;
  severity: number;
  source: "assessment" | "learner-wide";
  assignmentId?: string;
  label?: BilingualLabel;
  confidence?: number;
  evidenceCount?: number;
  lastEvidenceAt?: string;
}

export interface PeriodAttendance {
  learnerId: string;
  present: number;
  late: number;
  absent: number;
}

export interface ClassAnalyticsInput {
  classId: string;
  clubId: string;
  classTitle: string;
  period: ReportingPeriod;
  rows: readonly IeltsGradebookRow[];
  criterionEvidence: readonly NormalizedCriterionEvidence[];
  weakSubskills?: readonly WeakSubskillInput[];
  attendance?: readonly PeriodAttendance[];
}

export interface BilingualLabel {
  en: string;
  vi: string;
}

export interface BandDistribution {
  band: number;
  learners: number;
  share: number;
}

export interface SkillSummary {
  skill: IeltsSkill;
  label: BilingualLabel;
  learnerCount: number;
  meanBand: number | null;
  distribution: BandDistribution[];
  coverage: number;
  provisionalLearners: number;
  confirmedLearners: number;
}

export interface CriterionSummary {
  skill: "writing" | "speaking";
  criterion: string;
  task: WritingTask | null;
  label: BilingualLabel;
  learnerCount: number;
  meanBand: number | null;
  coverage: number;
  provenance: {
    aiProvisional: number;
    aiAdjudicated: number;
    teacherConfirmed: number;
  };
}

export type AttentionReasonCode =
  | "overdue_assignment"
  | "critical_weakness"
  | "repeated_absence";

export interface LearnerAttention {
  learnerId: string;
  displayName: string;
  reasons: Array<{
    code: AttentionReasonCode;
    count: number;
    severity?: number;
    details?: BilingualLabel[];
    assignmentIds: string[];
  }>;
  priority: number;
}

export interface ReteachPriority {
  skill: IeltsSkill;
  subskill: string;
  affectedLearners: number;
  severity: number;
  source: "assessment" | "learner-wide";
  assignmentIds: string[];
  label?: BilingualLabel;
}

export type SmartGroupBand = "below-5" | "5-5.5" | "6-6.5" | "7-plus";

export interface SmartGroup {
  skill: IeltsSkill;
  band: SmartGroupBand;
  learners: Array<{ learnerId: string; displayName: string; band: number }>;
  ungrouped: boolean;
}

export interface ClassAnalyticsReport {
  classId: string;
  clubId: string;
  classTitle: string;
  period: ReportingPeriod;
  assessments: AssessmentAggregate[];
  skillSummaries: SkillSummary[];
  criterionSummaries: CriterionSummary[];
  reteachPriorities: ReteachPriority[];
  attention: LearnerAttention[];
  insufficientEvidence: Array<{ learnerId: string; displayName: string }>;
  groups: SmartGroup[];
  groupsMissingEvidence: Record<
    IeltsSkill,
    Array<{ learnerId: string; displayName: string }>
  >;
  sources: Record<string, "available" | "unavailable">;
  coverage: { learnerCount: number; totalLearners: number };
}

export type ClassAnalytics = ClassAnalyticsReport;

export interface AssessmentAggregate {
  assessmentId: string;
  title: string;
  submittedLearners: number;
  provisionalLearners: number;
  reteachPriorities: ReteachPriority[];
  skillSummaries: SkillSummary[];
  criterionSummaries: CriterionSummary[];
}

export interface PostMockReport {
  period: ReportingPeriod;
  classTitle: string;
  rosterCount: number;
  submittedLearners: number;
  provisionalCount: number;
  title: string;
  skillSummaries: SkillSummary[];
  strengths: Array<{ skill: IeltsSkill; meanBand: number; coverage: number }>;
  gaps: Array<{ skill: IeltsSkill; meanBand: number; coverage: number }>;
  criterionCoverage: Array<{
    skill: "writing" | "speaking";
    criterion: string;
    learners: number;
  }>;
  criterionSummaries: CriterionSummary[];
  nextSteps: Array<{
    skill: IeltsSkill;
    criterion?: string;
    label: BilingualLabel;
    affectedLearners: number;
  }>;
  metadata: { coverage: number; methodology: BilingualLabel };
  methodology: BilingualLabel;
}

export type CentreEventKind =
  | "session"
  | "activity"
  | "mock"
  | "feedback"
  | "teacher-review"
  | "ai-grading";

export interface CentreEventFact {
  id: string;
  kind: CentreEventKind;
  occurredAt: string;
  learnerId?: string;
  classId?: string;
  teacherId?: string;
  assignmentId?: string;
  responseId?: string;
  skill?: IeltsSkill;
  taskNumber?: number;
  revision?: number;
  status?: string;
  stage?: "provisional" | "confirmed";
  turnedAroundHours?: number | null;
  sourceAvailable?: boolean;
}

export interface CentreClassFact {
  classId: string;
  title: string;
  teacherIds: string[];
  activeLearnerIds: string[];
}

export interface CentreAnalyticsInput {
  clubId: string;
  viewerId?: string;
  period: ReportingPeriod;
  events: readonly CentreEventFact[];
  classes: readonly CentreClassFact[];
  sources?: Record<string, "available" | "unavailable">;
}

export interface CentreClassTeacherRow {
  classId: string;
  classTitle: string;
  teacherId: string;
  sessions: number;
  mocksGraded: number;
  activeLearners: number;
}

export interface CentreClassRow {
  classId: string;
  classTitle: string;
  sessions: number;
  mocksGraded: number;
  activeLearners: number;
}

export interface CentreTeacherRow {
  teacherId: string;
  currentClassIds: string[];
  publishedFeedback: number;
  sessions: number;
  mocksGraded: number;
  activeLearners: number;
}

export interface CentreAnalyticsReport {
  coverage: {
    classesIncluded: number;
    publishedFeedback: number;
    feedbackWithKnownDuration: number;
  };
  teacherNames: Record<string, string>;
  clubId: string;
  viewerId?: string;
  period: ReportingPeriod;
  sessions: number;
  mocksGraded: { total: number; provisional: number; confirmed: number };
  turnedAroundRevisions: {
    count: number;
    medianHours: number | null;
    pending: number;
  };
  activeLearners: number;
  uniqueAiResponses: number;
  markingWorkload: {
    hours: number;
    qualifyingResponses: number;
    minutesPerResponse: number;
  };
  dailyTrend: Array<{
    date: string;
    sessions: number;
    mocksGraded: number;
    aiResponses: number;
  }>;
  classTeacherRows: CentreClassTeacherRow[];
  classRows: CentreClassRow[];
  teacherRows: CentreTeacherRow[];
  sources: Record<string, "available" | "unavailable">;
}

export type CentreAnalytics = CentreAnalyticsReport;

export const AI_MARKING_MINUTES_PER_TASK2 = 20;

/** Parent-safe, JSON-serializable report. No provisional score or private feedback. */
export type ReportLocale = "vi" | "en";
export type ReportSkill = "listening" | "reading" | "writing" | "speaking";
export type ReportSource = "objective" | "ai" | "teacher" | "mixed" | "none";
export type LocalizedReportText = Record<ReportLocale, string>;
export const REPORT_SKILLS: readonly ReportSkill[] = [
  "listening",
  "reading",
  "writing",
  "speaking",
];

export interface ReportAssessment {
  attemptId: string;
  assignmentId: string;
  title: string;
  submittedAt: string;
  skills: Record<ReportSkill, number | null>;
  overall: number | null;
  overallState: "complete" | "missing_skills" | "awaiting_confirmation";
  source: ReportSource;
}

export interface ReportCriterion {
  key: string;
  label: LocalizedReportText;
  skill: "writing" | "speaking";
  slot: number;
  attemptId: string;
  responseId: string;
  revision: number;
  assessedAt: string;
  band: number | null;
  source: ReportSource;
}

export interface ReportAttendanceSession {
  sessionId: string;
  date: string;
  title: string;
  status: "present" | "late" | "absent" | "unmarked";
}

export interface ParentBandReport {
  schemaVersion: 1;
  generatedAt: string;
  scoreBasis: "latest_available_at_generation";
  period: {
    month: string;
    timeZone: string;
    start: string;
    end: string;
    isCurrentMonth: boolean;
  };
  context: {
    classId: string;
    clubId: string;
    studentId: string;
    studentName: string;
    className: string;
    centreName: string;
  };
  headlineAssessment: ReportAssessment | null;
  skills: Array<{
    skill: ReportSkill;
    band: number | null;
    assessedAt: string | null;
    attemptId: string | null;
    source: ReportSource;
  }>;
  trajectory: ReportAssessment[];
  criteria: ReportCriterion[];
  attendance: {
    sessions: ReportAttendanceSession[];
    present: number;
    late: number;
    absent: number;
    unmarked: number;
    recordedSessions: number;
    markedSessions: number;
    rate: number | null;
    /** Only recorded attendance sessions are known; never imply a complete schedule. */
    coverage: "recorded_sessions_only";
  };
  nextFocus: Array<{ criterionKey: string; text: LocalizedReportText }>;
  availability: {
    assessedCount: number;
    pendingCount: number;
    missingSkills: ReportSkill[];
  };
}

export interface ParentReportInput {
  classId: string;
  studentId: string;
  month: string;
}

export interface ParentReportRoster {
  timeZone: string;
  classId: string;
  className: string;
  students: Array<{ id: string; name: string }>;
}

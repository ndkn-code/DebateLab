import type { IeltsGradebookAssignment } from "@/lib/api/ielts/gradebook-repository";
import type { BilingualLabel, LearnerAttention, ReportingPeriod } from "./contracts";
import type { ClassAnalyticsData } from "@/lib/api/analytics/class-repository";

export interface LearnerFollowupWeakness {
  label: BilingualLabel;
  lastEvidenceAt: string;
  evidenceCount: number;
  severity: number;
}

export interface LearnerFollowupAttendance {
  date: string;
  status: string;
}

export interface LearnerFollowup {
  classId: string;
  studentId: string;
  clubId: string;
  classTitle: string;
  displayName: string;
  period: ReportingPeriod;
  reasons: LearnerAttention["reasons"];
  sources: Record<string, "available" | "unavailable">;
  assignments: IeltsGradebookAssignment[];
  attendance: LearnerFollowupAttendance[];
  weaknesses: LearnerFollowupWeakness[];
}

function safeAssignment(assignment: IeltsGradebookAssignment): IeltsGradebookAssignment {
  return {
    ...assignment,
    reviewTargets: assignment.reviewTargets.map((target) => ({
      ...target,
      media: null,
    })),
  };
}

/** Pure, learner-scoped projection from the already authorized class snapshot. */
export function projectLearnerFollowup(
  data: ClassAnalyticsData,
  classId: string,
  studentId: string,
): LearnerFollowup | null {
  const learner = data.snapshot.gradebook.rows.find(
    (row) =>
      row.userId === studentId &&
      !row.historical &&
      row.membershipStatus === "active",
  );
  if (!learner) return null;
  const attention = data.report.attention.find(
    (item) => item.learnerId === studentId,
  );
  return {
    classId,
    studentId,
    clubId: data.snapshot.gradebook.clubId,
    classTitle: data.snapshot.gradebook.classTitle,
    displayName: learner.displayName,
    period: data.report.period,
    reasons: attention?.reasons ?? [],
    sources: data.report.sources,
    assignments: learner.assignments.map(safeAssignment),
    attendance: data.attendance
      .filter((item) => item.userId === studentId)
      .map(({ date, status }) => ({ date, status })),
    weaknesses: data.weakSubskills
      .filter(
        (item) =>
          item.learnerId === studentId &&
          item.label &&
          item.lastEvidenceAt &&
          typeof item.evidenceCount === "number",
      )
      .map((item) => ({
        label: item.label!,
        lastEvidenceAt: item.lastEvidenceAt!,
        evidenceCount: item.evidenceCount!,
        severity: item.severity,
      })),
  };
}

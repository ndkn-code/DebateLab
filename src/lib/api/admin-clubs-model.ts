import type {
  AdminClubAssignmentRow,
  AdminClubAtRiskStudent,
  AdminClubDashboardKpis,
  AdminClubPerformanceAttempt,
  AdminClubReviewQueueItem,
  AdminClubSkillSummary,
  AdminClubTrendPoint,
  ClubAssignmentInput,
  ClubAssignmentStatus,
} from "@/lib/types/admin-clubs";

const ASSIGNMENT_STATUSES = new Set<ClubAssignmentStatus>(["draft", "active", "archived"]);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SKILL_LABELS: Record<string, string> = {
  clarity: "Clarity",
  logic: "Logical Reasoning",
  rebuttal: "Rebuttal",
  evidence: "Evidence Quality",
  delivery: "Delivery",
  crossExamination: "Cross-Examination",
  diplomacy: "Diplomacy",
};

function average(values: Array<number | null | undefined>) {
  const finite = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!finite.length) return null;
  return Math.round((finite.reduce((sum, value) => sum + value, 0) / finite.length) * 10) / 10;
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function dateBucketLabel(date: Date) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" }).format(date);
}

export function normalizeClubAssignmentStatus(value: unknown): ClubAssignmentStatus {
  return ASSIGNMENT_STATUSES.has(value as ClubAssignmentStatus)
    ? (value as ClubAssignmentStatus)
    : "draft";
}

export function validateClubAssignmentInput(input: ClubAssignmentInput) {
  if (!UUID_PATTERN.test(input.clubId)) return { ok: false as const, reason: "invalid_club_id" };
  if (input.classId && !UUID_PATTERN.test(input.classId)) return { ok: false as const, reason: "invalid_class_id" };
  if (!input.title.trim()) return { ok: false as const, reason: "missing_title" };
  if (input.requiredAttempts != null && (!Number.isInteger(input.requiredAttempts) || input.requiredAttempts < 1)) {
    return { ok: false as const, reason: "invalid_required_attempts" };
  }
  if (input.rubricVersion != null && (!Number.isInteger(input.rubricVersion) || input.rubricVersion < 1)) {
    return { ok: false as const, reason: "invalid_rubric_version" };
  }
  if (input.dueAt && Number.isNaN(new Date(input.dueAt).getTime())) {
    return { ok: false as const, reason: "invalid_due_at" };
  }
  return { ok: true as const };
}

export function buildClubDashboardKpis({
  studentCount,
  cohortCount,
  attendanceRate,
  assignments,
  attempts,
  reviewQueue,
}: {
  studentCount: number;
  cohortCount: number;
  attendanceRate: number | null;
  assignments: AdminClubAssignmentRow[];
  attempts: AdminClubPerformanceAttempt[];
  reviewQueue: AdminClubReviewQueueItem[];
}): AdminClubDashboardKpis {
  const activeAssignments = assignments.filter((assignment) => assignment.status === "active");
  const expectedSubmissions = activeAssignments.reduce(
    (sum, assignment) => sum + Math.max(1, assignment.requiredAttempts) * Math.max(0, studentCount),
    0
  );
  const actualSubmissions = activeAssignments.reduce((sum, assignment) => sum + assignment.submissionCount, 0);

  return {
    completionRate: expectedSubmissions > 0 ? clampPercent((actualSubmissions / expectedSubmissions) * 100) : null,
    attendanceRate,
    averageScore: average(attempts.map((attempt) => attempt.overallScore)),
    reviewQueueCount: reviewQueue.filter((item) => item.status === "open").length,
    studentCount,
    cohortCount,
  };
}

export function buildWeakestSkills(
  attempts: AdminClubPerformanceAttempt[],
  limit = 6
): AdminClubSkillSummary[] {
  const totals = new Map<string, { sum: number; count: number }>();

  for (const attempt of attempts) {
    for (const [key, value] of Object.entries(attempt.skillScores ?? {})) {
      if (typeof value !== "number" || !Number.isFinite(value)) continue;
      const current = totals.get(key) ?? { sum: 0, count: 0 };
      current.sum += value;
      current.count += 1;
      totals.set(key, current);
    }
  }

  return [...totals.entries()]
    .map(([key, summary]) => ({
      key,
      label: SKILL_LABELS[key] ?? key.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase()),
      value: Math.round(summary.sum / Math.max(1, summary.count)),
    }))
    .sort((left, right) => left.value - right.value)
    .slice(0, limit);
}

export function buildClubTrend(
  attempts: AdminClubPerformanceAttempt[],
  assignments: AdminClubAssignmentRow[],
  now = new Date()
): AdminClubTrendPoint[] {
  const points: AdminClubTrendPoint[] = [];

  for (let index = 5; index >= 0; index -= 1) {
    const bucketEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    bucketEnd.setUTCDate(bucketEnd.getUTCDate() - index * 7);
    const bucketStart = new Date(bucketEnd);
    bucketStart.setUTCDate(bucketStart.getUTCDate() - 6);

    const bucketAttempts = attempts.filter((attempt) => {
      const timestamp = new Date(attempt.occurredAt).getTime();
      return timestamp >= bucketStart.getTime() && timestamp <= bucketEnd.getTime() + 86_399_999;
    });
    const activeAssignments = assignments.filter((assignment) => assignment.status === "active");
    const expectedSubmitters = Math.max(
      1,
      ...activeAssignments.map((assignment) =>
        Math.max(assignment.uniqueSubmitters, assignment.submissionCount, assignment.requiredAttempts)
      )
    );
    const completionRate = average(
      activeAssignments.map((assignment) =>
        assignment.uniqueSubmitters > 0
          ? clampPercent((assignment.uniqueSubmitters / expectedSubmitters) * 100)
          : 0
      )
    );

    points.push({
      label: dateBucketLabel(bucketEnd),
      averageScore: average(bucketAttempts.map((attempt) => attempt.overallScore)),
      completionRate,
    });
  }

  return points;
}

export function buildAtRiskStudents({
  attempts,
  studentAttendance,
  studentCompletion,
  limit = 6,
}: {
  attempts: AdminClubPerformanceAttempt[];
  studentAttendance: Map<string, number | null>;
  studentCompletion: Map<string, number | null>;
  limit?: number;
}): AdminClubAtRiskStudent[] {
  const attemptsByUser = new Map<string, AdminClubPerformanceAttempt[]>();
  for (const attempt of attempts) {
    const list = attemptsByUser.get(attempt.userId) ?? [];
    list.push(attempt);
    attemptsByUser.set(attempt.userId, list);
  }

  const userIds = new Set([
    ...attemptsByUser.keys(),
    ...studentAttendance.keys(),
    ...studentCompletion.keys(),
  ]);

  return [...userIds]
    .map((userId) => {
      const userAttempts = attemptsByUser.get(userId) ?? [];
      const latestAttempt = [...userAttempts].sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))[0];
      const averageScore = average(userAttempts.map((attempt) => attempt.overallScore));
      const attendanceRate = studentAttendance.get(userId) ?? null;
      const completionRate = studentCompletion.get(userId) ?? null;
      const scoreRisk = averageScore == null ? 18 : Math.max(0, 75 - averageScore);
      const attendanceRisk = attendanceRate == null ? 10 : Math.max(0, 85 - attendanceRate) * 0.7;
      const completionRisk = completionRate == null ? 12 : Math.max(0, 80 - completionRate) * 0.7;

      return {
        userId,
        displayName: latestAttempt?.studentName ?? "Student",
        cohort: latestAttempt?.classTitle ?? null,
        riskScore: Math.round(scoreRisk + attendanceRisk + completionRisk),
        completionRate,
        attendanceRate,
        averageScore,
      };
    })
    .filter((student) => student.riskScore > 0)
    .sort((left, right) => right.riskScore - left.riskScore)
    .slice(0, limit);
}

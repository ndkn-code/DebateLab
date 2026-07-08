import type {
  AdminClubAssignmentRow,
  AdminClubAtRiskStudent,
  AdminClubDashboardKpis,
  ClubEventType,
  ClubRecipientInput,
  AdminClubPerformanceAttempt,
  AdminClubReviewQueueItem,
  AdminClubSkillSummary,
  AdminClubTrendPoint,
  ClubAssignmentInput,
  ClubAssignmentStatus,
  ClubRole,
  SaveClubEventInput,
} from "@/lib/types/admin-clubs";
import {
  DEFAULT_CLASS_TIMEZONE,
  normalizeRecurrenceRule,
  summarizeRecurrence,
} from "@/lib/api/admin-class-schedules-model";
import type { ClassRecurrenceRule } from "@/lib/types/admin-classes";

const ASSIGNMENT_STATUSES = new Set<ClubAssignmentStatus>(["draft", "active", "archived"]);
const CLUB_ROLES = new Set<ClubRole>(["owner", "coach", "student"]);
const CLUB_EVENT_TYPES = new Set<ClubEventType>([
  "meeting",
  "workshop",
  "tournament",
  "social",
  "deadline",
  "other",
]);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EXTENSION_PATTERN = /^[a-z0-9]{1,12}$/;

export const VIETNAM_CITY_OPTIONS = [
  "An Giang",
  "Bac Ninh",
  "Ca Mau",
  "Can Tho",
  "Cao Bang",
  "Da Nang",
  "Dak Lak",
  "Dien Bien",
  "Dong Nai",
  "Dong Thap",
  "Gia Lai",
  "Ha Noi",
  "Ha Tinh",
  "Hai Phong",
  "Ho Chi Minh City",
  "Hue",
  "Hung Yen",
  "Khanh Hoa",
  "Lai Chau",
  "Lam Dong",
  "Lang Son",
  "Lao Cai",
  "Nghe An",
  "Ninh Binh",
  "Phu Tho",
  "Quang Ngai",
  "Quang Ninh",
  "Quang Tri",
  "Son La",
  "Tay Ninh",
  "Thai Nguyen",
  "Thanh Hoa",
  "Tuyen Quang",
  "Vinh Long",
] as const;

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

export function normalizeClubRole(value: unknown): ClubRole {
  return CLUB_ROLES.has(value as ClubRole) ? (value as ClubRole) : "student";
}

export function normalizeClubEventType(value: unknown): ClubEventType {
  return CLUB_EVENT_TYPES.has(value as ClubEventType) ? (value as ClubEventType) : "meeting";
}

export function normalizeVietnamCity(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  const match = VIETNAM_CITY_OPTIONS.find((city) => city.toLowerCase() === text.toLowerCase());
  return match ?? null;
}

export function normalizeEmailAddress(value: unknown) {
  const text = typeof value === "string" ? value.trim().toLowerCase() : "";
  return EMAIL_PATTERN.test(text) ? text : null;
}

export function normalizeSocialUrl(value: unknown, options: { required?: boolean; hostIncludes?: string } = {}) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) {
    if (options.required) throw new Error("Required social link is missing.");
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(text);
  } catch {
    throw new Error("Social links must be valid HTTPS URLs.");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("Social links must use HTTPS.");
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  if (options.hostIncludes && !host.includes(options.hostIncludes)) {
    throw new Error(`Facebook link must use a ${options.hostIncludes} domain.`);
  }

  parsed.hash = "";
  return parsed.toString();
}

export function normalizeClubRecipients(input: unknown): ClubRecipientInput[] {
  const source = Array.isArray(input) ? input : [];
  const seen = new Set<string>();
  const recipients: ClubRecipientInput[] = [];

  for (const item of source) {
    const record = typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {};
    const email = normalizeEmailAddress(record.email);
    if (!email) continue;
    const role = normalizeClubRole(record.role);
    const key = `${email}:${role}`;
    if (seen.has(key)) continue;
    seen.add(key);
    recipients.push({ email, role });
  }

  return recipients;
}

export function validateClubCreationInput(input: {
  name: unknown;
  city: unknown;
  facebookUrl: unknown;
  instagramUrl?: unknown;
  threadsUrl?: unknown;
  recipients: unknown;
}) {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name) return { ok: false as const, reason: "missing_name" };
  const city = normalizeVietnamCity(input.city);
  if (!city) return { ok: false as const, reason: "invalid_city" };

  try {
    normalizeSocialUrl(input.facebookUrl, { required: true, hostIncludes: "facebook.com" });
    normalizeSocialUrl(input.instagramUrl);
    normalizeSocialUrl(input.threadsUrl);
  } catch (error) {
    return {
      ok: false as const,
      reason: error instanceof Error ? error.message : "invalid_social_url",
    };
  }

  const recipients = normalizeClubRecipients(input.recipients);
  if (!recipients.some((recipient) => recipient.role === "owner")) {
    return { ok: false as const, reason: "missing_owner_recipient" };
  }

  return { ok: true as const, recipients, city };
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
  if (input.submissionTextEnabled === false && input.submissionFilesEnabled === false) {
    return { ok: false as const, reason: "assignment_requires_submission_mode" };
  }
  if (input.submissionMaxFiles != null && (!Number.isInteger(input.submissionMaxFiles) || input.submissionMaxFiles < 0 || input.submissionMaxFiles > 20)) {
    return { ok: false as const, reason: "invalid_submission_max_files" };
  }
  if (input.submissionMaxFileMb != null && (!Number.isInteger(input.submissionMaxFileMb) || input.submissionMaxFileMb < 1 || input.submissionMaxFileMb > 50)) {
    return { ok: false as const, reason: "invalid_submission_max_file_mb" };
  }
  const allowedExt = input.submissionAllowedExt ?? [];
  if (
    allowedExt.some((ext) => {
      const normalized = String(ext).trim().toLowerCase().replace(/^\./, "");
      return !EXTENSION_PATTERN.test(normalized);
    })
  ) {
    return { ok: false as const, reason: "invalid_submission_allowed_ext" };
  }
  return { ok: true as const };
}

export function validateClubEventInput(input: SaveClubEventInput) {
  if (!UUID_PATTERN.test(input.clubId)) return { ok: false as const, reason: "invalid_club_id" };
  if (input.classId && !UUID_PATTERN.test(input.classId)) return { ok: false as const, reason: "invalid_class_id" };
  const title = typeof input.title === "string" ? input.title.trim() : "";
  if (!title) return { ok: false as const, reason: "missing_title" };
  if (!isIsoDate(input.startDate)) return { ok: false as const, reason: "invalid_start_date" };
  if (input.endDate && !isIsoDate(input.endDate)) return { ok: false as const, reason: "invalid_end_date" };
  if (input.endDate && input.endDate < input.startDate) return { ok: false as const, reason: "end_before_start" };
  if (!isTime(input.startTime) || !isTime(input.endTime)) return { ok: false as const, reason: "invalid_time" };
  if (timeToMinutes(input.endTime) <= timeToMinutes(input.startTime)) {
    return { ok: false as const, reason: "end_time_before_start_time" };
  }

  const recurrenceRule = normalizeRecurrenceRule(input.recurrenceRule, input.startDate);
  const endDate = recurrenceRule.endMode === "on_date" ? recurrenceRule.until : input.endDate ?? null;

  return {
    ok: true as const,
    payload: {
      title,
      eventType: normalizeClubEventType(input.eventType),
      startDate: input.startDate,
      endDate,
      startTime: normalizeTime(input.startTime),
      endTime: normalizeTime(input.endTime),
      timezone: typeof input.timezone === "string" && input.timezone.trim()
        ? input.timezone.trim()
        : DEFAULT_CLASS_TIMEZONE,
      recurrenceRule,
      recurrenceSummary: summarizeRecurrence(recurrenceRule, input.startDate),
    },
  };
}

export function normalizeClubRecurrenceRule(input: Partial<ClassRecurrenceRule> | null | undefined, startDate: string) {
  return normalizeRecurrenceRule(input, startDate);
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

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isTime(value: unknown): value is string {
  return typeof value === "string" && /^\d{2}:\d{2}(:\d{2})?$/.test(value);
}

function normalizeTime(value: string) {
  return value.length === 5 ? `${value}:00` : value;
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isDevAdminBypassEnabled } from "@/lib/dev-admin-bypass";
import {
  buildAtRiskStudents,
  buildClubDashboardKpis,
  buildClubTrend,
  buildWeakestSkills,
  normalizeClubAssignmentStatus,
} from "@/lib/api/admin-clubs-model";
import {
  DEFAULT_CLASS_TIMEZONE,
  expandScheduleOccurrences,
  normalizeRecurrenceRule,
  summarizeRecurrence,
} from "@/lib/api/admin-class-schedules-model";
import type { AdminClassListRow } from "@/lib/types/admin-classes";
import type {
  AdminClubAssignmentRow,
  AdminClubDetailData,
  AdminClubEvent,
  AdminClubEventOccurrence,
  AdminClubInvitation,
  AdminClubListRow,
  AdminClubMember,
  AdminClubPerformanceAttempt,
  AdminClubReviewQueueItem,
  AdminClubsKpis,
  AdminClubsPageData,
  ClubEventStatus,
  ClubEventType,
  ClubInvitationStatus,
  ClubQaState,
  ClubStatus,
  ClubType,
} from "@/lib/types/admin-clubs";

type Supabase = Awaited<ReturnType<typeof createClient>> | SupabaseClient;

const QA_STATES = new Set<ClubQaState>(["empty", "active", "high", "low", "mixed"]);

function qaStateFromSearch(searchParams?: Record<string, string | string[] | undefined>) {
  const raw = Array.isArray(searchParams?.qa) ? searchParams?.qa[0] : searchParams?.qa;
  return QA_STATES.has(raw as ClubQaState) ? (raw as ClubQaState) : "active";
}

function numberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toClubListRow(row: Record<string, unknown>): AdminClubListRow {
  return {
    id: String(row.id),
    code: String(row.code ?? ""),
    name: String(row.name ?? "Untitled club"),
    clubType: (row.club_type === "center" || row.club_type === "independent" || row.club_type === "online"
      ? row.club_type
      : "school") as ClubType,
    city: (row.city as string | null | undefined) ?? null,
    country: String(row.country ?? "VN"),
    status: (row.status === "draft" || row.status === "archived" ? row.status : "active") as ClubStatus,
    timezone: String(row.timezone ?? "Asia/Ho_Chi_Minh"),
    logoUrl: (row.logo_url as string | null | undefined) ?? null,
    logoStoragePath: (row.logo_storage_path as string | null | undefined) ?? null,
    facebookUrl: (row.facebook_url as string | null | undefined) ?? null,
    instagramUrl: (row.instagram_url as string | null | undefined) ?? null,
    threadsUrl: (row.threads_url as string | null | undefined) ?? null,
    classCount: Number(row.class_count ?? 0),
    studentCount: Number(row.student_count ?? 0),
    coachCount: Number(row.coach_count ?? 0),
    assignmentCount: Number(row.assignment_count ?? 0),
    upcomingEventCount: Number(row.upcoming_event_count ?? 0),
    completionRate30d: numberOrNull(row.completion_rate_30d),
    attendanceRate30d: numberOrNull(row.attendance_rate_30d),
    averageScore30d: numberOrNull(row.average_score_30d),
    reviewQueueCount: Number(row.review_queue_count ?? 0),
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
  };
}

function toClassListRow(row: Record<string, unknown>): AdminClassListRow {
  return {
    id: String(row.id),
    code: String(row.code ?? ""),
    title: String(row.title ?? "Untitled cohort"),
    description: (row.description as string | null | undefined) ?? null,
    programType: row.program_type === "ielts" || row.program_type === "public_speaking" ? row.program_type : "debate",
    gradeLevel: (row.grade_level as string | null | undefined) ?? null,
    status: row.status === "draft" || row.status === "archived" ? row.status : "active",
    startDate: (row.start_date as string | null | undefined) ?? null,
    endDate: (row.end_date as string | null | undefined) ?? null,
    meetingSchedule: (row.meeting_schedule as string | null | undefined) ?? null,
    room: (row.room as string | null | undefined) ?? null,
    maxStudents: numberOrNull(row.max_students),
    studentCount: Number(row.student_count ?? 0),
    assignedCourseCount: Number(row.assigned_course_count ?? 0),
    attendanceRate30d: numberOrNull(row.attendance_rate_30d),
    sessionCount30d: Number(row.session_count_30d ?? 0),
    scheduleCount: Number(row.schedule_count ?? 0),
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
  };
}

function toAssignmentRow(row: Record<string, unknown>): AdminClubAssignmentRow {
  return {
    id: String(row.id),
    clubId: String(row.club_id),
    classId: (row.class_id as string | null | undefined) ?? null,
    classTitle: (row.class_title as string | null | undefined) ?? null,
    title: String(row.title ?? "Untitled assignment"),
    description: (row.description as string | null | undefined) ?? null,
    assignmentType: row.assignment_type === "case" || row.assignment_type === "speech" || row.assignment_type === "quiz" || row.assignment_type === "attendance"
      ? row.assignment_type
      : "practice",
    assignedTrack: row.assigned_track === "speaking" || row.assigned_track === "mun" ? row.assigned_track : "debate",
    topicTitle: (row.topic_title as string | null | undefined) ?? null,
    topicCategory: (row.topic_category as string | null | undefined) ?? null,
    dueAt: (row.due_at as string | null | undefined) ?? null,
    requiredAttempts: Number(row.required_attempts ?? 1),
    rubricKey: String(row.rubric_key ?? "debate_v1"),
    rubricVersion: Number(row.rubric_version ?? 1),
    status: normalizeClubAssignmentStatus(row.status),
    submissionCount: Number(row.submission_count ?? 0),
    uniqueSubmitters: Number(row.unique_submitters ?? 0),
    averageScore: numberOrNull(row.average_score),
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
  };
}

function toInvitationRow(row: Record<string, unknown>): AdminClubInvitation {
  return {
    id: String(row.id),
    clubId: String(row.club_id),
    email: String(row.email ?? ""),
    role: row.role === "owner" || row.role === "coach" ? row.role : "student",
    status: normalizeInvitationStatus(row.status),
    expiresAt: String(row.expires_at ?? new Date().toISOString()),
    invitedBy: (row.invited_by as string | null | undefined) ?? null,
    acceptedBy: (row.accepted_by as string | null | undefined) ?? null,
    acceptedAt: (row.accepted_at as string | null | undefined) ?? null,
    lastSentAt: (row.last_sent_at as string | null | undefined) ?? null,
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
  };
}

function enrichClubEvents(
  rows: Record<string, unknown>[],
  cohorts: AdminClassListRow[],
  rangeStart: string,
  rangeEnd: string
): AdminClubEvent[] {
  const cohortById = new Map(cohorts.map((cohort) => [cohort.id, cohort]));

  return rows.map((row) => {
    const startDate = String(row.start_date ?? toIsoDate(new Date()));
    const recurrenceInput = row.recurrence_rule && typeof row.recurrence_rule === "object"
      ? (row.recurrence_rule as Parameters<typeof normalizeRecurrenceRule>[0])
      : null;
    const rule = normalizeRecurrenceRule(recurrenceInput, startDate);
    const startTime = normalizeTime(String(row.start_time ?? "16:00:00"));
    const endTime = normalizeTime(String(row.end_time ?? "17:00:00"));
    const occurrences = expandScheduleOccurrences({
      id: String(row.id),
      startDate,
      endDate: (row.end_date as string | null | undefined) ?? null,
      startTime,
      endTime,
      recurrenceRule: rule,
    }, rangeStart, rangeEnd);
    const classId = (row.class_id as string | null | undefined) ?? null;

    return {
      id: String(row.id),
      clubId: String(row.club_id),
      classId,
      classTitle: classId ? cohortById.get(classId)?.title ?? null : null,
      title: String(row.title ?? "Club event"),
      eventType: normalizeEventType(row.event_type),
      room: (row.room as string | null | undefined) ?? null,
      location: (row.location as string | null | undefined) ?? null,
      startDate,
      endDate: (row.end_date as string | null | undefined) ?? null,
      startTime,
      endTime,
      timezone: String(row.timezone ?? DEFAULT_CLASS_TIMEZONE),
      recurrenceRule: rule,
      recurrenceSummary: (row.recurrence_summary as string | null | undefined) ?? summarizeRecurrence(rule, startDate),
      externalCalendarUrl: (row.external_calendar_url as string | null | undefined) ?? null,
      externalProvider: (row.external_provider as string | null | undefined) ?? null,
      status: normalizeEventStatus(row.status),
      createdAt: String(row.created_at ?? new Date().toISOString()),
      updatedAt: String(row.updated_at ?? new Date().toISOString()),
      occurrenceCount: occurrences.length,
      nextOccurrenceDate: occurrences.find((item) => item.date >= toIsoDate(new Date()))?.date ?? occurrences[0]?.date ?? null,
    };
  });
}

function buildClubEventOccurrences(
  events: AdminClubEvent[],
  rangeStart: string,
  rangeEnd: string
): AdminClubEventOccurrence[] {
  return events
    .filter((event) => event.status === "active")
    .flatMap((event) =>
      expandScheduleOccurrences({
        id: event.id,
        startDate: event.startDate,
        endDate: event.endDate,
        startTime: event.startTime,
        endTime: event.endTime,
        recurrenceRule: event.recurrenceRule,
      }, rangeStart, rangeEnd).map((occurrence) => ({
        id: `${event.id}-${occurrence.date}`,
        eventId: event.id,
        clubId: event.clubId,
        classId: event.classId,
        classTitle: event.classTitle,
        title: event.title,
        eventType: event.eventType,
        room: event.room,
        location: event.location,
        date: occurrence.date,
        startsAt: occurrence.startsAt,
        endsAt: occurrence.endsAt,
        recurrenceSummary: event.recurrenceSummary,
      }))
    )
    .sort((left, right) => left.date.localeCompare(right.date) || left.startsAt.localeCompare(right.startsAt));
}

function normalizeInvitationStatus(value: unknown): ClubInvitationStatus {
  if (value === "accepted" || value === "revoked" || value === "expired") return value;
  return "pending";
}

function normalizeEventStatus(value: unknown): ClubEventStatus {
  if (value === "cancelled" || value === "archived") return value;
  return "active";
}

function normalizeEventType(value: unknown): ClubEventType {
  if (
    value === "workshop" ||
    value === "tournament" ||
    value === "social" ||
    value === "deadline" ||
    value === "other"
  ) {
    return value;
  }
  return "meeting";
}

function buildPageKpis(clubs: AdminClubListRow[]): AdminClubsKpis {
  const completionRates = clubs
    .map((club) => club.completionRate30d)
    .filter((value): value is number => value != null);

  return {
    totalClubs: clubs.length,
    activeClubs: clubs.filter((club) => club.status === "active").length,
    totalStudents: clubs.reduce((sum, club) => sum + club.studentCount, 0),
    reviewQueueCount: clubs.reduce((sum, club) => sum + club.reviewQueueCount, 0),
    averageCompletionRate30d: completionRates.length
      ? Math.round(completionRates.reduce((sum, value) => sum + value, 0) / completionRates.length)
      : null,
  };
}

export async function getAdminClubsPageData({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
} = {}): Promise<AdminClubsPageData> {
  if (isDevAdminBypassEnabled()) {
    return getDevClubsPageData(qaStateFromSearch(searchParams));
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("admin_club_list_rows")
    .select("*")
    .neq("status", "archived")
    .order("created_at", { ascending: false });

  if (error) {
    return {
      clubs: [],
      kpis: buildPageKpis([]),
      qaEnabled: false,
      qaState: null,
      loadError: error.message,
    };
  }

  const clubs = ((data ?? []) as Record<string, unknown>[]).map(toClubListRow);
  return {
    clubs,
    kpis: buildPageKpis(clubs),
    qaEnabled: false,
    qaState: null,
    loadError: null,
  };
}

export async function getAdminClubDetail(
  clubId: string,
  searchParams?: Record<string, string | string[] | undefined>
): Promise<AdminClubDetailData | null> {
  const qaState = qaStateFromSearch(searchParams);
  if (isDevAdminBypassEnabled() && clubId.startsWith("00000000-0000-4c00-8000-")) {
    return getDevClubDetail(clubId, qaState);
  }

  const supabase = await createClient();
  const { data: clubRow, error: clubError } = await supabase
    .from("admin_club_list_rows")
    .select("*")
    .eq("id", clubId)
    .single();

  if (clubError || !clubRow) {
    if (isDevAdminBypassEnabled()) return getDevClubDetail(clubId, qaState);
    return null;
  }

  const [membersRes, cohortsRes, assignmentsRes, attemptsRes, reviewsRes, invitationsRes, eventsRes] = await Promise.all([
    supabase
      .from("club_memberships")
      .select("id, user_id, role, status, joined_at")
      .eq("club_id", clubId)
      .order("joined_at", { ascending: true }),
    supabase
      .from("admin_class_list_rows")
      .select("*")
      .eq("club_id", clubId)
      .order("created_at", { ascending: false }),
    supabase
      .from("admin_club_assignment_rows")
      .select("*")
      .eq("club_id", clubId)
      .order("created_at", { ascending: false }),
    supabase
      .from("performance_attempts")
      .select("*")
      .eq("club_id", clubId)
      .order("occurred_at", { ascending: false })
      .limit(100),
    supabase
      .from("coach_reviews")
      .select("id, performance_attempt_id, status, created_at")
      .eq("club_id", clubId)
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("club_invitations")
      .select("id, club_id, email, role, status, expires_at, invited_by, accepted_by, accepted_at, last_sent_at, created_at, updated_at")
      .eq("club_id", clubId)
      .order("created_at", { ascending: false })
      .limit(80),
    supabase
      .from("club_events")
      .select("*")
      .eq("club_id", clubId)
      .neq("status", "archived")
      .order("start_date", { ascending: true }),
  ]);

  const loadError =
    membersRes.error?.message ??
    cohortsRes.error?.message ??
    assignmentsRes.error?.message ??
    attemptsRes.error?.message ??
    reviewsRes.error?.message ??
    invitationsRes.error?.message ??
    eventsRes.error?.message ??
    null;

  const members = await enrichMembers(supabase, (membersRes.data ?? []) as Record<string, unknown>[]);
  const cohorts = ((cohortsRes.data ?? []) as Record<string, unknown>[]).map(toClassListRow);
  const assignments = ((assignmentsRes.data ?? []) as Record<string, unknown>[]).map(toAssignmentRow);
  const invitations = ((invitationsRes.data ?? []) as Record<string, unknown>[]).map(toInvitationRow);
  const scheduleRangeStart = toIsoDate(addDays(new Date(), -7));
  const scheduleRangeEnd = toIsoDate(addDays(new Date(), 90));
  const events = enrichClubEvents((eventsRes.data ?? []) as Record<string, unknown>[], cohorts, scheduleRangeStart, scheduleRangeEnd);
  const eventOccurrences = buildClubEventOccurrences(events, scheduleRangeStart, scheduleRangeEnd);
  const attempts = await enrichAttempts(
    supabase,
    (attemptsRes.data ?? []) as Record<string, unknown>[],
    cohorts,
    assignments,
    members
  );
  const reviewQueue = buildReviewQueue((reviewsRes.data ?? []) as Record<string, unknown>[], attempts);
  const attendanceByUser = new Map(members.map((member) => [member.userId, null]));
  const completionByUser = buildCompletionByUser(members, assignments, attempts);

  return {
    club: toClubListRow(clubRow as Record<string, unknown>),
    kpis: buildClubDashboardKpis({
      studentCount: members.filter((member) => member.role === "student" && member.status === "active").length,
      cohortCount: cohorts.length,
      attendanceRate: numberOrNull((clubRow as Record<string, unknown>).attendance_rate_30d),
      assignments,
      attempts,
      reviewQueue,
    }),
    members,
    cohorts,
    assignments,
    attempts,
    reviewQueue,
    atRiskStudents: buildAtRiskStudents({
      attempts,
      studentAttendance: attendanceByUser,
      studentCompletion: completionByUser,
    }),
    weakestSkills: buildWeakestSkills(attempts),
    trend: buildClubTrend(attempts, assignments),
    invitations,
    events,
    eventOccurrences,
    qaEnabled: false,
    qaState: null,
    loadError,
  };
}

async function enrichMembers(supabase: Supabase, rows: Record<string, unknown>[]): Promise<AdminClubMember[]> {
  const userIds = rows.map((row) => row.user_id as string).filter(Boolean);
  const profilesRes = userIds.length
    ? await supabase.from("profiles").select("id, email, display_name").in("id", userIds)
    : { data: [], error: null };
  const profilesById = new Map((profilesRes.data ?? []).map((profile) => [profile.id as string, profile]));

  return rows.map((row) => {
    const profile = profilesById.get(row.user_id as string);
    return {
      id: String(row.id),
      userId: String(row.user_id),
      displayName: String(profile?.display_name ?? profile?.email ?? "Student"),
      email: (profile?.email as string | null | undefined) ?? null,
      role: row.role === "owner" || row.role === "coach" ? row.role : "student",
      status: row.status === "removed" ? "removed" : "active",
      joinedAt: String(row.joined_at ?? new Date().toISOString()),
    };
  });
}

async function enrichAttempts(
  supabase: Supabase,
  rows: Record<string, unknown>[],
  cohorts: AdminClassListRow[],
  assignments: AdminClubAssignmentRow[],
  members: AdminClubMember[]
): Promise<AdminClubPerformanceAttempt[]> {
  const memberById = new Map(members.map((member) => [member.userId, member]));
  const cohortById = new Map(cohorts.map((cohort) => [cohort.id, cohort]));
  const assignmentById = new Map(assignments.map((assignment) => [assignment.id, assignment]));
  const missingUserIds = rows
    .map((row) => row.user_id as string)
    .filter((userId) => userId && !memberById.has(userId));
  const profilesRes = missingUserIds.length
    ? await supabase.from("profiles").select("id, email, display_name").in("id", missingUserIds)
    : { data: [], error: null };
  for (const profile of profilesRes.data ?? []) {
    memberById.set(profile.id as string, {
      id: `${profile.id}-profile`,
      userId: profile.id as string,
      displayName: String(profile.display_name ?? profile.email ?? "Student"),
      email: (profile.email as string | null | undefined) ?? null,
      role: "student",
      status: "active",
      joinedAt: new Date().toISOString(),
    });
  }

  return rows.map((row) => {
    const cohort = row.class_id ? cohortById.get(row.class_id as string) : undefined;
    const assignment = row.assignment_id ? assignmentById.get(row.assignment_id as string) : undefined;
    return {
      id: String(row.id),
      userId: String(row.user_id),
      studentName: memberById.get(row.user_id as string)?.displayName ?? "Student",
      clubId: (row.club_id as string | null | undefined) ?? null,
      classId: (row.class_id as string | null | undefined) ?? null,
      classTitle: cohort?.title ?? null,
      assignmentId: (row.assignment_id as string | null | undefined) ?? null,
      assignmentTitle: assignment?.title ?? null,
      practiceTrack: row.practice_track === "speaking" || row.practice_track === "mun" ? row.practice_track : "debate",
      format: (row.format as string | null | undefined) ?? null,
      topicTitle: (row.topic_title as string | null | undefined) ?? null,
      durationSeconds: numberOrNull(row.duration_seconds),
      wordCount: numberOrNull(row.word_count),
      overallScore: numberOrNull(row.overall_score),
      overallBand: (row.overall_band as string | null | undefined) ?? null,
      skillScores: (row.skill_scores && typeof row.skill_scores === "object" ? row.skill_scores : {}) as Record<string, number>,
      occurredAt: String(row.occurred_at ?? new Date().toISOString()),
    };
  });
}

function buildReviewQueue(rows: Record<string, unknown>[], attempts: AdminClubPerformanceAttempt[]): AdminClubReviewQueueItem[] {
  const attemptById = new Map(attempts.map((attempt) => [attempt.id, attempt]));
  const existing = rows.map((row) => {
    const attempt = attemptById.get(row.performance_attempt_id as string);
    const score = attempt?.overallScore ?? 0;
    return {
      id: String(row.id),
      attemptId: String(row.performance_attempt_id),
      studentName: attempt?.studentName ?? "Student",
      title: attempt?.assignmentTitle ?? attempt?.topicTitle ?? "Practice attempt",
      cohort: attempt?.classTitle ?? null,
      priority: score < 60 ? "high" : score < 72 ? "medium" : "low",
      submittedAt: attempt?.occurredAt ?? String(row.created_at ?? new Date().toISOString()),
      status: row.status === "resolved" ? "resolved" : "open",
    } satisfies AdminClubReviewQueueItem;
  });

  const lowScoreAttempts = attempts
    .filter((attempt) => (attempt.overallScore ?? 100) < 72)
    .slice(0, Math.max(0, 6 - existing.length))
    .map((attempt) => ({
      id: `${attempt.id}-auto-review`,
      attemptId: attempt.id,
      studentName: attempt.studentName,
      title: attempt.assignmentTitle ?? attempt.topicTitle ?? "Practice attempt",
      cohort: attempt.classTitle,
      priority: (attempt.overallScore ?? 0) < 60 ? "high" : "medium",
      submittedAt: attempt.occurredAt,
      status: "open",
    }) satisfies AdminClubReviewQueueItem);

  return [...existing, ...lowScoreAttempts];
}

function buildCompletionByUser(
  members: AdminClubMember[],
  assignments: AdminClubAssignmentRow[],
  attempts: AdminClubPerformanceAttempt[]
) {
  const activeAssignments = assignments.filter((assignment) => assignment.status === "active");
  const attemptsByUser = new Map<string, number>();
  for (const attempt of attempts) {
    if (!attempt.assignmentId) continue;
    attemptsByUser.set(attempt.userId, (attemptsByUser.get(attempt.userId) ?? 0) + 1);
  }

  return new Map(
    members
      .filter((member) => member.role === "student")
      .map((member) => [
        member.userId,
        activeAssignments.length
          ? Math.round(((attemptsByUser.get(member.userId) ?? 0) / activeAssignments.length) * 100)
          : null,
      ])
  );
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function normalizeTime(value: string) {
  return value.length === 5 ? `${value}:00` : value;
}

const DEV_CLUB_IDS: Record<ClubQaState, string> = {
  empty: "00000000-0000-4c00-8000-000000000001",
  active: "00000000-0000-4c00-8000-000000000002",
  high: "00000000-0000-4c00-8000-000000000003",
  low: "00000000-0000-4c00-8000-000000000004",
  mixed: "00000000-0000-4c00-8000-000000000005",
};

function devClub(state: ClubQaState): AdminClubListRow {
  const config = {
    empty: ["DL-EMPTY", "Empty Club QA", 0, 0, 0, null, null, null, 0],
    active: ["HDC-2026", "Hanoi Debate Club", 3, 72, 4, 78, 86, 72.4, 28],
    high: ["HDC-HIGH", "High Performing Cohort", 2, 48, 3, 96, 94, 84.6, 4],
    low: ["HDC-LOW", "Low Completion Cohort", 2, 52, 3, 38, 71, 61.8, 19],
    mixed: ["HDC-MIX", "Mixed Attendance Cohort", 4, 96, 5, 69, 78, 70.3, 16],
  }[state];

  return {
    id: DEV_CLUB_IDS[state],
    code: String(config[0]),
    name: String(config[1]),
    clubType: "school",
    city: "Hanoi",
    country: "VN",
    status: "active",
    timezone: "Asia/Ho_Chi_Minh",
    logoUrl: null,
    logoStoragePath: null,
    facebookUrl: "https://facebook.com/hanoidebateclub",
    instagramUrl: "https://instagram.com/hanoidebateclub",
    threadsUrl: null,
    classCount: Number(config[2]),
    studentCount: Number(config[3]),
    coachCount: Number(config[4]),
    assignmentCount: state === "empty" ? 0 : 12,
    upcomingEventCount: state === "empty" ? 0 : 5,
    completionRate30d: config[5] as number | null,
    attendanceRate30d: config[6] as number | null,
    averageScore30d: config[7] as number | null,
    reviewQueueCount: Number(config[8]),
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-15T00:00:00.000Z",
  };
}

function getDevClubsPageData(state: ClubQaState): AdminClubsPageData {
  const clubs = state === "empty"
    ? [devClub("empty")]
    : [devClub(state), devClub("high"), devClub("low"), devClub("mixed")];

  return {
    clubs,
    kpis: buildPageKpis(clubs),
    qaEnabled: true,
    qaState: state,
    loadError: null,
  };
}

function getDevClubDetail(clubId: string, state: ClubQaState): AdminClubDetailData {
  const resolvedState = (Object.values(DEV_CLUB_IDS).includes(clubId) ?
    (Object.entries(DEV_CLUB_IDS).find(([, id]) => id === clubId)?.[0] as ClubQaState) :
    state) ?? state;
  const club = devClub(resolvedState);
  const cohorts = buildDevCohorts(resolvedState, club.id);
  const members = buildDevMembers(resolvedState);
  const assignments = buildDevAssignments(resolvedState, club.id, cohorts);
  const attempts = buildDevAttempts(resolvedState, club.id, cohorts, assignments, members);
  const reviewQueue = buildReviewQueue([], attempts);
  const events = buildDevEvents(resolvedState, club.id, cohorts);
  const eventOccurrences = buildClubEventOccurrences(events, "2026-05-01", "2026-08-31");
  const completionByUser = buildCompletionByUser(members, assignments, attempts);
  const attendanceByUser = new Map(
    members
      .filter((member) => member.role === "student")
      .map((member, index) => [
        member.userId,
        resolvedState === "low"
          ? 58 + (index % 4) * 5
          : resolvedState === "mixed"
            ? 62 + (index % 6) * 6
            : resolvedState === "high"
              ? 90 + (index % 4) * 2
              : 82 + (index % 5) * 3,
      ])
  );

  return {
    club,
    kpis: buildClubDashboardKpis({
      studentCount: club.studentCount,
      cohortCount: cohorts.length,
      attendanceRate: club.attendanceRate30d,
      assignments,
      attempts,
      reviewQueue,
    }),
    members,
    cohorts,
    assignments,
    attempts,
    reviewQueue,
    atRiskStudents: buildAtRiskStudents({ attempts, studentAttendance: attendanceByUser, studentCompletion: completionByUser }),
    weakestSkills: buildWeakestSkills(attempts),
    trend: buildClubTrend(attempts, assignments, new Date("2026-05-15T00:00:00.000Z")),
    invitations: buildDevInvitations(resolvedState, club.id),
    events,
    eventOccurrences,
    qaEnabled: true,
    qaState: resolvedState,
    loadError: null,
  };
}

function buildDevInvitations(state: ClubQaState, clubId: string): AdminClubInvitation[] {
  if (state === "empty") return [];
  return [
    {
      id: "00000000-0000-4c15-8000-000000000001",
      clubId,
      email: "new.coach@debatelab.vn",
      role: "coach",
      status: "pending",
      expiresAt: "2026-05-30T00:00:00.000Z",
      invitedBy: "00000000-0000-4000-8000-000000000001",
      acceptedBy: null,
      acceptedAt: null,
      lastSentAt: "2026-05-15T00:00:00.000Z",
      createdAt: "2026-05-15T00:00:00.000Z",
      updatedAt: "2026-05-15T00:00:00.000Z",
    },
  ];
}

function buildDevEvents(
  state: ClubQaState,
  clubId: string,
  cohorts: AdminClassListRow[]
): AdminClubEvent[] {
  if (state === "empty") return [];
  return [
    {
      id: "00000000-0000-4c60-8000-000000000001",
      clubId,
      classId: cohorts[0]?.id ?? null,
      classTitle: cohorts[0]?.title ?? null,
      title: "Weekly sparring round",
      eventType: "meeting",
      room: "Room 204",
      location: "Ha Noi campus",
      startDate: "2026-05-18",
      endDate: "2026-07-31",
      startTime: "17:00:00",
      endTime: "18:30:00",
      timezone: DEFAULT_CLASS_TIMEZONE,
      recurrenceRule: normalizeRecurrenceRule({
        frequency: "weekly",
        interval: 1,
        weekdays: ["MO"],
        endMode: "on_date",
        until: "2026-07-31",
        count: null,
      }, "2026-05-18"),
      recurrenceSummary: "Weekly on Mon from May 18, 2026 until Jul 31, 2026",
      externalCalendarUrl: null,
      externalProvider: null,
      status: "active",
      createdAt: "2026-05-10T00:00:00.000Z",
      updatedAt: "2026-05-15T00:00:00.000Z",
      occurrenceCount: 11,
      nextOccurrenceDate: "2026-05-18",
    },
    {
      id: "00000000-0000-4c60-8000-000000000002",
      clubId,
      classId: null,
      classTitle: null,
      title: "Parent showcase",
      eventType: "social",
      room: "Auditorium",
      location: "Ha Noi campus",
      startDate: "2026-06-06",
      endDate: null,
      startTime: "09:00:00",
      endTime: "11:00:00",
      timezone: DEFAULT_CLASS_TIMEZONE,
      recurrenceRule: normalizeRecurrenceRule({ frequency: "none" }, "2026-06-06"),
      recurrenceSummary: "Does not repeat",
      externalCalendarUrl: null,
      externalProvider: null,
      status: "active",
      createdAt: "2026-05-12T00:00:00.000Z",
      updatedAt: "2026-05-15T00:00:00.000Z",
      occurrenceCount: 1,
      nextOccurrenceDate: "2026-06-06",
    },
  ];
}

function buildDevCohorts(state: ClubQaState, clubId: string): AdminClassListRow[] {
  if (state === "empty") return [];
  const rows = [
    ["00000000-0000-4500-8000-000000000201", "DEB-A", "Cohort A", "Advanced debate training.", "Advanced", 24, 88],
    ["00000000-0000-4500-8000-000000000202", "DEB-B", "Cohort B", "Policy case construction.", "Intermediate", 24, 82],
    ["00000000-0000-4500-8000-000000000203", "MUN-C", "Cohort C", "MUN diplomacy and speeches.", "Beginner", 24, state === "low" ? 63 : 79],
  ] as const;

  return rows.slice(0, state === "high" || state === "low" ? 2 : 3).map(([id, code, title, description, level, students, attendance]) => ({
    id,
    code,
    title,
    description,
    programType: "debate",
    gradeLevel: level,
    status: "active",
    startDate: "2026-05-01",
    endDate: "2026-07-31",
    meetingSchedule: "Tue & Thu 17:00 - 18:30",
    room: "Room 204",
    maxStudents: students,
    studentCount: students,
    assignedCourseCount: 3,
    attendanceRate30d: attendance,
    sessionCount30d: 8,
    scheduleCount: 2,
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-15T00:00:00.000Z",
  })).map((row) => ({ ...row, metadata: { clubId } }) as AdminClassListRow);
}

function buildDevMembers(state: ClubQaState): AdminClubMember[] {
  if (state === "empty") return [
    {
      id: "00000000-0000-4c10-8000-000000000001",
      userId: "00000000-0000-4000-8000-000000000001",
      displayName: "Coach Tran",
      email: "coach@debatelab.vn",
      role: "owner",
      status: "active",
      joinedAt: "2026-05-01T00:00:00.000Z",
    },
  ];

  const names = [
    "Nguyen Minh Anh",
    "Le Gia Bao",
    "Tran Phuong Linh",
    "Doan Nam Khanh",
    "Vu Ha My",
    "Nguyen Hoang Nam",
    "Pham Khanh Linh",
    "Le Minh Khang",
  ];
  const students = names.map((name, index) => ({
    id: `00000000-0000-4c10-8000-${String(index + 10).padStart(12, "0")}`,
    userId: `00000000-0000-4000-8000-${String(index + 210).padStart(12, "0")}`,
    displayName: name,
    email: `${name.toLowerCase().replace(/\s+/g, ".")}@student.vn`,
    role: "student",
    status: "active",
    joinedAt: `2026-05-${String(1 + index).padStart(2, "0")}T00:00:00.000Z`,
  }) satisfies AdminClubMember);

  return [
    {
      id: "00000000-0000-4c10-8000-000000000001",
      userId: "00000000-0000-4000-8000-000000000001",
      displayName: "Coach Tran",
      email: "coach@debatelab.vn",
      role: "owner",
      status: "active",
      joinedAt: "2026-05-01T00:00:00.000Z",
    },
    {
      id: "00000000-0000-4c10-8000-000000000002",
      userId: "00000000-0000-4000-8000-000000000002",
      displayName: "Coach Linh",
      email: "linh@debatelab.vn",
      role: "coach",
      status: "active",
      joinedAt: "2026-05-01T00:00:00.000Z",
    },
    ...students,
  ];
}

function buildDevAssignments(
  state: ClubQaState,
  clubId: string,
  cohorts: AdminClassListRow[]
): AdminClubAssignmentRow[] {
  if (state === "empty") return [];
  const completion = state === "high" ? [24, 23, 24, 22, 24] : state === "low" ? [8, 11, 15, 7, 13] : [18, 21, 24, 24, 24];
  const titles = ["Policy Debate - Case", "Rebuttal Practice", "Opening Statement Drill", "Cross-Examination Drill", "Logical Fallacies Quiz"];
  return titles.map((title, index) => ({
    id: `00000000-0000-4c20-8000-${String(index + 1).padStart(12, "0")}`,
    clubId,
    classId: cohorts[index % Math.max(1, cohorts.length)]?.id ?? null,
    classTitle: cohorts[index % Math.max(1, cohorts.length)]?.title ?? null,
    title,
    description: index === 0 ? "Draft a two-contention case and record a two-minute defense." : "Submit one scored practice attempt.",
    assignmentType: index === 4 ? "quiz" : "practice",
    assignedTrack: index === 2 ? "speaking" : "debate",
    topicTitle: title,
    topicCategory: "Debate",
    dueAt: `2026-05-${String(18 + index).padStart(2, "0")}T10:00:00.000Z`,
    requiredAttempts: 1,
    rubricKey: index === 2 ? "speaking_v1" : "debate_v1",
    rubricVersion: 1,
    status: "active",
    submissionCount: completion[index] ?? 0,
    uniqueSubmitters: completion[index] ?? 0,
    averageScore: state === "high" ? 82 + index : state === "low" ? 58 + index * 2 : 68 + index * 3,
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-15T00:00:00.000Z",
  }));
}

function buildDevAttempts(
  state: ClubQaState,
  clubId: string,
  cohorts: AdminClassListRow[],
  assignments: AdminClubAssignmentRow[],
  members: AdminClubMember[]
): AdminClubPerformanceAttempt[] {
  const students = members.filter((member) => member.role === "student");
  const base = state === "high" ? 82 : state === "low" ? 58 : 68;
  return assignments.flatMap((assignment, assignmentIndex) =>
    students.slice(0, Math.min(students.length, assignment.uniqueSubmitters)).map((student, studentIndex) => {
      const cohort = cohorts[(studentIndex + assignmentIndex) % Math.max(1, cohorts.length)];
      const score = Math.max(45, Math.min(96, base + (studentIndex % 6) * 2 + assignmentIndex - (state === "mixed" && studentIndex % 3 === 0 ? 10 : 0)));
      return {
        id: `00000000-0000-4c30-8000-${String(assignmentIndex * 100 + studentIndex + 1).padStart(12, "0")}`,
        userId: student.userId,
        studentName: student.displayName,
        clubId,
        classId: cohort?.id ?? null,
        classTitle: cohort?.title ?? null,
        assignmentId: assignment.id,
        assignmentTitle: assignment.title,
        practiceTrack: assignment.assignedTrack,
        format: assignment.assignedTrack === "speaking" ? "quick" : "full",
        topicTitle: assignment.topicTitle,
        durationSeconds: 420 + studentIndex * 18,
        wordCount: 540 + studentIndex * 21,
        overallScore: score,
        overallBand: score >= 85 ? "Proficient" : score >= 70 ? "Competent" : score >= 60 ? "Developing" : "Novice",
        skillScores: {
          rebuttal: Math.max(45, score - 14),
          crossExamination: Math.max(45, score - 10),
          logic: Math.max(45, score - 6),
          evidence: Math.max(45, score - 4),
          clarity: Math.min(96, score + 3),
          delivery: Math.min(96, score + 5),
        },
        occurredAt: `2026-05-${String(4 + assignmentIndex * 2).padStart(2, "0")}T0${studentIndex % 9}:00:00.000Z`,
      } satisfies AdminClubPerformanceAttempt;
    })
  );
}

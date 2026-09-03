import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { ORGANIZATION_JOIN_CODES_ENABLED } from "@/lib/features";
import {
  buildAtRiskStudents,
  buildClubDashboardKpis,
  buildClubTrend,
  buildWeakestSkills,
  normalizeClubAssignmentStatus,
} from "@/lib/api/admin-clubs-model";
import { getLeaderboardSafetyAudit } from "@/lib/leaderboards/social-trust-server";
import {
  DEFAULT_CLASS_TIMEZONE,
  expandScheduleOccurrences,
  normalizeRecurrenceRule,
  summarizeRecurrence,
} from "@/lib/api/admin-class-schedules-model";
import type { AdminClassListRow } from "@/lib/types/admin-classes";
import {
  normalizeOrganizationRole,
  organizationTypeFromLegacyClubType,
} from "@/lib/organizations/compatibility";
import type {
  AdminClubAssignmentRow,
  AdminClubDetailData,
  AdminClubEvent,
  AdminClubEventOccurrence,
  AdminClubInvitation,
  AdminClubJoinCode,
  AdminClubListRow,
  AdminClubMember,
  AdminClubPerformanceAttempt,
  AdminClubReviewQueueItem,
  AdminClubsKpis,
  AdminClubsPageData,
  ClubEventStatus,
  ClubEventType,
  ClubInvitationStatus,
  ClubJoinCodeStatus,
  ClubStatus,
  ClubType,
} from "@/lib/types/admin-clubs";

type Supabase = Awaited<ReturnType<typeof createClient>> | SupabaseClient;

function numberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toClubListRow(row: Record<string, unknown>): AdminClubListRow {
  const legacyClubType =
    row.club_type === "center" ||
    row.club_type === "independent" ||
    row.club_type === "online"
      ? row.club_type
      : "school";
  const organizationType =
    row.organization_type === "school" || row.organization_type === "club"
      ? row.organization_type
      : organizationTypeFromLegacyClubType(row.club_type);
  return {
    id: String(row.id),
    code: String(row.code ?? ""),
    name: String(row.name ?? "Untitled club"),
    organizationType,
    clubType: legacyClubType as ClubType,
    city: (row.city as string | null | undefined) ?? null,
    country: String(row.country ?? "VN"),
    status: (row.status === "draft" || row.status === "archived"
      ? row.status
      : "active") as ClubStatus,
    timezone: String(row.timezone ?? "Asia/Ho_Chi_Minh"),
    logoUrl: (row.logo_url as string | null | undefined) ?? null,
    logoStoragePath:
      (row.logo_storage_path as string | null | undefined) ?? null,
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
    programType:
      row.program_type === "ielts" || row.program_type === "public_speaking"
        ? row.program_type
        : "debate",
    gradeLevel: (row.grade_level as string | null | undefined) ?? null,
    status:
      row.status === "draft" || row.status === "archived"
        ? row.status
        : "active",
    startDate: (row.start_date as string | null | undefined) ?? null,
    endDate: (row.end_date as string | null | undefined) ?? null,
    meetingSchedule:
      (row.meeting_schedule as string | null | undefined) ?? null,
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
    assignmentType:
      row.assignment_type === "case" ||
      row.assignment_type === "speech" ||
      row.assignment_type === "quiz" ||
      row.assignment_type === "attendance"
        ? row.assignment_type
        : "practice",
    assignedTrack:
      row.assigned_track === "speaking" || row.assigned_track === "mun"
        ? row.assigned_track
        : "debate",
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
    isHomework: false,
    submissionTextEnabled: true,
    submissionFilesEnabled: false,
    submissionMaxFiles: 3,
    submissionMaxFileMb: 10,
    submissionAllowedExt: null,
    submissionInstructions: null,
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
  };
}

function isHomeworkMetadata(metadata: unknown) {
  return Boolean(
    metadata &&
    typeof metadata === "object" &&
    !Array.isArray(metadata) &&
    (metadata as Record<string, unknown>).submission_mode === "homework",
  );
}

async function enrichAssignmentSubmissionConfig(
  supabase: Supabase,
  assignments: AdminClubAssignmentRow[],
): Promise<AdminClubAssignmentRow[]> {
  const ids = assignments.map((assignment) => assignment.id);
  if (ids.length === 0) return assignments;

  const { data, error } = await supabase
    .from("club_assignments")
    .select(
      "id, metadata, submission_text_enabled, submission_files_enabled, submission_max_files, submission_max_file_mb, submission_allowed_ext, submission_instructions",
    )
    .in("id", ids);
  if (error) return assignments;

  const configById = new Map(
    ((data ?? []) as Record<string, unknown>[]).map((row) => [
      String(row.id),
      row,
    ]),
  );

  return assignments.map((assignment) => {
    const config = configById.get(assignment.id);
    if (!config) return assignment;
    return {
      ...assignment,
      isHomework: isHomeworkMetadata(config.metadata),
      submissionTextEnabled: config.submission_text_enabled !== false,
      submissionFilesEnabled: config.submission_files_enabled === true,
      submissionMaxFiles: Number(config.submission_max_files ?? 3),
      submissionMaxFileMb: Number(config.submission_max_file_mb ?? 10),
      submissionAllowedExt: Array.isArray(config.submission_allowed_ext)
        ? config.submission_allowed_ext.map(String)
        : null,
      submissionInstructions:
        (config.submission_instructions as string | null | undefined) ?? null,
    };
  });
}

function toInvitationRow(row: Record<string, unknown>): AdminClubInvitation {
  return {
    id: String(row.id),
    clubId: String(row.club_id),
    email: String(row.email ?? ""),
    role: normalizeOrganizationRole(row.role, "student") ?? "student",
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

function normalizeJoinCodeStatus(value: unknown): ClubJoinCodeStatus {
  if (value === "redeemed" || value === "revoked" || value === "expired")
    return value;
  return "pending";
}

function toJoinCodeRow(row: Record<string, unknown>): AdminClubJoinCode {
  return {
    id: String(row.id),
    clubId: String(row.club_id),
    status: normalizeJoinCodeStatus(row.status),
    role: "student",
    expiresAt: String(row.expires_at ?? new Date().toISOString()),
    issuedBy: (row.issued_by as string | null | undefined) ?? null,
    redeemedBy: (row.redeemed_by as string | null | undefined) ?? null,
    redeemedAt: (row.redeemed_at as string | null | undefined) ?? null,
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
  };
}

function enrichClubEvents(
  rows: Record<string, unknown>[],
  cohorts: AdminClassListRow[],
  rangeStart: string,
  rangeEnd: string,
): AdminClubEvent[] {
  const cohortById = new Map(cohorts.map((cohort) => [cohort.id, cohort]));

  return rows.map((row) => {
    const startDate = String(row.start_date ?? toIsoDate(new Date()));
    const recurrenceInput =
      row.recurrence_rule && typeof row.recurrence_rule === "object"
        ? (row.recurrence_rule as Parameters<typeof normalizeRecurrenceRule>[0])
        : null;
    const rule = normalizeRecurrenceRule(recurrenceInput, startDate);
    const startTime = normalizeTime(String(row.start_time ?? "16:00:00"));
    const endTime = normalizeTime(String(row.end_time ?? "17:00:00"));
    const occurrences = expandScheduleOccurrences(
      {
        id: String(row.id),
        startDate,
        endDate: (row.end_date as string | null | undefined) ?? null,
        startTime,
        endTime,
        recurrenceRule: rule,
      },
      rangeStart,
      rangeEnd,
    );
    const classId = (row.class_id as string | null | undefined) ?? null;

    return {
      id: String(row.id),
      clubId: String(row.club_id),
      classId,
      classTitle: classId ? (cohortById.get(classId)?.title ?? null) : null,
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
      recurrenceSummary:
        (row.recurrence_summary as string | null | undefined) ??
        summarizeRecurrence(rule, startDate),
      externalCalendarUrl:
        (row.external_calendar_url as string | null | undefined) ?? null,
      externalProvider:
        (row.external_provider as string | null | undefined) ?? null,
      status: normalizeEventStatus(row.status),
      createdAt: String(row.created_at ?? new Date().toISOString()),
      updatedAt: String(row.updated_at ?? new Date().toISOString()),
      occurrenceCount: occurrences.length,
      nextOccurrenceDate:
        occurrences.find((item) => item.date >= toIsoDate(new Date()))?.date ??
        occurrences[0]?.date ??
        null,
    };
  });
}

function buildClubEventOccurrences(
  events: AdminClubEvent[],
  rangeStart: string,
  rangeEnd: string,
): AdminClubEventOccurrence[] {
  return events
    .filter((event) => event.status === "active")
    .flatMap((event) =>
      expandScheduleOccurrences(
        {
          id: event.id,
          startDate: event.startDate,
          endDate: event.endDate,
          startTime: event.startTime,
          endTime: event.endTime,
          recurrenceRule: event.recurrenceRule,
        },
        rangeStart,
        rangeEnd,
      ).map((occurrence) => ({
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
      })),
    )
    .sort(
      (left, right) =>
        left.date.localeCompare(right.date) ||
        left.startsAt.localeCompare(right.startsAt),
    );
}

function normalizeInvitationStatus(value: unknown): ClubInvitationStatus {
  if (value === "accepted" || value === "revoked" || value === "expired")
    return value;
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
    reviewQueueCount: clubs.reduce(
      (sum, club) => sum + club.reviewQueueCount,
      0,
    ),
    averageCompletionRate30d: completionRates.length
      ? Math.round(
          completionRates.reduce((sum, value) => sum + value, 0) /
            completionRates.length,
        )
      : null,
  };
}

export async function getAdminClubsPageData(
  options: {
    searchParams?: Record<string, string | string[] | undefined>;
    includeArchived?: boolean;
  } = {},
): Promise<AdminClubsPageData> {
  const { includeArchived = false } = options;
  const supabase = await createClient();
  let listQuery = supabase
    .from("admin_club_list_rows")
    .select("*")
    .order("created_at", { ascending: false });
  if (!includeArchived) listQuery = listQuery.neq("status", "archived");
  const { data, error } = await listQuery;

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
  const clubIds = clubs.map((club) => club.id);
  const membershipResult = clubIds.length
    ? await supabase
        .from("club_memberships")
        .select("club_id, role, status")
        .in("club_id", clubIds)
        .eq("status", "active")
    : { data: [], error: null };
  if (membershipResult.error) {
    return {
      clubs,
      kpis: buildPageKpis(clubs),
      qaEnabled: false,
      qaState: null,
      loadError: membershipResult.error.message,
    };
  }
  const staffCounts = new Map<string, number>();
  for (const membership of membershipResult.data ?? []) {
    if (
      ["owner", "admin", "teacher", "coach"].includes(String(membership.role))
    ) {
      staffCounts.set(
        membership.club_id,
        (staffCounts.get(membership.club_id) ?? 0) + 1,
      );
    }
  }
  for (const club of clubs) club.coachCount = staffCounts.get(club.id) ?? 0;
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
): Promise<AdminClubDetailData | null> {
  const supabase = await createClient();
  const { data: clubRow, error: clubError } = await supabase
    .from("admin_club_list_rows")
    .select("*")
    .eq("id", clubId)
    .single();

  if (clubError || !clubRow) {
    return null;
  }

  const [
    membersRes,
    cohortsRes,
    assignmentsRes,
    attemptsRes,
    reviewsRes,
    invitationsRes,
    joinCodesRes,
    eventsRes,
    leaderboardSafety,
  ] = await Promise.all([
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
      .select(
        "id, club_id, email, role, status, expires_at, invited_by, accepted_by, accepted_at, last_sent_at, created_at, updated_at",
      )
      .eq("club_id", clubId)
      .order("created_at", { ascending: false })
      .limit(80),
    ORGANIZATION_JOIN_CODES_ENABLED
      ? supabase
          .from("club_join_codes")
          .select(
            "id, club_id, status, role, expires_at, issued_by, redeemed_by, redeemed_at, created_at, updated_at",
          )
          .eq("club_id", clubId)
          .order("created_at", { ascending: false })
          .limit(80)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("club_events")
      .select("*")
      .eq("club_id", clubId)
      .neq("status", "archived")
      .order("start_date", { ascending: true }),
    getLeaderboardSafetyAudit({
      supabase,
      clubId,
      limit: 60,
    }),
  ]);

  const loadError =
    membersRes.error?.message ??
    cohortsRes.error?.message ??
    assignmentsRes.error?.message ??
    attemptsRes.error?.message ??
    reviewsRes.error?.message ??
    invitationsRes.error?.message ??
    joinCodesRes.error?.message ??
    eventsRes.error?.message ??
    null;

  const members = await enrichMembers(
    supabase,
    (membersRes.data ?? []) as Record<string, unknown>[],
  );
  const cohorts = ((cohortsRes.data ?? []) as Record<string, unknown>[]).map(
    toClassListRow,
  );
  const assignments = await enrichAssignmentSubmissionConfig(
    supabase,
    ((assignmentsRes.data ?? []) as Record<string, unknown>[]).map(
      toAssignmentRow,
    ),
  );
  const invitations = (
    (invitationsRes.data ?? []) as Record<string, unknown>[]
  ).map(toInvitationRow);
  const joinCodes = (
    (joinCodesRes.data ?? []) as Record<string, unknown>[]
  ).map(toJoinCodeRow);
  const scheduleRangeStart = toIsoDate(addDays(new Date(), -7));
  const scheduleRangeEnd = toIsoDate(addDays(new Date(), 90));
  const events = enrichClubEvents(
    (eventsRes.data ?? []) as Record<string, unknown>[],
    cohorts,
    scheduleRangeStart,
    scheduleRangeEnd,
  );
  const eventOccurrences = buildClubEventOccurrences(
    events,
    scheduleRangeStart,
    scheduleRangeEnd,
  );
  const attempts = await enrichAttempts(
    supabase,
    (attemptsRes.data ?? []) as Record<string, unknown>[],
    cohorts,
    assignments,
    members,
  );
  const reviewQueue = buildReviewQueue(
    (reviewsRes.data ?? []) as Record<string, unknown>[],
    attempts,
  );
  const attendanceByUser = new Map(
    members.map((member) => [member.userId, null]),
  );
  const completionByUser = buildCompletionByUser(
    members,
    assignments,
    attempts,
  );

  return {
    club: toClubListRow(clubRow as Record<string, unknown>),
    kpis: buildClubDashboardKpis({
      studentCount: members.filter(
        (member) => member.role === "student" && member.status === "active",
      ).length,
      cohortCount: cohorts.length,
      attendanceRate: numberOrNull(
        (clubRow as Record<string, unknown>).attendance_rate_30d,
      ),
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
    joinCodes,
    events,
    eventOccurrences,
    leaderboardSafety,
    organizationJoinCodesEnabled: ORGANIZATION_JOIN_CODES_ENABLED,
    qaEnabled: false,
    qaState: null,
    loadError,
  };
}

async function enrichMembers(
  supabase: Supabase,
  rows: Record<string, unknown>[],
): Promise<AdminClubMember[]> {
  const userIds = rows.map((row) => row.user_id as string).filter(Boolean);
  const profilesRes = userIds.length
    ? await supabase
        .from("profiles")
        .select("id, email, display_name")
        .in("id", userIds)
    : { data: [], error: null };
  const profilesById = new Map(
    (profilesRes.data ?? []).map((profile) => [profile.id as string, profile]),
  );

  return rows.map((row) => {
    const profile = profilesById.get(row.user_id as string);
    return {
      id: String(row.id),
      userId: String(row.user_id),
      displayName: String(profile?.display_name ?? profile?.email ?? "Student"),
      email: (profile?.email as string | null | undefined) ?? null,
      role: normalizeOrganizationRole(row.role, "student") ?? "student",
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
  members: AdminClubMember[],
): Promise<AdminClubPerformanceAttempt[]> {
  const memberById = new Map(members.map((member) => [member.userId, member]));
  const cohortById = new Map(cohorts.map((cohort) => [cohort.id, cohort]));
  const assignmentById = new Map(
    assignments.map((assignment) => [assignment.id, assignment]),
  );
  const missingUserIds = rows
    .map((row) => row.user_id as string)
    .filter((userId) => userId && !memberById.has(userId));
  const profilesRes = missingUserIds.length
    ? await supabase
        .from("profiles")
        .select("id, email, display_name")
        .in("id", missingUserIds)
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
    const cohort = row.class_id
      ? cohortById.get(row.class_id as string)
      : undefined;
    const assignment = row.assignment_id
      ? assignmentById.get(row.assignment_id as string)
      : undefined;
    return {
      id: String(row.id),
      userId: String(row.user_id),
      studentName:
        memberById.get(row.user_id as string)?.displayName ?? "Student",
      clubId: (row.club_id as string | null | undefined) ?? null,
      classId: (row.class_id as string | null | undefined) ?? null,
      classTitle: cohort?.title ?? null,
      assignmentId: (row.assignment_id as string | null | undefined) ?? null,
      assignmentTitle: assignment?.title ?? null,
      practiceTrack:
        row.practice_track === "speaking" || row.practice_track === "mun"
          ? row.practice_track
          : "debate",
      format: (row.format as string | null | undefined) ?? null,
      topicTitle: (row.topic_title as string | null | undefined) ?? null,
      durationSeconds: numberOrNull(row.duration_seconds),
      wordCount: numberOrNull(row.word_count),
      overallScore: numberOrNull(row.overall_score),
      overallBand: (row.overall_band as string | null | undefined) ?? null,
      skillScores: (row.skill_scores && typeof row.skill_scores === "object"
        ? row.skill_scores
        : {}) as Record<string, number>,
      occurredAt: String(row.occurred_at ?? new Date().toISOString()),
    };
  });
}

function buildReviewQueue(
  rows: Record<string, unknown>[],
  attempts: AdminClubPerformanceAttempt[],
): AdminClubReviewQueueItem[] {
  const attemptById = new Map(attempts.map((attempt) => [attempt.id, attempt]));
  const existing = rows.map((row) => {
    const attempt = attemptById.get(row.performance_attempt_id as string);
    const score = attempt?.overallScore ?? 0;
    return {
      id: String(row.id),
      attemptId: String(row.performance_attempt_id),
      studentName: attempt?.studentName ?? "Student",
      title:
        attempt?.assignmentTitle ?? attempt?.topicTitle ?? "Practice attempt",
      cohort: attempt?.classTitle ?? null,
      priority: score < 60 ? "high" : score < 72 ? "medium" : "low",
      submittedAt:
        attempt?.occurredAt ??
        String(row.created_at ?? new Date().toISOString()),
      status: row.status === "resolved" ? "resolved" : "open",
    } satisfies AdminClubReviewQueueItem;
  });

  const lowScoreAttempts = attempts
    .filter((attempt) => (attempt.overallScore ?? 100) < 72)
    .slice(0, Math.max(0, 6 - existing.length))
    .map(
      (attempt) =>
        ({
          id: `${attempt.id}-auto-review`,
          attemptId: attempt.id,
          studentName: attempt.studentName,
          title:
            attempt.assignmentTitle ?? attempt.topicTitle ?? "Practice attempt",
          cohort: attempt.classTitle,
          priority: (attempt.overallScore ?? 0) < 60 ? "high" : "medium",
          submittedAt: attempt.occurredAt,
          status: "open",
        }) satisfies AdminClubReviewQueueItem,
    );

  return [...existing, ...lowScoreAttempts];
}

function buildCompletionByUser(
  members: AdminClubMember[],
  assignments: AdminClubAssignmentRow[],
  attempts: AdminClubPerformanceAttempt[],
) {
  const activeAssignments = assignments.filter(
    (assignment) => assignment.status === "active",
  );
  const attemptsByUser = new Map<string, number>();
  for (const attempt of attempts) {
    if (!attempt.assignmentId) continue;
    attemptsByUser.set(
      attempt.userId,
      (attemptsByUser.get(attempt.userId) ?? 0) + 1,
    );
  }

  return new Map(
    members
      .filter((member) => member.role === "student")
      .map((member) => [
        member.userId,
        activeAssignments.length
          ? Math.round(
              ((attemptsByUser.get(member.userId) ?? 0) /
                activeAssignments.length) *
                100,
            )
          : null,
      ]),
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

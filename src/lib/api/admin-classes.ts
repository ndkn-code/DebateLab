import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isDevAdminBypassEnabled } from "@/lib/dev-admin-bypass";
import { summarizeAttendanceRecords } from "@/lib/api/admin-classes-model";
import {
  DEFAULT_CLASS_TIMEZONE,
  expandScheduleOccurrences,
  getProgramLabel,
  normalizeClassProgram,
  normalizeRecurrenceRule,
  summarizeRecurrence,
} from "@/lib/api/admin-class-schedules-model";
import type {
  AdminClassAssignedCourse,
  AdminClassAttendanceSession,
  AdminClassDetailData,
  AdminClassProgram,
  AdminClassesKpis,
  AdminClassesPageData,
  AdminClassListRow,
  AdminClassRosterRow,
  AdminClassSchedule,
  AdminClassSchedulesData,
  AdminClassStatus,
  AttendanceStatus,
  ClassRecurrenceRule,
  ClassScheduleStatus,
} from "@/lib/types/admin-classes";

type Supabase = Awaited<ReturnType<typeof createClient>> | SupabaseClient;

type ClassRow = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  program_type?: AdminClassProgram | null;
  grade_level: string | null;
  status: AdminClassStatus;
  start_date: string | null;
  end_date: string | null;
  meeting_schedule: string | null;
  room: string | null;
  max_students: number | null;
  teacher_user_id?: string | null;
  created_by?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  student_count?: number | null;
  assigned_course_count?: number | null;
  attendance_rate_30d?: number | null;
  session_count_30d?: number | null;
  schedule_count?: number | null;
};

type ScheduleRow = {
  id: string;
  class_id: string;
  course_id: string | null;
  title: string;
  room: string | null;
  location: string | null;
  start_date: string;
  end_date: string | null;
  start_time: string;
  end_time: string;
  timezone: string | null;
  recurrence_rule: Partial<ClassRecurrenceRule> | null;
  recurrence_summary: string | null;
  status: ClassScheduleStatus;
  created_at: string;
  updated_at: string;
};

const DEFAULT_PAGE_SIZE = 12;

function toClassListRow(row: ClassRow): AdminClassListRow {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    description: row.description,
    programType: normalizeClassProgram(row.program_type),
    gradeLevel: row.grade_level,
    status: row.status,
    startDate: row.start_date,
    endDate: row.end_date,
    meetingSchedule: row.meeting_schedule,
    room: row.room,
    maxStudents: row.max_students,
    studentCount: row.student_count ?? 0,
    assignedCourseCount: row.assigned_course_count ?? 0,
    attendanceRate30d: row.attendance_rate_30d ?? null,
    sessionCount30d: row.session_count_30d ?? 0,
    scheduleCount: row.schedule_count ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function escapeLike(value: string) {
  return value.replace(/[,%()]/g, " ").trim();
}

function clampPage(value?: string | number | null) {
  const page = Number(value ?? 1);
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

function normalizeStatus(value?: string | null): AdminClassStatus | "all" {
  if (value === "draft" || value === "active" || value === "archived") return value;
  return "all";
}

function normalizeSort(value?: string | null): AdminClassesPageData["filters"]["sort"] {
  if (value === "oldest" || value === "title" || value === "attendance") return value;
  return "newest";
}

export async function getAdminClassesPageData({
  searchParams,
  pageSize = DEFAULT_PAGE_SIZE,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
  pageSize?: number;
} = {}): Promise<AdminClassesPageData> {
  const supabase = await createClient();
  const search = String(searchParams?.q ?? "").trim();
  const status = normalizeStatus(String(searchParams?.status ?? "all"));
  const sort = normalizeSort(String(searchParams?.sort ?? "newest"));
  const page = clampPage(String(searchParams?.page ?? "1"));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("admin_class_list_rows")
    .select("*", { count: "exact" });

  if (status !== "all") {
    query = query.eq("status", status);
  } else {
    query = query.neq("status", "archived");
  }

  const safeSearch = escapeLike(search);
  if (safeSearch) {
    query = query.or(
      `title.ilike.%${safeSearch}%,program_type.ilike.%${safeSearch}%,grade_level.ilike.%${safeSearch}%`
    );
  }

  if (sort === "oldest") query = query.order("created_at", { ascending: true });
  if (sort === "title") query = query.order("title", { ascending: true });
  if (sort === "attendance") {
    query = query.order("attendance_rate_30d", { ascending: false, nullsFirst: false });
  }
  if (sort === "newest") query = query.order("created_at", { ascending: false });

  const [{ data, error, count }, kpis] = await Promise.all([
    query.range(from, to),
    getAdminClassesKpis(supabase),
  ]);

  if (error) {
    if (isDevAdminBypassEnabled()) {
      return getDevClassesPageData({ search, status, sort, page, pageSize });
    }

    return {
      classes: [],
      kpis,
      page,
      pageSize,
      totalCount: 0,
      pageCount: 1,
      filters: { search, status, sort },
      loadError: error.message,
    };
  }

  const totalCount = count ?? 0;
  return {
    classes: ((data ?? []) as ClassRow[]).map(toClassListRow),
    kpis,
    page,
    pageSize,
    totalCount,
    pageCount: Math.max(1, Math.ceil(totalCount / pageSize)),
    filters: { search, status, sort },
    loadError: null,
  };
}

export async function getAdminClassSchedulesPageData({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
} = {}): Promise<AdminClassSchedulesData> {
  const supabase = await createClient();
  const range = normalizeScheduleRange(searchParams);
  const program = normalizeScheduleProgram(String(searchParams?.program ?? "all"));
  const level = String(searchParams?.level ?? "all").trim() || "all";

  const classQuery = supabase
    .from("admin_class_list_rows")
    .select("*")
    .neq("status", "archived")
    .order("program_type", { ascending: true })
    .order("grade_level", { ascending: true })
    .order("title", { ascending: true });

  const { data: classRows, error: classError } = await classQuery;
  if (classError) {
    if (isDevAdminBypassEnabled()) {
      return getDevSchedulesPageData(range.rangeStart, range.rangeEnd, program, level);
    }
    return emptySchedulesData(range.rangeStart, range.rangeEnd, program, level, classError.message);
  }

  let classes = ((classRows ?? []) as ClassRow[]).map(toClassListRow);
  if (program !== "all") classes = classes.filter((item) => item.programType === program);
  if (level !== "all") classes = classes.filter((item) => item.gradeLevel === level);

  const classIds = classes.map((item) => item.id);
  if (classIds.length === 0) {
    return buildSchedulesData([], [], range.rangeStart, range.rangeEnd, program, level, null);
  }

  const schedulesRes = await supabase
    .from("class_schedules")
    .select("*")
    .in("class_id", classIds)
    .eq("status", "active")
    .lte("start_date", range.rangeEnd)
    .or(`end_date.is.null,end_date.gte.${range.rangeStart}`)
    .order("start_date", { ascending: true });

  if (schedulesRes.error) {
    if (isDevAdminBypassEnabled()) {
      return getDevSchedulesPageData(range.rangeStart, range.rangeEnd, program, level);
    }
    return buildSchedulesData(classes, [], range.rangeStart, range.rangeEnd, program, level, schedulesRes.error.message);
  }

  const schedules = await enrichSchedules(
    supabase,
    (schedulesRes.data ?? []) as ScheduleRow[],
    classes,
    range.rangeStart,
    range.rangeEnd
  );
  return buildSchedulesData(classes, schedules, range.rangeStart, range.rangeEnd, program, level, null);
}

function normalizeScheduleRange(searchParams?: Record<string, string | string[] | undefined>) {
  const today = new Date();
  const defaultStart = toIsoDate(addDays(today, -7));
  const defaultEnd = toIsoDate(addDays(today, 45));
  const rangeStart = normalizeIsoDate(String(searchParams?.start ?? searchParams?.rangeStart ?? "")) ?? defaultStart;
  const rangeEnd = normalizeIsoDate(String(searchParams?.end ?? searchParams?.rangeEnd ?? "")) ?? defaultEnd;
  return rangeStart <= rangeEnd
    ? { rangeStart, rangeEnd }
    : { rangeStart: rangeEnd, rangeEnd: rangeStart };
}

function normalizeScheduleProgram(value: string): AdminClassProgram | "all" {
  if (value === "debate" || value === "ielts" || value === "public_speaking") return value;
  return "all";
}

function normalizeIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function emptySchedulesData(
  rangeStart: string,
  rangeEnd: string,
  program: AdminClassProgram | "all",
  level: string,
  loadError: string | null
): AdminClassSchedulesData {
  return buildSchedulesData([], [], rangeStart, rangeEnd, program, level, loadError);
}

async function enrichSchedules(
  supabase: Supabase,
  rows: ScheduleRow[],
  classes: AdminClassListRow[],
  rangeStart: string,
  rangeEnd: string
): Promise<AdminClassSchedule[]> {
  const classById = new Map(classes.map((classInfo) => [classInfo.id, classInfo]));
  const courseIds = Array.from(new Set(rows.map((row) => row.course_id).filter(Boolean) as string[]));
  const coursesRes = courseIds.length
    ? await supabase.from("courses").select("id, title").in("id", courseIds)
    : { data: [], error: null };
  const courseTitleById = new Map((coursesRes.data ?? []).map((course) => [course.id as string, course.title as string]));

  return rows.flatMap((row) => {
    const classInfo = classById.get(row.class_id);
    if (!classInfo) return [];
    const rule = normalizeRecurrenceRule(row.recurrence_rule, row.start_date);
    const summary = row.recurrence_summary ?? summarizeRecurrence(rule, row.start_date);
    const expansionSource = {
      id: row.id,
      startDate: row.start_date,
      endDate: row.end_date,
      startTime: normalizeTime(row.start_time),
      endTime: normalizeTime(row.end_time),
      recurrenceRule: rule,
    };
    const occurrences = expandScheduleOccurrences(expansionSource, rangeStart, rangeEnd);
    return [{
      id: row.id,
      classId: row.class_id,
      classTitle: classInfo.title,
      classProgramType: classInfo.programType,
      classLevel: classInfo.gradeLevel,
      courseId: row.course_id,
      courseTitle: row.course_id ? courseTitleById.get(row.course_id) ?? null : null,
      title: row.title,
      room: row.room,
      location: row.location,
      startDate: row.start_date,
      endDate: row.end_date,
      startTime: normalizeTime(row.start_time),
      endTime: normalizeTime(row.end_time),
      timezone: row.timezone ?? DEFAULT_CLASS_TIMEZONE,
      recurrenceRule: rule,
      recurrenceSummary: summary,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      occurrenceCount: occurrences.length,
      nextOccurrenceDate: occurrences.find((item) => item.date >= toIsoDate(new Date()))?.date ?? occurrences[0]?.date ?? null,
    }];
  });
}

function buildSchedulesData(
  classes: AdminClassListRow[],
  schedules: AdminClassSchedule[],
  rangeStart: string,
  rangeEnd: string,
  program: AdminClassProgram | "all",
  level: string,
  loadError: string | null
): AdminClassSchedulesData {
  const occurrences = schedules.flatMap((schedule) =>
    expandScheduleOccurrences({
      id: schedule.id,
      startDate: schedule.startDate,
      endDate: schedule.endDate,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      recurrenceRule: schedule.recurrenceRule,
    }, rangeStart, rangeEnd).map((occurrence) => ({
      id: `${schedule.id}-${occurrence.date}`,
      scheduleId: schedule.id,
      classId: schedule.classId,
      classTitle: schedule.classTitle,
      classProgramType: schedule.classProgramType,
      classLevel: schedule.classLevel,
      courseId: schedule.courseId,
      courseTitle: schedule.courseTitle,
      title: schedule.title,
      room: schedule.room,
      location: schedule.location,
      date: occurrence.date,
      startsAt: occurrence.startsAt,
      endsAt: occurrence.endsAt,
      recurrenceSummary: schedule.recurrenceSummary,
    }))
  ).sort((a, b) => a.date.localeCompare(b.date) || a.startsAt.localeCompare(b.startsAt));

  const classIdsWithSchedules = new Set(schedules.map((schedule) => schedule.classId));
  const weeklyHours = schedules.reduce((sum, schedule) => sum + estimateWeeklyScheduleHours(schedule), 0);

  return {
    schedules,
    occurrences,
    classes,
    filters: { rangeStart, rangeEnd, program, level },
    kpis: {
      upcomingMeetings: occurrences.length,
      activeSchedules: schedules.length,
      scheduledClasses: classIdsWithSchedules.size,
      weeklyHours: Math.round(weeklyHours * 10) / 10,
    },
    loadError,
  };
}

function normalizeTime(value: string) {
  return value.length === 5 ? `${value}:00` : value;
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

function estimateWeeklyScheduleHours(schedule: AdminClassSchedule) {
  const duration = Math.max(0, timeToMinutes(schedule.endTime) - timeToMinutes(schedule.startTime)) / 60;
  const interval = Math.max(1, schedule.recurrenceRule.interval || 1);
  if (schedule.recurrenceRule.frequency === "daily") return (duration * 5) / interval;
  if (schedule.recurrenceRule.frequency === "weekly") {
    return (duration * Math.max(1, schedule.recurrenceRule.weekdays.length)) / interval;
  }
  if (schedule.recurrenceRule.frequency === "monthly") return duration / (4 * interval);
  return 0;
}

async function getAdminClassesKpis(supabase: Supabase): Promise<AdminClassesKpis> {
  const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const [
    totalClasses,
    activeClasses,
    totalStudents,
    assignedCourses,
    sessions,
  ] = await Promise.all([
    supabase.from("classes").select("*", { count: "exact", head: true }),
    supabase.from("classes").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabase
      .from("class_memberships")
      .select("*", { count: "exact", head: true })
      .eq("member_role", "student")
      .eq("status", "active"),
    supabase.from("class_course_assignments").select("*", { count: "exact", head: true }),
    supabase
      .from("class_attendance_sessions")
      .select("id, class_attendance_records(status)")
      .gte("session_date", cutoff),
  ]);

  if (
    totalClasses.error ||
    activeClasses.error ||
    totalStudents.error ||
    assignedCourses.error ||
    sessions.error
  ) {
    return getDevKpis();
  }

  const records = (sessions.data ?? []).flatMap((session) =>
    Array.isArray(session.class_attendance_records)
      ? session.class_attendance_records
      : []
  );
  const attendance = summarizeAttendanceRecords(records);

  return {
    totalClasses: totalClasses.count ?? 0,
    activeClasses: activeClasses.count ?? 0,
    totalStudents: totalStudents.count ?? 0,
    assignedCourses: assignedCourses.count ?? 0,
    attendanceRate30d: attendance.attendanceRate,
    sessions30d: sessions.data?.length ?? 0,
  };
}

export async function getAdminClassDetail(
  classId: string
): Promise<AdminClassDetailData | null> {
  if (isDevAdminBypassEnabled() && classId.startsWith("00000000-0000-4500-8000-")) {
    return getDevClassDetail(classId);
  }

  const supabase = await createClient();
  const { data: classRow, error: classError } = await supabase
    .from("classes")
    .select("*")
    .eq("id", classId)
    .single();

  if (classError || !classRow) {
    if (isDevAdminBypassEnabled()) return getDevClassDetail(classId);
    return null;
  }

  const [
    membershipsRes,
    assignmentsRes,
    sessionsRes,
    schedulesRes,
  ] = await Promise.all([
    supabase
      .from("class_memberships")
      .select("id, user_id, member_role, status, joined_at")
      .eq("class_id", classId)
      .eq("status", "active")
      .order("joined_at", { ascending: true }),
    supabase
      .from("class_course_assignments")
      .select("id, course_id, assigned_at")
      .eq("class_id", classId)
      .order("assigned_at", { ascending: false }),
    supabase
      .from("class_attendance_sessions")
      .select("id, class_id, course_id, session_date, title, notes, created_at")
      .eq("class_id", classId)
      .order("session_date", { ascending: false })
      .limit(12),
    supabase
      .from("class_schedules")
      .select("*")
      .eq("class_id", classId)
      .neq("status", "archived")
      .order("start_date", { ascending: true }),
  ]);

  if (membershipsRes.error || assignmentsRes.error || sessionsRes.error || schedulesRes.error) {
    return {
      classInfo: {
        ...toClassListRow({ ...(classRow as ClassRow), student_count: 0 }),
        teacherUserId: classRow.teacher_user_id ?? null,
        createdBy: classRow.created_by ?? null,
        metadata: classRow.metadata ?? {},
      },
      roster: [],
      assignedCourses: [],
      attendanceSessions: [],
      attendanceGrid: { sessions: [], students: [] },
      schedules: [],
      scheduleOccurrences: [],
      loadError:
        membershipsRes.error?.message ??
        assignmentsRes.error?.message ??
        sessionsRes.error?.message ??
        schedulesRes.error?.message ??
        "Failed to load class detail",
    };
  }

  const memberships = (membershipsRes.data ?? []) as Array<{
    id: string;
    user_id: string;
    member_role: "student" | "teacher";
    status: "active" | "removed";
    joined_at: string;
  }>;
  const userIds = memberships.map((membership) => membership.user_id);
  const courseIds = (assignmentsRes.data ?? []).map((assignment) => assignment.course_id as string);
  const sessionRows = sessionsRes.data ?? [];
  const sessionIds = sessionRows.map((session) => session.id as string);

  const [
    profilesRes,
    coursesRes,
    recordsRes,
    recentSessionsRes,
  ] = await Promise.all([
    userIds.length
      ? supabase
          .from("profiles")
          .select("id, email, display_name, avatar_url, role")
          .in("id", userIds)
      : Promise.resolve({ data: [], error: null }),
    courseIds.length
      ? supabase
          .from("courses")
          .select("id, title, slug, category, difficulty, thumbnail_url, is_published, visibility")
          .in("id", courseIds)
      : Promise.resolve({ data: [], error: null }),
    sessionIds.length
      ? supabase
          .from("class_attendance_records")
          .select("id, session_id, user_id, status, notes")
          .in("session_id", sessionIds)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("class_attendance_sessions")
      .select("id, class_id, course_id, session_date")
      .eq("class_id", classId)
      .gte("session_date", new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)),
  ]);

  const recentSessionIds = (recentSessionsRes.data ?? []).map((session) => session.id as string);
  const recentRecordsRes = recentSessionIds.length
    ? await supabase
        .from("class_attendance_records")
        .select("session_id, user_id, status")
        .in("session_id", recentSessionIds)
    : { data: [], error: null };

  const profilesById = new Map(
    (profilesRes.data ?? []).map((profile) => [profile.id as string, profile])
  );
  const coursesById = new Map(
    (coursesRes.data ?? []).map((course) => [course.id as string, course])
  );
  const recordsBySessionId = new Map<string, Array<{ status: AttendanceStatus; user_id: string }>>();

  for (const record of (recordsRes.data ?? []) as Array<{ session_id: string; user_id: string; status: AttendanceStatus }>) {
    const list = recordsBySessionId.get(record.session_id) ?? [];
    list.push(record);
    recordsBySessionId.set(record.session_id, list);
  }

  const recentRecordsByUser = new Map<string, Array<{ status: AttendanceStatus }>>();
  for (const record of (recentRecordsRes.data ?? []) as Array<{ user_id: string; status: AttendanceStatus }>) {
    const list = recentRecordsByUser.get(record.user_id) ?? [];
    list.push(record);
    recentRecordsByUser.set(record.user_id, list);
  }

  const roster: AdminClassRosterRow[] = memberships
    .filter((membership) => membership.member_role === "student")
    .map((membership) => {
      const profile = profilesById.get(membership.user_id);
      const summary = summarizeAttendanceRecords(recentRecordsByUser.get(membership.user_id) ?? []);
      return {
        membershipId: membership.id,
        id: membership.user_id,
        displayName:
          String(profile?.display_name ?? "") ||
          String(profile?.email ?? "").split("@")[0] ||
          "Unnamed student",
        email: (profile?.email as string | null | undefined) ?? null,
        avatarUrl: (profile?.avatar_url as string | null | undefined) ?? null,
        role: (profile?.role as string | null | undefined) ?? null,
        memberRole: membership.member_role,
        status: membership.status,
        joinedAt: membership.joined_at,
        attendanceRate30d: summary.attendanceRate,
        present30d: summary.present,
        late30d: summary.late,
        absent30d: summary.absent,
      };
    });

  const assignedCourses: AdminClassAssignedCourse[] = (assignmentsRes.data ?? [])
    .flatMap((assignment) => {
      const course = coursesById.get(assignment.course_id as string);
      if (!course) return [];
      return [{
        assignmentId: assignment.id as string,
        courseId: course.id as string,
        title: course.title as string,
        slug: course.slug as string,
        category: (course.category as string | null | undefined) ?? null,
        difficulty: (course.difficulty as string | null | undefined) ?? null,
        thumbnailUrl: (course.thumbnail_url as string | null | undefined) ?? null,
        isPublished: Boolean(course.is_published),
        visibility: String(course.visibility ?? "public"),
        assignedAt: assignment.assigned_at as string,
      }];
    });

  const assignedCourseTitleById = new Map(
    assignedCourses.map((course) => [course.courseId, course.title])
  );
  const attendanceSessions: AdminClassAttendanceSession[] = sessionRows.map((session) => {
    const records = recordsBySessionId.get(session.id as string) ?? [];
    const summary = summarizeAttendanceRecords(records);
    return {
      id: session.id as string,
      classId,
      courseId: session.course_id as string,
      courseTitle: assignedCourseTitleById.get(session.course_id as string) ?? "Assigned course",
      sessionDate: session.session_date as string,
      title: (session.title as string | null | undefined) ?? null,
      notes: (session.notes as string | null | undefined) ?? null,
      present: summary.present,
      late: summary.late,
      absent: summary.absent,
      total: summary.total,
      attendanceRate: summary.attendanceRate,
      createdAt: session.created_at as string,
    };
  });

  const detailClassInfo = toClassListRow({
    ...(classRow as ClassRow),
    student_count: roster.length,
    assigned_course_count: assignedCourses.length,
    attendance_rate_30d: summarizeAttendanceRecords(
      [...recentRecordsByUser.values()].flat()
    ).attendanceRate,
    session_count_30d: recentSessionsRes.data?.length ?? 0,
    schedule_count: schedulesRes.data?.length ?? 0,
  });
  const scheduleRangeStart = toIsoDate(addDays(new Date(), -7));
  const scheduleRangeEnd = toIsoDate(addDays(new Date(), 90));
  const schedules = await enrichSchedules(
    supabase,
    (schedulesRes.data ?? []) as ScheduleRow[],
    [detailClassInfo],
    scheduleRangeStart,
    scheduleRangeEnd
  );
  const scheduleData = buildSchedulesData(
    [detailClassInfo],
    schedules,
    scheduleRangeStart,
    scheduleRangeEnd,
    "all",
    "all",
    null
  );

  return {
    classInfo: {
      ...detailClassInfo,
      teacherUserId: classRow.teacher_user_id ?? null,
      createdBy: classRow.created_by ?? null,
      metadata: classRow.metadata ?? {},
    },
    roster,
    assignedCourses,
    attendanceSessions,
    attendanceGrid: {
      sessions: attendanceSessions,
      students: roster.map((student) => {
        const attendance: Record<string, AttendanceStatus> = {};
        for (const session of attendanceSessions) {
          const record = (recordsBySessionId.get(session.id) ?? [])
            .find((item) => item.user_id === student.id);
          if (record) attendance[session.id] = record.status;
        }
        return { ...student, attendance };
      }),
    },
    schedules,
    scheduleOccurrences: scheduleData.occurrences,
    loadError: profilesRes.error?.message ?? coursesRes.error?.message ?? recordsRes.error?.message ?? null,
  };
}

function getDevKpis(): AdminClassesKpis {
  return {
    totalClasses: 12,
    activeClasses: 10,
    totalStudents: 248,
    assignedCourses: 27,
    attendanceRate30d: 89,
    sessions30d: 36,
  };
}

const DEV_CLASSES: AdminClassListRow[] = [
  ["00000000-0000-4500-8000-000000000101", "DEB-2026-S1", "Intro Debate Cohort", "Introductory debate concepts and confident communication.", "debate", "Beginner", "active", "2026-05-01", "2026-07-31", "Tues & Thu 4:00 - 5:30 PM", "Room 204", 28, 3, 92, 14, 2],
  ["00000000-0000-4500-8000-000000000102", "PS-2026-HS", "Public Speaking 101", "Speaking workshop for high school students.", "public_speaking", "Beginner", "active", "2026-04-15", "2026-05-31", "Mon 5:00 - 6:30 PM", "Room 108", 24, 2, 88, 9, 1],
  ["00000000-0000-4500-8000-000000000103", "DEB-2026-A", "Advanced Argumentation", "A sharper track for rebuttal and weighing.", "debate", "Advanced", "active", "2026-03-10", "2026-06-10", "Wed 4:30 - 6:00 PM", "Room 302", 32, 3, 85, 12, 1],
  ["00000000-0000-4500-8000-000000000104", "IELTS-2026-F", "IELTS Writing Lab", "Focused writing and speaking practice for IELTS learners.", "ielts", "Band 6.5-7.5", "active", "2026-01-20", "2026-07-30", "Sat 10:00 - 11:30 AM", "Room 401", 26, 2, 76, 8, 1],
].map(([id, code, title, description, programType, gradeLevel, status, startDate, endDate, meetingSchedule, room, studentCount, assignedCourseCount, attendanceRate30d, sessionCount30d, scheduleCount]) => ({
  id: String(id),
  code: String(code),
  title: String(title),
  description: String(description),
  programType: programType as AdminClassProgram,
  gradeLevel: String(gradeLevel),
  status: status as AdminClassStatus,
  startDate: String(startDate),
  endDate: String(endDate),
  meetingSchedule: String(meetingSchedule),
  room: String(room),
  maxStudents: Number(studentCount),
  studentCount: Number(studentCount),
  assignedCourseCount: Number(assignedCourseCount),
  attendanceRate30d: Number(attendanceRate30d),
  sessionCount30d: Number(sessionCount30d),
  scheduleCount: Number(scheduleCount),
  createdAt: "2026-05-01T00:00:00.000Z",
  updatedAt: "2026-05-08T00:00:00.000Z",
}));

function getDevClassesPageData({
  search,
  status,
  sort,
  page,
  pageSize,
}: {
  search: string;
  status: AdminClassStatus | "all";
  sort: AdminClassesPageData["filters"]["sort"];
  page: number;
  pageSize: number;
}): AdminClassesPageData {
  const normalizedSearch = search.toLowerCase();
  let classes = DEV_CLASSES.filter((item) => {
    const matchesStatus = status === "all" || item.status === status;
    const matchesSearch = !normalizedSearch ||
      item.title.toLowerCase().includes(normalizedSearch) ||
      getProgramLabel(item.programType).toLowerCase().includes(normalizedSearch) ||
      (item.gradeLevel ?? "").toLowerCase().includes(normalizedSearch);
    return matchesStatus && matchesSearch;
  });

  if (sort === "oldest") classes = [...classes].reverse();
  if (sort === "title") classes = [...classes].sort((a, b) => a.title.localeCompare(b.title));
  if (sort === "attendance") {
    classes = [...classes].sort((a, b) => (b.attendanceRate30d ?? 0) - (a.attendanceRate30d ?? 0));
  }

  const totalCount = classes.length;
  return {
    classes: classes.slice((page - 1) * pageSize, page * pageSize),
    kpis: getDevKpis(),
    page,
    pageSize,
    totalCount,
    pageCount: Math.max(1, Math.ceil(totalCount / pageSize)),
    filters: { search, status, sort },
    loadError: null,
  };
}

const DEV_SCHEDULES: AdminClassSchedule[] = [
  {
    id: "00000000-0000-4800-8000-000000000101",
    classId: "00000000-0000-4500-8000-000000000101",
    classTitle: "Intro Debate Cohort",
    classProgramType: "debate",
    classLevel: "Beginner",
    courseId: "00000000-0000-4600-8000-000000000002",
    courseTitle: "Debate Fundamentals",
    title: "Debate Basics A",
    room: "Room 204",
    location: null,
    startDate: "2026-05-04",
    endDate: "2026-07-31",
    startTime: "16:00:00",
    endTime: "17:30:00",
    timezone: DEFAULT_CLASS_TIMEZONE,
    recurrenceRule: normalizeRecurrenceRule({ frequency: "weekly", interval: 1, weekdays: ["MO", "TH"], endMode: "on_date", until: "2026-07-31" }, "2026-05-04"),
    recurrenceSummary: "Weekly on Mon, Thu from May 4, 2026 until Jul 31, 2026",
    status: "active",
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-08T00:00:00.000Z",
    occurrenceCount: 0,
    nextOccurrenceDate: null,
  },
  {
    id: "00000000-0000-4800-8000-000000000102",
    classId: "00000000-0000-4500-8000-000000000103",
    classTitle: "Advanced Argumentation",
    classProgramType: "debate",
    classLevel: "Advanced",
    courseId: "00000000-0000-4600-8000-000000000003",
    courseTitle: "Argument Building",
    title: "Case Construction",
    room: "Room 302",
    location: null,
    startDate: "2026-05-06",
    endDate: "2026-06-10",
    startTime: "17:30:00",
    endTime: "19:00:00",
    timezone: DEFAULT_CLASS_TIMEZONE,
    recurrenceRule: normalizeRecurrenceRule({ frequency: "weekly", interval: 1, weekdays: ["WE"], endMode: "on_date", until: "2026-06-10" }, "2026-05-06"),
    recurrenceSummary: "Weekly on Wed from May 6, 2026 until Jun 10, 2026",
    status: "active",
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-08T00:00:00.000Z",
    occurrenceCount: 0,
    nextOccurrenceDate: null,
  },
  {
    id: "00000000-0000-4800-8000-000000000103",
    classId: "00000000-0000-4500-8000-000000000104",
    classTitle: "IELTS Writing Lab",
    classProgramType: "ielts",
    classLevel: "Band 6.5-7.5",
    courseId: null,
    courseTitle: null,
    title: "IELTS Writing",
    room: "Room 401",
    location: null,
    startDate: "2026-05-05",
    endDate: "2026-07-30",
    startTime: "19:00:00",
    endTime: "20:30:00",
    timezone: DEFAULT_CLASS_TIMEZONE,
    recurrenceRule: normalizeRecurrenceRule({ frequency: "weekly", interval: 1, weekdays: ["TU", "TH"], endMode: "on_date", until: "2026-07-30" }, "2026-05-05"),
    recurrenceSummary: "Weekly on Tue, Thu from May 5, 2026 until Jul 30, 2026",
    status: "active",
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-08T00:00:00.000Z",
    occurrenceCount: 0,
    nextOccurrenceDate: null,
  },
  {
    id: "00000000-0000-4800-8000-000000000104",
    classId: "00000000-0000-4500-8000-000000000102",
    classTitle: "Public Speaking 101",
    classProgramType: "public_speaking",
    classLevel: "Beginner",
    courseId: "00000000-0000-4600-8000-000000000001",
    courseTitle: "Public Speaking 101",
    title: "Presentation Mastery",
    room: "Room 108",
    location: null,
    startDate: "2026-05-09",
    endDate: "2026-05-31",
    startTime: "10:00:00",
    endTime: "12:00:00",
    timezone: DEFAULT_CLASS_TIMEZONE,
    recurrenceRule: normalizeRecurrenceRule({ frequency: "weekly", interval: 1, weekdays: ["SA"], endMode: "on_date", until: "2026-05-31" }, "2026-05-09"),
    recurrenceSummary: "Weekly on Sat from May 9, 2026 until May 31, 2026",
    status: "active",
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-08T00:00:00.000Z",
    occurrenceCount: 0,
    nextOccurrenceDate: null,
  },
];

function getDevSchedulesPageData(
  rangeStart: string,
  rangeEnd: string,
  program: AdminClassProgram | "all",
  level: string
): AdminClassSchedulesData {
  let classes = DEV_CLASSES;
  if (program !== "all") classes = classes.filter((item) => item.programType === program);
  if (level !== "all") classes = classes.filter((item) => item.gradeLevel === level);
  const classIds = new Set(classes.map((item) => item.id));
  const schedules = DEV_SCHEDULES.filter((schedule) => classIds.has(schedule.classId));
  return buildSchedulesData(classes, schedules, rangeStart, rangeEnd, program, level, null);
}

function getDevClassDetail(classId: string): AdminClassDetailData {
  const classInfo = DEV_CLASSES.find((item) => item.id === classId) ?? DEV_CLASSES[0];
  const roster: AdminClassRosterRow[] = [
    ["00000000-0000-4000-8000-000000000201", "Alex Lee", "alex.lee@riverside.edu", 92, 8, 1, 0],
    ["00000000-0000-4000-8000-000000000202", "Jamie Martinez", "jamie.martinez@riverside.edu", 88, 7, 2, 0],
    ["00000000-0000-4000-8000-000000000203", "Sara Rahman", "sara.rahman@riverside.edu", 85, 7, 1, 1],
    ["00000000-0000-4000-8000-000000000204", "David Wu", "david.wu@riverside.edu", 83, 6, 1, 2],
    ["00000000-0000-4000-8000-000000000205", "Tyler Young", "tyler.young@riverside.edu", 79, 6, 2, 2],
  ].map(([id, displayName, email, attendanceRate30d, present30d, late30d, absent30d]) => ({
    membershipId: `${id}-membership`,
    id: String(id),
    displayName: String(displayName),
    email: String(email),
    avatarUrl: null,
    role: "student",
    memberRole: "student",
    status: "active",
    joinedAt: "2026-05-01T00:00:00.000Z",
    attendanceRate30d: Number(attendanceRate30d),
    present30d: Number(present30d),
    late30d: Number(late30d),
    absent30d: Number(absent30d),
  }));

  const assignedCourses: AdminClassAssignedCourse[] = [
    ["00000000-0000-4600-8000-000000000001", "Public Speaking 101", "Core Skills"],
    ["00000000-0000-4600-8000-000000000002", "Debate Fundamentals", "Foundations"],
    ["00000000-0000-4600-8000-000000000003", "Argument Building", "Core Skills"],
  ].map(([courseId, title, category], index) => ({
    assignmentId: `${courseId}-assignment`,
    courseId: String(courseId),
    title: String(title),
    slug: String(title).toLowerCase().replace(/\s+/g, "-"),
    category: String(category),
    difficulty: index === 0 ? "beginner" : "intermediate",
    thumbnailUrl: null,
    isPublished: true,
    visibility: "class_restricted",
    assignedAt: "2026-05-01T00:00:00.000Z",
  }));

  const attendanceSessions: AdminClassAttendanceSession[] = [
    ["00000000-0000-4700-8000-000000000001", assignedCourses[0].courseId, "Public Speaking 101", "2026-05-06", 20, 2, 2],
    ["00000000-0000-4700-8000-000000000002", assignedCourses[0].courseId, "Public Speaking 101", "2026-05-04", 21, 1, 2],
    ["00000000-0000-4700-8000-000000000003", assignedCourses[1].courseId, "Debate Fundamentals", "2026-05-01", 18, 3, 3],
  ].map(([id, courseId, courseTitle, sessionDate, present, late, absent]) => {
    const total = Number(present) + Number(late) + Number(absent);
    return {
      id: String(id),
      classId: classInfo.id,
      courseId: String(courseId),
      courseTitle: String(courseTitle),
      sessionDate: String(sessionDate),
      title: null,
      notes: null,
      present: Number(present),
      late: Number(late),
      absent: Number(absent),
      total,
      attendanceRate: Math.round(((Number(present) + Number(late)) / total) * 100),
      createdAt: `${sessionDate}T14:00:00.000Z`,
    };
  });
  const schedules = DEV_SCHEDULES.filter((schedule) => schedule.classId === classInfo.id);
  const scheduleData = buildSchedulesData(
    [classInfo],
    schedules,
    toIsoDate(addDays(new Date(), -7)),
    toIsoDate(addDays(new Date(), 90)),
    "all",
    "all",
    null
  );

  return {
    classInfo: {
      ...classInfo,
      teacherUserId: null,
      createdBy: null,
      metadata: {},
    },
    roster,
    assignedCourses,
    attendanceSessions,
    attendanceGrid: {
      sessions: attendanceSessions,
      students: roster.map((student, index) => ({
        ...student,
        attendance: Object.fromEntries(
          attendanceSessions.map((session, sessionIndex) => [
            session.id,
            (index + sessionIndex) % 5 === 0
              ? "absent"
              : (index + sessionIndex) % 3 === 0
                ? "late"
                : "present",
          ])
        ) as Record<string, AttendanceStatus>,
      })),
    },
    schedules,
    scheduleOccurrences: scheduleData.occurrences,
    loadError: null,
  };
}

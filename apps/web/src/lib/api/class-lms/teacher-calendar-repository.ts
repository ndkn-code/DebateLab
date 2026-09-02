import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createTypedServerClient } from "@/lib/supabase/server";
import { requireClassManagerDashboard } from "@/lib/api/class-manager-access";
import { normalizeOrganizationRole } from "@/lib/organizations/compatibility";
import { LMS_PILOT_FEATURE_KEY } from "./model";
import {
  resolveTeacherWorkspaceClassFeature,
  TEACHER_WORKSPACE_FEATURE_KEY,
} from "./teacher-workspace-capability";
import {
  normalizeClassProgram,
  type ClassRecurrenceRule,
} from "../admin-class-schedules-model";
import {
  TEACHER_CALENDAR_DEFAULT_TIMEZONE,
  TEACHER_CLASS_COLOR_TOKENS,
  expandTeacherScheduleOccurrences,
  normalizeTeacherCalendarPreferences,
  normalizeTeacherCalendarRange,
  sortTeacherCalendarEvents,
  type TeacherCalendarActionPermissions,
  type TeacherCalendarEvent,
  type TeacherCalendarEventDetail,
  type TeacherCalendarPreferences,
  type TeacherCalendarPreferencesInput,
  type TeacherCalendarRangeInput,
  type TeacherCalendarRangeResult,
  type TeacherCalendarStatus,
  type TeacherClassColorToken,
} from "./teacher-calendar-model";

type Row = Record<string, unknown>;
type Db = SupabaseClient;

const CALENDAR_STATUSES = new Set<TeacherCalendarStatus>([
  "scheduled",
  "completed",
  "cancelled",
  "archived",
]);
const DEFAULT_ACTIONS: TeacherCalendarActionPermissions = {
  viewClass: true,
  takeAttendance: true,
  reviewHomework: true,
  viewGradebook: true,
  planLesson: true,
  manageMaterials: true,
  postAnnouncement: true,
  reschedule: true,
  cancel: true,
  complete: true,
};

/** Server-only read model. Calendar callers never receive a Supabase client. */
export async function loadTeacherCalendarRange(
  input: TeacherCalendarRangeInput = {},
): Promise<TeacherCalendarRangeResult> {
  const session = await createTypedServerClient();
  const actorId = await requireClassManagerDashboard(session);
  const db = session as unknown as Db;
  const preferences = await loadPreferences(db, actorId);
  const range = normalizeTeacherCalendarRange({
    ...input,
    timezone: input.timezone ?? preferences.timezone,
    weekStart: input.weekStart ?? preferences.weekStart,
  });
  const managed = await loadManagedClasses(db, actorId);
  const classes = managed.classes
    .filter((row) => !input.classId || row.id === input.classId)
    .filter(
      (row) => !input.programType || row.programType === input.programType,
    );
  const allowedClassIds = new Set(classes.map((row) => row.id));
  if (input.classId && !allowedClassIds.has(input.classId))
    return { range, events: [], classes: [] };
  if (allowedClassIds.size === 0) return { range, events: [], classes: [] };

  const requestedStatuses = input.statuses?.filter(
    (value): value is TeacherCalendarStatus => CALENDAR_STATUSES.has(value),
  );
  // Completion belongs to an LMS occurrence, not to class_schedules. Query all
  // schedule states first, then apply the requested event status after enrichment.
  const scheduleStatuses = ["active", "cancelled", "archived"];
  const scheduleQuery = db
    .from("class_schedules")
    .select("*")
    .in("class_id", [...allowedClassIds])
    .lte("start_date", range.endDate)
    .or(`end_date.is.null,end_date.gte.${range.startDate}`)
    .in("status", scheduleStatuses)
    .order("start_date", { ascending: true })
    .order("id", { ascending: true });
  const scheduleResult = await scheduleQuery;
  if (scheduleResult.error)
    throw new Error(
      `loadTeacherCalendarRange(schedules): ${scheduleResult.error.message}`,
    );

  const schedules = (scheduleResult.data ?? []) as Row[];
  const occurrenceResult = await db
    .from("lms_lesson_occurrences")
    .select(
      "id, club_id, class_id, class_schedule_id, course_id, lesson_id, occurrence_date, starts_at, ends_at, timezone, title, notes, status, metadata, updated_at",
    )
    .in("class_id", [...allowedClassIds])
    .gte("occurrence_date", range.startDate)
    .lte("occurrence_date", range.endDate)
    .order("starts_at", { ascending: true })
    .order("id", { ascending: true });
  if (occurrenceResult.error) {
    throw new Error(
      `loadTeacherCalendarRange(occurrences): ${occurrenceResult.error.message}`,
    );
  }
  const occurrences = (occurrenceResult.data ?? []) as Row[];

  const scheduleOccurrences = schedules.flatMap((schedule) => {
    const source = toExpansionSource(schedule);
    return expandTeacherScheduleOccurrences(
      source,
      range.startDate,
      range.endDate,
    ).map((expanded) => ({ schedule, expanded }));
  });
  const occurrenceByScheduleDate = new Map<string, Row>();
  for (const occurrence of occurrences) {
    if (typeof occurrence.class_schedule_id === "string") {
      const key = `${occurrence.class_schedule_id}:${occurrence.occurrence_date}`;
      if (!occurrenceByScheduleDate.has(key))
        occurrenceByScheduleDate.set(key, occurrence);
    }
  }
  const usedOccurrenceIds = new Set<string>();
  for (const occurrence of occurrenceByScheduleDate.values())
    usedOccurrenceIds.add(String(occurrence.id));

  const eventInputs = scheduleOccurrences.map(({ schedule, expanded }) => ({
    schedule,
    expanded,
    occurrence:
      occurrenceByScheduleDate.get(`${schedule.id}:${expanded.date}`) ?? null,
  }));
  // Standalone planned lessons are included as well; they remain subject to the exact
  // managed-class set and are never allowed to create a second event for a linked schedule.
  for (const occurrence of occurrences) {
    if (
      usedOccurrenceIds.has(String(occurrence.id)) ||
      occurrence.class_schedule_id
    )
      continue;
    eventInputs.push({
      schedule: {
        id: String(occurrence.id),
        class_id: occurrence.class_id,
        course_id: occurrence.course_id,
        title: occurrence.title,
        room: null,
        location: null,
        start_date: occurrence.occurrence_date,
        end_date: occurrence.occurrence_date,
        start_time: String(occurrence.starts_at).slice(11, 19),
        end_time: String(occurrence.ends_at).slice(11, 19),
        timezone: occurrence.timezone,
        status: "active",
        metadata: occurrence.metadata ?? {},
        synthetic: true,
      },
      expanded: {
        scheduleId: String(occurrence.id),
        date: String(occurrence.occurrence_date),
        startsAt: String(occurrence.starts_at),
        endsAt: String(occurrence.ends_at),
      },
      occurrence,
    });
  }

  const [coursesResult, lessonsResult, colorResult, sessionsResult] =
    await Promise.all([
      collectIds(eventInputs, "course_id").length
        ? db
            .from("courses")
            .select("id, title")
            .in("id", collectIds(eventInputs, "course_id"))
        : Promise.resolve({ data: [], error: null }),
      collectIds(eventInputs, "lesson_id").length
        ? db
            .from("lessons")
            .select("id, title")
            .in("id", collectIds(eventInputs, "lesson_id"))
        : Promise.resolve({ data: [], error: null }),
      db
        .from("teacher_workspace_class_preferences")
        .select("class_id, color_token")
        .eq("user_id", actorId)
        .in("class_id", [...allowedClassIds]),
      db
        .from("class_attendance_sessions")
        .select("id, class_id, course_id, occurrence_id, session_date")
        .in("class_id", [...allowedClassIds])
        .gte("session_date", range.startDate)
        .lte("session_date", range.endDate),
    ]);
  if (coursesResult.error || lessonsResult.error || sessionsResult.error)
    throw new Error(
      `loadTeacherCalendarRange(enrichment): ${coursesResult.error?.message ?? lessonsResult.error?.message ?? sessionsResult.error?.message}`,
    );

  const sessionRows = (sessionsResult.data ?? []) as Row[];
  const sessionIds = ids(sessionRows, "id");
  const recordsResult = sessionIds.length
    ? await db
        .from("class_attendance_records")
        .select("session_id, status")
        .in("session_id", sessionIds)
    : { data: [], error: null };
  if (recordsResult.error)
    throw new Error(
      `loadTeacherCalendarRange(attendance): ${recordsResult.error.message}`,
    );
  const courseMap = new Map(
    ((coursesResult.data ?? []) as Row[]).map((row) => [
      String(row.id),
      String(row.title),
    ]),
  );
  const lessonMap = new Map(
    ((lessonsResult.data ?? []) as Row[]).map((row) => [
      String(row.id),
      String(row.title),
    ]),
  );
  const colors = new Map(
    ((colorResult.data ?? []) as Row[]).map((row) => [
      String(row.class_id),
      normalizeColor(row.color_token, String(row.class_id)),
    ]),
  );
  const attendance = buildAttendanceMap(
    sessionRows,
    (recordsResult.data ?? []) as Row[],
  );
  const classMap = new Map(managed.classes.map((row) => [row.id, row]));
  const events = sortTeacherCalendarEvents(
    eventInputs.flatMap(({ schedule, expanded, occurrence }) => {
      const classRow = classMap.get(String(schedule.class_id));
      if (!classRow) return [];
      const status = eventStatus(schedule, occurrence);
      if (requestedStatuses?.length && !requestedStatuses.includes(status))
        return [];
      const occurrenceMetadata = asObject(occurrence?.metadata);
      const session = sessionRows.find(
        (row) =>
          String(row.occurrence_id ?? "") === String(occurrence?.id ?? "") ||
          (String(row.class_id) === classRow.id &&
            String(row.course_id ?? "") ===
              String(occurrence?.course_id ?? schedule.course_id ?? "") &&
            String(row.session_date) === expanded.date),
      );
      return [
        {
          id: occurrence
            ? `occurrence:${occurrence.id}:${expanded.date}`
            : `${schedule.id}:${expanded.date}`,
          scheduleId: String(schedule.id),
          scheduleUpdatedAt: timestampOrNull(schedule.updated_at),
          occurrenceUpdatedAt: occurrence
            ? timestamp(occurrence.updated_at)
            : null,
          expectedUpdatedAt: timestamp(
            occurrence?.updated_at ?? schedule.updated_at,
          ),
          occurrenceId: occurrence ? String(occurrence.id) : null,
          classId: classRow.id,
          classTitle: classRow.title,
          programType: classRow.programType,
          courseId: stringOrNull(occurrence?.course_id ?? schedule.course_id),
          courseTitle:
            courseMap.get(
              String(occurrence?.course_id ?? schedule.course_id),
            ) ?? null,
          lessonId: stringOrNull(occurrence?.lesson_id),
          lessonTitle: lessonMap.get(String(occurrence?.lesson_id)) ?? null,
          title: String(occurrence?.title ?? schedule.title),
          date: expanded.date,
          startsAt: String(occurrence?.starts_at ?? expanded.startsAt),
          endsAt: String(occurrence?.ends_at ?? expanded.endsAt),
          timezone: String(
            occurrence?.timezone ?? schedule.timezone ?? range.timezone,
          ),
          status,
          scheduleStatus: normalizeScheduleStatus(schedule.status),
          location: stringOrNull(
            occurrenceMetadata.location ?? schedule.location,
          ),
          room: stringOrNull(occurrenceMetadata.room ?? schedule.room),
          meetingUrl: stringOrNull(
            occurrenceMetadata.meetingUrl ??
              occurrenceMetadata.meeting_url ??
              asObject(schedule.metadata).meetingUrl ??
              asObject(schedule.metadata).meeting_url,
          ),
          attendanceState: session
            ? attendance.get(String(session.id))?.recorded
              ? "taken"
              : "pending"
            : null,
          counts: { assignmentCount: 0, submissionCount: 0, reviewCount: 0 },
          colorToken:
            colors.get(classRow.id) ?? normalizeColor(null, classRow.id),
          actions: actionsFor(
            status,
            Boolean(occurrence),
            managed.roleByClass.get(classRow.id) ?? "teacher",
            !schedule.synthetic,
          ),
        } satisfies TeacherCalendarEvent,
      ];
    }),
  );

  // Assignment/review counts are fetched in one batch and merged by event ID.
  await enrichEventCounts(db, events);
  return {
    range,
    events,
    classes: classes.map((row) => ({
      ...row,
      colorToken: colors.get(row.id) ?? normalizeColor(null, row.id),
    })),
  };
}

export async function loadTeacherCalendarEventDetail(input: {
  eventId: string;
  date?: string;
  timezone?: string;
}): Promise<TeacherCalendarEventDetail> {
  const date = input.date ?? input.eventId.split(":").at(-1);
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    throw new Error("Invalid calendar event date");
  const page = await loadTeacherCalendarRange({
    startDate: date,
    endDate: date,
    timezone: input.timezone,
    view: "day",
  });
  const event =
    page.events.find((row) => row.id === input.eventId) ??
    page.events.find(
      (row) => row.date === date && row.scheduleId === input.eventId,
    );
  if (!event) throw new Error("Calendar event not found");
  const session = await createTypedServerClient();
  const db = session as unknown as Db;
  let attendanceQuery = db
    .from("class_attendance_sessions")
    .select("id")
    .eq("class_id", event.classId);
  attendanceQuery = event.occurrenceId
    ? attendanceQuery.eq("occurrence_id", event.occurrenceId)
    : attendanceQuery.eq("session_date", event.date);
  if (!event.occurrenceId && event.courseId)
    attendanceQuery = attendanceQuery.eq("course_id", event.courseId);
  const [linksResult, announcementsResult, attendanceResult] =
    await Promise.all([
      event.occurrenceId
        ? db
            .from("lms_occurrence_resources")
            .select("resource_id, required, order_index")
            .eq("occurrence_id", event.occurrenceId)
            .order("order_index")
        : Promise.resolve({ data: [], error: null }),
      db
        .from("lms_announcements")
        .select("id, title, body, status, publish_at")
        .eq("class_id", event.classId)
        .order("publish_at", { ascending: false })
        .limit(20),
      attendanceQuery.limit(1),
    ]);
  if (linksResult.error || announcementsResult.error || attendanceResult.error)
    throw new Error(
      `loadTeacherCalendarEventDetail: ${linksResult.error?.message ?? announcementsResult.error?.message ?? attendanceResult.error?.message}`,
    );
  const rosterProjection = await db.rpc("load_teacher_calendar_roster", {
    p_class_id: event.classId,
    p_occurrence_id: event.occurrenceId,
    p_session_date: event.date,
  });
  if (rosterProjection.error)
    throw new Error(
      `loadTeacherCalendarEventDetail(roster): ${rosterProjection.error.message}`,
    );
  const rosterRows = (rosterProjection.data ?? []) as Row[];
  const resourceIds = ids((linksResult.data ?? []) as Row[], "resource_id");
  const assignmentLinksResult = event.occurrenceId
    ? await db
        .from("lms_occurrence_assignments")
        .select("assignment_id, relation_type")
        .eq("occurrence_id", event.occurrenceId)
    : { data: [], error: null };
  if (assignmentLinksResult.error)
    throw new Error(
      `loadTeacherCalendarEventDetail(assignments): ${assignmentLinksResult.error.message}`,
    );
  const assignmentLinks = (assignmentLinksResult.data ?? []) as Row[];
  const assignmentIds = ids(assignmentLinks, "assignment_id");
  const [resourcesResult, assignmentsResult, submissionsResult, reviewsResult] =
    await Promise.all([
      resourceIds.length
        ? db
            .from("lms_resources")
            .select("id, title, kind")
            .in("id", resourceIds)
        : Promise.resolve({ data: [], error: null }),
      assignmentIds.length
        ? db
            .from("club_assignments")
            .select("id, title, due_at")
            .in("id", assignmentIds)
        : Promise.resolve({ data: [], error: null }),
      assignmentIds.length
        ? db
            .from("club_assignment_submissions")
            .select("assignment_id")
            .in("assignment_id", assignmentIds)
        : Promise.resolve({ data: [], error: null }),
      assignmentIds.length
        ? db
            .from("ielts_teacher_reviews")
            .select("assignment_id")
            .in("assignment_id", assignmentIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
  const failed = [
    resourcesResult,
    assignmentsResult,
    submissionsResult,
    reviewsResult,
  ].find((result) => result.error);
  if (failed?.error)
    throw new Error(
      `loadTeacherCalendarEventDetail(children): ${failed.error.message}`,
    );
  const sessionId =
    String((attendanceResult.data as Row[] | null)?.[0]?.id ?? "") || null;
  const recordsResult = sessionId
    ? await db
        .from("class_attendance_records")
        .select("status")
        .eq("session_id", sessionId)
    : { data: [], error: null };
  if (recordsResult.error)
    throw new Error(
      `loadTeacherCalendarEventDetail(attendance): ${recordsResult.error.message}`,
    );
  const attendanceRows = (recordsResult.data ?? []) as Row[];
  const counts = {
    present: attendanceRows.filter((row) => row.status === "present").length,
    late: attendanceRows.filter((row) => row.status === "late").length,
    absent: attendanceRows.filter((row) => row.status === "absent").length,
    recorded: attendanceRows.length,
  };
  return {
    ...event,
    rosterCount: rosterRows.length,
    roster: rosterRows.map((row) => ({
      id: String(row.user_id),
      name: String(row.display_name ?? "Student"),
      enrollmentStatus:
        row.enrollment_status === "removed_after_occurrence"
          ? ("removed_after_occurrence" as const)
          : ("enrolled" as const),
      status:
        row.attendance_status === "present" ||
        row.attendance_status === "late" ||
        row.attendance_status === "absent"
          ? (row.attendance_status as "present" | "late" | "absent")
          : ("unmarked" as const),
    })),
    lessonNotes: null,
    materials: ((linksResult.data ?? []) as Row[]).flatMap((link) => {
      const resource = ((resourcesResult.data ?? []) as Row[]).find(
        (row) => String(row.id) === String(link.resource_id),
      );
      return resource
        ? [
            {
              id: String(resource.id),
              title: String(resource.title),
              kind: String(resource.kind),
              required: Boolean(link.required),
            },
          ]
        : [];
    }),
    assignments: assignmentLinks.flatMap((link) => {
      const assignment = ((assignmentsResult.data ?? []) as Row[]).find(
        (row) => String(row.id) === String(link.assignment_id),
      );
      if (!assignment) return [];
      const assignmentId = String(assignment.id);
      return [
        {
          id: assignmentId,
          title: String(assignment.title),
          dueAt: stringOrNull(assignment.due_at),
          relationType: String(link.relation_type ?? "homework"),
          submissionCount: ((submissionsResult.data ?? []) as Row[]).filter(
            (row) => String(row.assignment_id) === assignmentId,
          ).length,
          reviewCount: ((reviewsResult.data ?? []) as Row[]).filter(
            (row) => String(row.assignment_id) === assignmentId,
          ).length,
        },
      ];
    }),
    attendance: { sessionId, ...counts },
    announcements: ((announcementsResult.data ?? []) as Row[]).map((row) => ({
      id: String(row.id),
      title: String(row.title),
      body: String(row.body ?? ""),
      status: String(row.status),
      publishAt: stringOrNull(row.publish_at),
    })),
    actionUrls: {
      viewClass: `/dashboard/teacher/classes/${event.classId}`,
      takeAttendance: `/dashboard/teacher/classes/${event.classId}?tab=attendance&date=${event.date}`,
      reviewHomework: `/dashboard/teacher/classes/${event.classId}?tab=review`,
      viewGradebook: `/dashboard/teacher/classes/${event.classId}?tab=gradebook`,
      planLesson: `/dashboard/teacher/classes/${event.classId}?tab=lessons&plan=${encodeURIComponent(event.id)}`,
      manageMaterials: `/dashboard/teacher/materials?classId=${event.classId}`,
      postAnnouncement: `/dashboard/teacher/classes/${event.classId}?tab=announcements`,
    },
  };
}

export async function saveTeacherCalendarPreferences(
  input: TeacherCalendarPreferencesInput,
): Promise<TeacherCalendarPreferences> {
  const session = await createTypedServerClient();
  const actorId = await requireClassManagerDashboard(session);
  const db = session as unknown as Db;
  const preferences = normalizeTeacherCalendarPreferences(input);
  const result = await db.from("teacher_workspace_preferences").upsert(
    {
      user_id: actorId,
      default_calendar_view: preferences.view,
      week_start: preferences.weekStart,
      working_hour_start: preferences.workingHours.start,
      working_hour_end: preferences.workingHours.end,
      timezone_mode: preferences.timezoneMode,
      timezone:
        preferences.timezoneMode === "fixed" ? preferences.timezone : null,
    },
    { onConflict: "user_id" },
  );
  if (result.error)
    throw new Error(`saveTeacherCalendarPreferences: ${result.error.message}`);
  return preferences;
}

export async function saveTeacherClassColor(input: {
  classId: string;
  colorToken: TeacherClassColorToken;
}): Promise<{ classId: string; colorToken: TeacherClassColorToken }> {
  if (!input.classId || !TEACHER_CLASS_COLOR_TOKENS.includes(input.colorToken))
    throw new Error("Invalid class color");
  const session = await createTypedServerClient();
  const actorId = await requireClassManagerDashboard(session);
  const db = session as unknown as Db;
  const managed = await loadManagedClasses(db, actorId);
  if (!managed.classes.some((row) => row.id === input.classId))
    throw new Error("Forbidden");
  const result = await db.from("teacher_workspace_class_preferences").upsert(
    {
      user_id: actorId,
      class_id: input.classId,
      color_token: input.colorToken,
    },
    { onConflict: "user_id,class_id" },
  );
  if (result.error)
    throw new Error(`saveTeacherClassColor: ${result.error.message}`);
  return input;
}

async function loadManagedClasses(db: Db, actorId: string) {
  const [
    profileResult,
    clubsResult,
    teacherResult,
    classesResult,
    flagsResult,
  ] = await Promise.all([
    db.from("profiles").select("role").eq("id", actorId).maybeSingle(),
    db
      .from("club_memberships")
      .select("club_id, role")
      .eq("user_id", actorId)
      .eq("status", "active")
      .in("role", ["owner", "admin", "head_teacher", "teacher", "coach"]),
    db
      .from("class_memberships")
      .select("class_id")
      .eq("user_id", actorId)
      .eq("member_role", "teacher")
      .eq("status", "active"),
    db
      .from("classes")
      .select("id, club_id, title, program_type, status")
      .eq("status", "active")
      .order("title", { ascending: true }),
    db
      .from("lms_pilot_flags")
      .select("club_id, class_id, feature_key, enabled")
      .in("feature_key", [
        TEACHER_WORKSPACE_FEATURE_KEY,
        LMS_PILOT_FEATURE_KEY,
      ]),
  ]);
  const failed = [
    profileResult,
    clubsResult,
    teacherResult,
    classesResult,
    flagsResult,
  ].find((result) => result.error);
  if (failed?.error)
    throw new Error(
      `loadTeacherCalendar authorization: ${failed.error.message}`,
    );
  const isPlatformAdmin = profileResult.data?.role === "admin";
  const ownerClubs = new Set(
    ((clubsResult.data ?? []) as Row[])
      .filter((row) => {
        const role = normalizeOrganizationRole(row.role);
        return role === "owner" || role === "admin" || role === "head_teacher";
      })
      .map((row) => String(row.club_id)),
  );
  const teacherClasses = new Set(
    ((teacherResult.data ?? []) as Row[]).map((row) => String(row.class_id)),
  );
  const flags = (flagsResult.data ?? []) as Row[];
  const enabled = (row: Row) =>
    resolveTeacherWorkspaceClassFeature({
      flags,
      organizationId: String(row.club_id),
      classId: String(row.id),
      programType: normalizeClassProgram(row.program_type),
    });
  const classes = ((classesResult.data ?? []) as Row[])
    .filter(
      (row) =>
        enabled(row) &&
        (isPlatformAdmin ||
          ownerClubs.has(String(row.club_id)) ||
          teacherClasses.has(String(row.id))),
    )
    .map((row) => ({
      id: String(row.id),
      title: String(row.title),
      programType: normalizeClassProgram(row.program_type),
    }));
  const roleByClass = new Map(
    classes.map((row) => [
      row.id,
      isPlatformAdmin ||
      ownerClubs.has(
        String(
          ((classesResult.data ?? []) as Row[]).find(
            (candidate) => String(candidate.id) === row.id,
          )?.club_id,
        ),
      )
        ? ("admin" as const)
        : ("teacher" as const),
    ]),
  );
  return { classes, roleByClass };
}

function toExpansionSource(row: Row) {
  return {
    id: String(row.id),
    startDate: String(row.start_date),
    endDate: stringOrNull(row.end_date),
    startTime: String(row.start_time),
    endTime: String(row.end_time),
    recurrenceRule: (row.recurrence_rule ?? {
      frequency: "none",
    }) as ClassRecurrenceRule,
    timezone: stringOrNull(row.timezone) ?? TEACHER_CALENDAR_DEFAULT_TIMEZONE,
  };
}

function eventStatus(
  schedule: Row,
  occurrence: Row | null,
): TeacherCalendarStatus {
  if (occurrence?.status === "completed") return "completed";
  if (occurrence?.status === "cancelled" || schedule.status === "cancelled")
    return "cancelled";
  if (schedule.status === "archived") return "archived";
  return "scheduled";
}

function normalizeScheduleStatus(
  value: unknown,
): "active" | "cancelled" | "archived" {
  return value === "cancelled" || value === "archived" ? value : "active";
}
function timestamp(value: unknown): string {
  const result = String(value ?? "");
  if (!result || !Number.isFinite(Date.parse(result)))
    throw new Error("Calendar event is missing a valid concurrency token");
  return result;
}
function timestampOrNull(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  return timestamp(value);
}
function actionsFor(
  status: TeacherCalendarStatus,
  planned: boolean,
  role: "admin" | "teacher",
  scheduleMutable: boolean,
): TeacherCalendarActionPermissions {
  const actions = {
    ...DEFAULT_ACTIONS,
    planLesson: !planned,
    reschedule: status === "scheduled" && (scheduleMutable || planned),
    cancel: status === "scheduled" && planned,
    complete: status === "scheduled" && planned,
  };
  if (role === "teacher" && status === "archived")
    return { ...actions, reschedule: false, cancel: false, complete: false };
  return actions;
}

async function loadPreferences(
  db: Db,
  actorId: string,
): Promise<TeacherCalendarPreferences> {
  const result = await db
    .from("teacher_workspace_preferences")
    .select(
      "default_calendar_view, week_start, working_hour_start, working_hour_end, timezone_mode, timezone",
    )
    .eq("user_id", actorId)
    .maybeSingle();
  if (result.error) return normalizeTeacherCalendarPreferences(undefined);
  return normalizeTeacherCalendarPreferences({
    view: result.data?.default_calendar_view,
    weekStart: result.data?.week_start === 0 ? 0 : 1,
    workingHours: {
      start: result.data?.working_hour_start,
      end: result.data?.working_hour_end,
    },
    timezoneMode: result.data?.timezone_mode,
    timezone: result.data?.timezone,
  });
}

async function enrichEventCounts(db: Db, events: TeacherCalendarEvent[]) {
  const occurrenceIds = events.flatMap((event) =>
    event.occurrenceId ? [event.occurrenceId] : [],
  );
  if (!occurrenceIds.length) return;
  const linksResult = await db
    .from("lms_occurrence_assignments")
    .select("occurrence_id, assignment_id")
    .in("occurrence_id", occurrenceIds);
  if (linksResult.error) return;
  const links = (linksResult.data ?? []) as Row[];
  const assignmentIds = ids(links, "assignment_id");
  if (!assignmentIds.length) return;
  const [submissionsResult, reviewsResult] = await Promise.all([
    db
      .from("club_assignment_submissions")
      .select("assignment_id")
      .in("assignment_id", assignmentIds),
    db
      .from("ielts_teacher_reviews")
      .select("assignment_id, status")
      .in("assignment_id", assignmentIds),
  ]);
  const submissionCounts = countBy(
    (submissionsResult.data ?? []) as Row[],
    "assignment_id",
  );
  const reviewCounts = countBy(
    (reviewsResult.data ?? []) as Row[],
    "assignment_id",
  );
  const assignmentsByOccurrence = new Map<string, string[]>();
  for (const link of links)
    assignmentsByOccurrence.set(String(link.occurrence_id), [
      ...(assignmentsByOccurrence.get(String(link.occurrence_id)) ?? []),
      String(link.assignment_id),
    ]);
  for (const event of events) {
    const assignmentList = event.occurrenceId
      ? (assignmentsByOccurrence.get(event.occurrenceId) ?? [])
      : [];
    event.counts = {
      assignmentCount: assignmentList.length,
      submissionCount: assignmentList.reduce(
        (sum, id) => sum + (submissionCounts.get(id) ?? 0),
        0,
      ),
      reviewCount: assignmentList.reduce(
        (sum, id) => sum + (reviewCounts.get(id) ?? 0),
        0,
      ),
    };
  }
}

function buildAttendanceMap(sessions: Row[], records: Row[]) {
  const map = new Map<string, { recorded: number }>();
  for (const session of sessions) map.set(String(session.id), { recorded: 0 });
  for (const record of records) {
    const item = map.get(String(record.session_id));
    if (item) item.recorded += 1;
  }
  return map;
}
function collectIds(
  inputs: Array<{ schedule: Row; occurrence: Row | null }>,
  key: string,
) {
  return [
    ...new Set(
      inputs
        .map((item) => item.occurrence?.[key] ?? item.schedule[key])
        .filter((value): value is string => typeof value === "string"),
    ),
  ];
}
function ids(rows: Row[], key: string) {
  return [
    ...new Set(
      rows
        .map((row) => row[key])
        .filter((value): value is string => typeof value === "string"),
    ),
  ];
}
function countBy(rows: Row[], key: string) {
  const counts = new Map<string, number>();
  for (const row of rows)
    counts.set(String(row[key]), (counts.get(String(row[key])) ?? 0) + 1);
  return counts;
}
function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length ? value : null;
}
function asObject(value: unknown): Row {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Row)
    : {};
}
function normalizeColor(value: unknown, seed: string): TeacherClassColorToken {
  if (TEACHER_CLASS_COLOR_TOKENS.includes(value as TeacherClassColorToken))
    return value as TeacherClassColorToken;
  let hash = 0;
  for (const character of seed)
    hash = (hash * 31 + character.charCodeAt(0)) | 0;
  return TEACHER_CLASS_COLOR_TOKENS[
    Math.abs(hash) % TEACHER_CLASS_COLOR_TOKENS.length
  ];
}

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  loadTeacherCalendarEventDetail,
  loadTeacherCalendarRange,
} from "@/lib/api/class-lms/teacher-calendar-repository";
import {
  normalizeTeacherCalendarRange,
  type TeacherCalendarEvent,
  type TeacherCalendarRangeResult,
  type TeacherCalendarStatus,
  type TeacherCalendarView,
} from "@/lib/api/class-lms/teacher-calendar-model";
import { loadTeacherReviewQueue } from "@/lib/api/class-lms/teacher-review-queue";
import { loadTeacherWorkspaceCapability } from "@/lib/api/class-lms/teacher-workspace-capability";
import { requireClassManager } from "@/lib/api/class-manager-access";
import { createTypedAdminClient } from "@/lib/supabase/admin";
import { loadIeltsClassGradebook } from "@/lib/api/ielts/gradebook-repository";
import { createTypedServerClient } from "@/lib/supabase/server";
import {
  listClassResources,
  listClassAnnouncements,
} from "@/app/actions/class-lms";
import {
  teacherWorkspaceLoadPlan,
  withTeacherWorkspaceDeadline,
} from "./loading-policy";
import { isTeacherWorkspaceAccessBoundaryError } from "./errors";
import {
  buildTeacherWorkspaceDemoPresentation,
  isExplicitTeacherWorkspaceDemo,
  type TeacherEventDetailPresentation,
  type TeacherWorkspacePresentation,
  type TeacherWorkspaceSurface,
} from "./presentation";

function emptyCalendar(
  view: TeacherCalendarView = "week",
): TeacherCalendarRangeResult {
  return {
    range: {
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date().toISOString().slice(0, 10),
      view,
      timezone: "UTC",
    },
    events: [],
    classes: [],
  };
}

type AssignmentRow = {
  id: string;
  class_id: string | null;
  title: string | null;
  assignment_type: string | null;
  due_at: string | null;
  status: string | null;
  updated_at: string | null;
};

type SubmissionCountRow = {
  assignment_id: string;
  grade_status: string | null;
  submission_state: string | null;
};

function normalizeAssignmentKind(
  value: string,
): TeacherWorkspacePresentation["assignments"][number]["kind"] {
  if (["reading", "listening", "writing", "speaking"].includes(value)) {
    return value as TeacherWorkspacePresentation["assignments"][number]["kind"];
  }
  // `club_assignments.assignment_type` speaks its own vocabulary.
  if (value === "speech") return "speaking";
  return "homework";
}

function normalizeContentStatus(
  value: string,
): "published" | "scheduled" | "draft" {
  if (value === "published") return "published";
  if (value === "scheduled") return "scheduled";
  return "draft";
}

function normalizeAssignmentStatus(
  value: unknown,
): TeacherWorkspacePresentation["assignments"][number]["status"] {
  if (value === "draft") return "draft";
  if (value === "archived") return "closed";
  return "assigned";
}

/**
 * Assignments read straight from `club_assignments`, not from occurrence links.
 * The occurrence-link projection only ever showed work already attached to a
 * calendar event, and `lms_occurrence_assignments` is empty in production — so
 * the surface was structurally blank and `publishTeacherAssignment` had nothing
 * to act on. A draft with no due date is the exact row a teacher needs to
 * publish, so it is kept rather than filtered out.
 */
async function loadClassAssignments(
  classes: TeacherWorkspacePresentation["classes"],
): Promise<TeacherWorkspacePresentation["assignments"]> {
  const classIds = classes.map((item) => item.id);
  if (!classIds.length) return [];
  const client = (await createTypedServerClient()) as unknown as SupabaseClient;
  const { data: rows, error } = await client
    .from("club_assignments")
    .select("id, class_id, title, assignment_type, due_at, status, updated_at")
    .in("class_id", classIds)
    .neq("status", "archived")
    .order("due_at", { ascending: false, nullsFirst: true })
    .limit(200);
  if (error) throw new Error(`teacher workspace assignments: ${error.message}`);
  const assignmentRows = (rows ?? []) as AssignmentRow[];
  if (!assignmentRows.length) return [];

  const { data: submissionRows, error: submissionError } = await client
    .from("club_assignment_submissions")
    .select("assignment_id, grade_status, submission_state")
    .in(
      "assignment_id",
      assignmentRows.map((row) => String(row.id)),
    );
  if (submissionError)
    throw new Error(
      `teacher workspace assignment submissions: ${submissionError.message}`,
    );
  // Missing work is roster-based, never derived from an unloaded calendar detail.
  const { data: members, error: memberError } = await client
    .from("class_memberships")
    .select("class_id")
    .in("class_id", classIds)
    .eq("member_role", "student")
    .eq("status", "active");
  if (memberError)
    throw new Error(
      `teacher workspace assignment roster: ${memberError.message}`,
    );
  const rosterCounts = new Map<string, number>();
  for (const member of members ?? []) {
    const id = String(member.class_id);
    rosterCounts.set(id, (rosterCounts.get(id) ?? 0) + 1);
  }
  const counts = new Map<string, { submitted: number; reviewed: number }>();
  for (const row of (submissionRows ?? []) as SubmissionCountRow[]) {
    if (row.submission_state !== "submitted") continue;
    const key = String(row.assignment_id);
    const entry = counts.get(key) ?? { submitted: 0, reviewed: 0 };
    entry.submitted += 1;
    if (row.grade_status === "graded") entry.reviewed += 1;
    counts.set(key, entry);
  }

  const classById = new Map(classes.map((item) => [item.id, item]));
  return assignmentRows.flatMap((row) => {
    const classId = String(row.class_id ?? "");
    const classItem = classById.get(classId);
    if (!classItem) return [];
    const tally = counts.get(String(row.id)) ?? { submitted: 0, reviewed: 0 };
    return [
      {
        id: String(row.id),
        classId,
        title: String(row.title ?? "Assignment"),
        classTitle: classItem.title,
        kind: normalizeAssignmentKind(String(row.assignment_type ?? "")),
        dueAt: (row.due_at as string | null) ?? null,
        status: normalizeAssignmentStatus(row.status),
        updatedAt: (row.updated_at as string | null) ?? null,
        submitted: tally.submitted,
        reviewed: tally.reviewed,
        missing: Math.max(
          0,
          (rosterCounts.get(classId) ?? 0) - tally.submitted,
        ),
      },
    ];
  });
}

/**
 * One register, for the most recent lesson that already has a roster. When no
 * lesson in range has an attendance session the surface still shows the roster
 * and says the register is closed, rather than pretending there are no learners.
 */
function buildAttendanceRegister(
  classes: TeacherWorkspacePresentation["classes"],
  events: TeacherCalendarEvent[],
  eventDetails: Record<string, TeacherEventDetailPresentation>,
): TeacherWorkspacePresentation["attendance"] {
  const empty = {
    classId: null,
    classTitle: null,
    sessionId: null,
    courseId: null,
    occurrenceId: null,
    sessionDate: null,
    lessonAt: null,
    students: [],
  } satisfies TeacherWorkspacePresentation["attendance"];
  const withRoster = events
    .filter((event) => (eventDetails[event.id]?.roster.length ?? 0) > 0)
    .sort((left, right) => right.startsAt.localeCompare(left.startsAt));
  const chosen =
    withRoster.find((event) => eventDetails[event.id]?.attendance.sessionId) ??
    withRoster[0];
  if (!chosen) return empty;
  const detail = eventDetails[chosen.id];
  if (!detail) return empty;
  return {
    classId: chosen.classId,
    classTitle:
      classes.find((item) => item.id === chosen.classId)?.title ??
      chosen.classTitle,
    sessionId: detail.attendance.sessionId,
    courseId: chosen.courseId,
    occurrenceId: chosen.occurrenceId,
    sessionDate: chosen.date,
    lessonAt: chosen.startsAt,
    students: detail.roster.map((student) => ({
      id: student.id,
      name: student.name,
      status: student.status,
    })),
  };
}

async function loadDetails(
  events: TeacherCalendarEvent[],
): Promise<TeacherWorkspacePresentation["eventDetails"]> {
  // A failed detail must never become an empty roster or attendance register.
  const details = await Promise.all(
    events.slice(0, 16).map(async (event) => {
      const detail = await loadTeacherCalendarEventDetail({
        eventId: event.id,
        date: event.date,
        timezone: event.timezone,
      });
      return [
        event.id,
        {
          eventId: event.id,
          actionUrls: detail.actionUrls,
          roster: detail.roster,
          rosterCount: detail.rosterCount,
          lessonNotes: detail.lessonNotes,
          materials: detail.materials,
          homework: detail.assignments.map((assignment) => ({
            id: assignment.id,
            title: assignment.title,
            dueAt: assignment.dueAt,
            submissions: assignment.submissionCount,
            reviews: assignment.reviewCount,
          })),
          attendance: detail.attendance,
          announcements: detail.announcements.map((announcement) => ({
            id: announcement.id,
            title: announcement.title,
            body: announcement.body,
            publishedAt: announcement.publishAt,
          })),
        } satisfies TeacherEventDetailPresentation,
      ] as const;
    }),
  );
  return Object.fromEntries(details);
}

async function loadClassGradebook(
  item: TeacherWorkspacePresentation["classes"][number],
): Promise<Pick<Awaited<ReturnType<typeof loadIeltsClassGradebook>>, "rows">> {
  const client = await createTypedServerClient();
  const manager = await requireClassManager(client, item.id);
  if (manager.clubId !== item.organizationId) throw new Error("Forbidden");
  // The trusted profile reader is created only after class/organization ownership validation.
  return loadIeltsClassGradebook(
    client,
    {
      classId: manager.classId,
      clubId: manager.clubId,
      limit: 100,
    },
    createTypedAdminClient(),
  );
}

const productionLoaders = {
  capability: loadTeacherWorkspaceCapability,
  calendar: loadTeacherCalendarRange,
  reviews: loadTeacherReviewQueue,
  details: loadDetails,
  assignments: loadClassAssignments,
  resources: listClassResources,
  announcements: listClassAnnouncements,
  gradebook: loadClassGradebook,
};

export async function loadTeacherWorkspacePresentation(
  input: {
    locale: string;
    surface: TeacherWorkspaceSurface;
    view?: TeacherCalendarView;
    anchorDate?: string;
    classId?: string;
    programType?: string;
    status?: TeacherCalendarStatus;
    demo?: string;
    eventId?: string;
    tab?: string;
  },
  loaders = productionLoaders,
  timeoutMs = 5_000,
): Promise<TeacherWorkspacePresentation> {
  if (isExplicitTeacherWorkspaceDemo(input.demo)) {
    return buildTeacherWorkspaceDemoPresentation({
      locale: input.locale,
      surface: input.surface,
      view: input.view,
      range: normalizeTeacherCalendarRange({
        view: input.view,
        anchorDate: input.anchorDate,
        timezone: "America/New_York",
      }),
    });
  }

  const fallback = {
    state: "error" as const,
    source: "contracts" as const,
    locale: input.locale,
    surface: input.surface,
    isAdminPreview: false,
    isHeadTeacher: false,
    hasIeltsEntitlement: false,
    classes: [],
    calendar: emptyCalendar(input.view),
    eventDetails: {},
    reviews: [],
    assignments: [],
    gradebook: { students: [], assessments: [], scores: {} },
    attendance: {
      classId: null,
      classTitle: null,
      sessionId: null,
      courseId: null,
      occurrenceId: null,
      sessionDate: null,
      lessonAt: null,
      students: [],
    },
    materials: [],
    announcements: [],
  } satisfies TeacherWorkspacePresentation;

  try {
    const capability = await withTeacherWorkspaceDeadline(
      loaders.capability,
      timeoutMs,
    );
    if (!capability.canAccess) return { ...fallback, state: "denied" };
    if (
      new Set(["organization", "people", "curriculum", "reports"]).has(
        input.surface,
      ) &&
      !capability.isHeadTeacher
    ) {
      return { ...fallback, state: "denied" };
    }

    if (
      input.classId &&
      !capability.classes.some((item) => item.id === input.classId)
    ) {
      return { ...fallback, state: "denied" };
    }
    const classTabSurface = input.tab;
    const tabSurfaces = [
      "assignments",
      "gradebook",
      "attendance",
      "materials",
      "announcements",
    ];
    const plan = teacherWorkspaceLoadPlan(
      input.surface === "class-detail" &&
        tabSurfaces.includes(classTabSurface ?? "")
        ? (classTabSurface as TeacherWorkspaceSurface)
        : input.surface,
    );
    const deadline = Date.now() + timeoutMs;
    const dataStatus: NonNullable<TeacherWorkspacePresentation["dataStatus"]> =
      {};
    async function source<T>(
      key: keyof typeof dataStatus,
      enabled: boolean,
      load: () => Promise<T>,
      empty: T,
    ): Promise<T> {
      dataStatus[key] = "not_requested";
      if (!enabled) return empty;
      try {
        const value = await withTeacherWorkspaceDeadline(
          load,
          Math.max(0, deadline - Date.now()),
        );
        dataStatus[key] = "ready";
        return value;
      } catch (error) {
        // Never recover a permission boundary by presenting previously authorized data.
        if (isTeacherWorkspaceAccessBoundaryError(error)) throw error;
        dataStatus[key] = "unavailable";
        console.error(`teacher workspace ${key} unavailable`, error);
        return empty;
      }
    }
    const classes: TeacherWorkspacePresentation["classes"] = capability.classes
      .filter((item) => !input.classId || item.id === input.classId)
      .map((item) => ({
        ...item,
        colorToken: "blue",
        studentCount: 0,
        nextLessonAt: null,
        room: null,
        completion: 0,
        attendanceRate: 0,
        pendingReviews: 0,
        metricsStatus: "not_requested",
        reviewsStatus: "not_requested",
        calendarStatus: "not_requested",
      }));
    const calendarInput = {
      view: input.view,
      anchorDate: input.anchorDate,
      classId: input.classId,
      programType:
        input.programType === "ielts" ||
        input.programType === "debate" ||
        input.programType === "public_speaking"
          ? input.programType
          : undefined,
      statuses: input.status ? [input.status] : undefined,
    } satisfies Parameters<typeof loadTeacherCalendarRange>[0];
    const authorizedIds = new Set(classes.map((item) => item.id));
    const calendarPromise = source(
      "calendar",
      plan.calendar,
      () => loaders.calendar(calendarInput),
      emptyCalendar(input.view),
    );
    const detailsPromise = calendarPromise.then((calendar) =>
      source(
        "details",
        plan.details || Boolean(input.eventId && input.surface === "calendar"),
        async () => {
          if (dataStatus.calendar !== "ready")
            throw new Error("Calendar unavailable");
          const authorizedEvents = calendar.events.filter((event) =>
            authorizedIds.has(event.classId),
          );
          const selected =
            input.surface === "calendar"
              ? authorizedEvents.filter((event) => event.id === input.eventId)
              : authorizedEvents;
          if (input.eventId && input.surface === "calendar" && !selected.length)
            throw new Error("Forbidden");
          return loaders.details(selected);
        },
        {} as TeacherWorkspacePresentation["eventDetails"],
      ),
    );
    const [
      calendar,
      eventDetails,
      reviewQueue,
      assignments,
      contentResources,
      contentAnnouncements,
      gradebooks,
    ] = await Promise.all([
      calendarPromise,
      detailsPromise,
      source(
        "reviews",
        plan.reviews,
        () => loaders.reviews({ classId: input.classId, status: "all" }),
        {
          items: [],
          total: 0,
          counts: { needs_review: 0, returned: 0, draft: 0 },
          classes: [],
        },
      ),
      source(
        "assignments",
        plan.assignments,
        () => loaders.assignments(classes),
        [],
      ),
      source(
        "materials",
        plan.materials,
        () =>
          Promise.all(
            classes.map(async (item) => ({
              classId: item.id,
              items: await loaders.resources(item.id),
            })),
          ),
        [],
      ),
      source(
        "announcements",
        plan.announcements,
        () =>
          Promise.all(
            classes.map(async (item) => ({
              classId: item.id,
              items: await loaders.announcements(item.id),
            })),
          ),
        [],
      ),
      source(
        "gradebook",
        plan.gradebook,
        () =>
          Promise.all(
            classes
              .filter((item) => item.programType === "ielts")
              .map((item) => loaders.gradebook(item)),
          ),
        [],
      ),
    ]);
    // Recheck returned scopes even though each production loader enforces RLS/ownership.
    calendar.classes = calendar.classes.filter((item) =>
      authorizedIds.has(item.id),
    );
    calendar.events = calendar.events.filter((item) =>
      authorizedIds.has(item.classId),
    );
    const eventIds = new Set(calendar.events.map((item) => item.id));
    for (const eventId of Object.keys(eventDetails))
      if (!eventIds.has(eventId)) delete eventDetails[eventId];
    for (const item of classes) {
      const classEvents = calendar.events.filter(
        (event) => event.classId === item.id,
      );
      const details = classEvents
        .map((event) => eventDetails[event.id])
        .filter(Boolean);
      item.calendarStatus = dataStatus.calendar;
      item.reviewsStatus = dataStatus.reviews;
      item.metricsStatus =
        dataStatus.details === "ready" && details.length
          ? "ready"
          : dataStatus.details === "unavailable"
            ? "unavailable"
            : "not_requested";
      item.colorToken =
        calendar.classes.find((row) => row.id === item.id)?.colorToken ??
        "blue";
      item.nextLessonAt =
        classEvents.find((event) => event.status === "scheduled")?.startsAt ??
        null;
      item.room = classEvents.find((event) => event.room)?.room ?? null;
      item.studentCount = Math.max(
        0,
        ...details.map((detail) => detail.rosterCount),
      );
      const recorded = details.reduce(
        (sum, detail) => sum + detail.attendance.recorded,
        0,
      );
      const attended = details.reduce(
        (sum, detail) =>
          sum + detail.attendance.present + detail.attendance.late,
        0,
      );
      item.attendanceRate = recorded
        ? Math.round((attended / recorded) * 100)
        : 0;
      const homework = details.flatMap((detail) => detail.homework);
      item.completion =
        homework.length && item.studentCount
          ? Math.min(
              100,
              Math.round(
                (homework.reduce((sum, row) => sum + row.submissions, 0) /
                  (homework.length * item.studentCount)) *
                  100,
              ),
            )
          : 0;
      item.pendingReviews = reviewQueue.items.filter(
        (review) =>
          review.classId === item.id && review.status === "needs_review",
      ).length;
    }
    const materials: TeacherWorkspacePresentation["materials"] =
      contentResources.flatMap((result) =>
        result.items.map((resource) => ({
          id: resource.id,
          classId: result.classId,
          title: resource.title,
          classTitle: classes.find((item) => item.id === result.classId)!.title,
          kind: resource.kind === "link" ? "link" : "document",
          status: resource.status === "published" ? "published" : "draft",
          updatedAt: resource.updatedAt,
        })),
      );
    const announcements: TeacherWorkspacePresentation["announcements"] =
      contentAnnouncements.flatMap((result) =>
        result.items.map((announcement) => ({
          id: announcement.id,
          classId: result.classId,
          title: announcement.title,
          classTitle: classes.find((item) => item.id === result.classId)!.title,
          body: announcement.body,
          status: normalizeContentStatus(announcement.status),
          publishAt: announcement.publishAt,
        })),
      );
    const gradebook: TeacherWorkspacePresentation["gradebook"] = {
      students: [],
      assessments: [],
      scores: {},
    };
    for (const result of gradebooks) {
      for (const row of result.rows) {
        if (!gradebook.students.some((student) => student.id === row.userId))
          gradebook.students.push({ id: row.userId, name: row.displayName });
        gradebook.scores[row.userId] ??= {};
        for (const assignment of row.assignments) {
          if (
            !gradebook.assessments.some(
              (item) => item.id === assignment.assignmentId,
            )
          )
            gradebook.assessments.push({
              id: assignment.assignmentId,
              title: assignment.title,
              maxScore: assignment.homework.scoreMax ?? 9,
            });
          gradebook.scores[row.userId][assignment.assignmentId] =
            assignment.score.overall ??
            (assignment.homework.submitted ? "draft" : "missing");
        }
      }
    }

    return {
      ...fallback,
      dataStatus,
      state: Object.values(dataStatus).includes("unavailable")
        ? "partial"
        : classes.length || capability.isPlatformAdmin
          ? "ready"
          : "empty",
      isAdminPreview: capability.isPlatformAdmin,
      isHeadTeacher: capability.isHeadTeacher,
      hasIeltsEntitlement: capability.hasIeltsEntitlement,
      classes,
      calendar,
      eventDetails,
      reviews: reviewQueue.items
        .filter((item) => authorizedIds.has(item.classId))
        .map((item) => ({
          key: item.key,
          kind: item.kind,
          responseId: item.responseId,
          submissionId: item.submissionId,
          submissionUpdatedAt: item.submissionUpdatedAt,
          programType: item.programType,
          classId: item.classId,
          classTitle: item.classTitle,
          studentName: item.studentName,
          assignmentTitle: item.assignmentTitle,
          submittedAt: item.submittedAt,
          dueAt: item.dueAt,
          ageDays: item.ageDays,
          status: item.status,
          scoreSource: item.scoreSource,
          attemptLabel:
            item.revision == null ? "Submission" : `Revision ${item.revision}`,
        })),
      assignments: assignments.filter((item) =>
        authorizedIds.has(item.classId),
      ),
      announcements,
      materials,
      gradebook,
      attendance: buildAttendanceRegister(
        classes,
        calendar.events,
        eventDetails,
      ),
    };
  } catch (error) {
    if (isTeacherWorkspaceAccessBoundaryError(error)) {
      return { ...fallback, state: "denied" };
    }
    console.error("teacher workspace presentation failed", error);
    return fallback;
  }
}

import "server-only";

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

function fallbackDetail(
  event: TeacherCalendarEvent,
): TeacherEventDetailPresentation {
  return {
    eventId: event.id,
    roster: [],
    rosterCount: 0,
    lessonNotes: null,
    materials: [],
    homework: [],
    attendance: { present: 0, late: 0, absent: 0, recorded: 0 },
    announcements: [],
  };
}

async function loadDetails(events: TeacherCalendarEvent[]) {
  const selected = events.slice(0, 16);
  const settled = await Promise.allSettled(
    selected.map((event) =>
      loadTeacherCalendarEventDetail({
        eventId: event.id,
        date: event.date,
        timezone: event.timezone,
      }),
    ),
  );
  return Object.fromEntries(
    selected.map((event, index) => {
      const result = settled[index];
      if (result.status !== "fulfilled")
        return [event.id, fallbackDetail(event)];
      const detail = result.value;
      return [
        event.id,
        {
          eventId: event.id,
          roster: [],
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
          attendance: {
            present: detail.attendance.present,
            late: detail.attendance.late,
            absent: detail.attendance.absent,
            recorded: detail.attendance.recorded,
          },
          announcements: detail.announcements.map((announcement) => ({
            id: announcement.id,
            title: announcement.title,
            body: announcement.body,
            publishedAt: announcement.publishAt,
          })),
        } satisfies TeacherEventDetailPresentation,
      ];
    }),
  );
}

export async function loadTeacherWorkspacePresentation(input: {
  locale: string;
  surface: TeacherWorkspaceSurface;
  view?: TeacherCalendarView;
  anchorDate?: string;
  classId?: string;
  programType?: string;
  status?: TeacherCalendarStatus;
  demo?: string;
}): Promise<TeacherWorkspacePresentation> {
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
    attendance: [],
    materials: [],
    announcements: [],
  } satisfies TeacherWorkspacePresentation;

  try {
    const capability = await loadTeacherWorkspaceCapability();
    if (!capability.canAccess) return { ...fallback, state: "denied" };

    const [calendar, reviewQueue] = await Promise.all([
      loadTeacherCalendarRange({
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
      }),
      loadTeacherReviewQueue({
        classId: input.classId,
        status: "all",
      }),
    ]);
    const eventDetails = await loadDetails(calendar.events);
    const classColors = new Map(
      calendar.classes.map((item) => [item.id, item.colorToken]),
    );
    const classes = capability.classes.map((item) => {
      const classEvents = calendar.events.filter(
        (event) => event.classId === item.id,
      );
      return {
        id: item.id,
        organizationId: item.organizationId,
        title: item.title,
        programType: item.programType,
        colorToken: classColors.get(item.id) ?? "blue",
        studentCount: 0,
        nextLessonAt:
          classEvents.find((event) => event.status === "scheduled")?.startsAt ??
          null,
        room: classEvents.find((event) => event.room)?.room ?? null,
        completion: 0,
        attendanceRate: 0,
        pendingReviews: reviewQueue.items.filter(
          (review) => review.classId === item.id,
        ).length,
        isAssigned: item.isAssigned,
        isLeadTeacher: item.isLeadTeacher,
      };
    });

    return {
      ...fallback,
      state: classes.length || capability.isPlatformAdmin ? "ready" : "empty",
      isAdminPreview: capability.isPlatformAdmin,
      isHeadTeacher: capability.isHeadTeacher,
      hasIeltsEntitlement: capability.hasIeltsEntitlement,
      classes,
      calendar,
      eventDetails,
      reviews: reviewQueue.items.map((item) => ({
        key: item.key,
        kind: item.kind,
        responseId: item.responseId,
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
    };
  } catch (error) {
    if (isTeacherWorkspaceAccessBoundaryError(error)) {
      return { ...fallback, state: "denied" };
    }
    console.error("teacher workspace presentation failed", error);
    return fallback;
  }
}

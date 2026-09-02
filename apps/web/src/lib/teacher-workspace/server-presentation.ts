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
import { loadIeltsClassGradebook } from "@/lib/api/ielts/gradebook-repository";
import { createTypedServerClient } from "@/lib/supabase/server";
import {
  listClassResources,
  listClassAnnouncements,
} from "@/app/actions/class-lms";
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
    actionUrls: {},
    roster: [],
    rosterCount: 0,
    lessonNotes: null,
    materials: [],
    homework: [],
    attendance: { present: 0, late: 0, absent: 0, recorded: 0 },
    announcements: [],
  };
}

function normalizeAssignmentKind(
  value: string,
): TeacherWorkspacePresentation["assignments"][number]["kind"] {
  return ["reading", "listening", "writing", "speaking"].includes(value)
    ? (value as TeacherWorkspacePresentation["assignments"][number]["kind"])
    : "homework";
}

function normalizeContentStatus(
  value: string,
): "published" | "scheduled" | "draft" {
  if (value === "published") return "published";
  if (value === "scheduled") return "scheduled";
  return "draft";
}

function buildContractCollections(
  classes: TeacherWorkspacePresentation["classes"],
  events: TeacherCalendarEvent[],
  eventDetails: Record<string, TeacherEventDetailPresentation>,
) {
  const assignments = new Map<
    string,
    TeacherWorkspacePresentation["assignments"][number]
  >();
  const announcements = new Map<
    string,
    TeacherWorkspacePresentation["announcements"][number]
  >();
  for (const [eventId, detail] of Object.entries(eventDetails)) {
    const event = events.find((item) => item.id === eventId);
    if (!event) continue;
    const classTitle =
      classes.find((item) => item.id === event.classId)?.title ??
      event.classTitle;
    for (const assignment of detail.homework) {
      // Nullable due dates cannot satisfy the teacher table's required dueAt field;
      // retain those records in the event drawer, but do not invent a date here.
      if (!assignment.dueAt) continue;
      assignments.set(`${event.classId}:${assignment.id}`, {
        id: assignment.id,
        classId: event.classId,
        title: assignment.title,
        classTitle,
        kind: normalizeAssignmentKind("homework"),
        dueAt: assignment.dueAt,
        status: "assigned",
        submitted: assignment.submissions,
        reviewed: assignment.reviews,
        missing: Math.max(0, detail.rosterCount - assignment.submissions),
      });
    }
    for (const announcement of detail.announcements) {
      announcements.set(`${event.classId}:${announcement.id}`, {
        id: announcement.id,
        classId: event.classId,
        title: announcement.title,
        classTitle,
        body: announcement.body,
        status: normalizeContentStatus("published"),
        publishAt: announcement.publishedAt,
      });
    }
  }
  return {
    assignments: [...assignments.values()],
    announcements: [...announcements.values()],
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
          actionUrls: detail.actionUrls,
          roster: detail.roster.map((student) => ({
            id: student.id,
            name: student.name,
            status: student.status,
          })),
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
    if (
      new Set(["organization", "people", "curriculum", "reports"]).has(
        input.surface,
      ) &&
      !capability.isHeadTeacher
    ) {
      return { ...fallback, state: "denied" };
    }

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
      const details = classEvents
        .map((event) => eventDetails[event.id])
        .filter(Boolean);
      const rosterCount = Math.max(
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
      const assignmentCount = details.reduce(
        (sum, detail) => sum + detail.homework.length,
        0,
      );
      const submitted = details.reduce(
        (sum, detail) =>
          sum +
          detail.homework.reduce(
            (total, assignment) => total + assignment.submissions,
            0,
          ),
        0,
      );
      return {
        id: item.id,
        organizationId: item.organizationId,
        title: item.title,
        programType: item.programType,
        colorToken: classColors.get(item.id) ?? "blue",
        studentCount: rosterCount,
        nextLessonAt:
          classEvents.find((event) => event.status === "scheduled")?.startsAt ??
          null,
        room: classEvents.find((event) => event.room)?.room ?? null,
        completion:
          assignmentCount && rosterCount
            ? Math.min(
                100,
                Math.round((submitted / (assignmentCount * rosterCount)) * 100),
              )
            : 0,
        attendanceRate: recorded ? Math.round((attended / recorded) * 100) : 0,
        pendingReviews: reviewQueue.items.filter(
          (review) => review.classId === item.id,
        ).length,
        isAssigned: item.isAssigned,
        isLeadTeacher: item.isLeadTeacher,
      };
    });

    const collections = buildContractCollections(
      classes,
      calendar.events,
      eventDetails,
    );
    const content = await Promise.allSettled(
      capability.classes.map(async (item) => {
        const [resources, announcements] = await Promise.all([
          listClassResources(item.id),
          listClassAnnouncements(item.id),
        ]);
        return { classId: item.id, resources, announcements };
      }),
    );
    const materials: TeacherWorkspacePresentation["materials"] = [];
    const loadedAnnouncements = new Map(
      collections.announcements.map((announcement) => [
        `${announcement.classId}:${announcement.id}`,
        announcement,
      ]),
    );
    for (const result of content) {
      if (result.status !== "fulfilled") continue;
      const classTitle =
        classes.find((item) => item.id === result.value.classId)?.title ??
        "Class";
      for (const resource of result.value.resources) {
        materials.push({
          id: resource.id,
          classId: result.value.classId,
          title: resource.title,
          classTitle,
          kind: resource.kind === "link" ? "link" : "document",
          status: resource.status === "published" ? "published" : "draft",
          updatedAt: resource.updatedAt,
        });
      }
      for (const announcement of result.value.announcements) {
        loadedAnnouncements.set(`${result.value.classId}:${announcement.id}`, {
          id: announcement.id,
          classId: result.value.classId,
          title: announcement.title,
          classTitle,
          body: announcement.body,
          status:
            announcement.status === "published"
              ? "published"
              : announcement.status === "draft"
                ? "draft"
                : "scheduled",
          publishAt: announcement.publishAt,
        });
      }
    }
    const gradebook = {
      students: [] as TeacherWorkspacePresentation["gradebook"]["students"],
      assessments:
        [] as TeacherWorkspacePresentation["gradebook"]["assessments"],
      scores: {} as TeacherWorkspacePresentation["gradebook"]["scores"],
    };
    const ieltsClasses = capability.classes.filter(
      (item) => item.programType === "ielts",
    );
    if (ieltsClasses.length) {
      const client = await createTypedServerClient();
      const gradebooks = await Promise.allSettled(
        ieltsClasses.map((item) =>
          loadIeltsClassGradebook(client, {
            classId: item.id,
            clubId: item.organizationId,
            limit: 100,
          }),
        ),
      );
      for (const result of gradebooks) {
        if (result.status !== "fulfilled") continue;
        for (const row of result.value.rows) {
          if (
            !gradebook.students.some((student) => student.id === row.userId)
          ) {
            gradebook.students.push({ id: row.userId, name: row.displayName });
          }
          gradebook.scores[row.userId] ??= {};
          for (const assignment of row.assignments) {
            if (
              !gradebook.assessments.some(
                (item) => item.id === assignment.assignmentId,
              )
            ) {
              gradebook.assessments.push({
                id: assignment.assignmentId,
                title: assignment.title,
                maxScore: assignment.homework.scoreMax ?? 9,
              });
            }
            gradebook.scores[row.userId][assignment.assignmentId] =
              assignment.score.overall ??
              (assignment.homework.submitted ? "draft" : "missing");
          }
        }
      }
    }

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
      assignments: collections.assignments,
      announcements: [...loadedAnnouncements.values()],
      materials,
      gradebook,
    };
  } catch (error) {
    if (isTeacherWorkspaceAccessBoundaryError(error)) {
      return { ...fallback, state: "denied" };
    }
    console.error("teacher workspace presentation failed", error);
    return fallback;
  }
}

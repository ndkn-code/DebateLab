import type {
  TeacherCalendarActionPermissions,
  TeacherCalendarEvent,
  TeacherCalendarRangeResult,
  TeacherCalendarStatus,
  TeacherCalendarView,
  TeacherClassColorToken,
} from "@/lib/api/class-lms/teacher-calendar-model";

export type TeacherWorkspaceSurface =
  | "calendar"
  | "classes"
  | "review-queue"
  | "assignments"
  | "gradebook"
  | "attendance"
  | "materials"
  | "announcements"
  | "organization"
  | "people"
  | "curriculum"
  | "reports"
  | "class-detail";

export const HEAD_TEACHER_WORKSPACE_SURFACES = [
  "organization",
  "people",
  "curriculum",
  "reports",
] as const satisfies readonly TeacherWorkspaceSurface[];

export type HeadTeacherWorkspaceSurface =
  (typeof HEAD_TEACHER_WORKSPACE_SURFACES)[number];

export function isHeadTeacherWorkspaceSurface(
  value: TeacherWorkspaceSurface,
): value is HeadTeacherWorkspaceSurface {
  return (HEAD_TEACHER_WORKSPACE_SURFACES as readonly string[]).includes(value);
}

export type TeacherWorkspaceNavigationItem = {
  key:
    | "calendar"
    | "classes"
    | "review_queue"
    | "assignments"
    | "gradebook"
    | "attendance"
    | "materials"
    | "announcements"
    | "organization"
    | "people"
    | "curriculum"
    | "reports";
  label: string;
  href: string;
  badge: number | null;
};

export type TeacherWorkspaceNavigation = {
  canAccess: boolean;
  isAdminPreview: boolean;
  isHeadTeacher: boolean;
  hasIeltsEntitlement: boolean;
  classCount: number;
  pendingReviewCount: number;
  items: TeacherWorkspaceNavigationItem[];
};

export interface TeacherWorkspaceClassPresentation {
  id: string;
  organizationId: string;
  title: string;
  programType: "ielts" | "debate" | "public_speaking";
  colorToken: TeacherClassColorToken;
  studentCount: number;
  nextLessonAt: string | null;
  room: string | null;
  completion: number;
  attendanceRate: number;
  pendingReviews: number;
  isAssigned: boolean;
  isLeadTeacher: boolean;
}

export interface TeacherEventDetailPresentation {
  eventId: string;
  actionUrls: Partial<Record<keyof TeacherCalendarActionPermissions, string>>;
  roster: Array<{
    id: string;
    name: string;
    status: "present" | "late" | "absent" | "unmarked";
  }>;
  rosterCount: number;
  lessonNotes: string | null;
  materials: Array<{
    id: string;
    title: string;
    kind: string;
    required: boolean;
  }>;
  homework: Array<{
    id: string;
    title: string;
    dueAt: string | null;
    submissions: number;
    reviews: number;
  }>;
  attendance: {
    /**
     * The register row `teacher_workspace_correct_attendance` corrects. Null
     * means no register was ever opened for this lesson — see the known gap in
     * `docs/cards/B1.md`: nothing in the product can create one today.
     */
    sessionId: string | null;
    present: number;
    late: number;
    absent: number;
    recorded: number;
  };
  announcements: Array<{
    id: string;
    title: string;
    body: string;
    publishedAt: string | null;
  }>;
}

export interface TeacherReviewPresentation {
  key: string;
  kind: "homework" | "writing" | "speaking";
  /** Present only for IELTS response reviews; never an answer-key identifier. */
  responseId: string | null;
  /** Write-seam handle: the row `teacher_workspace_grade_homework` grades. */
  submissionId: string | null;
  /** Optimistic-concurrency token for that grade; null means grading is unsafe. */
  submissionUpdatedAt: string | null;
  /** Chooses the default score ceiling: IELTS grades out of 9, everything else out of 10. */
  programType: string;
  classId: string;
  classTitle: string;
  studentName: string;
  assignmentTitle: string;
  submittedAt: string | null;
  dueAt: string | null;
  ageDays: number;
  status: "needs_review" | "returned" | "draft";
  scoreSource: "none" | "ai_provisional" | "teacher_published";
  attemptLabel: string;
}

export interface TeacherAssignmentPresentation {
  id: string;
  classId: string;
  title: string;
  classTitle: string;
  kind: "homework" | "reading" | "listening" | "writing" | "speaking";
  /** Null for a draft a teacher has not dated yet; those must still be publishable. */
  dueAt: string | null;
  status: "draft" | "assigned" | "closed";
  /** Optimistic-concurrency token for `teacher_workspace_publish_assignment`. */
  updatedAt: string | null;
  submitted: number;
  reviewed: number;
  missing: number;
}

export interface TeacherMaterialPresentation {
  id: string;
  classId: string;
  title: string;
  classTitle: string;
  kind: "document" | "video" | "link" | "worksheet";
  status: "published" | "scheduled" | "draft";
  updatedAt: string;
}

export interface TeacherAnnouncementPresentation {
  id: string;
  classId: string;
  title: string;
  classTitle: string;
  body: string;
  status: "published" | "scheduled" | "draft";
  publishAt: string | null;
}

export interface TeacherWorkspacePresentation {
  state: "ready" | "empty" | "denied" | "error";
  source: "contracts" | "explicit_demo";
  locale: string;
  surface: TeacherWorkspaceSurface;
  isAdminPreview: boolean;
  isHeadTeacher: boolean;
  hasIeltsEntitlement: boolean;
  classes: TeacherWorkspaceClassPresentation[];
  calendar: TeacherCalendarRangeResult;
  eventDetails: Record<string, TeacherEventDetailPresentation>;
  reviews: TeacherReviewPresentation[];
  assignments: TeacherAssignmentPresentation[];
  gradebook: {
    students: Array<{ id: string; name: string }>;
    assessments: Array<{ id: string; title: string; maxScore: number }>;
    scores: Record<
      string,
      Record<string, number | "missing" | "late" | "draft">
    >;
  };
  /**
   * The register for one lesson — the most recent lesson that already has a
   * roster. `sessionId` is the write handle; when it is null the register was
   * never opened and no correction is possible, which the surface says out loud
   * rather than showing a dead control.
   * Statuses mirror `class_attendance_records.status`, which has no "excused".
   */
  attendance: {
    classId: string | null;
    classTitle: string | null;
    sessionId: string | null;
    /** Everything the register needs to be opened when `sessionId` is null. */
    courseId: string | null;
    occurrenceId: string | null;
    sessionDate: string | null;
    lessonAt: string | null;
    students: Array<{
      id: string;
      name: string;
      status: "present" | "late" | "absent" | "unmarked";
    }>;
  };
  materials: TeacherMaterialPresentation[];
  announcements: TeacherAnnouncementPresentation[];
}

export interface TeacherCalendarQuery {
  view?: TeacherCalendarView;
  date?: string;
  classId?: string;
  program?: string;
  status?: TeacherCalendarStatus;
  demo?: string;
}

const ACTIONS = {
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

const DEMO_CLASSES: TeacherWorkspaceClassPresentation[] = [
  {
    id: "class-ielts-7b",
    organizationId: "thinkfy-academy",
    title: "IELTS Academic 7B",
    programType: "ielts",
    colorToken: "teal",
    studentCount: 18,
    nextLessonAt: "2026-08-31T13:00:00.000Z",
    room: "Studio 2 · Zoom",
    completion: 68,
    attendanceRate: 94,
    pendingReviews: 7,
    isAssigned: true,
    isLeadTeacher: true,
  },
  {
    id: "class-debate-foundations",
    organizationId: "thinkfy-academy",
    title: "Debate Foundations",
    programType: "debate",
    colorToken: "amber",
    studentCount: 16,
    nextLessonAt: "2026-08-31T14:30:00.000Z",
    room: "Room 4A",
    completion: 74,
    attendanceRate: 91,
    pendingReviews: 3,
    isAssigned: true,
    isLeadTeacher: false,
  },
  {
    id: "class-speaking-studio",
    organizationId: "thinkfy-academy",
    title: "Public Speaking Studio",
    programType: "public_speaking",
    colorToken: "violet",
    studentCount: 14,
    nextLessonAt: "2026-09-02T16:00:00.000Z",
    room: "Studio 1",
    completion: 59,
    attendanceRate: 88,
    pendingReviews: 2,
    isAssigned: true,
    isLeadTeacher: true,
  },
];

function event(
  id: string,
  classId: string,
  date: string,
  startsAt: string,
  endsAt: string,
  title: string,
  options: Partial<TeacherCalendarEvent> = {},
): TeacherCalendarEvent {
  const classItem =
    DEMO_CLASSES.find((item) => item.id === classId) ?? DEMO_CLASSES[0];
  return {
    id,
    scheduleId: `schedule-${id}`,
    scheduleUpdatedAt: "2026-08-30T12:00:00.000Z",
    occurrenceUpdatedAt: "2026-08-30T12:00:00.000Z",
    expectedUpdatedAt: "2026-08-30T12:00:00.000Z",
    occurrenceId:
      options.occurrenceId === undefined
        ? `occurrence-${id}`
        : options.occurrenceId,
    classId,
    classTitle: classItem.title,
    programType: classItem.programType,
    courseId: `course-${classId}`,
    courseTitle:
      classItem.programType === "ielts"
        ? "IELTS Academic · Band 7"
        : classItem.programType === "debate"
          ? "Argumentation Essentials"
          : "Confident Delivery",
    lessonId:
      options.lessonId === undefined ? `lesson-${id}` : options.lessonId,
    lessonTitle: options.lessonTitle ?? title,
    title,
    date,
    startsAt,
    endsAt,
    timezone: "America/New_York",
    status: options.status ?? "scheduled",
    scheduleStatus: options.scheduleStatus ?? "active",
    location: options.location ?? classItem.room,
    room: options.room ?? classItem.room,
    meetingUrl:
      options.meetingUrl ??
      (classItem.programType === "ielts"
        ? "https://meet.example.test/ielts-7b"
        : null),
    attendanceState: options.attendanceState ?? "pending",
    counts: options.counts ?? {
      assignmentCount: 2,
      submissionCount: 12,
      reviewCount: 4,
    },
    colorToken: classItem.colorToken,
    actions: { ...ACTIONS, ...(options.actions ?? {}) },
  };
}

const DEMO_EVENTS: TeacherCalendarEvent[] = [
  event(
    "ielts-reading",
    "class-ielts-7b",
    "2026-08-31",
    "2026-08-31T13:00:00.000Z",
    "2026-08-31T14:15:00.000Z",
    "Reading: inference under time pressure",
    { attendanceState: "taken" },
  ),
  event(
    "debate-rebuttal",
    "class-debate-foundations",
    "2026-08-31",
    "2026-08-31T13:30:00.000Z",
    "2026-08-31T15:00:00.000Z",
    "Rebuttal lab: clash and weighing",
    {
      attendanceState: "taken",
      counts: { assignmentCount: 1, submissionCount: 14, reviewCount: 2 },
    },
  ),
  event(
    "speaking-coaching",
    "class-speaking-studio",
    "2026-08-31",
    "2026-08-31T14:30:00.000Z",
    "2026-08-31T15:30:00.000Z",
    "Voice and presence coaching",
  ),
  event(
    "ielts-writing",
    "class-ielts-7b",
    "2026-09-01",
    "2026-09-01T14:00:00.000Z",
    "2026-09-01T15:30:00.000Z",
    "Writing Task 2: position and cohesion",
    { counts: { assignmentCount: 2, submissionCount: 15, reviewCount: 7 } },
  ),
  event(
    "debate-case",
    "class-debate-foundations",
    "2026-09-01",
    "2026-09-01T16:00:00.000Z",
    "2026-09-01T17:15:00.000Z",
    "Case construction studio",
    {
      occurrenceId: null,
      lessonId: null,
      lessonTitle: null,
      actions: { ...ACTIONS, planLesson: true },
    },
  ),
  event(
    "speaking-story",
    "class-speaking-studio",
    "2026-09-02",
    "2026-09-02T16:00:00.000Z",
    "2026-09-02T17:30:00.000Z",
    "Story arc and audience connection",
  ),
  event(
    "ielts-listening",
    "class-ielts-7b",
    "2026-09-03",
    "2026-09-03T13:00:00.000Z",
    "2026-09-03T14:00:00.000Z",
    "Listening: maps and multi-speaker cues",
    {
      status: "completed",
      attendanceState: "taken",
      actions: {
        ...ACTIONS,
        reschedule: false,
        cancel: false,
        complete: false,
      },
    },
  ),
  event(
    "debate-scrimmage",
    "class-debate-foundations",
    "2026-09-03",
    "2026-09-03T13:30:00.000Z",
    "2026-09-03T15:30:00.000Z",
    "Scrimmage: technology motion",
  ),
  event(
    "ielts-speaking",
    "class-ielts-7b",
    "2026-09-04",
    "2026-09-04T15:00:00.000Z",
    "2026-09-04T16:00:00.000Z",
    "Speaking Part 2: structured fluency",
  ),
  event(
    "speaking-cancelled",
    "class-speaking-studio",
    "2026-09-05",
    "2026-09-05T16:00:00.000Z",
    "2026-09-05T17:00:00.000Z",
    "Presentation rehearsal",
    {
      status: "cancelled",
      scheduleStatus: "cancelled",
      actions: {
        ...ACTIONS,
        reschedule: false,
        cancel: false,
        complete: false,
      },
    },
  ),
];

function detailFor(
  eventItem: TeacherCalendarEvent,
): TeacherEventDetailPresentation {
  const rosterNames = [
    "Minh Anh",
    "Linh Pham",
    "Noah Williams",
    "Sofia Tran",
    "Ethan Nguyen",
  ];
  const statuses: TeacherEventDetailPresentation["roster"][number]["status"][] =
    ["present", "late", "present", "absent", "unmarked"];
  return {
    eventId: eventItem.id,
    actionUrls: {
      viewClass: `/dashboard/teacher/classes/${eventItem.classId}`,
      takeAttendance: `/dashboard/teacher/classes/${eventItem.classId}?tab=attendance&date=${eventItem.date}`,
      reviewHomework: `/dashboard/teacher/review-queue?classId=${eventItem.classId}`,
      viewGradebook: `/dashboard/teacher/classes/${eventItem.classId}?tab=gradebook`,
      planLesson: `/dashboard/teacher/classes/${eventItem.classId}?tab=lessons&plan=${encodeURIComponent(eventItem.id)}`,
      manageMaterials: `/dashboard/teacher/materials?classId=${eventItem.classId}`,
      postAnnouncement: `/dashboard/teacher/classes/${eventItem.classId}?tab=announcements`,
    },
    rosterCount:
      DEMO_CLASSES.find((item) => item.id === eventItem.classId)
        ?.studentCount ?? rosterNames.length,
    roster: rosterNames.map((name, index) => ({
      id: `${eventItem.id}-student-${index}`,
      name,
      status: statuses[index],
    })),
    lessonNotes: eventItem.occurrenceId
      ? "Model one worked example, then move learners into paired practice before the final timed attempt."
      : null,
    materials: [
      {
        id: `${eventItem.id}-slides`,
        title: "Lesson slides",
        kind: "presentation",
        required: true,
      },
      {
        id: `${eventItem.id}-worksheet`,
        title: "Practice worksheet",
        kind: "worksheet",
        required: true,
      },
      {
        id: `${eventItem.id}-rubric`,
        title: "Feedback rubric",
        kind: "document",
        required: false,
      },
    ],
    homework: [
      {
        id: `${eventItem.id}-homework`,
        title: `${eventItem.title} follow-up`,
        dueAt: `${eventItem.date}T23:00:00.000Z`,
        submissions: eventItem.counts.submissionCount,
        reviews: eventItem.counts.reviewCount,
      },
    ],
    attendance: {
      sessionId: `${eventItem.id}-register`,
      present: 13,
      late: 2,
      absent: 1,
      recorded: 16,
    },
    announcements: [
      {
        id: `${eventItem.id}-announcement`,
        title: "Before class",
        body: "Bring your annotated practice response and review the highlighted rubric criteria.",
        publishedAt: "2026-08-30T15:00:00.000Z",
      },
    ],
  };
}

export function isExplicitTeacherWorkspaceDemo(value: string | undefined) {
  return process.env.NODE_ENV !== "production" && value === "teacher";
}

export function buildTeacherWorkspaceDemoPresentation(input: {
  locale: string;
  surface: TeacherWorkspaceSurface;
  view?: TeacherCalendarView;
  range?: TeacherCalendarRangeResult["range"];
}): TeacherWorkspacePresentation {
  const range =
    input.range ??
    ({
      startDate: "2026-08-31",
      endDate: "2026-09-06",
      view: input.view ?? "week",
      timezone: "America/New_York",
    } satisfies TeacherCalendarRangeResult["range"]);
  const calendarEvents = DEMO_EVENTS.filter(
    (event) => event.date >= range.startDate && event.date <= range.endDate,
  );
  const reviews: TeacherReviewPresentation[] = [
    {
      key: "writing-linh",
      kind: "writing",
      responseId: "demo-writing-response",
      submissionId: null,
      submissionUpdatedAt: null,
      programType: "ielts",
      classId: "class-ielts-7b",
      classTitle: "IELTS Academic 7B",
      studentName: "Linh Pham",
      assignmentTitle: "Task 2 · Public transport",
      submittedAt: "2026-08-29T19:42:00.000Z",
      dueAt: "2026-08-30T22:00:00.000Z",
      ageDays: 1,
      status: "needs_review",
      scoreSource: "ai_provisional",
      attemptLabel: "Attempt 2",
    },
    {
      key: "speaking-minh",
      kind: "speaking",
      responseId: "demo-speaking-response",
      submissionId: null,
      submissionUpdatedAt: null,
      programType: "ielts",
      classId: "class-ielts-7b",
      classTitle: "IELTS Academic 7B",
      studentName: "Minh Anh",
      assignmentTitle: "Speaking Part 2 · A memorable trip",
      submittedAt: "2026-08-30T14:10:00.000Z",
      dueAt: "2026-09-01T22:00:00.000Z",
      ageDays: 0,
      status: "needs_review",
      scoreSource: "ai_provisional",
      attemptLabel: "Attempt 1",
    },
    {
      key: "homework-noah",
      kind: "homework",
      responseId: null,
      submissionId: "demo-submission-noah",
      submissionUpdatedAt: "2026-08-28T21:05:00.000Z",
      programType: "debate",
      classId: "class-debate-foundations",
      classTitle: "Debate Foundations",
      studentName: "Noah Williams",
      assignmentTitle: "Rebuttal drill · round 3",
      submittedAt: "2026-08-28T21:05:00.000Z",
      dueAt: "2026-08-29T22:00:00.000Z",
      ageDays: 2,
      status: "needs_review",
      scoreSource: "none",
      attemptLabel: "Resubmission",
    },
    {
      key: "homework-sofia",
      kind: "homework",
      responseId: null,
      submissionId: "demo-submission-sofia",
      submissionUpdatedAt: "2026-08-27T16:30:00.000Z",
      programType: "public_speaking",
      classId: "class-speaking-studio",
      classTitle: "Public Speaking Studio",
      studentName: "Sofia Tran",
      assignmentTitle: "60-second story arc",
      submittedAt: "2026-08-27T16:30:00.000Z",
      dueAt: "2026-08-28T22:00:00.000Z",
      ageDays: 3,
      status: "returned",
      scoreSource: "teacher_published",
      attemptLabel: "Attempt 1",
    },
  ];
  const assignments: TeacherAssignmentPresentation[] = [
    {
      id: "assignment-task2",
      classId: "class-ielts-7b",
      title: "Writing Task 2 · Public transport",
      classTitle: "IELTS Academic 7B",
      kind: "writing",
      dueAt: "2026-09-02T22:00:00.000Z",
      status: "assigned",
      updatedAt: "2026-08-30T09:00:00.000Z",
      submitted: 15,
      reviewed: 8,
      missing: 3,
    },
    {
      id: "assignment-listening",
      classId: "class-ielts-7b",
      title: "Listening · Section 2 map",
      classTitle: "IELTS Academic 7B",
      kind: "listening",
      dueAt: "2026-09-03T22:00:00.000Z",
      status: "assigned",
      updatedAt: "2026-08-30T09:05:00.000Z",
      submitted: 12,
      reviewed: 12,
      missing: 6,
    },
    {
      id: "assignment-rebuttal",
      classId: "class-debate-foundations",
      title: "Rebuttal drill · round 3",
      classTitle: "Debate Foundations",
      kind: "homework",
      dueAt: "2026-09-01T22:00:00.000Z",
      status: "assigned",
      updatedAt: "2026-08-29T09:00:00.000Z",
      submitted: 14,
      reviewed: 11,
      missing: 2,
    },
    {
      id: "assignment-story",
      classId: "class-speaking-studio",
      title: "60-second story arc",
      classTitle: "Public Speaking Studio",
      kind: "speaking",
      dueAt: "2026-09-04T22:00:00.000Z",
      status: "draft",
      updatedAt: "2026-08-31T09:00:00.000Z",
      submitted: 0,
      reviewed: 0,
      missing: 0,
    },
  ];
  const students = [
    { id: "student-minh", name: "Minh Anh" },
    { id: "student-linh", name: "Linh Pham" },
    { id: "student-noah", name: "Noah Williams" },
    { id: "student-sofia", name: "Sofia Tran" },
    { id: "student-ethan", name: "Ethan Nguyen" },
  ];
  const assessments = [
    { id: "reading-1", title: "Reading 1", maxScore: 40 },
    { id: "listening-1", title: "Listening 1", maxScore: 40 },
    { id: "writing-1", title: "Writing 1", maxScore: 9 },
    { id: "speaking-1", title: "Speaking 1", maxScore: 9 },
  ];
  const scores = {
    "student-minh": {
      "reading-1": 32,
      "listening-1": 34,
      "writing-1": "draft" as const,
      "speaking-1": 7,
    },
    "student-linh": {
      "reading-1": 35,
      "listening-1": 33,
      "writing-1": "draft" as const,
      "speaking-1": 7.5,
    },
    "student-noah": {
      "reading-1": 27,
      "listening-1": "late" as const,
      "writing-1": 6.5,
      "speaking-1": 6.5,
    },
    "student-sofia": {
      "reading-1": 31,
      "listening-1": 36,
      "writing-1": 7,
      "speaking-1": 8,
    },
    "student-ethan": {
      "reading-1": "missing" as const,
      "listening-1": 29,
      "writing-1": 6,
      "speaking-1": 6.5,
    },
  };
  return {
    state: "ready",
    source: "explicit_demo",
    locale: input.locale,
    surface: input.surface,
    isAdminPreview: true,
    isHeadTeacher: true,
    hasIeltsEntitlement: true,
    classes: DEMO_CLASSES,
    calendar: {
      range,
      events: calendarEvents,
      classes: DEMO_CLASSES.map(({ id, title, programType, colorToken }) => ({
        id,
        title,
        programType,
        colorToken,
      })),
    },
    eventDetails: Object.fromEntries(
      calendarEvents.map((item) => [item.id, detailFor(item)]),
    ),
    reviews,
    assignments,
    gradebook: { students, assessments, scores },
    attendance: {
      classId: "class-ielts-7b",
      classTitle: "IELTS Academic 7B",
      sessionId: "demo-register",
      courseId: "demo-course",
      occurrenceId: "demo-occurrence",
      sessionDate: "2026-08-31",
      lessonAt: "2026-08-31T13:00:00.000Z",
      students: students.map((student, index) => ({
        ...student,
        status: (["present", "present", "late", "absent", "unmarked"] as const)[
          index
        ],
      })),
    },
    materials: [
      {
        id: "material-rubric",
        classId: "class-ielts-7b",
        title: "Writing Task 2 feedback rubric",
        classTitle: "IELTS Academic 7B",
        kind: "document",
        status: "published",
        updatedAt: "2026-08-30T14:00:00.000Z",
      },
      {
        id: "material-clash",
        classId: "class-debate-foundations",
        title: "Clash and weighing worksheet",
        classTitle: "Debate Foundations",
        kind: "worksheet",
        status: "published",
        updatedAt: "2026-08-29T18:00:00.000Z",
      },
      {
        id: "material-voice",
        classId: "class-speaking-studio",
        title: "Voice warm-up video",
        classTitle: "Public Speaking Studio",
        kind: "video",
        status: "scheduled",
        updatedAt: "2026-08-30T12:00:00.000Z",
      },
      {
        id: "material-sample",
        classId: "class-ielts-7b",
        title: "Band 7 sample essay",
        classTitle: "IELTS Academic 7B",
        kind: "link",
        status: "draft",
        updatedAt: "2026-08-31T12:00:00.000Z",
      },
    ],
    announcements: [
      {
        id: "announcement-1",
        classId: "class-ielts-7b",
        title: "Mock test room change",
        classTitle: "IELTS Academic 7B",
        body: "Thursday’s mock test will meet in Studio 2. Bring headphones and arrive ten minutes early.",
        status: "published",
        publishAt: "2026-08-30T13:00:00.000Z",
      },
      {
        id: "announcement-2",
        classId: "class-debate-foundations",
        title: "Scrimmage teams posted",
        classTitle: "Debate Foundations",
        body: "Teams and speaking positions are available in Materials.",
        status: "scheduled",
        publishAt: "2026-09-01T12:00:00.000Z",
      },
      {
        id: "announcement-3",
        classId: "class-speaking-studio",
        title: "Bring a story object",
        classTitle: "Public Speaking Studio",
        body: "Draft: bring one object that can anchor a two-minute personal story.",
        status: "draft",
        publishAt: null,
      },
    ],
  };
}

import { createHash } from "node:crypto";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
// eslint-disable-next-line no-restricted-imports -- standalone, explicitly confirmed service-role CLI
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const TEACHER_WORKSPACE_DEMO_TAG = "teacher-workspace-demo-v1";
export const DEFAULT_TEACHER_EMAIL = "jknguyen.wor@gmail.com";
type DemoRow = Record<string, unknown> & { id?: string };
export interface TeacherWorkspaceDemoManifest {
  tag: string;
  organizationId: string;
  teacherId: string;
  syntheticLearnerEmails: string[];
  tables: Record<string, DemoRow[]>;
}

export function deterministicUuid(key: string) {
  const digest = createHash("sha256")
    .update(`${TEACHER_WORKSPACE_DEMO_TAG}:${key}`)
    .digest("hex");
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-${((parseInt(digest.slice(16, 18), 16) & 0x3f) | 0x80).toString(16)}${digest.slice(18, 20)}-${digest.slice(20, 32)}`;
}
function metadata(extra: Record<string, unknown> = {}) {
  return {
    seed: TEACHER_WORKSPACE_DEMO_TAG,
    analytics_excluded: true,
    ...extra,
  };
}
function atDate(weekStart: string, offset: number) {
  const date = new Date(`${weekStart}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

/** A complete, deterministic fixture for the teacher workspace. */
export function buildTeacherWorkspaceDemoManifest(input: {
  organizationId: string;
  teacherId: string;
  learnerIds: string[];
  learnerEmails?: string[];
  weekStart?: string;
}): TeacherWorkspaceDemoManifest {
  const weekStart = input.weekStart ?? "2026-08-31";
  const id = (key: string) =>
    deterministicUuid(`${input.organizationId}:${input.teacherId}:${key}`);
  const classSpecs = [
    {
      key: "ielts-foundation",
      code: "DEMO-IELTS-FOUNDATION",
      title: "[Demo] IELTS Foundation",
      grade: "Foundation",
      program: "ielts",
      color: "teal",
    },
    {
      key: "debate",
      code: "DEMO-DEBATE-FOUNDATION",
      title: "[Demo] Debate Lab",
      grade: "Beginner",
      program: "debate",
      color: "amber",
    },
    {
      key: "public-speaking",
      code: "DEMO-PUBLIC-SPEAKING",
      title: "[Demo] Public Speaking",
      grade: "Beginner",
      program: "public_speaking",
      color: "violet",
    },
  ] as const;
  const classes = classSpecs.map((spec) => ({
    id: id(`class:${spec.key}`),
    code: spec.code,
    club_id: input.organizationId,
    title: spec.title,
    description:
      "Demo-only teacher workspace class. Safe to remove with the tagged cleanup command.",
    grade_level: spec.grade,
    program_type: spec.program,
    status: "active",
    start_date: weekStart,
    end_date: "2026-12-31",
    teacher_user_id: input.teacherId,
    created_by: input.teacherId,
    metadata: metadata({ classKey: spec.key }),
  }));
  const courses = classSpecs.map((spec, index) => ({
    id: id(`course:${spec.key}`),
    title: `[Demo] ${spec.title.replace("[Demo] ", "")} Course`,
    slug: `teacher-workspace-demo-${spec.key}`,
    description: "Tagged teacher workspace demo course.",
    short_description: "Demo course",
    category: spec.program,
    subject: spec.program,
    difficulty: "beginner",
    estimated_hours: 4,
    is_published: true,
    is_free: true,
    is_archived: false,
    visibility: "class_restricted",
    sort_order: index,
    created_by: input.teacherId,
    metadata: metadata({ classKey: spec.key }),
  }));
  const modules = classSpecs.map((spec) => ({
    id: id(`module:${spec.key}`),
    course_id: id(`course:${spec.key}`),
    title: `[Demo] ${spec.title} Module`,
    description: "Demo module",
    order_index: 0,
    sort_order: 0,
  }));
  const lessons = classSpecs.map((spec) => ({
    id: id(`lesson:${spec.key}`),
    module_id: id(`module:${spec.key}`),
    title: `[Demo] ${spec.title} Lesson`,
    slug: `teacher-workspace-demo-${spec.key}`,
    type: "article",
    content: { seed: TEACHER_WORKSPACE_DEMO_TAG },
    duration_minutes: 30,
    order_index: 0,
    is_published: true,
  }));
  const activities = classSpecs.map((spec) => ({
    id: id(`activity:${spec.key}`),
    module_id: id(`module:${spec.key}`),
    activity_type: "lesson",
    title: `[Demo] ${spec.title} Practice`,
    description: "Demo practice activity",
    phase: "practice",
    order_index: 1,
    duration_minutes: 15,
    content: { prompt: "Complete this demo activity." },
    metadata: metadata({ classKey: spec.key }),
  }));
  const tables: Record<string, DemoRow[]> = {
    lms_outbox_events: [],
    lms_pilot_flags: [],
    teacher_workspace_preferences: [],
    teacher_workspace_class_preferences: [],
    classes,
    courses,
    course_modules: modules,
    lessons,
    activities,
    class_course_assignments: [],
    class_schedules: [],
    class_memberships: [],
    lms_resources: [],
    lms_resource_assignments: [],
    lms_lesson_occurrences: [],
    lms_occurrence_resources: [],
    lms_occurrence_assignments: [],
    lms_occurrence_roster_snapshots: [],
    class_attendance_sessions: [],
    class_attendance_records: [],
    club_assignments: [],
    club_assignment_submissions: [],
    lms_announcements: [],
    lms_notifications: [],
    notification_events: [],
    notification_inbox_items: [],
  };
  const classByKey = (key: string) =>
    classes.find(
      (row) => (row.metadata as Record<string, unknown>).classKey === key,
    )!;
  const courseByKey = (key: string) =>
    courses.find(
      (row) => (row.metadata as Record<string, unknown>).classKey === key,
    )!;
  for (const spec of classSpecs) {
    const cls = classByKey(spec.key);
    const course = courseByKey(spec.key);
    tables.class_course_assignments.push({
      id: id(`class-course:${spec.key}`),
      class_id: cls.id,
      course_id: course.id,
      assigned_by: input.teacherId,
      metadata: metadata({ classKey: spec.key }),
    });
    tables.lms_pilot_flags.push({
      id: id(`pilot:${spec.key}`),
      club_id: input.organizationId,
      class_id: cls.id,
      feature_key: "teacher_workspace_v2",
      enabled: true,
      enabled_by: input.teacherId,
      enabled_at: `${weekStart}T08:00:00Z`,
      metadata: metadata({ classKey: spec.key }),
    });
    tables.teacher_workspace_class_preferences.push({
      user_id: input.teacherId,
      class_id: cls.id,
      color_token: spec.color,
    });
    tables.class_memberships.push({
      id: id(`teacher-membership:${cls.id}`),
      class_id: cls.id,
      user_id: input.teacherId,
      member_role: "teacher",
      status: "active",
      joined_at: `${weekStart}T08:00:00Z`,
      created_by: input.teacherId,
      metadata: metadata(),
    });
    input.learnerIds.forEach((learnerId, index) =>
      tables.class_memberships.push({
        id: id(`student-membership:${cls.id}:${learnerId}`),
        class_id: cls.id,
        user_id: learnerId,
        member_role: "student",
        status: "active",
        joined_at: `${weekStart}T08:00:00Z`,
        created_by: input.teacherId,
        metadata: metadata({ seat: index + 1 }),
      }),
    );
    for (const kind of ["reading", "speaking"] as const) {
      const resourceId = id(`resource:${spec.key}:${kind}`);
      tables.lms_resources.push({
        id: resourceId,
        club_id: input.organizationId,
        scope_class_id: cls.id,
        title: `[Demo] ${kind} reference`,
        description: "Demo link with explicit provenance and license.",
        kind: "link",
        url: `https://example.com/teacher-workspace-demo/${spec.key}/${kind}`,
        provenance: "Thinkfy demo fixture; example.com reference",
        license_status: "approved",
        status: "published",
        published_at: `${weekStart}T08:30:00Z`,
        created_by: input.teacherId,
        metadata: metadata({ classKey: spec.key, licensed: true }),
      });
      tables.lms_resource_assignments.push({
        id: id(`resource-assignment:${spec.key}:${kind}`),
        resource_id: resourceId,
        class_id: cls.id,
        assigned_by: input.teacherId,
      });
    }
  }
  const scheduleSpecs = [
    [
      "ielts-foundation",
      0,
      "09:00:00",
      "10:30:00",
      true,
      "IELTS Writing workshop",
    ],
    ["debate", 0, "09:45:00", "11:15:00", false, "Case building studio"],
    [
      "public-speaking",
      1,
      "14:00:00",
      "15:00:00",
      true,
      "Speaking with confidence",
    ],
    [
      "ielts-foundation",
      3,
      "16:00:00",
      "17:30:00",
      false,
      "IELTS feedback clinic",
    ],
    ["debate", 4, "10:00:00", "11:00:00", true, "Rebuttal drills"],
  ] as const;
  for (const [
    classKey,
    dayOffset,
    startTime,
    endTime,
    planned,
    title,
  ] of scheduleSpecs) {
    const cls = classByKey(classKey);
    const date = atDate(weekStart, dayOffset);
    tables.class_schedules.push({
      id: id(`schedule:${classKey}:${dayOffset}:${startTime}`),
      class_id: cls.id,
      course_id: courseByKey(classKey).id,
      title: `[Demo] ${title}`,
      room: classKey === "ielts-foundation" ? "Room A" : "Room B",
      location: "Thinkfy Demo Campus",
      start_date: date,
      end_date: date,
      start_time: startTime,
      end_time: endTime,
      timezone: "America/New_York",
      recurrence_rule: { frequency: "none" },
      status: "active",
      created_by: input.teacherId,
      metadata: metadata({
        classKey,
        planned,
        scheduleKind: planned ? "planned" : "unplanned",
      }),
    });
  }
  const assignmentSpecs = [
    [
      "ielts-writing",
      "ielts-foundation",
      "[Demo] Writing Task 2 — feedback round",
      "writing",
      1,
      false,
    ],
    [
      "ielts-reading",
      "ielts-foundation",
      "[Demo] Reading — auto-marked",
      "reading",
      1,
      true,
    ],
    [
      "ielts-listening",
      "ielts-foundation",
      "[Demo] Listening — auto-marked",
      "listening",
      2,
      true,
    ],
    [
      "debate",
      "debate",
      "[Demo] Constructive case outline",
      "debate",
      2,
      false,
    ],
    [
      "public-speaking",
      "public-speaking",
      "[Demo] Three-minute introduction",
      "speaking",
      3,
      false,
    ],
  ] as const;
  for (const [
    assignmentKey,
    classKey,
    title,
    track,
    dayOffset,
    autoMarked,
  ] of assignmentSpecs) {
    const cls = classByKey(classKey);
    const assignmentId = id(`assignment:${assignmentKey}`);
    tables.club_assignments.push({
      id: assignmentId,
      club_id: input.organizationId,
      class_id: cls.id,
      title,
      description:
        "Demo ordinary homework assignment for teacher review queue.",
      assignment_type: "practice",
      assigned_track:
        track === "writing" || track === "listening" || track === "reading"
          ? "speaking"
          : track,
      due_at: `${atDate(weekStart, dayOffset)}T17:00:00Z`,
      status: "active",
      created_by: input.teacherId,
      required_attempts: 1,
      rubric_key: "debate_v1",
      rubric_version: 1,
      submission_text_enabled: true,
      submission_files_enabled: false,
      submission_instructions: "Submit a short response.",
      metadata: metadata({
        classKey,
        assignmentKey,
        queueExample: !autoMarked,
        autoMarked,
      }),
    });
    input.learnerIds.forEach((learnerId, index) => {
      const queueState = autoMarked
        ? "graded"
        : index % 3 === 0
          ? "submitted"
          : index % 3 === 1
            ? "returned"
            : "graded";
      tables.club_assignment_submissions.push({
        id: id(`submission:${assignmentKey}:${learnerId}`),
        assignment_id: assignmentId,
        club_id: input.organizationId,
        class_id: cls.id,
        user_id: learnerId,
        source_type: "manual",
        source_id: id(`source:${assignmentKey}:${learnerId}`),
        submission_state: "submitted",
        status: queueState === "graded" ? "reviewed" : "submitted",
        grade_status: queueState,
        score: queueState === "graded" ? (autoMarked ? 34 : 86) : null,
        score_max: queueState === "graded" ? (autoMarked ? 40 : 100) : null,
        graded_by: queueState === "graded" ? input.teacherId : null,
        graded_at: queueState === "graded" ? `${weekStart}T15:00:00Z` : null,
        submitted_at: `${weekStart}T${String(10 + index).padStart(2, "0")}:00:00Z`,
        submission_text: "Demo learner submission for the teacher workspace.",
        rubric_breakdown: queueState === "graded" ? { clarity: 86 } : {},
        feedback:
          queueState === "graded"
            ? autoMarked
              ? "[Demo] Automatically marked with answer-key feedback."
              : "Demo feedback: clear structure."
            : null,
        metadata: metadata({ classKey, assignmentKey, queueState, autoMarked }),
      });
    });
  }
  const ielts = classByKey("ielts-foundation");
  const ieltsCourse = courseByKey("ielts-foundation");
  const ieltsLesson = lessons.find(
    (row) => row.module_id === id("module:ielts-foundation"),
  )!;
  (
    [
      [0, "scheduled"],
      [1, "completed"],
      [2, "cancelled"],
    ] as const
  ).forEach(([offset, status], index) => {
    const occurrenceId = id(`occurrence:${status}`);
    const schedule = tables.class_schedules.find(
      (row) =>
        row.class_id === ielts.id &&
        (row.metadata as Record<string, unknown>).planned === true,
    )!;
    const date = atDate(weekStart, offset);
    tables.lms_lesson_occurrences.push({
      id: occurrenceId,
      club_id: input.organizationId,
      class_id: ielts.id,
      class_schedule_id: schedule.id,
      course_id: ieltsCourse.id,
      lesson_id: ieltsLesson.id,
      occurrence_date: date,
      starts_at: `${date}T13:00:00Z`,
      ends_at: `${date}T14:00:00Z`,
      timezone: "UTC",
      title: `[Demo] IELTS occurrence ${status}`,
      notes: "Demo occurrence",
      status,
      published_at: status === "cancelled" ? null : `${date}T08:00:00Z`,
      created_by: input.teacherId,
      updated_by: input.teacherId,
      metadata: metadata({ status, planned: index !== 2 }),
    });
    tables.lms_occurrence_assignments.push({
      occurrence_id: occurrenceId,
      assignment_id: id("assignment:ielts-writing"),
      relation_type: "homework",
      added_by: input.teacherId,
    });
    tables.lms_occurrence_resources.push({
      occurrence_id: occurrenceId,
      resource_id: id("resource:ielts-foundation:reading"),
      order_index: 0,
      required: true,
      added_by: input.teacherId,
    });
    tables.lms_occurrence_roster_snapshots.push(
      ...[input.teacherId, ...input.learnerIds].map((userId) => ({
        occurrence_id: occurrenceId,
        user_id: userId,
        class_membership_id: id(
          `${userId === input.teacherId ? "teacher" : "student"}-membership:${ielts.id}${userId === input.teacherId ? "" : `:${userId}`}`,
        ),
        enrollment_status: "enrolled",
      })),
    );
    if (index < 2) {
      const sessionId = id(`attendance-session:${status}`);
      tables.class_attendance_sessions.push({
        id: sessionId,
        class_id: ielts.id,
        course_id: ieltsCourse.id,
        occurrence_id: occurrenceId,
        session_date: date,
        title: `[Demo] Attendance ${status}`,
        notes: "Demo attendance",
        taken_by: input.teacherId,
        metadata: metadata({ status }),
      });
      input.learnerIds.forEach((userId, learnerIndex) =>
        tables.class_attendance_records.push({
          id: id(`attendance-record:${status}:${userId}`),
          session_id: sessionId,
          user_id: userId,
          status: learnerIndex % 2 === 0 ? "present" : "late",
          notes: "[Demo] attendance record",
        }),
      );
    }
  });
  const announcementId = id("announcement:welcome");
  tables.lms_outbox_events.push({
    id: id("outbox:announcement:welcome"),
    club_id: input.organizationId,
    class_id: ielts.id,
    event_type: "announcement",
    dedupe_key: `announcement-published:${announcementId}`,
    payload: { demoTag: TEACHER_WORKSPACE_DEMO_TAG, announcementId },
    recipient_ids: [],
    email_recipient_ids: [],
    status: "cancelled",
    attempts: 0,
    last_error: "Demo delivery disabled",
    processed_at: null,
    available_at: `${weekStart}T08:00:00Z`,
  });
  for (const row of tables.club_assignments)
    tables.lms_outbox_events.push({
      id: id(`outbox:assignment:${row.id}`),
      club_id: input.organizationId,
      class_id: row.class_id,
      event_type: "assignment_published",
      dedupe_key: `assignment-published:${row.id}`,
      payload: { demoTag: TEACHER_WORKSPACE_DEMO_TAG, assignmentId: row.id },
      recipient_ids: [],
      email_recipient_ids: [],
      status: "cancelled",
      attempts: 0,
      last_error: "Demo delivery disabled",
      processed_at: null,
      available_at: `${weekStart}T08:00:00Z`,
    });
  tables.lms_announcements.push({
    id: announcementId,
    club_id: input.organizationId,
    class_id: ielts.id,
    title: "[Demo] Welcome to this week",
    body: "Your teacher has shared this demo announcement with the class.",
    status: "published",
    published_at: `${weekStart}T08:00:00Z`,
    publish_at: `${weekStart}T08:00:00Z`,
    created_by: input.teacherId,
    updated_by: input.teacherId,
  });
  const notificationEventId = id("notification-event:welcome");
  tables.notification_events.push({
    id: notificationEventId,
    event_key: `${TEACHER_WORKSPACE_DEMO_TAG}:${input.organizationId}:${input.teacherId}:welcome`,
    event_type: "announcement",
    source: "lms-demo",
    actor_id: input.teacherId,
    subject_type: "class",
    subject_id: ielts.id,
    title: "[Demo] New class announcement",
    body: "A demo class announcement is ready to review.",
    message_class: "operational",
    topic: "announcements",
    payload: metadata({ classId: ielts.id, announcementId }),
    importance: "normal",
    created_at: `${weekStart}T08:00:00Z`,
  });
  for (const recipientId of [input.teacherId, ...input.learnerIds]) {
    tables.notification_inbox_items.push({
      id: id(`notification-inbox:welcome:${recipientId}`),
      event_id: notificationEventId,
      recipient_id: recipientId,
      state: "unread",
      read_at: null,
      archived_at: null,
      created_at: `${weekStart}T08:00:00Z`,
    });
  }
  return {
    tag: TEACHER_WORKSPACE_DEMO_TAG,
    organizationId: input.organizationId,
    teacherId: input.teacherId,
    syntheticLearnerEmails:
      input.learnerEmails ??
      input.learnerIds.map(
        (_, i) => `teacher-workspace-demo-${i + 1}@invalid.thinkfy.test`,
      ),
    tables,
  };
}

export function parseTeacherWorkspaceDemoArgs(argv: string[]) {
  const result = {
    apply: false,
    cleanup: false,
    organizationId: null as string | null,
    projectRef: null as string | null,
    email: DEFAULT_TEACHER_EMAIL,
    weekStart: "2026-08-31",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--apply") result.apply = true;
    else if (arg === "--cleanup") result.cleanup = true;
    else if (arg === "--organization-id")
      result.organizationId = argv[++index] ?? null;
    else if (arg === "--project-ref") result.projectRef = argv[++index] ?? null;
    else if (arg === "--week-start")
      result.weekStart = argv[++index] ?? result.weekStart;
    else if (arg === "--email")
      throw new Error(
        "--email is not supported; the demo teacher is fixed to jknguyen.wor@gmail.com.",
      );
    else if (arg === "--help" || arg === "-h") {
      console.log(
        "Usage: tsx scripts/teacher-workspace-demo.ts [--apply|--cleanup] --project-ref <ref> --organization-id <uuid> [--week-start <date>]\nDefault is a dry run. Mutating modes require exact project and organization identifiers.",
      );
      process.exit(0);
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  if (result.apply && result.cleanup)
    throw new Error("Choose --apply or --cleanup, not both.");
  if (
    (result.apply || result.cleanup) &&
    (!result.projectRef || !result.organizationId)
  )
    throw new Error(
      "--apply and --cleanup require explicit --project-ref and --organization-id.",
    );
  return result;
}
function configuredClient() {
  loadEnvConfig(path.resolve(process.cwd(), "apps/web"));
  loadEnvConfig(process.cwd());
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.",
    );
  return {
    url,
    client: createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    }),
  };
}
function assertProjectRef(url: string, supplied: string | null) {
  const actual = new URL(url).hostname.split(".")[0];
  if (!supplied || supplied !== actual)
    throw new Error(
      `Refusing to run: --project-ref must exactly match configured Supabase project (${actual}).`,
    );
}
async function resolveTeacher(client: SupabaseClient) {
  const users = await client.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (users.error) throw new Error(`teacher lookup: ${users.error.message}`);
  const matches = users.data.users.filter(
    (user) => user.email?.toLowerCase() === DEFAULT_TEACHER_EMAIL,
  );
  if (matches.length !== 1)
    throw new Error(
      `Expected exactly one auth user for ${DEFAULT_TEACHER_EMAIL}; found ${matches.length}.`,
    );
  return matches[0].id;
}
async function resolveOrganization(
  client: SupabaseClient,
  teacherId: string,
  explicitId: string | null,
) {
  if (explicitId) {
    const { data, error } = await client
      .from("club_memberships")
      .select("club_id")
      .eq("user_id", teacherId)
      .eq("club_id", explicitId)
      .eq("status", "active");
    if (error) throw new Error(`organization lookup: ${error.message}`);
    if (data?.length !== 1)
      throw new Error(
        "The exact organization is not an active membership for this teacher.",
      );
    return explicitId;
  }
  const { data, error } = await client
    .from("club_memberships")
    .select("club_id")
    .eq("user_id", teacherId)
    .eq("status", "active");
  if (error) throw new Error(`organization lookup: ${error.message}`);
  const ids = [...new Set((data ?? []).map((row) => row.club_id))];
  if (ids.length !== 1)
    throw new Error(
      `Teacher has ${ids.length} active organizations; pass --organization-id explicitly.`,
    );
  return ids[0]!;
}
async function ensureSyntheticLearners(
  client: SupabaseClient,
  organizationId: string,
  teacherId: string,
  count = 4,
  create = true,
) {
  const listed = await client.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listed.error)
    throw new Error(`synthetic learner lookup: ${listed.error.message}`);
  const ids: string[] = [];
  const emails: string[] = [];
  for (let index = 1; index <= count; index += 1) {
    const email = `teacher-workspace-demo-${index}@invalid.thinkfy.test`;
    emails.push(email);
    const existing = listed.data.users.find(
      (user) => user.email?.toLowerCase() === email,
    );
    if (existing) {
      if (
        existing.user_metadata?.teacher_workspace_demo !==
          TEACHER_WORKSPACE_DEMO_TAG ||
        existing.user_metadata?.organization_id !== organizationId ||
        existing.user_metadata?.teacher_id !== teacherId
      )
        throw new Error(
          `Refusing to reuse synthetic auth user ${email}: demo metadata tag does not match.`,
        );
      ids.push(existing.id);
      continue;
    }
    if (!create) {
      ids.push(
        deterministicUuid(
          `${organizationId}:${teacherId}:synthetic-learner:${index}`,
        ),
      );
      continue;
    }
    const created = await client.auth.admin.createUser({
      email,
      email_confirm: true,
      password: `${deterministicUuid(`${organizationId}:${teacherId}:password:${index}`)}Aa!1`,
      user_metadata: {
        teacher_workspace_demo: TEACHER_WORKSPACE_DEMO_TAG,
        organization_id: organizationId,
        teacher_id: teacherId,
      },
      ban_duration: "876000h",
    });
    if (created.error || !created.data.user)
      throw new Error(
        `synthetic learner ${index}: ${created.error?.message ?? "not created"}`,
      );
    ids.push(created.data.user.id);
  }
  return { ids, emails };
}
function isProvablyDemoTagged(existing: DemoRow, expected: DemoRow) {
  const existingMetadata = existing.metadata;
  if (
    existingMetadata &&
    typeof existingMetadata === "object" &&
    (existingMetadata as Record<string, unknown>).seed ===
      TEACHER_WORKSPACE_DEMO_TAG
  )
    return true;
  const payload = existing.payload;
  if (
    payload &&
    typeof payload === "object" &&
    (payload as Record<string, unknown>).demoTag === TEACHER_WORKSPACE_DEMO_TAG
  )
    return true;
  return Object.entries(expected).some(
    ([key, value]) =>
      typeof value === "string" &&
      value.includes("[Demo]") &&
      existing[key] === value,
  );
}
const IDLESS_TABLE_KEYS: Record<string, string[]> = {
  teacher_workspace_class_preferences: ["user_id", "class_id"],
  lms_occurrence_resources: ["occurrence_id", "resource_id"],
  lms_occurrence_assignments: ["occurrence_id", "assignment_id"],
  lms_occurrence_roster_snapshots: ["occurrence_id", "user_id"],
};
function rowWithoutSyntheticId(row: DemoRow) {
  const safe = { ...row };
  delete safe.id;
  delete safe.metadata;
  return safe;
}
function sameFixtureShape(existing: DemoRow, expected: DemoRow) {
  return Object.entries(expected)
    .filter(([key]) => key !== "id" && key !== "metadata")
    .every(([key, value]) => existing[key] === value);
}
async function assertNoDeterministicCollisions(
  client: SupabaseClient,
  manifest: TeacherWorkspaceDemoManifest,
) {
  for (const [table, rows] of Object.entries(manifest.tables)) {
    if (!rows.length) continue;
    const expected = new Map(rows.map((row) => [row.id, row]));
    let existingRows: DemoRow[] = [];
    const keyColumns = IDLESS_TABLE_KEYS[table];
    if (keyColumns) {
      const result = await client.from(table).select("*");
      if (result.error)
        throw new Error(`collision check ${table}: ${result.error.message}`);
      existingRows = (result.data ?? []) as DemoRow[];
      existingRows = existingRows.filter((existing) =>
        rows.some((row) =>
          keyColumns.every((key) => existing[key] === row[key]),
        ),
      );
    } else {
      const result = await client
        .from(table)
        .select("*")
        .in(
          "id",
          rows.map((row) => row.id),
        );
      if (result.error)
        throw new Error(`collision check ${table}: ${result.error.message}`);
      existingRows = (result.data ?? []) as DemoRow[];
    }
    for (const existing of existingRows) {
      const expectedRow =
        expected.get(existing.id) ??
        rows.find((row) =>
          keyColumns?.every((key) => existing[key] === row[key]),
        );
      if (
        !expectedRow ||
        !isProvablyDemoTagged(existing, expectedRow) &&
        !(
          table === "notification_inbox_items" &&
          existing.event_id === expectedRow.event_id &&
          existing.recipient_id === expectedRow.recipient_id
        ) &&
        !(keyColumns &&
          !Object.prototype.hasOwnProperty.call(existing, "metadata") &&
          !Object.prototype.hasOwnProperty.call(existing, "payload") &&
          sameFixtureShape(existing, expectedRow))
      )
        throw new Error(
          `Refusing deterministic ID collision in ${table}:${existing.id ?? "composite-key"}; existing row is not provably tagged ${TEACHER_WORKSPACE_DEMO_TAG}.`,
        );
    }
  }
}
async function assertWorkspaceFeatureEnabled(
  client: SupabaseClient,
  organizationId: string,
) {
  const result = await client
    .from("lms_pilot_flags")
    .select("class_id, enabled")
    .eq("club_id", organizationId)
    .eq("feature_key", "teacher_workspace_v2")
    .eq("enabled", true);
  if (result.error)
    throw new Error(`workspace feature lookup: ${result.error.message}`);
  if (!result.data?.length)
    throw new Error(
      "Refusing to apply demo: teacher_workspace_v2 is not enabled for the exact organization.",
    );
}
const APPLY_ORDER = [
  "classes",
  "courses",
  "course_modules",
  "lessons",
  "activities",
  "lms_pilot_flags",
  "teacher_workspace_preferences",
  "teacher_workspace_class_preferences",
  "class_course_assignments",
  "class_schedules",
  "class_memberships",
  "lms_resources",
  "lms_resource_assignments",
  "lms_lesson_occurrences",
  "lms_occurrence_resources",
  "lms_occurrence_assignments",
  "lms_occurrence_roster_snapshots",
  "class_attendance_sessions",
  "class_attendance_records",
  "club_assignments",
  "club_assignment_submissions",
  "lms_outbox_events",
  "lms_announcements",
  "lms_notifications",
  "notification_events",
  "notification_inbox_items",
];
async function upsertManifest(
  client: SupabaseClient,
  manifest: TeacherWorkspaceDemoManifest,
) {
  await assertNoDeterministicCollisions(client, manifest);
  for (const table of APPLY_ORDER) {
    const rows = manifest.tables[table] ?? [];
    if (!rows.length) continue;
    const keyColumns = IDLESS_TABLE_KEYS[table];
    // The classes trigger requires the lead teacher to already have an active
    // class membership. Create the class without its pointer, add memberships,
    // then attach the pointer in the same deterministic seed operation below.
    const payload = keyColumns
      ? rows.map(rowWithoutSyntheticId)
      : table === "classes"
        ? rows.map((row) => ({ ...row, teacher_user_id: null }))
        : rows;
    const result = keyColumns
      ? await client
          .from(table)
          .upsert(payload, { onConflict: keyColumns.join(",") })
      : await client.from(table).upsert(payload, { onConflict: "id" });
    if (result.error) throw new Error(`seed ${table}: ${result.error.message}`);

    if (table === "class_memberships") {
      for (const classRow of manifest.tables.classes ?? []) {
        const update = await client
          .from("classes")
          .update({ teacher_user_id: manifest.teacherId })
          .eq("id", classRow.id);
        if (update.error)
          throw new Error(
            `seed lead teacher ${String(classRow.id)}: ${update.error.message}`,
          );
      }
    }
  }
}
async function cleanupManifest(
  client: SupabaseClient,
  manifest: TeacherWorkspaceDemoManifest,
) {
  await assertNoDeterministicCollisions(client, manifest);
  for (const table of [...APPLY_ORDER].reverse()) {
    const rows = manifest.tables[table] ?? [];
    if (!rows.length) continue;
    const keyColumns = IDLESS_TABLE_KEYS[table];
    if (keyColumns) {
      for (const row of rows) {
        let query = client.from(table).delete();
        for (const key of keyColumns) query = query.eq(key, row[key]);
        const result = await query;
        if (result.error)
          throw new Error(`cleanup ${table}: ${result.error.message}`);
      }
    } else {
      const result = await client
        .from(table)
        .delete()
        .in(
          "id",
          rows.map((row) => row.id),
        );
      if (result.error)
        throw new Error(`cleanup ${table}: ${result.error.message}`);
    }
  }
  const listed = await client.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listed.error)
    throw new Error(`cleanup synthetic learners: ${listed.error.message}`);
  for (const email of manifest.syntheticLearnerEmails) {
    const user = listed.data.users.find(
      (candidate) => candidate.email?.toLowerCase() === email.toLowerCase(),
    );
    if (!user) continue;
    if (
      user.user_metadata?.teacher_workspace_demo !== TEACHER_WORKSPACE_DEMO_TAG
      || user.user_metadata?.organization_id !== manifest.organizationId
      || user.user_metadata?.teacher_id !== manifest.teacherId
    )
      throw new Error(
        `Refusing to delete synthetic auth user ${email}: demo metadata tag does not match.`,
      );
    const result = await client.auth.admin.deleteUser(user.id);
    if (result.error)
      throw new Error(`cleanup ${email}: ${result.error.message}`);
  }
}
async function main() {
  const options = parseTeacherWorkspaceDemoArgs(process.argv.slice(2));
  const { url, client } = configuredClient();
  if (options.apply || options.cleanup)
    assertProjectRef(url, options.projectRef);
  const teacherId = await resolveTeacher(client);
  const organizationId = await resolveOrganization(
    client,
    teacherId,
    options.organizationId,
  );
  if (options.apply) await assertWorkspaceFeatureEnabled(client, organizationId);
  const learners = await ensureSyntheticLearners(
    client,
    organizationId,
    teacherId,
    4,
    options.apply,
  );
  const manifest = buildTeacherWorkspaceDemoManifest({
    organizationId,
    teacherId,
    learnerIds: learners.ids,
    learnerEmails: learners.emails,
    weekStart: options.weekStart,
  });
  console.log(
    JSON.stringify(
      {
        mode: options.cleanup ? "cleanup" : options.apply ? "apply" : "dry-run",
        projectRef: new URL(url).hostname.split(".")[0],
        organizationId,
        teacherId,
        tag: manifest.tag,
        counts: Object.fromEntries(
          Object.entries(manifest.tables).map(([table, rows]) => [
            table,
            rows.length,
          ]),
        ),
      },
      null,
      2,
    ),
  );
  if (options.cleanup) await cleanupManifest(client, manifest);
  else if (options.apply) await upsertManifest(client, manifest);
  else
    console.log(
      "Dry run: no database writes were performed. Pass --apply or --cleanup with explicit project and organization identifiers.",
    );
}
if (import.meta.url === `file://${process.argv[1]}`)
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });

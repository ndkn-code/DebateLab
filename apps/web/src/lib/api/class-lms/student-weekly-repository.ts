import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSessionUserId } from "@/lib/api/ielts/assignment-access";
import { LMS_RESOURCE_BUCKET } from "./model";
import { createTypedServerClient } from "@/lib/supabase/server";

type Row = Record<string, unknown>;

export interface StudentWeeklyResource {
  id: string;
  title: string;
  kind: string;
  required: boolean;
  url: string | null;
  signedUrl: string | null;
}

export interface StudentWeeklyAssignment {
  id: string;
  title: string;
  relationType: "prework" | "classwork" | "homework";
  dueAt: string | null;
  status: string;
  submissionState: string | null;
  gradeStatus: string | null;
}

export interface StudentWeeklyOccurrence {
  id: string;
  classId: string;
  classTitle: string;
  courseId: string;
  courseTitle: string;
  lessonId: string | null;
  lessonTitle: string | null;
  activityId: string | null;
  activityTitle: string | null;
  date: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  title: string;
  notes: string | null;
  status: string;
  historical: boolean;
  attendance: string | null;
  resources: StudentWeeklyResource[];
  assignments: StudentWeeklyAssignment[];
}

export interface StudentWeeklyLmsView {
  range: { startDate: string; endDate: string };
  occurrences: StudentWeeklyOccurrence[];
  announcements: Array<{ id: string; classId: string; title: string; body: string; publishedAt: string | null }>;
  notifications: Array<{ id: string; eventType: string; title: string; body: string; readAt: string | null; createdAt: string }>;
  unreadNotifications: number;
}

function ids(rows: Row[], key: string) {
  return [...new Set(rows.map((row) => row[key]).filter((value): value is string => typeof value === "string"))];
}

function byId(rows: Row[]) {
  return new Map(rows.map((row) => [String(row.id), row]));
}

function assertDateRange(startDate: string, endDate: string) {
  const pattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!pattern.test(startDate) || !pattern.test(endDate)) throw new Error("Invalid schedule date range");
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const days = (end.getTime() - start.getTime()) / 86_400_000;
  if (!Number.isFinite(days) || days < 0 || days > 13) throw new Error("Schedule range must be at most 14 days");
}

async function signedResourceUrl(db: SupabaseClient, row: Row) {
  if (row.kind !== "file" || typeof row.storage_path !== "string") return null;
  const { data, error } = await db.storage.from(LMS_RESOURCE_BUCKET).createSignedUrl(row.storage_path, 900);
  return error ? null : data?.signedUrl ?? null;
}

/**
 * RLS is the final historical boundary: removed learners receive only published
 * past occurrences captured in their immutable roster snapshot.
 */
export async function loadMyStudentLmsWeek(params: {
  startDate: string;
  endDate: string;
}): Promise<StudentWeeklyLmsView> {
  assertDateRange(params.startDate, params.endDate);
  const session = await createTypedServerClient();
  const userId = await getSessionUserId(session);
  const db = session as unknown as SupabaseClient;
  const { data: occurrenceData, error: occurrenceError } = await db
    .from("lms_lesson_occurrences")
    .select("id, class_id, course_id, lesson_id, activity_id, occurrence_date, starts_at, ends_at, timezone, title, notes, status, published_at")
    .gte("occurrence_date", params.startDate)
    .lte("occurrence_date", params.endDate)
    .not("published_at", "is", null)
    .order("starts_at", { ascending: true })
    .order("id", { ascending: true });
  if (occurrenceError) throw new Error(`loadMyStudentLmsWeek(occurrences): ${occurrenceError.message}`);
  const occurrences = (occurrenceData ?? []) as Row[];
  const occurrenceIds = ids(occurrences, "id");
  const classIds = ids(occurrences, "class_id");
  const courseIds = ids(occurrences, "course_id");
  const lessonIds = ids(occurrences, "lesson_id");
  const activityIds = ids(occurrences, "activity_id");

  const [links, assignmentLinks, classes, courses, lessons, activities, sessions, activeMemberships, notifications] = await Promise.all([
    occurrenceIds.length ? db.from("lms_occurrence_resources").select("occurrence_id, resource_id, order_index, required").in("occurrence_id", occurrenceIds).order("order_index") : Promise.resolve({ data: [], error: null }),
    occurrenceIds.length ? db.from("lms_occurrence_assignments").select("occurrence_id, assignment_id, relation_type").in("occurrence_id", occurrenceIds) : Promise.resolve({ data: [], error: null }),
    classIds.length ? db.from("classes").select("id, title").in("id", classIds) : Promise.resolve({ data: [], error: null }),
    courseIds.length ? db.from("courses").select("id, title").in("id", courseIds) : Promise.resolve({ data: [], error: null }),
    lessonIds.length ? db.from("lessons").select("id, title").in("id", lessonIds).eq("is_published", true) : Promise.resolve({ data: [], error: null }),
    activityIds.length ? db.from("activities").select("id, title").in("id", activityIds).eq("is_archived", false) : Promise.resolve({ data: [], error: null }),
    occurrenceIds.length ? db.from("class_attendance_sessions").select("id, occurrence_id").in("occurrence_id", occurrenceIds) : Promise.resolve({ data: [], error: null }),
    classIds.length ? db.from("class_memberships").select("class_id").eq("user_id", userId).eq("member_role", "student").eq("status", "active").in("class_id", classIds) : Promise.resolve({ data: [], error: null }),
    db.from("lms_notifications").select("id, event_type, title, body, read_at, created_at").eq("recipient_id", userId).order("created_at", { ascending: false }).limit(100),
  ]);
  const results = [links, assignmentLinks, classes, courses, lessons, activities, sessions, activeMemberships, notifications];
  const failed = results.find((result) => result.error);
  if (failed?.error) throw new Error(`loadMyStudentLmsWeek: ${failed.error.message}`);

  const resourceIds = ids((links.data ?? []) as Row[], "resource_id");
  const assignmentIds = ids((assignmentLinks.data ?? []) as Row[], "assignment_id");
  const sessionIds = ids((sessions.data ?? []) as Row[], "id");
  const [resourcesResult, assignmentsResult, submissionsResult, attendanceResult] = await Promise.all([
    resourceIds.length ? db.from("lms_resources").select("id, title, kind, url, storage_path").in("id", resourceIds).eq("status", "published") : Promise.resolve({ data: [], error: null }),
    assignmentIds.length ? db.from("club_assignments").select("id, title, due_at, status").in("id", assignmentIds).eq("status", "active") : Promise.resolve({ data: [], error: null }),
    assignmentIds.length ? db.from("club_assignment_submissions").select("assignment_id, submission_state, grade_status, created_at").eq("user_id", userId).in("assignment_id", assignmentIds).order("created_at", { ascending: false }) : Promise.resolve({ data: [], error: null }),
    sessionIds.length ? db.from("class_attendance_records").select("session_id, status").eq("user_id", userId).in("session_id", sessionIds) : Promise.resolve({ data: [], error: null }),
  ]);
  const childFailed = [resourcesResult, assignmentsResult, submissionsResult, attendanceResult].find((result) => result.error);
  if (childFailed?.error) throw new Error(`loadMyStudentLmsWeek(children): ${childFailed.error.message}`);

  const resourceRows = (resourcesResult.data ?? []) as Row[];
  const signedUrls = new Map(await Promise.all(resourceRows.map(async (row) => [String(row.id), await signedResourceUrl(db, row)] as const)));
  const resourceMap = byId(resourceRows);
  const assignmentMap = byId((assignmentsResult.data ?? []) as Row[]);
  const latestSubmission = new Map<string, Row>();
  for (const row of (submissionsResult.data ?? []) as Row[]) if (!latestSubmission.has(String(row.assignment_id))) latestSubmission.set(String(row.assignment_id), row);
  const sessionByOccurrence = new Map(((sessions.data ?? []) as Row[]).map((row) => [String(row.occurrence_id), String(row.id)]));
  const attendanceBySession = new Map(((attendanceResult.data ?? []) as Row[]).map((row) => [String(row.session_id), String(row.status)]));
  const activeClassIds = new Set(((activeMemberships.data ?? []) as Row[]).map((row) => String(row.class_id)));
  const classMap = byId((classes.data ?? []) as Row[]);
  const courseMap = byId((courses.data ?? []) as Row[]);
  const lessonMap = byId((lessons.data ?? []) as Row[]);
  const activityMap = byId((activities.data ?? []) as Row[]);
  const resourceLinks = (links.data ?? []) as Row[];
  const assignmentsLinks = (assignmentLinks.data ?? []) as Row[];

  const viewOccurrences = occurrences.map((row): StudentWeeklyOccurrence => {
    const occurrenceId = String(row.id);
    return {
      id: occurrenceId,
      classId: String(row.class_id),
      classTitle: String(classMap.get(String(row.class_id))?.title ?? ""),
      courseId: String(row.course_id),
      courseTitle: String(courseMap.get(String(row.course_id))?.title ?? ""),
      lessonId: typeof row.lesson_id === "string" ? row.lesson_id : null,
      lessonTitle: typeof row.lesson_id === "string" ? String(lessonMap.get(row.lesson_id)?.title ?? "") || null : null,
      activityId: typeof row.activity_id === "string" ? row.activity_id : null,
      activityTitle: typeof row.activity_id === "string" ? String(activityMap.get(row.activity_id)?.title ?? "") || null : null,
      date: String(row.occurrence_date), startsAt: String(row.starts_at), endsAt: String(row.ends_at), timezone: String(row.timezone),
      title: String(row.title), notes: typeof row.notes === "string" ? row.notes : null, status: String(row.status),
      historical: !activeClassIds.has(String(row.class_id)),
      attendance: attendanceBySession.get(sessionByOccurrence.get(occurrenceId) ?? "") ?? null,
      resources: resourceLinks.filter((link) => link.occurrence_id === row.id).flatMap((link) => {
        const resource = resourceMap.get(String(link.resource_id));
        return resource ? [{ id: String(resource.id), title: String(resource.title), kind: String(resource.kind), required: Boolean(link.required), url: typeof resource.url === "string" ? resource.url : null, signedUrl: signedUrls.get(String(resource.id)) ?? null }] : [];
      }),
      assignments: assignmentsLinks.filter((link) => link.occurrence_id === row.id).flatMap((link) => {
        const assignment = assignmentMap.get(String(link.assignment_id));
        if (!assignment) return [];
        const submission = latestSubmission.get(String(assignment.id));
        return [{ id: String(assignment.id), title: String(assignment.title), relationType: link.relation_type as StudentWeeklyAssignment["relationType"], dueAt: typeof assignment.due_at === "string" ? assignment.due_at : null, status: String(assignment.status), submissionState: submission ? String(submission.submission_state) : null, gradeStatus: submission ? String(submission.grade_status) : null }];
      }),
    };
  });

  const activeIds = [...activeClassIds];
  const { data: announcementData, error: announcementError } = activeIds.length
    ? await db.from("lms_announcements").select("id, class_id, title, body, published_at").in("class_id", activeIds).eq("status", "published").lte("published_at", new Date().toISOString()).order("published_at", { ascending: false })
    : { data: [], error: null };
  if (announcementError) throw new Error(`loadMyStudentLmsWeek(announcements): ${announcementError.message}`);
  const notificationRows = (notifications.data ?? []) as Row[];
  return {
    range: params,
    occurrences: viewOccurrences,
    announcements: ((announcementData ?? []) as Row[]).map((row) => ({ id: String(row.id), classId: String(row.class_id), title: String(row.title), body: String(row.body), publishedAt: typeof row.published_at === "string" ? row.published_at : null })),
    notifications: notificationRows.map((row) => ({ id: String(row.id), eventType: String(row.event_type), title: String(row.title), body: String(row.body), readAt: typeof row.read_at === "string" ? row.read_at : null, createdAt: String(row.created_at) })),
    unreadNotifications: notificationRows.filter((row) => !row.read_at).length,
  };
}

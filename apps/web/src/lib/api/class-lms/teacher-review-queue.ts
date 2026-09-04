import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createTypedAdminClient } from "@/lib/supabase/admin";
import { createTypedServerClient } from "@/lib/supabase/server";
import { requireClassManagerDashboard } from "@/lib/api/class-manager-access";
import { loadTeacherWorkspaceCapability } from "./teacher-workspace-capability";
import {
  buildTeacherReviewQueue,
  filterTeacherReviewQueue,
  type TeacherReviewQueue,
  type TeacherReviewQueueStatus,
} from "./teacher-review-queue-contract";

export type { TeacherReviewQueue, TeacherReviewQueueItem, TeacherReviewQueueSource, TeacherReviewQueueStatus } from "./teacher-review-queue-contract";
type Raw = Record<string, unknown>;

function asDb(client: unknown) {
  return client as SupabaseClient;
}

/** One batched read model for ordinary homework plus current IELTS writing/speaking work. */
export async function loadTeacherReviewQueue(params: {
  status?: TeacherReviewQueueStatus;
  classId?: string;
  now?: string | Date;
} = {}): Promise<TeacherReviewQueue> {
  const session = await createTypedServerClient();
  const db = asDb(session);
  await requireClassManagerDashboard(session);
  const capability = await loadTeacherWorkspaceCapability();
  const classes = capability.classes.map((row) => ({ id: row.id, club_id: row.organizationId, title: row.title, program_type: row.programType }));
  const classIds = classes.map((row) => row.id);
  const classById = new Map(classes.map((row) => [row.id, row]));
  if (classIds.length === 0) return { items: [], total: 0, counts: { needs_review: 0, returned: 0, draft: 0 }, classes: [] };

  const { data: assignments, error: assignmentError } = await db.from("club_assignments").select("id, club_id, class_id, title, assignment_type, due_at, status").in("class_id", classIds).neq("status", "archived");
  if (assignmentError) throw new Error(`loadTeacherReviewQueue assignments: ${assignmentError.message}`);
  const assignmentRows = (assignments ?? []) as Raw[];
  const assignmentIds = assignmentRows.map((row) => String(row.id));
  if (assignmentIds.length === 0) return { items: [], total: 0, counts: { needs_review: 0, returned: 0, draft: 0 }, classes: classes.map((row) => ({ id: row.id, clubId: row.club_id, title: row.title, programType: row.program_type ?? "debate" })) };
  const [submissionsResult, attemptsResult] = await Promise.all([
    db.from("club_assignment_submissions").select("id, assignment_id, club_id, class_id, user_id, submission_state, grade_status, submitted_at, created_at, updated_at").in("assignment_id", assignmentIds).eq("submission_state", "submitted").not("submitted_at", "is", null).order("submitted_at", { ascending: true }),
    db.from("ielts_attempts").select("id, assignment_id, user_id, club_id, class_id, submitted_at, status").in("assignment_id", assignmentIds).not("submitted_at", "is", null),
  ]);
  if (submissionsResult.error || attemptsResult.error) throw new Error(`loadTeacherReviewQueue submissions: ${submissionsResult.error?.message ?? attemptsResult.error?.message}`);
  const submissions = (submissionsResult.data ?? []) as Raw[];
  const attempts = (attemptsResult.data ?? []) as Raw[];
  const attemptIds = attempts.map((row) => String(row.id));
  const [writingResult, speakingResult, reviewsResult] = await Promise.all([
    attemptIds.length ? db.from("writing_responses").select("id, attempt_id, user_id, task_number, revision, status, updated_at, created_at").in("attempt_id", attemptIds).in("status", ["scored", "overridden"]) : Promise.resolve({ data: [], error: null }),
    attemptIds.length ? db.from("speaking_responses").select("id, attempt_id, user_id, part_number, revision, status, updated_at, created_at").in("attempt_id", attemptIds).in("status", ["scored", "overridden"]) : Promise.resolve({ data: [], error: null }),
    attemptIds.length ? db.from("ielts_teacher_reviews").select("id, writing_response_id, speaking_response_id, revision, status, updated_at").in("attempt_id", attemptIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (writingResult.error || speakingResult.error || reviewsResult.error) throw new Error(`loadTeacherReviewQueue IELTS: ${writingResult.error?.message ?? speakingResult.error?.message ?? reviewsResult.error?.message}`);
  const profileIds = [...new Set([...submissions, ...attempts].map((row) => String(row.user_id)))];
  const admin = createTypedAdminClient() as unknown as SupabaseClient;
  const { data: profiles, error: profilesError } = profileIds.length ? await admin.from("profiles").select("id, display_name, email").in("id", profileIds) : { data: [], error: null };
  if (profilesError) throw new Error(`loadTeacherReviewQueue profiles: ${profilesError.message}`);
  const profileMap = new Map((profiles ?? []).map((row) => [row.id, row.display_name?.trim() || row.email?.split("@")[0] || "Student"]));
  const assignmentMap = new Map(assignmentRows.map((row) => [String(row.id), row]));
  const attemptMap = new Map(attempts.map((row) => [String(row.id), row]));
  const makeContext = (row: Raw) => {
    const assignment = assignmentMap.get(String(row.assignment_id));
    const classRow = classById.get(String(row.class_id ?? assignment?.class_id));
    return { ...row, class_id: classRow?.id ?? row.class_id, club_id: classRow?.club_id ?? row.club_id, class_title: classRow?.title ?? "Class", program_type: classRow?.program_type ?? "debate", assignment_title: assignment?.title ?? "Homework", due_at: assignment?.due_at ?? null, student_name: profileMap.get(String(row.user_id)) ?? "Student" };
  };
  const homework = submissions.map(makeContext);
  const responseRows = [
    ...(writingResult.data ?? []).map((row) => ({ ...row, kind: "writing" as const })),
    ...(speakingResult.data ?? []).map((row) => ({ ...row, kind: "speaking" as const })),
  ].flatMap((response) => {
    const attempt = attemptMap.get(String(response.attempt_id));
    if (!attempt || !attempt.submitted_at) return [];
    const assignment = assignmentMap.get(String(attempt.assignment_id));
    const classRow = classById.get(String(attempt.class_id));
    return [{ ...response, submitted_at: attempt.submitted_at, attempt_id: attempt.id, assignment_id: attempt.assignment_id, user_id: attempt.user_id, class_id: attempt.class_id, club_id: attempt.club_id, class_title: classRow?.title ?? "Class", program_type: classRow?.program_type ?? "ielts", assignment_title: assignment?.title ?? "IELTS response", due_at: assignment?.due_at ?? null, student_name: profileMap.get(String(attempt.user_id)) ?? "Student" }];
  });
  const currentResponseRowsForQueue = responseRows as Array<Raw & { kind: "writing" | "speaking" }>;
  const responseIds = new Set(currentResponseRowsForQueue.map((row) => String(row.id)));
  const reviews = (reviewsResult.data ?? []).flatMap((review) => {
    const responseId = review.writing_response_id ?? review.speaking_response_id;
    return responseId && responseIds.has(responseId) ? [{ ...review, response_id: responseId }] : [];
  }) as Raw[];
  const items = buildTeacherReviewQueue({ now: params.now, homework, responses: currentResponseRowsForQueue, reviews });
  const selected = filterTeacherReviewQueue(items, params.status ?? "all", params.classId);
  const counts = { needs_review: items.filter((item) => item.status === "needs_review").length, returned: items.filter((item) => item.status === "returned").length, draft: items.filter((item) => item.status === "draft").length };
  return { items: selected, total: selected.length, counts, classes: classes.map((row) => ({ id: row.id, clubId: row.club_id, title: row.title, programType: row.program_type ?? "debate" })) };
}

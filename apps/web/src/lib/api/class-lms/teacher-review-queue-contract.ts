import { latestByKey } from "@/lib/api/ielts/deterministic-selection";

export type TeacherReviewQueueStatus = "needs_review" | "returned" | "draft" | "all";
export type TeacherReviewScoreSource = "none" | "ai_provisional" | "teacher_published";
type Raw = Record<string, unknown>;

export interface TeacherReviewQueueItem {
  key: string; kind: "homework" | "writing" | "speaking"; classId: string; clubId: string; classTitle: string; programType: string;
  studentId: string; studentName: string; assignmentId: string; assignmentTitle: string; dueAt: string | null; submittedAt: string | null; ageDays: number;
  attemptId: string | null; responseId: string | null; submissionId: string | null; revision: number | null;
  /** Optimistic-concurrency token for `teacher_workspace_grade_homework`; homework only. */
  submissionUpdatedAt: string | null;
  status: "needs_review" | "returned" | "draft"; scoreSource: TeacherReviewScoreSource; teacherPublished: boolean;
}
export interface TeacherReviewQueue { items: TeacherReviewQueueItem[]; total: number; counts: Record<Exclude<TeacherReviewQueueStatus, "all">, number>; classes: Array<{ id: string; clubId: string; title: string; programType: string }>; }
export interface TeacherReviewQueueSource { now?: string | Date; homework: Array<Raw & { kind?: "homework" }>; responses: Array<Raw & { kind: "writing" | "speaking" }>; reviews: Raw[]; }

function iso(value: unknown): string | null { return typeof value === "string" && value.length > 0 ? value : null; }
function statusForReview(value: unknown): "needs_review" | "returned" | "draft" { return value === "returned" ? "returned" : value === "draft" ? "draft" : "needs_review"; }
function ageDays(submittedAt: string | null, now: Date): number { if (!submittedAt) return 0; return Math.max(0, Math.floor((now.getTime() - Date.parse(submittedAt)) / 86_400_000)); }
function reviewMap(reviews: Raw[]) {
  const result = new Map<string, Raw>();
  for (const review of reviews) {
    const key = `${String(review.response_id)}:${String(review.revision)}`;
    const current = result.get(key);
    const reviewRank = review.status === "published" ? 2 : 1;
    const currentRank = current?.status === "published" ? 2 : 1;
    const reviewOrder = `${String(review.updated_at ?? "")}:${String(review.id ?? "")}`;
    const currentOrder = `${String(current?.updated_at ?? "")}:${String(current?.id ?? "")}`;
    if (!current || reviewRank > currentRank || (reviewRank === currentRank && reviewOrder > currentOrder)) result.set(key, review);
  }
  return result;
}
function currentResponses(rows: Array<Raw & { kind: "writing" | "speaking" }>) {
  const writing = latestByKey(rows.filter((row) => row.kind === "writing"), ["attempt_id", "task_number"]);
  const speaking = latestByKey(rows.filter((row) => row.kind === "speaking"), ["attempt_id", "part_number"]);
  return [...writing.values(), ...speaking.values()] as Array<Raw & { kind: "writing" | "speaking" }>;
}

/** Pure, deterministic projection for the teacher review queue. */
export function buildTeacherReviewQueue(source: TeacherReviewQueueSource): TeacherReviewQueueItem[] {
  const now = new Date(source.now ?? Date.now()); const reviews = reviewMap(source.reviews); const items: TeacherReviewQueueItem[] = [];
  for (const row of source.homework) {
    const gradeStatus = String(row.grade_status ?? "submitted"); if (gradeStatus === "graded") continue;
    const submittedAt = iso(row.submitted_at); if (!submittedAt || row.submission_state === "failed" || row.submission_state === "draft") continue;
    items.push({ key: `homework:${String(row.id)}`, kind: "homework", classId: String(row.class_id), clubId: String(row.club_id), classTitle: String(row.class_title ?? "Class"), programType: String(row.program_type ?? "debate"), studentId: String(row.user_id), studentName: String(row.student_name ?? "Student"), assignmentId: String(row.assignment_id), assignmentTitle: String(row.assignment_title ?? "Homework"), dueAt: iso(row.due_at), submittedAt, ageDays: ageDays(submittedAt, now), attemptId: null, responseId: null, submissionId: String(row.id), revision: null, submissionUpdatedAt: iso(row.updated_at), status: statusForReview(gradeStatus), scoreSource: "none", teacherPublished: false });
  }
  for (const row of currentResponses(source.responses)) {
    if (row.status && row.status !== "scored" && row.status !== "overridden") continue;
    const responseId = String(row.id); const revision = Number(row.revision ?? 0); const review = reviews.get(`${responseId}:${revision}`); if (review?.status === "published") continue;
    const submittedAt = iso(row.submitted_at ?? row.updated_at ?? row.created_at);
    items.push({ key: `${row.kind}:${responseId}:${revision}`, kind: row.kind, classId: String(row.class_id), clubId: String(row.club_id), classTitle: String(row.class_title ?? "Class"), programType: String(row.program_type ?? "ielts"), studentId: String(row.user_id), studentName: String(row.student_name ?? "Student"), assignmentId: String(row.assignment_id), assignmentTitle: String(row.assignment_title ?? "IELTS response"), dueAt: iso(row.due_at), submittedAt, ageDays: ageDays(submittedAt, now), attemptId: iso(row.attempt_id), responseId, submissionId: null, revision, submissionUpdatedAt: null, status: statusForReview(review?.status), scoreSource: "ai_provisional", teacherPublished: false });
  }
  return items.sort((left, right) => (left.submittedAt ?? left.dueAt ?? "9999").localeCompare(right.submittedAt ?? right.dueAt ?? "9999") || left.key.localeCompare(right.key));
}

export function filterTeacherReviewQueue(items: TeacherReviewQueueItem[], status: TeacherReviewQueueStatus, classId?: string) {
  return items.filter((item) => (!classId || item.classId === classId) && (status === "all" || item.status === status));
}

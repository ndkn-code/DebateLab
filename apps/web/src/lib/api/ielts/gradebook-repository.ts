import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  criteriaForReview,
  IELTS_TEACHER_RUBRIC,
  type RubricCriterion,
} from "@/lib/ielts/teacher/rubric";
import type { TeacherReviewRow } from "./teacher-review-repository";
import {
  decodeGradebookCursor,
  encodeGradebookCursor,
  isCurrentResponseRevision,
  officialOverallVisibility,
  reviewRevisionKey,
} from "./gradebook-contract";
import { IELTS_SPEAKING_AUDIO_BUCKET } from "@/lib/ielts/speaking-scorer/constants";
import { currentResponseRows, latestByKey } from "./deterministic-selection";
import {
  projectEffectiveScoreSource,
  type EffectiveScoreSource,
} from "./effective-score-contract";

/** JSON-safe contract consumed by the teacher gradebook UI. */
export interface IeltsGradebookCriterion {
  key: string;
  labelEn: string;
  labelVi: string;
  aiBand: number | null;
  teacherBand: number | null;
  effectiveBand: number | null;
  reviewStatus: "none" | "draft" | "published" | "returned";
  rationale: string | null;
}

export interface IeltsGradebookScore {
  listening: number | null;
  reading: number | null;
  writing: number | null;
  speaking: number | null;
  overall: number | null;
  provisional: number | null;
  overallIsProvisional: boolean;
  source: "none" | EffectiveScoreSource;
}

export interface IeltsGradebookReviewTarget {
  responseKind: "writing" | "speaking";
  responseId: string;
  revision: number;
  taskNumber: number | null;
  partNumber: number | null;
  attemptId: string;
  assignmentId: string;
  currentReviewId: string | null;
  currentReviewStatus: "none" | "draft" | "published" | "returned";
  currentReviewNote: string | null;
  currentReview: {
    id: string;
    status: "draft" | "published" | "returned";
    note: string | null;
  } | null;
  /** Learner-safe scorer lifecycle. Provider/model/error details stay server-side. */
  scoringStatus: "pending" | "scoring" | "scored" | "failed" | "overridden";
  manualRetryAvailable: boolean;
  criteria: IeltsGradebookCriterion[];
  media: {
    signedUrl: string;
    expiresAt: string;
    mimeType: string | null;
    sizeBytes: number | null;
    sha256: string | null;
  } | null;
}

export interface IeltsGradebookAssignment {
  assignmentId: string;
  title: string;
  assignmentType: string;
  dueAt: string | null;
  status: string;
  attemptId: string | null;
  attemptStatus: string | null;
  submittedAt: string | null;
  score: IeltsGradebookScore;
  criteria: IeltsGradebookCriterion[];
  reviewTargets: IeltsGradebookReviewTarget[];
  needsTeacherReview: boolean;
  homework: {
    submissionId: string | null;
    submitted: boolean;
    status: string | null;
    gradeStatus: string | null;
    submittedAt: string | null;
    score: number | null;
    scoreMax: number | null;
  };
}

export interface IeltsGradebookCourseProgress {
  courseId: string;
  title: string;
  completedItems: number;
  totalItems: number;
  percent: number;
  status: string | null;
}

export interface IeltsGradebookRow {
  userId: string;
  displayName: string;
  email: string;
  membershipStatus: string;
  historical: boolean;
  attendance: {
    present: number;
    late: number;
    absent: number;
    rate: number | null;
  };
  courses: IeltsGradebookCourseProgress[];
  assignments: IeltsGradebookAssignment[];
}

export interface IeltsClassGradebook {
  classId: string;
  clubId: string;
  classTitle: string;
  rubric: typeof IELTS_TEACHER_RUBRIC;
  rows: IeltsGradebookRow[];
  nextCursor: string | null;
  summary: {
    totalStudents: number;
    started: number;
    submitted: number;
    completed: number;
    needsReview: number;
    averageOverallBand: number | null;
    skillAverages: Record<
      "listening" | "reading" | "writing" | "speaking",
      number | null
    >;
  };
}

type Db = SupabaseClient;
function asDb(client: unknown): Db {
  return client as Db;
}
function ids(rows: Array<Record<string, unknown>>, key: string): string[] {
  return [
    ...new Set(
      rows
        .map((row) => row[key])
        .filter((v): v is string => typeof v === "string"),
    ),
  ];
}
function n(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : value == null
      ? null
      : Number(value);
}
function avg(values: Array<number | null>): number | null {
  const present = values.filter(
    (v): v is number => v !== null && Number.isFinite(v),
  );
  return present.length
    ? Math.round((present.reduce((a, b) => a + b, 0) / present.length) * 100) /
        100
    : null;
}
function criterionBand(
  criterion: RubricCriterion,
  row: Record<string, unknown>,
): number | null {
  const map: Record<string, string> = {
    taskAchievement: "task_response_band",
    taskResponse: "task_response_band",
    coherenceCohesion: "coherence_cohesion_band",
    lexicalResource: "lexical_resource_band",
    grammaticalRangeAccuracy: "grammar_band",
    fluencyCoherence: "fluency_coherence_band",
    pronunciation: "pronunciation_band",
  };
  return n(row[map[criterion.key] ?? criterion.dbKey]);
}
function rationale(
  criterion: RubricCriterion,
  response: Record<string, unknown>,
): string | null {
  const feedback = response.feedback ?? response.paragraph_feedback;
  if (!feedback || typeof feedback !== "object") return null;
  const item = (feedback as Record<string, unknown>)[criterion.key];
  if (typeof item === "string") return item;
  if (
    item &&
    typeof item === "object" &&
    typeof (item as Record<string, unknown>).rationale === "string"
  )
    return (item as Record<string, unknown>).rationale as string;
  return null;
}

function emptyScore(): IeltsGradebookScore {
  return {
    listening: null,
    reading: null,
    writing: null,
    speaking: null,
    overall: null,
    provisional: null,
    overallIsProvisional: true,
    source: "none",
  };
}

function makeCriteria(
  kind: "writing" | "speaking",
  taskNumber: number | null,
  response: Record<string, unknown> | undefined,
  review: TeacherReviewRow | undefined,
): IeltsGradebookCriterion[] {
  const criteria = criteriaForReview(kind, taskNumber ?? undefined);
  return criteria.map((criterion) => {
    const aiBand = response ? criterionBand(criterion, response) : null;
    const teacherBand = review
      ? criterionBand(criterion, review as unknown as Record<string, unknown>)
      : null;
    const effectiveBand =
      review?.status === "published" ? (teacherBand ?? aiBand) : aiBand;
    return {
      key: criterion.key,
      labelEn: criterion.labelEn,
      labelVi: criterion.labelVi,
      aiBand,
      teacherBand,
      effectiveBand,
      reviewStatus: review?.status ?? "none",
      rationale: response ? rationale(criterion, response) : null,
    };
  });
}

type Raw = Record<string, unknown>;
type Attendance = { present: number; late: number; absent: number };
type GradebookIndex = {
  profiles: Map<string, Raw>;
  attempts: Map<string, Raw>;
  ai: Map<string, Raw>;
  effective: Map<string, Raw>;
  writing: Map<string, Raw[]>;
  speaking: Map<string, Raw[]>;
  reviews: Map<string, TeacherReviewRow>;
  homework: Map<string, Raw>;
  attendance: Map<string, Attendance>;
  courses: Raw[];
  courseTotals: Map<string, number>;
  courseCompleted: Map<string, number>;
  enrollments: Map<string, Raw>;
  memberships: Map<string, Raw>;
};

function addToMap(map: Map<string, Raw[]>, rows: Raw[], key: string) {
  for (const row of rows) {
    const id = String(row[key]);
    map.set(id, [...(map.get(id) ?? []), row]);
  }
}
function attendanceIndex(rows: Raw[]): Map<string, Attendance> {
  const result = new Map<string, Attendance>();
  for (const row of rows) {
    const key = String(row.user_id);
    const value = result.get(key) ?? { present: 0, late: 0, absent: 0 };
    const status = String(row.status);
    if (status === "present") value.present += 1;
    else if (status === "late") value.late += 1;
    else value.absent += 1;
    result.set(key, value);
  }
  return result;
}
function reviewIndex(rows: TeacherReviewRow[]): Map<string, TeacherReviewRow> {
  const result = new Map<string, TeacherReviewRow>();
  for (const review of rows) {
    const id = review.writing_response_id ?? review.speaking_response_id;
    const key = id ? reviewRevisionKey(id, review.revision) : null;
    const current = key ? result.get(key) : undefined;
    if (
      key &&
      (!current ||
        (review.status === "published" && current.status !== "published") ||
        (review.status === current.status &&
          review.updated_at > current.updated_at))
    )
      result.set(key, review);
  }
  return result;
}
export function selectCurrentReview<T extends { revision: number }>(
  review: T | undefined,
  responseRevision: number,
): T | undefined {
  return review && isCurrentResponseRevision(review.revision, responseRevision)
    ? review
    : undefined;
}
function courseMaps(
  moduleRows: Raw[],
  lessonRows: Raw[],
  activityRows: Raw[],
  lessonProgress: Raw[],
  activityAttempts: Raw[],
) {
  const moduleToCourse = new Map(
    moduleRows.map((row) => [String(row.id), String(row.course_id)]),
  );
  const itemToCourse = new Map(
    [...lessonRows, ...activityRows].map((row) => [
      String(row.id),
      moduleToCourse.get(String(row.module_id)) ?? "",
    ]),
  );
  const totals = new Map<string, number>();
  for (const courseId of itemToCourse.values())
    if (courseId) totals.set(courseId, (totals.get(courseId) ?? 0) + 1);
  const completed = new Map<string, number>();
  for (const row of [...lessonProgress, ...activityAttempts]) {
    const courseId = itemToCourse.get(String(row.lesson_id ?? row.activity_id));
    if (!courseId) continue;
    const key = `${row.user_id}:${courseId}`;
    completed.set(key, (completed.get(key) ?? 0) + 1);
  }
  return { totals, completed };
}

function makeScore(row?: Raw): IeltsGradebookScore {
  if (!row) return emptyScore();
  const listening = n(row.listening_band);
  const reading = n(row.reading_band);
  const writing = n(row.writing_band);
  const speaking = n(row.speaking_band);
  const rawOverall = n(row.overall_band);
  const visible = officialOverallVisibility({
    listening,
    reading,
    writing,
    speaking,
    overall: rawOverall,
    flaggedProvisional: Boolean(row.overall_is_provisional),
  });
  return {
    listening,
    reading,
    writing,
    speaking,
    overall: visible.overall,
    provisional: n(row.provisional_band ?? rawOverall),
    overallIsProvisional: visible.overallIsProvisional,
    source: projectEffectiveScoreSource(row, row),
  };
}
function responseRows(
  attemptId: string | null,
  map: Map<string, Raw[]>,
): Raw[] {
  return attemptId ? (map.get(attemptId) ?? []) : [];
}
function currentReview(response: Raw, reviews: Map<string, TeacherReviewRow>) {
  const revision = n(response.revision) ?? 0;
  return selectCurrentReview(
    reviews.get(reviewRevisionKey(String(response.id), revision)),
    revision,
  );
}
function criteriaRows(
  writing: Raw[],
  speaking: Raw[],
  reviews: Map<string, TeacherReviewRow>,
) {
  return [
    ...currentResponseRows(writing, "task_number").flatMap((response) =>
      makeCriteria(
        "writing",
        n(response.task_number),
        response,
        currentReview(response, reviews),
      ),
    ),
    ...currentResponseRows(speaking, "part_number").flatMap((response) =>
      makeCriteria(
        "speaking",
        null,
        response,
        currentReview(response, reviews),
      ),
    ),
  ];
}
function hasUnpublishedReview(
  writing: Raw[],
  speaking: Raw[],
  reviews: Map<string, TeacherReviewRow>,
) {
  return [
    ...currentResponseRows(writing, "task_number"),
    ...currentResponseRows(speaking, "part_number"),
  ].some(
    (response) => currentReview(response, reviews)?.status !== "published",
  );
}
function homeworkValue(homework: Raw | undefined) {
  return {
    submissionId: homework ? String(homework.id) : null,
    submitted: Boolean(homework?.submitted_at),
    status: homework ? String(homework.submission_state ?? "submitted") : null,
    gradeStatus: homework ? String(homework.grade_status ?? "submitted") : null,
    submittedAt:
      homework && typeof homework.submitted_at === "string"
        ? homework.submitted_at
        : null,
    score: homework ? n(homework.score) : null,
    scoreMax: homework ? n(homework.score_max) : null,
  };
}
function makeReviewTarget(
  kind: "writing" | "speaking",
  response: Raw,
  assignmentId: string,
  attemptId: string,
  reviews: Map<string, TeacherReviewRow>,
): IeltsGradebookReviewTarget {
  const review = currentReview(response, reviews);
  const status = review?.status ?? "none";
  const note = review?.reviewer_note ?? review?.returned_note ?? null;
  const scoringStatus = String(response.status ?? "pending") as
    "pending" | "scoring" | "scored" | "failed" | "overridden";
  return {
    responseKind: kind,
    responseId: String(response.id),
    revision: n(response.revision) ?? 0,
    taskNumber: kind === "writing" ? n(response.task_number) : null,
    partNumber: kind === "speaking" ? n(response.part_number) : null,
    attemptId,
    assignmentId,
    currentReviewId: review?.id ?? null,
    currentReviewStatus: status,
    currentReviewNote: note,
    currentReview: review
      ? { id: review.id, status: review.status, note }
      : null,
    scoringStatus,
    manualRetryAvailable: scoringStatus === "failed",
    criteria: makeCriteria(
      kind,
      kind === "writing" ? n(response.task_number) : null,
      response,
      review,
    ),
    media: null,
  };
}
export function buildReviewTargets(
  assignmentId: string,
  attemptId: string | null,
  writing: Raw[],
  speaking: Raw[],
  reviews: Map<string, TeacherReviewRow>,
): IeltsGradebookReviewTarget[] {
  if (!attemptId) return [];
  return [
    ...currentResponseRows(writing, "task_number").map((response) =>
      makeReviewTarget("writing", response, assignmentId, attemptId, reviews),
    ),
    ...currentResponseRows(speaking, "part_number").map((response) =>
      makeReviewTarget("speaking", response, assignmentId, attemptId, reviews),
    ),
  ];
}
function makeAssignment(
  assignment: Raw,
  userId: string,
  index: GradebookIndex,
): IeltsGradebookAssignment {
  const assignmentId = String(assignment.id);
  const attempt = index.attempts.get(`${userId}:${assignmentId}`);
  const attemptId = attempt ? String(attempt.id) : null;
  const responsesW = responseRows(attemptId, index.writing);
  const responsesS = responseRows(attemptId, index.speaking);
  const criteria = criteriaRows(responsesW, responsesS, index.reviews);
  const needsReview = hasUnpublishedReview(
    responsesW,
    responsesS,
    index.reviews,
  );
  const homework = index.homework.get(`${userId}:${assignmentId}`);
  const scoreRow = attemptId
    ? (index.effective.get(attemptId) ?? index.ai.get(attemptId))
    : undefined;
  return {
    assignmentId,
    title: String(assignment.title ?? ""),
    assignmentType: String(assignment.assignment_type ?? "practice"),
    dueAt: typeof assignment.due_at === "string" ? assignment.due_at : null,
    status: String(assignment.status ?? ""),
    attemptId,
    attemptStatus: attempt ? String(attempt.status) : null,
    submittedAt:
      attempt && typeof attempt.submitted_at === "string"
        ? attempt.submitted_at
        : null,
    score: makeScore(scoreRow),
    criteria,
    reviewTargets: buildReviewTargets(
      assignmentId,
      attemptId,
      responsesW,
      responsesS,
      index.reviews,
    ),
    needsTeacherReview: needsReview,
    homework: homeworkValue(homework),
  };
}
function makeCourseProgress(
  userId: string,
  course: Raw,
  index: GradebookIndex,
): IeltsGradebookCourseProgress {
  const courseId = String(course.id);
  const totalItems = index.courseTotals.get(courseId) ?? 0;
  const completedItems =
    index.courseCompleted.get(`${userId}:${courseId}`) ?? 0;
  const enrollment = index.enrollments.get(`${userId}:${courseId}`);
  return {
    courseId,
    title: String(course.title ?? ""),
    completedItems,
    totalItems,
    percent: totalItems
      ? Math.round((completedItems / totalItems) * 100)
      : (n(enrollment?.progress_percent) ?? 0),
    status: enrollment?.status ? String(enrollment.status) : null,
  };
}
function makeStudentRow(
  userId: string,
  assignments: Raw[],
  index: GradebookIndex,
): IeltsGradebookRow {
  const profile = index.profiles.get(userId) ?? {};
  const membership = index.memberships.get(userId) ?? {};
  const membershipStatus = String(membership.status ?? "removed");
  const attendance = index.attendance.get(userId) ?? {
    present: 0,
    late: 0,
    absent: 0,
  };
  const total = attendance.present + attendance.late + attendance.absent;
  return {
    userId,
    displayName: String(profile.display_name ?? ""),
    email: String(profile.email ?? ""),
    membershipStatus,
    historical: membershipStatus !== "active",
    attendance: {
      ...attendance,
      rate: total
        ? Math.round(((attendance.present + attendance.late) / total) * 100) /
          100
        : null,
    },
    courses: index.courses.map((course) =>
      makeCourseProgress(userId, course, index),
    ),
    assignments: assignments.map((assignment) =>
      makeAssignment(assignment, userId, index),
    ),
  };
}
export function summarizeGradebookRows(
  rows: IeltsGradebookRow[],
  totalStudents: number,
) {
  const assignments = rows.flatMap((row) => row.assignments);
  const scores = assignments.map((a) => a.score);
  return {
    totalStudents,
    started: assignments.filter((a) => a.attemptId).length,
    submitted: assignments.filter(
      (a) => a.attemptStatus === "submitted" || a.submittedAt,
    ).length,
    completed: assignments.filter((a) => a.attemptStatus === "completed")
      .length,
    needsReview: assignments.filter((a) => a.needsTeacherReview).length,
    averageOverallBand: avg(scores.map((s) => s.overall)),
    skillAverages: {
      listening: avg(scores.map((s) => s.listening)),
      reading: avg(scores.map((s) => s.reading)),
      writing: avg(scores.map((s) => s.writing)),
      speaking: avg(scores.map((s) => s.speaking)),
    },
  };
}
const summary = summarizeGradebookRows;

type ResultLike = { data: unknown; error: { message: string } | null };
function emptyResult(): ResultLike {
  return { data: [], error: null };
}
function optional<T extends ResultLike>(
  condition: boolean,
  query: PromiseLike<T>,
): PromiseLike<T> {
  return condition ? query : Promise.resolve(emptyResult() as T);
}
async function loadIdentity(
  db: Db,
  readDb: Db,
  studentIds: string[],
  assignmentIds: string[],
  classId: string,
) {
  const [profiles, attempts] = await Promise.all([
    optional(
      studentIds.length > 0,
      readDb
        .from("profiles")
        .select("id, display_name, email")
        .in("id", studentIds),
    ),
    optional(
      assignmentIds.length > 0 && studentIds.length > 0,
      db
        .from("ielts_attempts")
        .select("id, user_id, assignment_id, status, submitted_at, created_at")
        .in("assignment_id", assignmentIds)
        .in("user_id", studentIds)
        .eq("class_id", classId)
        .order("created_at", { ascending: false }),
    ),
  ]);
  return { profiles, attempts };
}
async function loadScoring(
  db: Db,
  attemptIds: string[],
  classId: string,
  clubId: string,
) {
  const [effective, writing, speaking, reviews] = await Promise.all([
    optional(
      attemptIds.length > 0,
      db
        .from("ielts_effective_attempt_scores")
        .select(
          "attempt_id, listening_band, reading_band, writing_band, speaking_band, overall_band, provisional_band, overall_is_provisional, score_source",
        )
        .eq("class_id", classId)
        .eq("club_id", clubId)
        .in("attempt_id", attemptIds),
    ),
    optional(
      attemptIds.length > 0,
      db
        .from("writing_responses")
        .select(
          "id, attempt_id, task_number, revision, status, updated_at, task_response_band, coherence_cohesion_band, lexical_resource_band, grammar_band, task_band, paragraph_feedback",
        )
        .in("attempt_id", attemptIds),
    ),
    optional(
      attemptIds.length > 0,
      db
        .from("speaking_responses")
        .select(
          "id, attempt_id, part_number, revision, status, updated_at, fluency_coherence_band, lexical_resource_band, grammar_band, pronunciation_band, speaking_band, feedback, audio_storage_path, audio_mime_type, audio_size_bytes, audio_sha256, audio_verified_at",
        )
        .in("attempt_id", attemptIds),
    ),
    optional(
      attemptIds.length > 0,
      db
        .from("ielts_teacher_reviews")
        .select("*")
        .eq("class_id", classId)
        .eq("club_id", clubId)
        .in("attempt_id", attemptIds),
    ),
  ]);
  return { effective, writing, speaking, reviews };
}
async function loadEngagement(
  db: Db,
  readDb: Db,
  studentIds: string[],
  assignmentIds: string[],
  attendanceSessionIds: string[],
  courseIds: string[],
) {
  const [homework, attendance, courses, modules, enrollments] =
    await Promise.all([
      optional(
        assignmentIds.length > 0 && studentIds.length > 0,
        db
          .from("club_assignment_submissions")
          .select(
            "id, assignment_id, user_id, submission_state, grade_status, score, score_max, submitted_at, created_at",
          )
          .in("assignment_id", assignmentIds)
          .in("user_id", studentIds)
          .order("created_at", { ascending: false }),
      ),
      optional(
        attendanceSessionIds.length > 0 && studentIds.length > 0,
        db
          .from("class_attendance_records")
          .select("session_id, user_id, status")
          .in("session_id", attendanceSessionIds)
          .in("user_id", studentIds),
      ),
      optional(
        courseIds.length > 0,
        readDb.from("courses").select("id, title").in("id", courseIds),
      ),
      optional(
        courseIds.length > 0,
        readDb
          .from("course_modules")
          .select("id, course_id")
          .in("course_id", courseIds),
      ),
      optional(
        studentIds.length > 0 && courseIds.length > 0,
        readDb
          .from("enrollments")
          .select("user_id, course_id, status, progress_percent")
          .in("user_id", studentIds)
          .in("course_id", courseIds),
      ),
    ]);
  return { homework, attendance, courses, modules, enrollments };
}
async function loadCourseProgress(
  readDb: Db,
  studentIds: string[],
  moduleRows: Raw[],
) {
  const moduleIds = ids(moduleRows, "id");
  const [lessons, activities] = await Promise.all([
    optional(
      moduleIds.length > 0,
      readDb.from("lessons").select("id, module_id").in("module_id", moduleIds),
    ),
    optional(
      moduleIds.length > 0,
      readDb
        .from("activities")
        .select("id, module_id")
        .in("module_id", moduleIds),
    ),
  ]);
  const lessonRows = (lessons.data ?? []) as Raw[];
  const activityRows = (activities.data ?? []) as Raw[];
  const lessonIds = ids(lessonRows, "id");
  const activityIds = ids(activityRows, "id");
  const [lessonProgress, activityAttempts] = await Promise.all([
    optional(
      studentIds.length > 0 && lessonIds.length > 0,
      readDb
        .from("lesson_progress")
        .select("user_id, lesson_id, status")
        .in("user_id", studentIds)
        .in("lesson_id", lessonIds)
        .eq("status", "completed"),
    ),
    optional(
      studentIds.length > 0 && activityIds.length > 0,
      readDb
        .from("activity_attempts")
        .select("user_id, activity_id, completed_at")
        .in("user_id", studentIds)
        .in("activity_id", activityIds)
        .not("completed_at", "is", null),
    ),
  ]);
  return {
    lessonRows,
    activityRows,
    lessonProgress: (lessonProgress.data ?? []) as Raw[],
    activityAttempts: (activityAttempts.data ?? []) as Raw[],
  };
}
async function loadAiScores(db: Db, attemptIds: string[]) {
  return attemptIds.length
    ? db
        .from("attempt_band_scores")
        .select(
          "attempt_id, listening_band, reading_band, writing_band, speaking_band, overall_band",
        )
        .in("attempt_id", attemptIds)
    : emptyResult();
}
async function loadBase(db: Db, params: { classId: string; clubId: string }) {
  const [
    classResult,
    rosterResult,
    assignmentsResult,
    attendanceSessionsResult,
    courseAssignmentsResult,
  ] = await Promise.all([
    db
      .from("classes")
      .select("id, club_id, title, program_type")
      .eq("id", params.classId)
      .eq("club_id", params.clubId)
      .maybeSingle(),
    db
      .from("class_memberships")
      .select("user_id, status, joined_at, removed_at")
      .eq("class_id", params.classId)
      .eq("member_role", "student"),
    db
      .from("club_assignments")
      .select("id, title, assignment_type, due_at, status, ielts_test_id")
      .eq("club_id", params.clubId)
      .eq("class_id", params.classId)
      .neq("status", "archived")
      .order("created_at", { ascending: true }),
    db
      .from("class_attendance_sessions")
      .select("id")
      .eq("class_id", params.classId),
    db
      .from("class_course_assignments")
      .select("course_id")
      .eq("class_id", params.classId),
  ]);
  if (classResult.error || !classResult.data)
    throw new Error(
      `loadIeltsClassGradebook(class): ${classResult.error?.message ?? "not found"}`,
    );
  if ((classResult.data as Raw).program_type !== "ielts")
    throw new Error("IELTS gradebook requires an IELTS class");
  if (
    [
      rosterResult,
      assignmentsResult,
      attendanceSessionsResult,
      courseAssignmentsResult,
    ].some((result) => result.error)
  )
    throw new Error("loadIeltsClassGradebook: failed to load class inputs");
  const studentIds = ids((rosterResult.data ?? []) as Raw[], "user_id");
  const assignments = (assignmentsResult.data ?? []) as Raw[];
  const assignmentIds = ids(assignments, "id");
  const attendanceSessionIds = ids(
    (attendanceSessionsResult.data ?? []) as Raw[],
    "id",
  );
  const courseIds = ids(
    (courseAssignmentsResult.data ?? []) as Raw[],
    "course_id",
  );
  return {
    classResult,
    rosterRows: (rosterResult.data ?? []) as Raw[],
    studentIds,
    assignments,
    assignmentIds,
    attendanceSessionIds,
    courseIds,
  };
}
async function loadBatches(
  db: Db,
  readDb: Db,
  base: Awaited<ReturnType<typeof loadBase>>,
  params: { classId: string; clubId: string },
) {
  const identity = await loadIdentity(
    db,
    readDb,
    base.studentIds,
    base.assignmentIds,
    params.classId,
  );
  const attemptIds = ids((identity.attempts.data ?? []) as Raw[], "id");
  const [scoring, engagement] = await Promise.all([
    loadScoring(db, attemptIds, params.classId, params.clubId),
    loadEngagement(
      db,
      readDb,
      base.studentIds,
      base.assignmentIds,
      base.attendanceSessionIds,
      base.courseIds,
    ),
  ]);
  const { profiles, attempts } = identity;
  const { effective, writing, speaking, reviews } = scoring;
  const { homework, attendance, courses, modules, enrollments } = engagement;
  if (
    [
      profiles,
      attempts,
      effective,
      writing,
      speaking,
      reviews,
      homework,
      attendance,
      courses,
      modules,
      enrollments,
    ].some((result) => result.error)
  )
    throw new Error("loadIeltsClassGradebook: failed to load class data");
  return {
    profiles,
    attempts,
    effective,
    writing,
    speaking,
    reviews,
    homework,
    attendance,
    courses,
    modules,
    enrollments,
  };
}
async function buildIndex(
  db: Db,
  readDb: Db,
  base: Awaited<ReturnType<typeof loadBase>>,
  batches: Awaited<ReturnType<typeof loadBatches>>,
): Promise<GradebookIndex> {
  const moduleRows = (batches.modules.data ?? []) as Raw[];
  const progress = await loadCourseProgress(
    readDb,
    base.studentIds,
    moduleRows,
  );
  const attemptRows = (batches.attempts.data ?? []) as Raw[];
  const aiResult = await loadAiScores(db, ids(attemptRows, "id"));
  if (aiResult.error)
    throw new Error(
      `loadIeltsClassGradebook(ai scores): ${aiResult.error.message}`,
    );
  const course = courseMaps(
    moduleRows,
    progress.lessonRows,
    progress.activityRows,
    progress.lessonProgress,
    progress.activityAttempts,
  );
  const index: GradebookIndex = {
    profiles: new Map(
      ((batches.profiles.data ?? []) as Raw[]).map((r) => [String(r.id), r]),
    ),
    memberships: new Map(base.rosterRows.map((r) => [String(r.user_id), r])),
    attempts: latestByKey(attemptRows, ["user_id", "assignment_id"]),
    ai: new Map(
      ((aiResult.data ?? []) as Raw[]).map((r) => [String(r.attempt_id), r]),
    ),
    effective: new Map(
      ((batches.effective.data ?? []) as Raw[]).map((r) => [
        String(r.attempt_id),
        r,
      ]),
    ),
    writing: new Map(),
    speaking: new Map(),
    reviews: reviewIndex((batches.reviews.data ?? []) as TeacherReviewRow[]),
    homework: latestByKey((batches.homework.data ?? []) as Raw[], [
      "user_id",
      "assignment_id",
    ]),
    attendance: attendanceIndex((batches.attendance.data ?? []) as Raw[]),
    courses: (batches.courses.data ?? []) as Raw[],
    courseTotals: course.totals,
    courseCompleted: course.completed,
    enrollments: new Map(
      ((batches.enrollments.data ?? []) as Raw[]).map((r) => [
        `${r.user_id}:${r.course_id}`,
        r,
      ]),
    ),
  };
  addToMap(index.writing, (batches.writing.data ?? []) as Raw[], "attempt_id");
  addToMap(
    index.speaking,
    (batches.speaking.data ?? []) as Raw[],
    "attempt_id",
  );
  return index;
}

/** Batched gradebook loader. It deliberately loads every child table once and joins in memory. */
export async function loadIeltsClassGradebook(
  client: unknown,
  params: {
    classId: string;
    clubId: string;
    cursor?: string | null;
    limit?: number;
  },
  trustedReadClient?: unknown,
): Promise<IeltsClassGradebook> {
  const db = asDb(client);
  const readDb = asDb(trustedReadClient ?? client);
  const pageSize = Math.min(Math.max(params.limit ?? 25, 1), 100);
  const base = await loadBase(db, params);
  const batches = await loadBatches(db, readDb, base, params);
  const index = await buildIndex(db, readDb, base, batches);
  const cursorUserId = decodeGradebookCursor(
    params.cursor,
    params.classId,
    params.clubId,
  );
  const sortedStudents = base.studentIds
    .sort()
    .filter((id) => !cursorUserId || id > cursorUserId);
  const pageStudentIds = sortedStudents.slice(0, pageSize);
  const rows = pageStudentIds.map((userId) =>
    makeStudentRow(userId, base.assignments, index),
  );
  const fullRows = base.studentIds.map((userId) =>
    makeStudentRow(userId, base.assignments, index),
  );
  await attachSignedSpeakingMedia(
    readDb,
    rows,
    (batches.speaking.data ?? []) as Raw[],
  );
  return {
    classId: params.classId,
    clubId: params.clubId,
    classTitle: String((base.classResult.data as Raw).title ?? ""),
    rubric: IELTS_TEACHER_RUBRIC,
    rows,
    nextCursor:
      sortedStudents.length > pageSize && pageStudentIds.length
        ? encodeGradebookCursor(
            pageStudentIds[pageStudentIds.length - 1],
            params.classId,
            params.clubId,
          )
        : null,
    summary: summary(fullRows, base.studentIds.length),
  };
}

async function attachSignedSpeakingMedia(
  db: Db,
  rows: IeltsGradebookRow[],
  speakingRows: Raw[],
) {
  const byId = new Map(speakingRows.map((row) => [String(row.id), row]));
  const targets = rows
    .flatMap((row) => row.assignments)
    .flatMap((assignment) => assignment.reviewTargets)
    .filter((target) => target.responseKind === "speaking");
  const expiresIn = 15 * 60;
  await Promise.all(
    targets.map(async (target) => {
      const row = byId.get(target.responseId);
      const path = row?.audio_storage_path;
      if (typeof path !== "string" || !row?.audio_verified_at) return;
      const { data, error } = await db.storage
        .from(IELTS_SPEAKING_AUDIO_BUCKET)
        .createSignedUrl(path, expiresIn);
      if (error || !data?.signedUrl) return;
      target.media = {
        signedUrl: data.signedUrl,
        expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
        mimeType:
          typeof row.audio_mime_type === "string" ? row.audio_mime_type : null,
        sizeBytes: n(row.audio_size_bytes),
        sha256: typeof row.audio_sha256 === "string" ? row.audio_sha256 : null,
      };
    }),
  );
}

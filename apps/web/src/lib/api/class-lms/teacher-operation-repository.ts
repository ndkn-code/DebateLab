import "server-only";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createTypedServerClient } from "@/lib/supabase/server";
import {
  materialAccessRuleSchema,
  materialPlacementInputSchema,
  materialRightsInputSchema,
} from "./material-contracts";

const uuid = z.string().uuid();
const timestamp = z.string().datetime({ offset: true });
const idempotencyKey = z.string().trim().min(8).max(200);
const nonEmpty = (max: number) => z.string().trim().min(1).max(max);

export const teacherRescheduleSchema = z.object({
  scheduleId: uuid, startDate: z.string().date(), endDate: z.string().date(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/),
  timezone: nonEmpty(100), expectedUpdatedAt: timestamp, idempotencyKey,
}).strict();
export type TeacherRescheduleInput = z.infer<typeof teacherRescheduleSchema>;

export const teacherOccurrenceStateSchema = z.object({
  occurrenceId: uuid, state: z.enum(["scheduled", "completed", "cancelled"]),
  expectedUpdatedAt: timestamp, idempotencyKey,
}).strict();
export type TeacherOccurrenceStateInput = z.infer<typeof teacherOccurrenceStateSchema>;

export const teacherLessonPlanSchema = z.object({
  classId: uuid, courseId: uuid, scheduleId: uuid, lessonId: uuid.nullable().optional(),
  activityId: uuid.nullable().optional(), occurrenceDate: z.string().date(), startsAt: timestamp, endsAt: timestamp,
  timezone: nonEmpty(100), title: nonEmpty(200), notes: z.string().trim().max(20_000).nullable().optional(), idempotencyKey,
}).strict().refine((value) => Boolean(value.lessonId || value.activityId), { message: "A lesson or activity is required." });
export type TeacherLessonPlanInput = z.infer<typeof teacherLessonPlanSchema>;

export const teacherPublishAssignmentSchema = z.object({
  assignmentId: uuid, expectedUpdatedAt: timestamp, idempotencyKey,
}).strict();
export type TeacherPublishAssignmentInput = z.infer<typeof teacherPublishAssignmentSchema>;

export const teacherAttendanceCorrectionSchema = z.object({
  sessionId: uuid, userId: uuid, status: z.enum(["present", "late", "absent"]),
  notes: z.string().trim().max(2_000).nullable().optional(), idempotencyKey,
}).strict();
export type TeacherAttendanceCorrectionInput = z.infer<typeof teacherAttendanceCorrectionSchema>;

export const teacherHomeworkGradeSchema = z.object({
  submissionId: uuid, score: z.number().finite().nonnegative(), scoreMax: z.number().finite().positive(),
  feedback: z.string().trim().max(20_000).nullable().optional(), rubricBreakdown: z.record(z.string(), z.unknown()).default({}),
  expectedUpdatedAt: timestamp, idempotencyKey,
}).strict().refine((value) => value.score <= value.scoreMax, { message: "Score cannot exceed maximum." });
export type TeacherHomeworkGradeInput = z.infer<typeof teacherHomeworkGradeSchema>;

export const teacherAnnouncementSchema = z.object({
  classId: uuid, title: nonEmpty(200), body: nonEmpty(20_000), publish: z.boolean().default(false),
  publishAt: timestamp.nullable().optional(), idempotencyKey,
}).strict();
export type TeacherAnnouncementInput = z.infer<typeof teacherAnnouncementSchema>;

export const teacherMaterialPlacementSchema = materialPlacementInputSchema.extend({ idempotencyKey }).strict();
export type TeacherMaterialPlacementInput = z.infer<typeof teacherMaterialPlacementSchema>;

export const teacherMaterialAudienceSchema = z.object({ placementId: uuid, classId: uuid, userIds: z.array(uuid).max(500), idempotencyKey }).strict();
export type TeacherMaterialAudienceInput = z.infer<typeof teacherMaterialAudienceSchema>;

export const teacherMaterialRulesSchema = z.object({ placementId: uuid, rules: z.array(materialAccessRuleSchema).max(20), idempotencyKey }).strict();
export type TeacherMaterialRulesInput = z.infer<typeof teacherMaterialRulesSchema>;

export const teacherMaterialRightsSchema = z.object({ materialId: uuid, versionId: uuid, rights: materialRightsInputSchema, idempotencyKey }).strict();
export type TeacherMaterialRightsInput = z.infer<typeof teacherMaterialRightsSchema>;

export const teacherMaterialReviewSchema = z.object({ materialId: uuid, versionId: uuid, status: z.enum(["approved", "rejected"]), note: z.string().trim().max(20_000).nullable().optional(), idempotencyKey }).strict();
export type TeacherMaterialReviewInput = z.infer<typeof teacherMaterialReviewSchema>;

export const teacherMaterialPublishSchema = z.object({ materialId: uuid, placementId: uuid, idempotencyKey }).strict();
export type TeacherMaterialPublishInput = z.infer<typeof teacherMaterialPublishSchema>;

export const teacherReviewOverrideSchema = z.object({
  reviewId: uuid, reason: nonEmpty(2_000), idempotencyKey,
}).strict();
export type TeacherReviewOverrideInput = z.infer<typeof teacherReviewOverrideSchema>;

export const teacherReviewReturnOverrideSchema = teacherReviewOverrideSchema.extend({
  note: z.string().trim().max(20_000).nullable().optional(),
}).strict();
export type TeacherReviewReturnOverrideInput = z.infer<typeof teacherReviewReturnOverrideSchema>;

export const teacherReviewQueueInputSchema = z.object({
  classId: uuid,
  cursor: z.object({ submittedAt: timestamp, itemId: uuid }).strict().nullable().optional(),
  limit: z.number().int().min(1).max(100).default(50),
}).strict();
export type TeacherReviewQueueInput = z.infer<typeof teacherReviewQueueInputSchema>;

export const studentWeekInputSchema = z.object({
  classId: uuid, from: z.string().date(), to: z.string().date(),
}).strict();
export type StudentWeekInput = z.infer<typeof studentWeekInputSchema>;

type RpcClient = { rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }> };
type OperationRpc = (args: Record<string, unknown>) => Promise<unknown>;

async function callRpc(name: string, args: Record<string, unknown>): Promise<unknown> {
  const client = await createTypedServerClient() as unknown as RpcClient;
  const { data, error } = await client.rpc(name, args);
  if (error) throw new Error(error.message);
  return data;
}

function parsed<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new Error(result.error.issues[0]?.message ?? "Invalid LMS input");
  return result.data;
}

export const teacherOperationRpc: Record<string, OperationRpc> = {
  reschedule: (args) => callRpc("teacher_workspace_reschedule", args),
  occurrenceState: (args) => callRpc("teacher_workspace_set_occurrence_state", args),
  planLesson: (args) => callRpc("teacher_workspace_plan_lesson", { p_input: args }),
  publishAssignment: (args) => callRpc("teacher_workspace_publish_assignment", args),
  attendance: (args) => callRpc("teacher_workspace_correct_attendance", args),
  gradeHomework: (args) => callRpc("teacher_workspace_grade_homework", args),
  announcement: (args) => callRpc("teacher_workspace_publish_announcement", { p_input: args }),
  placeMaterial: (args) => callRpc("teacher_workspace_place_material", { p_input: args }),
  setMaterialAudience: (args) => callRpc("lms_set_material_audience", args),
  setMaterialRules: (args) => callRpc("lms_set_material_unlock_rules", args),
  setMaterialRights: (args) => callRpc("lms_set_material_rights", args),
  reviewMaterial: (args) => callRpc("lms_review_material_content", args),
  publishMaterial: (args) => callRpc("teacher_workspace_publish_material", args),
  publishReviewOverride: (args) => callRpc("head_teacher_override_publish_ielts_review", args),
  returnReviewOverride: (args) => callRpc("head_teacher_override_return_ielts_review", args),
  reviewQueue: (args) => callRpc("load_teacher_review_queue_v2", args),
  studentWeek: (args) => callRpc("load_student_lms_week", args),
};

async function operation(key: string, args: Record<string, unknown>) {
  const fn = teacherOperationRpc[key];
  if (!fn) throw new Error(`Unknown LMS operation: ${key}`);
  return fn(args);
}

export async function rescheduleTeacherCalendar(input: unknown) {
  const value = parsed(teacherRescheduleSchema, input);
  const result = await operation("reschedule", { p_schedule_id: value.scheduleId, p_start_date: value.startDate, p_end_date: value.endDate, p_start_time: value.startTime, p_end_time: value.endTime, p_timezone: value.timezone, p_expected_updated_at: value.expectedUpdatedAt, p_idempotency_key: value.idempotencyKey });
  revalidatePath("/dashboard/teacher"); return result;
}
export async function setTeacherOccurrenceState(input: unknown) {
  const value = parsed(teacherOccurrenceStateSchema, input);
  const result = await operation("occurrenceState", { p_occurrence_id: value.occurrenceId, p_state: value.state, p_expected_updated_at: value.expectedUpdatedAt, p_idempotency_key: value.idempotencyKey });
  revalidatePath("/dashboard/teacher"); return result;
}
export async function planTeacherLesson(input: unknown) { const value = parsed(teacherLessonPlanSchema, input); const result = await operation("planLesson", value); revalidatePath(`/dashboard/teacher/classes/${value.classId}`); return result; }
export async function publishTeacherAssignment(input: unknown) { const value = parsed(teacherPublishAssignmentSchema, input); const result = await operation("publishAssignment", { p_assignment_id: value.assignmentId, p_expected_updated_at: value.expectedUpdatedAt, p_idempotency_key: value.idempotencyKey }); revalidatePath("/dashboard/teacher"); return result; }
export async function correctTeacherAttendance(input: unknown) { const value = parsed(teacherAttendanceCorrectionSchema, input); const result = await operation("attendance", { p_session_id: value.sessionId, p_user_id: value.userId, p_status: value.status, p_notes: value.notes ?? null, p_idempotency_key: value.idempotencyKey }); revalidatePath("/dashboard/teacher"); return result; }
export async function gradeTeacherHomework(input: unknown) { const value = parsed(teacherHomeworkGradeSchema, input); const result = await operation("gradeHomework", { p_submission_id: value.submissionId, p_score: value.score, p_score_max: value.scoreMax, p_feedback: value.feedback ?? null, p_rubric_breakdown: value.rubricBreakdown, p_expected_updated_at: value.expectedUpdatedAt, p_idempotency_key: value.idempotencyKey }); revalidatePath("/dashboard/teacher"); return result; }
export async function publishTeacherAnnouncement(input: unknown) { const value = parsed(teacherAnnouncementSchema, input); const result = await operation("announcement", value); revalidatePath(`/dashboard/teacher/classes/${value.classId}`); return result; }
export async function placeTeacherMaterial(input: unknown) { const value = parsed(teacherMaterialPlacementSchema, input); const result = await operation("placeMaterial", value); revalidatePath("/dashboard/teacher"); return result; }
export async function setTeacherMaterialAudience(input: unknown) { const value = parsed(teacherMaterialAudienceSchema, input); const result = await operation("setMaterialAudience", { p_placement_id: value.placementId, p_class_id: value.classId, p_user_ids: value.userIds }); revalidatePath("/dashboard/teacher"); return result; }
export async function setTeacherMaterialRules(input: unknown) { const value = parsed(teacherMaterialRulesSchema, input); const result = await operation("setMaterialRules", { p_placement_id: value.placementId, p_rules: value.rules }); revalidatePath("/dashboard/teacher"); return result; }
export async function setTeacherMaterialRights(input: unknown) { const value = parsed(teacherMaterialRightsSchema, input); const result = await operation("setMaterialRights", { p_material_id: value.materialId, p_version_id: value.versionId, p_rights: value.rights }); revalidatePath("/dashboard/teacher"); return result; }
export async function reviewTeacherMaterial(input: unknown) { const value = parsed(teacherMaterialReviewSchema, input); const result = await operation("reviewMaterial", { p_material_id: value.materialId, p_version_id: value.versionId, p_status: value.status, p_note: value.note ?? null }); revalidatePath("/dashboard/teacher"); return result; }
export async function publishTeacherMaterial(input: unknown) { const value = parsed(teacherMaterialPublishSchema, input); const result = await operation("publishMaterial", { p_material_id: value.materialId, p_placement_id: value.placementId, p_idempotency_key: value.idempotencyKey }); revalidatePath("/dashboard/teacher"); return result; }
export async function publishHeadTeacherReviewOverride(input: unknown) { const value = parsed(teacherReviewOverrideSchema, input); const result = await operation("publishReviewOverride", { p_review_id: value.reviewId, p_reason: value.reason, p_idempotency_key: value.idempotencyKey }); revalidatePath("/dashboard/teacher"); return result; }
export async function returnHeadTeacherReviewOverride(input: unknown) { const value = parsed(teacherReviewReturnOverrideSchema, input); const result = await operation("returnReviewOverride", { p_review_id: value.reviewId, p_reason: value.reason, p_note: value.note ?? null, p_idempotency_key: value.idempotencyKey }); revalidatePath("/dashboard/teacher"); return result; }
export async function loadTeacherReviewQueueV2(input: unknown) {
  const value = parsed(teacherReviewQueueInputSchema, input);
  return operation("reviewQueue", {
    p_class_id: value.classId,
    p_cursor_at: value.cursor?.submittedAt ?? null,
    p_cursor_id: value.cursor?.itemId ?? null,
    p_limit: value.limit,
  });
}
export async function loadStudentLmsWeek(input: unknown) { const value = parsed(studentWeekInputSchema, input); return operation("studentWeek", { p_class_id: value.classId, p_from: value.from, p_to: value.to }); }

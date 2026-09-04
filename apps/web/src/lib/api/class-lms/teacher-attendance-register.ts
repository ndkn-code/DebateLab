import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createTypedServerClient } from "@/lib/supabase/server";

/**
 * Opening a lesson's attendance register.
 *
 * `teacher_workspace_correct_attendance` corrects a row in an existing register
 * but cannot create one, and the canonical creator —
 * `save_class_attendance_transaction` — is dead: it never sets `occurrence_id`,
 * and `private.require_lms_attendance_occurrence`
 * (`supabase/migrations/20260829210000_lms_release_fixes.sql:146`) rejects every
 * insert without it. Production bears this out: zero rows in
 * `class_attendance_sessions`, ever.
 *
 * This card may not add a migration, so the register is opened here instead —
 * a plain insert through the teacher's own RLS-scoped client, which the policy
 * "Attendance sessions insertable by admins and assigned teachers" already
 * permits and which supplies the `occurrence_id` the trigger demands. No
 * service-role key, no privilege escalation: a teacher who cannot manage the
 * class is refused by RLS exactly as before.
 *
 * FOLLOW-UP for whoever next owns a migration: repair
 * `save_class_attendance_transaction` to carry `occurrence_id`, then route this
 * back through it so there is one canonical create path again.
 */

export const openAttendanceRegisterSchema = z
  .object({
    classId: z.string().uuid(),
    courseId: z.string().uuid(),
    occurrenceId: z.string().uuid(),
    sessionDate: z.string().date(),
    title: z.string().trim().min(1).max(200).nullable().optional(),
  })
  .strict();

export type OpenAttendanceRegisterInput = z.infer<
  typeof openAttendanceRegisterSchema
>;

type SessionRow = { id: string };

export async function openTeacherAttendanceRegister(
  input: unknown,
): Promise<{ sessionId: string }> {
  const parsed = openAttendanceRegisterSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid register input");
  }
  const value = parsed.data;
  const db = (await createTypedServerClient()) as unknown as SupabaseClient;

  // A register may already exist for this lesson — including a legacy row with
  // no occurrence link, which still owns the (class, course, date) key.
  const existing = await db
    .from("class_attendance_sessions")
    .select("id")
    .eq("class_id", value.classId)
    .eq("course_id", value.courseId)
    .eq("session_date", value.sessionDate)
    .maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data) return { sessionId: (existing.data as SessionRow).id };

  // `taken_by` is the register's audit trail; RLS still decides whether the
  // insert is allowed, so this only records who opened it.
  const { data: auth, error: authError } = await db.auth.getUser();
  if (authError) throw new Error(authError.message);
  const actorId = auth.user?.id;
  if (!actorId) throw new Error("UNAUTHORIZED");

  const created = await db
    .from("class_attendance_sessions")
    .insert({
      class_id: value.classId,
      course_id: value.courseId,
      occurrence_id: value.occurrenceId,
      session_date: value.sessionDate,
      title: value.title ?? null,
      taken_by: actorId,
    })
    .select("id")
    .single();
  if (created.error) throw new Error(created.error.message);
  return { sessionId: (created.data as SessionRow).id };
}

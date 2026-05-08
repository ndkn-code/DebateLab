"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEV_ADMIN_PROFILE, isDevAdminBypassEnabled } from "@/lib/dev-admin-bypass";
import { validateAttendanceSubmission } from "@/lib/api/admin-classes-model";
import type {
  AdminClassStatus,
  AttendanceStatus,
  SaveAttendanceInput,
} from "@/lib/types/admin-classes";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const CLASS_STATUSES = new Set<AdminClassStatus>(["draft", "active", "archived"]);
const ATTENDANCE_STATUSES = new Set<AttendanceStatus>(["present", "late", "absent"]);

function isDevClassId(id: string) {
  return isDevAdminBypassEnabled() && id.startsWith("00000000-0000-4500-8000-");
}

async function verifyAdmin(supabase: Supabase) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (isDevAdminBypassEnabled()) return DEV_ADMIN_PROFILE.id;
    throw new Error("Unauthorized");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    if (isDevAdminBypassEnabled()) return user.id;
    throw new Error("Forbidden");
  }

  return user.id;
}

async function logAdminAction(
  supabase: Supabase,
  adminId: string,
  action: string,
  entityType: string,
  entityId: string,
  changes: Record<string, unknown>
) {
  await supabase.from("admin_activity_log").insert({
    admin_user_id: adminId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    changes,
  });
}

function cleanString(value: FormDataEntryValue | string | null | undefined) {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length > 0 ? text : null;
}

function cleanDate(value: FormDataEntryValue | string | null | undefined) {
  const text = cleanString(value);
  if (!text) return null;
  const date = new Date(`${text}T00:00:00`);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid date");
  return text;
}

function cleanStatus(value: FormDataEntryValue | string | null | undefined) {
  const text = cleanString(value) ?? "active";
  if (!CLASS_STATUSES.has(text as AdminClassStatus)) throw new Error("Invalid class status");
  return text as AdminClassStatus;
}

function classPayloadFromForm(formData: FormData) {
  const title = cleanString(formData.get("title"));
  if (!title) throw new Error("Class title is required");

  const code =
    cleanString(formData.get("code")) ??
    title
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 24);

  return {
    code,
    title,
    description: cleanString(formData.get("description")),
    grade_level: cleanString(formData.get("gradeLevel")),
    status: cleanStatus(formData.get("status")),
    start_date: cleanDate(formData.get("startDate")),
    end_date: cleanDate(formData.get("endDate")),
    meeting_schedule: cleanString(formData.get("meetingSchedule")),
    room: cleanString(formData.get("room")),
    max_students: cleanString(formData.get("maxStudents"))
      ? Number(cleanString(formData.get("maxStudents")))
      : null,
  };
}

export async function createClass(formData: FormData) {
  const supabase = await createClient();
  const adminId = await verifyAdmin(supabase);
  const payload = classPayloadFromForm(formData);

  const { data, error } = await supabase
    .from("classes")
    .insert({ ...payload, created_by: adminId })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  await logAdminAction(supabase, adminId, "create_class", "class", data.id, payload);
  revalidatePath("/dashboard/admin/classes");
  return data.id as string;
}

export async function updateClass(classId: string, formData: FormData) {
  const supabase = await createClient();
  const adminId = await verifyAdmin(supabase);
  const payload = classPayloadFromForm(formData);

  if (isDevClassId(classId)) {
    return;
  }

  const { error } = await supabase
    .from("classes")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", classId);

  if (error) throw new Error(error.message);
  await logAdminAction(supabase, adminId, "update_class", "class", classId, payload);
  revalidatePath("/dashboard/admin/classes");
  revalidatePath(`/dashboard/admin/classes/${classId}`);
}

export async function archiveClass(classId: string) {
  const supabase = await createClient();
  const adminId = await verifyAdmin(supabase);
  if (isDevClassId(classId)) {
    return;
  }
  const { error } = await supabase
    .from("classes")
    .update({ status: "archived", updated_at: new Date().toISOString() })
    .eq("id", classId);
  if (error) throw new Error(error.message);
  await logAdminAction(supabase, adminId, "archive_class", "class", classId, {});
  revalidatePath("/dashboard/admin/classes");
}

export async function searchStudentsForClass(query: string, excludeClassId?: string) {
  const supabase = await createClient();
  await verifyAdmin(supabase);
  const term = query.trim();
  if (term.length < 2) return [];

  if (isDevAdminBypassEnabled() && excludeClassId && isDevClassId(excludeClassId)) {
    return [
      { id: "00000000-0000-4000-8000-000000000301", display_name: "Maya Kim", avatar_url: null, email: "maya.kim@riverside.edu" },
      { id: "00000000-0000-4000-8000-000000000302", display_name: "Aisha Nguyen", avatar_url: null, email: "aisha.nguyen@riverside.edu" },
    ].filter((student) => student.display_name.toLowerCase().includes(term.toLowerCase()) || student.email.toLowerCase().includes(term.toLowerCase()));
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, email")
    .eq("role", "student")
    .or(`display_name.ilike.%${term}%,email.ilike.%${term}%`)
    .limit(12);

  if (error) throw new Error(error.message);
  if (!excludeClassId || !data?.length) return data ?? [];

  const { data: existing } = await supabase
    .from("class_memberships")
    .select("user_id")
    .eq("class_id", excludeClassId)
    .eq("member_role", "student")
    .eq("status", "active");

  const assignedIds = new Set((existing ?? []).map((row) => row.user_id as string));
  return data.filter((student) => !assignedIds.has(student.id));
}

export async function addStudentToClass(classId: string, userId: string) {
  const supabase = await createClient();
  const adminId = await verifyAdmin(supabase);
  if (isDevClassId(classId)) {
    return;
  }

  const { error } = await supabase.from("class_memberships").upsert(
    {
      class_id: classId,
      user_id: userId,
      member_role: "student",
      status: "active",
      removed_at: null,
      created_by: adminId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "class_id,user_id,member_role" }
  );

  if (error) throw new Error(error.message);
  await logAdminAction(supabase, adminId, "add_class_student", "class", classId, { user_id: userId });
  revalidatePath("/dashboard/admin/classes");
  revalidatePath(`/dashboard/admin/classes/${classId}`);
}

export async function removeStudentFromClass(classId: string, userId: string) {
  const supabase = await createClient();
  const adminId = await verifyAdmin(supabase);
  if (isDevClassId(classId)) {
    return;
  }
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("class_memberships")
    .update({ status: "removed", removed_at: now, updated_at: now })
    .eq("class_id", classId)
    .eq("user_id", userId)
    .eq("member_role", "student");

  if (error) throw new Error(error.message);
  await logAdminAction(supabase, adminId, "remove_class_student", "class", classId, { user_id: userId });
  revalidatePath("/dashboard/admin/classes");
  revalidatePath(`/dashboard/admin/classes/${classId}`);
}

export async function searchCoursesForClass(query: string, excludeClassId?: string) {
  const supabase = await createClient();
  await verifyAdmin(supabase);
  const term = query.trim();
  if (term.length < 2) return [];

  if (isDevAdminBypassEnabled() && excludeClassId && isDevClassId(excludeClassId)) {
    return [
      { id: "00000000-0000-4600-8000-000000000101", title: "Clash and Rebuttal", slug: "clash-and-rebuttal", category: "Core Skills", difficulty: "intermediate", thumbnail_url: null, is_published: true, visibility: "public" },
      { id: "00000000-0000-4600-8000-000000000102", title: "Constructive Case Builder", slug: "constructive-case-builder", category: "Foundations", difficulty: "beginner", thumbnail_url: null, is_published: true, visibility: "public" },
    ].filter((course) => course.title.toLowerCase().includes(term.toLowerCase()) || course.category.toLowerCase().includes(term.toLowerCase()));
  }

  const { data, error } = await supabase
    .from("courses")
    .select("id, title, slug, category, difficulty, thumbnail_url, is_published, visibility")
    .eq("is_archived", false)
    .or(`title.ilike.%${term}%,category.ilike.%${term}%`)
    .order("title")
    .limit(12);

  if (error) throw new Error(error.message);
  if (!excludeClassId || !data?.length) return data ?? [];

  const { data: existing } = await supabase
    .from("class_course_assignments")
    .select("course_id")
    .eq("class_id", excludeClassId);

  const assignedIds = new Set((existing ?? []).map((row) => row.course_id as string));
  return data.filter((course) => !assignedIds.has(course.id));
}

export async function searchClassesForCourse(query: string, excludeCourseId?: string) {
  const supabase = await createClient();
  await verifyAdmin(supabase);
  const term = query.trim();
  if (term.length < 2) return [];

  if (isDevAdminBypassEnabled()) {
    return [
      { id: "00000000-0000-4500-8000-000000000101", code: "IDC-2026-S1", title: "Intro Debate Cohort", grade_level: "9-12", status: "active" },
      { id: "00000000-0000-4500-8000-000000000102", code: "PSC-2026-HS", title: "Public Speaking 101", grade_level: "High School", status: "active" },
    ].filter((classRow) => classRow.title.toLowerCase().includes(term.toLowerCase()) || classRow.code.toLowerCase().includes(term.toLowerCase()));
  }

  const { data, error } = await supabase
    .from("classes")
    .select("id, code, title, grade_level, status")
    .neq("status", "archived")
    .or(`title.ilike.%${term}%,code.ilike.%${term}%,grade_level.ilike.%${term}%`)
    .order("created_at", { ascending: false })
    .limit(12);

  if (error) throw new Error(error.message);
  if (!excludeCourseId || !data?.length) return data ?? [];

  const { data: existing } = await supabase
    .from("class_course_assignments")
    .select("class_id")
    .eq("course_id", excludeCourseId);

  const assignedIds = new Set((existing ?? []).map((row) => row.class_id as string));
  return data.filter((classRow) => !assignedIds.has(classRow.id));
}

export async function assignCourseToClass(classId: string, courseId: string) {
  const supabase = await createClient();
  const adminId = await verifyAdmin(supabase);
  if (isDevClassId(classId)) {
    return;
  }

  const { error: assignmentError } = await supabase.from("class_course_assignments").upsert(
    {
      class_id: classId,
      course_id: courseId,
      assigned_by: adminId,
    },
    { onConflict: "class_id,course_id" }
  );

  if (assignmentError) throw new Error(assignmentError.message);

  const { error: visibilityError } = await supabase
    .from("courses")
    .update({ visibility: "class_restricted" })
    .eq("id", courseId);

  if (visibilityError) throw new Error(visibilityError.message);
  await logAdminAction(supabase, adminId, "assign_course_to_class", "class", classId, { course_id: courseId });
  revalidatePath("/dashboard/admin/classes");
  revalidatePath(`/dashboard/admin/classes/${classId}`);
  revalidatePath("/dashboard/admin/courses");
  revalidatePath(`/dashboard/admin/courses/${courseId}/settings`);
}

export async function unassignCourseFromClass(classId: string, courseId: string) {
  const supabase = await createClient();
  const adminId = await verifyAdmin(supabase);
  if (isDevClassId(classId)) {
    return;
  }
  const { error } = await supabase
    .from("class_course_assignments")
    .delete()
    .eq("class_id", classId)
    .eq("course_id", courseId);

  if (error) throw new Error(error.message);
  await logAdminAction(supabase, adminId, "unassign_course_from_class", "class", classId, { course_id: courseId });
  revalidatePath("/dashboard/admin/classes");
  revalidatePath(`/dashboard/admin/classes/${classId}`);
  revalidatePath(`/dashboard/admin/courses/${courseId}/settings`);
}

export async function saveAttendanceSession(input: SaveAttendanceInput) {
  const supabase = await createClient();
  const adminId = await verifyAdmin(supabase);
  if (isDevClassId(input.classId)) {
    return;
  }

  const sessionDate = cleanDate(input.sessionDate);
  if (!sessionDate) throw new Error("Session date is required");
  if (!input.classId || !input.courseId) throw new Error("Class and course are required");

  const [studentsRes, coursesRes] = await Promise.all([
    supabase
      .from("class_memberships")
      .select("user_id")
      .eq("class_id", input.classId)
      .eq("member_role", "student")
      .eq("status", "active"),
    supabase
      .from("class_course_assignments")
      .select("course_id")
      .eq("class_id", input.classId),
  ]);

  if (studentsRes.error) throw new Error(studentsRes.error.message);
  if (coursesRes.error) throw new Error(coursesRes.error.message);

  const validation = validateAttendanceSubmission({
    activeStudentIds: (studentsRes.data ?? []).map((row) => row.user_id as string),
    assignedCourseIds: (coursesRes.data ?? []).map((row) => row.course_id as string),
    courseId: input.courseId,
    records: input.records,
  });

  if (!validation.ok) {
    if (validation.reason === "course_not_assigned") {
      throw new Error("Attendance course must be assigned to this class.");
    }
    if (validation.reason === "student_not_in_class") {
      throw new Error("Attendance contains a student who is not active in this class.");
    }
    if (validation.reason === "invalid_status") {
      throw new Error("Attendance contains an invalid status.");
    }
    throw new Error("Attendance must include at least one student.");
  }

  for (const record of input.records) {
    if (!ATTENDANCE_STATUSES.has(record.status)) throw new Error("Invalid attendance status");
  }

  const { data: session, error: sessionError } = await supabase
    .from("class_attendance_sessions")
    .upsert(
      {
        class_id: input.classId,
        course_id: input.courseId,
        session_date: sessionDate,
        title: input.title ?? null,
        notes: input.notes ?? null,
        taken_by: adminId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "class_id,course_id,session_date" }
    )
    .select("id")
    .single();

  if (sessionError) throw new Error(sessionError.message);

  const { error: recordsError } = await supabase.from("class_attendance_records").upsert(
    input.records.map((record) => ({
      session_id: session.id,
      user_id: record.userId,
      status: record.status,
      notes: record.notes ?? null,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: "session_id,user_id" }
  );

  if (recordsError) throw new Error(recordsError.message);
  await logAdminAction(supabase, adminId, "save_class_attendance", "class", input.classId, {
    course_id: input.courseId,
    session_date: sessionDate,
    records: input.records.length,
  });

  revalidatePath("/dashboard/admin/classes");
  revalidatePath(`/dashboard/admin/classes/${input.classId}`);
}

export async function deleteAttendanceSession(classId: string, sessionId: string) {
  const supabase = await createClient();
  const adminId = await verifyAdmin(supabase);
  if (isDevClassId(classId)) {
    return;
  }
  const { error } = await supabase
    .from("class_attendance_sessions")
    .delete()
    .eq("id", sessionId)
    .eq("class_id", classId);

  if (error) throw new Error(error.message);
  await logAdminAction(supabase, adminId, "delete_class_attendance", "class", classId, { session_id: sessionId });
  revalidatePath("/dashboard/admin/classes");
  revalidatePath(`/dashboard/admin/classes/${classId}`);
}

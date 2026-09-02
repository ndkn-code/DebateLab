"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isDevAdminBypassEnabled } from "@/lib/dev-admin-bypass";
import { validateAttendanceSubmission } from "@/lib/api/admin-classes-model";
import {
  DEFAULT_CLASS_TIMEZONE,
  buildClassCodeCandidate,
  isScheduleCourseAllowed,
  normalizeClassLevel,
  normalizeClassProgram,
  normalizeRecurrenceRule,
  summarizeRecurrence,
} from "@/lib/api/admin-class-schedules-model";
import type {
  AdminClassProgram,
  AdminClassStatus,
  AttendanceStatus,
  SaveClassScheduleInput,
  SaveAttendanceInput,
} from "@/lib/types/admin-classes";
import { containsIlikePattern, mergeUniqueById } from "@/lib/supabase/search";
import {
  requireClassManager,
  requireClassOwner,
  requireClubOwner,
  requirePlatformAdmin,
} from "@/lib/api/class-manager-access";
import { normalizeOrganizationRole } from "@/lib/organizations/compatibility";

type Supabase = Awaited<ReturnType<typeof createClient>>;

type ClassRpcClient = {
  rpc<T>(name: string, args: Record<string, unknown>): Promise<{
    data: T | null;
    error: { message: string } | null;
  }>;
};

function classRpc(supabase: Supabase) {
  return supabase as unknown as ClassRpcClient;
}

const CLASS_STATUSES = new Set<AdminClassStatus>(["draft", "active", "archived"]);
const ATTENDANCE_STATUSES = new Set<AttendanceStatus>(["present", "late", "absent"]);

function isDevClassId(id: string) {
  return isDevAdminBypassEnabled() && id.startsWith("00000000-0000-4500-8000-");
}

async function verifyAdmin(supabase: Supabase) {
  return requirePlatformAdmin(supabase as Parameters<typeof requirePlatformAdmin>[0]);
}

async function callClassRpc<T>(
  supabase: Supabase,
  name: string,
  args: Record<string, unknown>,
) {
  const { data, error } = await classRpc(supabase).rpc<T>(name, args);
  if (error) throw new Error(error.message);
  if (data === null) throw new Error(`${name} returned no result`);
  return data;
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

function cleanTime(value: string | null | undefined) {
  const text = cleanString(value);
  if (!text || !/^\d{2}:\d{2}(:\d{2})?$/.test(text)) throw new Error("Invalid time");
  return text.length === 5 ? `${text}:00` : text;
}

function cleanStatus(value: FormDataEntryValue | string | null | undefined) {
  const text = cleanString(value) ?? "active";
  if (!CLASS_STATUSES.has(text as AdminClassStatus)) throw new Error("Invalid class status");
  return text as AdminClassStatus;
}

function classPayloadFromForm(formData: FormData) {
  const title = cleanString(formData.get("title"));
  if (!title) throw new Error("Class title is required");
  const programType = normalizeClassProgram(cleanString(formData.get("programType")));
  const level = normalizeClassLevel(programType, cleanString(formData.get("gradeLevel")));

  return {
    title,
    description: cleanString(formData.get("description")),
    program_type: programType,
    grade_level: level,
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

async function generateUniqueClassCode(supabase: Supabase, programType: AdminClassProgram) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = buildClassCodeCandidate(programType, attempt);
    const { data, error } = await supabase.from("classes").select("id").eq("code", code).limit(1);
    if (error) throw new Error(error.message);
    if (!data?.length) return code;
  }
  throw new Error("Could not generate a unique class code");
}

export async function createClass(formData: FormData) {
  const supabase = await createClient();
  const clubId = cleanString(formData.get("clubId"));
  if (clubId) {
    await requireClubOwner(supabase as Parameters<typeof requireClubOwner>[0], clubId);
  } else {
    await verifyAdmin(supabase);
  }
  const payload = classPayloadFromForm(formData);
  const code = await generateUniqueClassCode(supabase, payload.program_type);
  const classId = await callClassRpc<string>(supabase, "create_class_transaction", {
    p_club_id: clubId,
    p_code: code,
    p_title: payload.title,
    p_description: payload.description,
    p_program_type: payload.program_type,
    p_grade_level: payload.grade_level,
    p_status: payload.status,
    p_start_date: payload.start_date,
    p_end_date: payload.end_date,
    p_meeting_schedule: payload.meeting_schedule,
    p_room: payload.room,
    p_max_students: payload.max_students,
  });
  revalidatePath("/dashboard/admin/classes");
  return classId;
}

export async function updateClass(classId: string, formData: FormData) {
  const supabase = await createClient();
  await requireClassManager(supabase as Parameters<typeof requireClassManager>[0], classId);
  const payload = classPayloadFromForm(formData);

  if (isDevClassId(classId)) {
    return;
  }

  await callClassRpc<string>(supabase, "update_class_transaction", {
    p_class_id: classId,
    p_title: payload.title,
    p_description: payload.description,
    p_program_type: payload.program_type,
    p_grade_level: payload.grade_level,
    p_status: payload.status,
    p_start_date: payload.start_date,
    p_end_date: payload.end_date,
    p_meeting_schedule: payload.meeting_schedule,
    p_room: payload.room,
    p_max_students: payload.max_students,
  });
  revalidatePath("/dashboard/admin/classes");
  revalidatePath(`/dashboard/admin/classes/${classId}`);
}

export async function archiveClass(classId: string) {
  const supabase = await createClient();
  await requireClassManager(supabase as Parameters<typeof requireClassManager>[0], classId);
  if (isDevClassId(classId)) {
    return;
  }
  await callClassRpc<string>(supabase, "archive_class_transaction", { p_class_id: classId });
  revalidatePath("/dashboard/admin/classes");
}

export async function searchStudentsForClass(query: string, excludeClassId?: string) {
  const supabase = await createClient();
  let clubId: string | null = null;
  if (excludeClassId) {
    const context = await requireClassManager(supabase as Parameters<typeof requireClassManager>[0], excludeClassId);
    clubId = context.clubId;
  } else {
    await verifyAdmin(supabase);
  }
  const term = query.trim();
  if (term.length < 2) return [];

  if (isDevAdminBypassEnabled() && excludeClassId && isDevClassId(excludeClassId)) {
    return [
      { id: "00000000-0000-4000-8000-000000000301", display_name: "Maya Kim", avatar_url: null, email: "maya.kim@riverside.edu" },
      { id: "00000000-0000-4000-8000-000000000302", display_name: "Aisha Nguyen", avatar_url: null, email: "aisha.nguyen@riverside.edu" },
    ].filter((student) => student.display_name.toLowerCase().includes(term.toLowerCase()) || student.email.toLowerCase().includes(term.toLowerCase()));
  }

  const pattern = containsIlikePattern(term);
  let eligibleStudentIds: string[] | null = null;
  if (clubId) {
    const { data: memberships, error: membershipError } = await supabase
      .from("club_memberships")
      .select("user_id")
      .eq("club_id", clubId)
      .eq("role", "student")
      .eq("status", "active");
    if (membershipError) throw new Error(membershipError.message);
    eligibleStudentIds = (memberships ?? []).map((row) => row.user_id as string);
    if (eligibleStudentIds.length === 0) return [];
  }
  const byName = supabase
    .from("profiles")
    .select("id, display_name, avatar_url, email")
    .eq("role", "student")
    .ilike("display_name", pattern)
    .limit(12);
  const byEmail = supabase
    .from("profiles")
    .select("id, display_name, avatar_url, email")
    .eq("role", "student")
    .ilike("email", pattern)
    .limit(12);
  const [nameRes, emailRes] = await Promise.all([
    eligibleStudentIds ? byName.in("id", eligibleStudentIds) : byName,
    eligibleStudentIds ? byEmail.in("id", eligibleStudentIds) : byEmail,
  ]);

  if (nameRes.error) throw new Error(nameRes.error.message);
  if (emailRes.error) throw new Error(emailRes.error.message);

  const data = mergeUniqueById([nameRes.data, emailRes.data], 12);

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
  await requireClassManager(supabase as Parameters<typeof requireClassManager>[0], classId);
  if (isDevClassId(classId)) {
    return;
  }

  const { data: classRow, error: classError } = await supabase
    .from("classes")
    .select("club_id")
    .eq("id", classId)
    .maybeSingle();

  if (classError) throw new Error(classError.message);
  const { data: studentProfile, error: studentProfileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (studentProfileError) throw new Error(studentProfileError.message);
  if (studentProfile?.role !== "student") throw new Error("Student profile is required");

  const clubId = (classRow?.club_id as string | null | undefined) ?? null;

  if (clubId) {
    const { data: activeClub, error: activeClubError } = await supabase
      .from("club_memberships")
      .select("id, club_id")
      .eq("user_id", userId)
      .eq("role", "student")
      .eq("status", "active")
      .maybeSingle();

    if (activeClubError && activeClubError.code !== "PGRST116") {
      throw new Error(activeClubError.message);
    }

    if (activeClub && activeClub.club_id !== clubId) {
      throw new Error("Student already belongs to another organization.");
    }

    if (!activeClub) {
      throw new Error("Student must join this organization before class activation.");
    }
  }

  await callClassRpc<string>(supabase, "manage_class_student_transaction", {
    p_class_id: classId,
    p_student_id: userId,
    p_action: "add",
  });
  revalidatePath("/dashboard/admin/classes");
  revalidatePath(`/dashboard/admin/classes/${classId}`);
}

export async function removeStudentFromClass(classId: string, userId: string) {
  const supabase = await createClient();
  await requireClassManager(supabase as Parameters<typeof requireClassManager>[0], classId);
  if (isDevClassId(classId)) {
    return;
  }
  await callClassRpc<string>(supabase, "manage_class_student_transaction", {
    p_class_id: classId,
    p_student_id: userId,
    p_action: "remove",
  });
  revalidatePath("/dashboard/admin/classes");
  revalidatePath(`/dashboard/admin/classes/${classId}`);
}

export async function assignTeacherToClass(classId: string, userId: string) {
  const supabase = await createClient();
  await requireClassOwner(
    supabase as Parameters<typeof requireClassOwner>[0],
    classId,
  );
  if (!userId) throw new Error("Teacher is required");

  const { data: classRow, error: classError } = await supabase
    .from("classes")
    .select("club_id")
    .eq("id", classId)
    .maybeSingle();
  if (classError) throw new Error(classError.message);
  if (!classRow) throw new Error("Class not found");
  if (!classRow.club_id) throw new Error("Global classes cannot assign club teachers");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (profileError) throw new Error(profileError.message);
  if (!profile) {
    throw new Error("Teacher profile is required");
  }

  const { data: clubMembership, error: clubMembershipError } = await supabase
    .from("club_memberships")
    .select("id, role")
    .eq("club_id", classRow.club_id)
    .eq("user_id", userId)
    .eq("status", "active")
    .in("role", ["owner", "admin", "head_teacher", "teacher", "coach"])
    .maybeSingle();
  if (clubMembershipError) throw new Error(clubMembershipError.message);
  const organizationRole = normalizeOrganizationRole(clubMembership?.role);
  const isOrganizationAcademicLeader = [
    "owner",
    "admin",
    "head_teacher",
  ].includes(organizationRole ?? "");
  const isCanonicalTeacher =
    organizationRole === "teacher" && profile.role === "teacher";
  if (
    profile.role !== "admin" &&
    !isOrganizationAcademicLeader &&
    !isCanonicalTeacher
  ) {
    throw new Error("Teacher must be an active manager of this club");
  }

  await callClassRpc<string>(supabase, "manage_class_teacher_transaction", {
    p_class_id: classId,
    p_teacher_id: userId,
    p_action: "add",
  });
  revalidatePath(`/dashboard/admin/classes/${classId}`);
}

export async function removeTeacherFromClass(classId: string, userId: string) {
  const supabase = await createClient();
  await requireClassOwner(
    supabase as Parameters<typeof requireClassOwner>[0],
    classId,
  );
  await callClassRpc<string>(supabase, "manage_class_teacher_transaction", {
    p_class_id: classId,
    p_teacher_id: userId,
    p_action: "remove",
  });
  revalidatePath(`/dashboard/admin/classes/${classId}`);
}

export async function searchCoursesForClass(query: string, excludeClassId?: string) {
  const supabase = await createClient();
  if (excludeClassId) {
    await requireClassManager(supabase as Parameters<typeof requireClassManager>[0], excludeClassId);
  } else {
    await verifyAdmin(supabase);
  }
  const term = query.trim();
  if (term.length < 2) return [];

  if (isDevAdminBypassEnabled() && excludeClassId && isDevClassId(excludeClassId)) {
    return [
      { id: "00000000-0000-4600-8000-000000000101", title: "Clash and Rebuttal", slug: "clash-and-rebuttal", category: "Core Skills", difficulty: "intermediate", thumbnail_url: null, is_published: true, visibility: "public" },
      { id: "00000000-0000-4600-8000-000000000102", title: "Constructive Case Builder", slug: "constructive-case-builder", category: "Foundations", difficulty: "beginner", thumbnail_url: null, is_published: true, visibility: "public" },
    ].filter((course) => course.title.toLowerCase().includes(term.toLowerCase()) || course.category.toLowerCase().includes(term.toLowerCase()));
  }

  const pattern = containsIlikePattern(term);
  const select =
    "id, title, slug, category, difficulty, thumbnail_url, is_published, visibility";
  const [titleRes, categoryRes] = await Promise.all([
    supabase
      .from("courses")
      .select(select)
      .eq("is_archived", false)
      .ilike("title", pattern)
      .order("title")
      .limit(12),
    supabase
      .from("courses")
      .select(select)
      .eq("is_archived", false)
      .ilike("category", pattern)
      .order("title")
      .limit(12),
  ]);

  if (titleRes.error) throw new Error(titleRes.error.message);
  if (categoryRes.error) throw new Error(categoryRes.error.message);

  const data = mergeUniqueById([titleRes.data, categoryRes.data], 12);
  if (!excludeClassId || !data?.length) return data ?? [];

  const { data: existing } = await supabase
    .from("class_course_assignments")
    .select("course_id")
    .eq("class_id", excludeClassId);

  const assignedIds = new Set((existing ?? []).map((row) => row.course_id as string));
  return data.filter((course) => !assignedIds.has(course.id));
}

export async function getAssignedCoursesForClass(classId: string) {
  const supabase = await createClient();
  await requireClassManager(supabase as Parameters<typeof requireClassManager>[0], classId);

  if (isDevClassId(classId)) {
    return [
      { id: "00000000-0000-4600-8000-000000000001", title: "Public Speaking 101" },
      { id: "00000000-0000-4600-8000-000000000002", title: "Debate Fundamentals" },
      { id: "00000000-0000-4600-8000-000000000003", title: "Argument Building" },
    ];
  }

  const { data: assignments, error: assignmentError } = await supabase
    .from("class_course_assignments")
    .select("course_id")
    .eq("class_id", classId);
  if (assignmentError) throw new Error(assignmentError.message);
  const courseIds = (assignments ?? []).map((row) => row.course_id as string);
  if (!courseIds.length) return [];

  const { data, error } = await supabase
    .from("courses")
    .select("id, title")
    .in("id", courseIds)
    .order("title");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function searchClassesForCourse(query: string, excludeCourseId?: string) {
  const supabase = await createClient();
  await verifyAdmin(supabase);
  const term = query.trim();
  if (term.length < 2) return [];

  if (isDevAdminBypassEnabled()) {
    return [
      { id: "00000000-0000-4500-8000-000000000101", code: "DEB-2026-S1", title: "Intro Debate Cohort", program_type: "debate", grade_level: "Beginner", status: "active" },
      { id: "00000000-0000-4500-8000-000000000102", code: "PS-2026-HS", title: "Public Speaking 101", program_type: "public_speaking", grade_level: "Beginner", status: "active" },
    ].filter((classRow) =>
      classRow.title.toLowerCase().includes(term.toLowerCase()) ||
      classRow.program_type.toLowerCase().includes(term.toLowerCase()) ||
      classRow.grade_level.toLowerCase().includes(term.toLowerCase())
    );
  }

  const pattern = containsIlikePattern(term);
  const select = "id, code, title, program_type, grade_level, status";
  const [titleRes, programRes, gradeRes] = await Promise.all([
    supabase
      .from("classes")
      .select(select)
      .neq("status", "archived")
      .ilike("title", pattern)
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("classes")
      .select(select)
      .neq("status", "archived")
      .ilike("program_type", pattern)
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("classes")
      .select(select)
      .neq("status", "archived")
      .ilike("grade_level", pattern)
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  if (titleRes.error) throw new Error(titleRes.error.message);
  if (programRes.error) throw new Error(programRes.error.message);
  if (gradeRes.error) throw new Error(gradeRes.error.message);

  const data = mergeUniqueById([titleRes.data, programRes.data, gradeRes.data], 12);
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
  await requireClassManager(supabase as Parameters<typeof requireClassManager>[0], classId);
  if (isDevClassId(classId)) {
    return;
  }

  const [{ data: classRow, error: classError }, { data: courseRow, error: courseError }] = await Promise.all([
    supabase.from("classes").select("program_type").eq("id", classId).maybeSingle(),
    supabase.from("courses").select("subject").eq("id", courseId).maybeSingle(),
  ]);
  if (classError) throw new Error(classError.message);
  if (courseError) throw new Error(courseError.message);
  if (!classRow) throw new Error("Class not found");
  if (!courseRow) throw new Error("Course not found");
  if (courseRow.subject === "ielts" && classRow.program_type !== "ielts") {
    throw new Error("IELTS courses can only be assigned to IELTS classes.");
  }

  await callClassRpc<string>(supabase, "manage_class_course_transaction", {
    p_class_id: classId,
    p_course_id: courseId,
    p_action: "assign",
  });
  revalidatePath("/dashboard/admin/classes");
  revalidatePath(`/dashboard/admin/classes/${classId}`);
  revalidatePath("/dashboard/admin/courses");
  revalidatePath(`/dashboard/admin/courses/${courseId}/settings`);
}

export async function unassignCourseFromClass(classId: string, courseId: string) {
  const supabase = await createClient();
  await requireClassManager(supabase as Parameters<typeof requireClassManager>[0], classId);
  if (isDevClassId(classId)) {
    return;
  }
  await callClassRpc<string>(supabase, "manage_class_course_transaction", {
    p_class_id: classId,
    p_course_id: courseId,
    p_action: "unassign",
  });
  revalidatePath("/dashboard/admin/classes");
  revalidatePath(`/dashboard/admin/classes/${classId}`);
  revalidatePath(`/dashboard/admin/courses/${courseId}/settings`);
}

export async function saveAttendanceSession(input: SaveAttendanceInput) {
  const supabase = await createClient();
  await requireClassManager(supabase as Parameters<typeof requireClassManager>[0], input.classId);
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

  await callClassRpc<string>(supabase, "save_class_attendance_transaction", {
    p_class_id: input.classId,
    p_course_id: input.courseId,
    p_session_date: sessionDate,
    p_title: input.title ?? null,
    p_notes: input.notes ?? null,
    p_records: input.records.map((record) => ({
      userId: record.userId,
      status: record.status,
      notes: record.notes ?? null,
    })),
  });

  revalidatePath("/dashboard/admin/classes");
  revalidatePath(`/dashboard/admin/classes/${input.classId}`);
}

export async function deleteAttendanceSession(classId: string, sessionId: string) {
  const supabase = await createClient();
  await requireClassManager(supabase as Parameters<typeof requireClassManager>[0], classId);
  if (isDevClassId(classId)) {
    return;
  }
  await callClassRpc<string>(supabase, "delete_class_attendance_transaction", {
    p_class_id: classId,
    p_session_id: sessionId,
  });
  revalidatePath("/dashboard/admin/classes");
  revalidatePath(`/dashboard/admin/classes/${classId}`);
}

export async function saveClassSchedule(input: SaveClassScheduleInput) {
  const supabase = await createClient();
  await requireClassManager(supabase as Parameters<typeof requireClassManager>[0], input.classId);
  if (isDevClassId(input.classId)) {
    return input.id ?? "dev-schedule";
  }

  const startDate = cleanDate(input.startDate);
  if (!startDate) throw new Error("Schedule start date is required");
  const startTime = cleanTime(input.startTime);
  const endTime = cleanTime(input.endTime);
  if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
    throw new Error("End time must be after start time");
  }
  const title = cleanString(input.title);
  if (!title) throw new Error("Schedule title is required");

  const recurrenceRule = normalizeRecurrenceRule(input.recurrenceRule, startDate);
  const endDate = recurrenceRule.endMode === "on_date" ? recurrenceRule.until : cleanDate(input.endDate);
  const courseId = cleanString(input.courseId);

  if (courseId) {
    const { data: assignments, error: assignmentError } = await supabase
      .from("class_course_assignments")
      .select("course_id")
      .eq("class_id", input.classId);
    if (assignmentError) throw new Error(assignmentError.message);
    if (!isScheduleCourseAllowed(courseId, (assignments ?? []).map((row) => row.course_id as string))) {
      throw new Error("Schedule course must be assigned to this class.");
    }
  }

  const payload = {
    class_id: input.classId,
    course_id: courseId,
    title,
    room: cleanString(input.room),
    location: cleanString(input.location),
    start_date: startDate,
    end_date: endDate,
    start_time: startTime,
    end_time: endTime,
    timezone: cleanString(input.timezone) ?? DEFAULT_CLASS_TIMEZONE,
    recurrence_rule: recurrenceRule,
    recurrence_summary: summarizeRecurrence(recurrenceRule, startDate),
    status: "active",
    updated_at: new Date().toISOString(),
  };

  const scheduleId = await callClassRpc<string>(supabase, "save_class_schedule_transaction", {
    p_class_id: input.classId,
    p_schedule_id: input.id ?? null,
    p_course_id: courseId,
    p_title: title,
    p_room: payload.room,
    p_location: payload.location,
    p_start_date: startDate,
    p_end_date: endDate,
    p_start_time: startTime,
    p_end_time: endTime,
    p_timezone: payload.timezone,
    p_recurrence_rule: recurrenceRule,
    p_recurrence_summary: payload.recurrence_summary,
    p_status: payload.status,
  });

  revalidatePath("/dashboard/admin/classes");
  revalidatePath(`/dashboard/admin/classes/${input.classId}`);
  return scheduleId;
}

export async function deleteClassSchedule(classId: string, scheduleId: string) {
  const supabase = await createClient();
  await requireClassManager(supabase as Parameters<typeof requireClassManager>[0], classId);
  if (isDevClassId(classId)) {
    return;
  }
  await callClassRpc<string>(supabase, "archive_class_schedule_transaction", {
    p_class_id: classId,
    p_schedule_id: scheduleId,
  });
  revalidatePath("/dashboard/admin/classes");
  revalidatePath(`/dashboard/admin/classes/${classId}`);
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

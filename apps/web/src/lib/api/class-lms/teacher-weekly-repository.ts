import "server-only";

import { DEFAULT_CLASS_TIMEZONE } from "@/lib/api/admin-class-schedules-model";
import { requireClassManagerDashboard } from "@/lib/api/class-manager-access";
import {
  addIsoDateDays,
  weekStartForTimezone,
} from "@/lib/api/class-lms/weekly-model";
import { createTypedServerClient } from "@/lib/supabase/server";
import { normalizeOrganizationRole } from "@/lib/organizations/compatibility";

const OCCURRENCE_STATUSES = new Set(["scheduled", "cancelled", "completed"]);

export interface TeacherWeekOccurrence {
  id: string;
  classId: string;
  classTitle: string;
  programType: string;
  date: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  title: string;
  status: "scheduled" | "cancelled" | "completed";
}

export interface TeacherWeekView {
  startDate: string;
  endDate: string;
  timezone: string;
  occurrences: TeacherWeekOccurrence[];
  classes: Array<{ id: string; title: string; programType: string }>;
}

function occurrenceStatus(value: string): TeacherWeekOccurrence["status"] {
  if (!OCCURRENCE_STATUSES.has(value)) {
    throw new Error(`Unknown lesson occurrence status: ${value}`);
  }
  return value as TeacherWeekOccurrence["status"];
}

export async function loadTeacherLmsWeek(params: {
  weekStart?: string;
  classId?: string;
  programType?: string;
}): Promise<TeacherWeekView> {
  const db = await createTypedServerClient();
  const actorId = await requireClassManagerDashboard(db);

  const [
    { data: profile, error: profileError },
    { data: clubMemberships, error: clubError },
  ] = await Promise.all([
    db.from("profiles").select("role").eq("id", actorId).maybeSingle(),
    db
      .from("club_memberships")
      .select("club_id, role")
      .eq("user_id", actorId)
      .eq("status", "active")
      .in("role", ["owner", "admin", "teacher", "coach"]),
  ]);
  if (profileError || clubError) {
    throw new Error(
      `loadTeacherLmsWeek authority: ${profileError?.message ?? clubError?.message}`,
    );
  }

  const isAdmin = profile?.role === "admin";
  const isTeacherProfile = profile?.role === "teacher";
  const ownerClubIds = new Set(
    (clubMemberships ?? [])
      .filter((row) => {
        const role = normalizeOrganizationRole(row.role);
        return role === "owner" || role === "admin";
      })
      .map((row) => row.club_id),
  );
  const managerClubIds = [
    ...new Set((clubMemberships ?? []).map((row) => row.club_id)),
  ];
  let classQuery = db
    .from("classes")
    .select("id, club_id, title, program_type")
    .eq("status", "active")
    .order("title", { ascending: true });
  if (!isAdmin) classQuery = classQuery.in("club_id", managerClubIds);
  const { data: candidateClasses, error: classError } = await classQuery;
  if (classError) {
    throw new Error(`loadTeacherLmsWeek classes: ${classError.message}`);
  }

  const teacherClassIds = new Set<string>();
  if (!isAdmin) {
    const { data: teacherMemberships, error: teacherError } = await db
      .from("class_memberships")
      .select("class_id")
      .eq("user_id", actorId)
      .eq("member_role", "teacher")
      .eq("status", "active");
    if (teacherError) {
      throw new Error(
        `loadTeacherLmsWeek memberships: ${teacherError.message}`,
      );
    }
    for (const row of teacherMemberships ?? []) teacherClassIds.add(row.class_id);
  }

  const managedClassRows = (candidateClasses ?? []).filter(
    (row) =>
      isAdmin ||
      ownerClubIds.has(row.club_id ?? "") ||
      (isTeacherProfile && teacherClassIds.has(row.id)),
  );
  const classes = managedClassRows
    .map((row) => ({
      id: row.id,
      title: row.title,
      programType: row.program_type ?? "debate",
    }))
    .filter(
      (row) => !params.programType || row.programType === params.programType,
    );
  const allowedClassIds = new Set(classes.map((row) => row.id));
  const timezoneClass = params.classId
    ? managedClassRows.find((row) => row.id === params.classId)
    : managedClassRows.find((row) => allowedClassIds.has(row.id));
  let timezone = DEFAULT_CLASS_TIMEZONE;
  if (timezoneClass?.club_id) {
    const { data: club, error: timezoneError } = await db
      .from("clubs")
      .select("timezone")
      .eq("id", timezoneClass.club_id)
      .maybeSingle();
    if (timezoneError) {
      throw new Error(`loadTeacherLmsWeek timezone: ${timezoneError.message}`);
    }
    if (club?.timezone) timezone = club.timezone;
  }
  const startDate = weekStartForTimezone(params.weekStart, timezone);
  const endDate = addIsoDateDays(startDate, 6);
  if (params.classId && !allowedClassIds.has(params.classId)) {
    return {
      startDate,
      endDate,
      timezone,
      classes,
      occurrences: [],
    };
  }

  const queriedClassIds = params.classId
    ? [params.classId]
    : [...allowedClassIds];
  if (queriedClassIds.length === 0) {
    return {
      startDate,
      endDate,
      timezone,
      classes,
      occurrences: [],
    };
  }

  const query = db
    .from("lms_lesson_occurrences")
    .select(
      "id, class_id, occurrence_date, starts_at, ends_at, timezone, title, status",
    )
    .gte("occurrence_date", startDate)
    .lte("occurrence_date", endDate)
    .in("class_id", queriedClassIds)
    .order("starts_at", { ascending: true })
    .order("id", { ascending: true });
  const { data: occurrenceRows, error: occurrenceError } = await query;
  if (occurrenceError) {
    throw new Error(
      `loadTeacherLmsWeek occurrences: ${occurrenceError.message}`,
    );
  }

  const classMap = new Map(managedClassRows.map((row) => [row.id, row]));

  return {
    startDate,
    endDate,
    timezone,
    classes,
    occurrences: (occurrenceRows ?? [])
      .filter((row) => allowedClassIds.has(row.class_id))
      .map((row) => {
        const classRow = classMap.get(row.class_id);
        return {
          id: row.id,
          classId: row.class_id,
          classTitle: classRow?.title ?? "Class",
          programType: classRow?.program_type ?? "debate",
          date: row.occurrence_date,
          startsAt: row.starts_at,
          endsAt: row.ends_at,
          timezone: row.timezone,
          title: row.title,
          status: occurrenceStatus(row.status),
        };
      }),
  };
}

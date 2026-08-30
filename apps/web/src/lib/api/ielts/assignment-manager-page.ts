/**
 * Page-composition loader for the teacher IELTS assignments surface (WS-5.3).
 * Gates on `requireClubManager` (returns null for non-managers → notFound) and
 * gathers everything the assign form + list need: the club's classes, the
 * published mocks, and the existing IELTS-mock assignments.
 */
import "server-only";
import { createTypedServerClient } from "@/lib/supabase/server";
import type { IeltsClassStudyPlanSurfaceView } from "@/lib/ielts/study-plan/class-view";
import { requireClubManager } from "./assignment-access";
import { listClubIeltsAssignments, type IeltsMockAssignmentRow } from "./assignments-repository";
import { loadIeltsClassStudyPlanForManager } from "./class-study-plan-repository";
import { getPublishedIeltsTests } from "./tests-repository";
import { filterAssignableIeltsClasses, type AssignableClass, type AssignableClassRow } from "./assignment-manager-model";
import { normalizeOrganizationRole } from "@/lib/organizations/compatibility";

export type { AssignableClass } from "./assignment-manager-model";

export interface AssignableTest {
  id: string;
  title: string;
  slug: string;
  module: string;
  kind: string;
}

export interface IeltsAssignmentsAdminPage {
  clubId: string;
  clubName: string;
  classes: AssignableClass[];
  tests: AssignableTest[];
  assignments: IeltsMockAssignmentRow[];
  classStudyPlans: IeltsClassStudyPlanSurfaceView;
}

export async function loadIeltsAssignmentsAdminPage(
  clubId: string,
): Promise<IeltsAssignmentsAdminPage | null> {
  const supabase = await createTypedServerClient();

  let actorId: string;
  try {
    actorId = await requireClubManager(supabase, clubId);
  } catch {
    return null;
  }

  const [{ data: actorProfile }, { data: clubMembership }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", actorId).maybeSingle(),
    supabase
      .from("club_memberships")
      .select("role")
      .eq("club_id", clubId)
      .eq("user_id", actorId)
      .eq("status", "active")
      .maybeSingle(),
  ]);

  const managerRole = normalizeOrganizationRole(clubMembership?.role);
  const managerScope = {
    actorId,
    isAdmin: actorProfile?.role === "admin" || managerRole === "admin" || managerRole === "owner",
    clubRole: managerRole,
  };

  const [{ data: club, error: clubError }, classesRes, tests, assignments] = await Promise.all([
    supabase.from("clubs").select("id, name").eq("id", clubId).maybeSingle(),
    supabase
      .from("classes")
      .select("id, title, club_id, teacher_user_id")
      .eq("club_id", clubId)
      .eq("program_type", "ielts")
      .eq("status", "active")
      .order("title", { ascending: true }),
    getPublishedIeltsTests(supabase),
    listClubIeltsAssignments(clubId, supabase),
  ]);

  if (classesRes.error) {
    throw new Error(`loadIeltsAssignmentsAdminPage classes: ${classesRes.error.message}`);
  }
  if (clubError) {
    throw new Error(`loadIeltsAssignmentsAdminPage club: ${clubError.message}`);
  }
  if (club?.id !== clubId) return null;
  let assignedClassIds: Set<string> | undefined;
  if (!managerScope.isAdmin) {
    const assignedClassesRes = await supabase
      .from("class_memberships")
      .select("class_id")
      .eq("user_id", actorId)
      .eq("member_role", "teacher")
      .eq("status", "active");
    if (assignedClassesRes.error) {
      throw new Error(
        `loadIeltsAssignmentsAdminPage class memberships: ${assignedClassesRes.error.message}`,
      );
    }
    assignedClassIds = new Set(assignedClassesRes.data?.map((row) => row.class_id) ?? []);
  }
  const classes = filterAssignableIeltsClasses(
    (classesRes.data ?? []) as AssignableClassRow[],
    { ...managerScope, clubId, assignedClassIds },
  );
  const classStudyPlans = await loadIeltsClassStudyPlanForManager(clubId, {
    classes,
    client: supabase,
  });

  return {
    clubId,
    clubName: club.name,
    classes,
    tests: tests.map((test) => ({
      id: test.id,
      title: test.title,
      slug: test.slug,
      module: test.module,
      kind: test.kind,
    })),
    assignments,
    classStudyPlans,
  };
}

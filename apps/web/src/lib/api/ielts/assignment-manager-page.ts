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

export interface AssignableClass {
  id: string;
  title: string;
}

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

  try {
    await requireClubManager(supabase, clubId);
  } catch {
    return null;
  }

  const { data: club, error: clubError } = await supabase
    .from("clubs")
    .select("id, name")
    .eq("id", clubId)
    .maybeSingle();
  if (clubError) throw new Error(`loadIeltsAssignmentsAdminPage club: ${clubError.message}`);
  if (!club) return null;

  const [classesRes, tests, assignments] = await Promise.all([
    supabase
      .from("classes")
      .select("id, title")
      .eq("club_id", clubId)
      .eq("status", "active")
      .order("title", { ascending: true }),
    getPublishedIeltsTests(supabase),
    listClubIeltsAssignments(clubId, supabase),
  ]);
  if (classesRes.error) {
    throw new Error(`loadIeltsAssignmentsAdminPage classes: ${classesRes.error.message}`);
  }
  const classes = (classesRes.data ?? []).map((row) => ({ id: row.id, title: row.title }));
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

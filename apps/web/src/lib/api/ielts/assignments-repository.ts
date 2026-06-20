/**
 * IELTS class-assignment repository (WS-5.3) — the canonical create/list path
 * for "assign a published mock to a class". An assignment reuses the existing
 * Club OS `club_assignments` row (`ielts_attempts.assignment_id` already FKs it)
 * tagged `assignment_type = 'ielts_mock'` with a typed `ielts_test_id`.
 *
 * Class titles + test metadata are fetched in their own batch reads rather than
 * via PostgREST embeds: `club_assignments.class_id` resolves to both the
 * `classes` table and the `admin_class_list_rows` view, which makes an embed
 * ambiguous. All reads/writes are typed + RLS-enforced.
 */
import "server-only";
import { createTypedServerClient } from "@/lib/supabase/server";
import type { IeltsServerClient } from "./assignment-access";

export interface IeltsMockAssignmentRow {
  id: string;
  clubId: string;
  classId: string;
  classTitle: string | null;
  testId: string;
  testTitle: string | null;
  testSlug: string | null;
  testModule: string | null;
  title: string;
  status: string;
  dueAt: string | null;
  createdAt: string;
}

interface CreateIeltsMockAssignmentParams {
  clubId: string;
  classId: string;
  testId: string;
  dueAt?: string | null;
  title?: string | null;
  createdBy: string;
}

const BASE_SELECT = "id, club_id, class_id, ielts_test_id, title, status, due_at, created_at";

interface RawAssignmentRow {
  id: string;
  club_id: string;
  class_id: string | null;
  ielts_test_id: string | null;
  title: string;
  status: string;
  due_at: string | null;
  created_at: string;
}

interface TestMeta {
  title: string | null;
  slug: string | null;
  module: string | null;
}

function unique(values: (string | null)[]): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

async function loadClassTitles(
  supabase: IeltsServerClient,
  classIds: string[],
): Promise<Map<string, string | null>> {
  if (classIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from("classes")
    .select("id, title")
    .in("id", classIds);
  if (error) throw new Error(`loadClassTitles: ${error.message}`);
  return new Map((data ?? []).map((row) => [row.id, row.title]));
}

async function loadTestMeta(
  supabase: IeltsServerClient,
  testIds: string[],
): Promise<Map<string, TestMeta>> {
  if (testIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from("ielts_tests")
    .select("id, title, slug, module")
    .in("id", testIds);
  if (error) throw new Error(`loadTestMeta: ${error.message}`);
  return new Map(
    (data ?? []).map((row) => [row.id, { title: row.title, slug: row.slug, module: row.module }]),
  );
}

async function decorateAssignments(
  supabase: IeltsServerClient,
  rows: RawAssignmentRow[],
): Promise<IeltsMockAssignmentRow[]> {
  if (rows.length === 0) return [];
  const [classTitles, testMeta] = await Promise.all([
    loadClassTitles(supabase, unique(rows.map((row) => row.class_id))),
    loadTestMeta(supabase, unique(rows.map((row) => row.ielts_test_id))),
  ]);
  return rows.map((row) => {
    const test = row.ielts_test_id ? testMeta.get(row.ielts_test_id) : undefined;
    return {
      id: row.id,
      clubId: row.club_id,
      // ielts_mock rows always carry class_id + ielts_test_id (DB CHECK).
      classId: row.class_id ?? "",
      classTitle: row.class_id ? classTitles.get(row.class_id) ?? null : null,
      testId: row.ielts_test_id ?? "",
      testTitle: test?.title ?? null,
      testSlug: test?.slug ?? null,
      testModule: test?.module ?? null,
      title: row.title,
      status: row.status,
      dueAt: row.due_at,
      createdAt: row.created_at,
    };
  });
}

function normalizeDueAt(dueAt: string | null | undefined): string | null {
  if (!dueAt) return null;
  const parsed = new Date(dueAt);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/**
 * Canonical create path for an IELTS-mock club assignment. Asserts the mock is
 * published and the class belongs to the club; the insert itself is gated by the
 * `club_assignments` INSERT RLS policy (`can_manage_club`).
 */
export async function createIeltsMockAssignment(
  params: CreateIeltsMockAssignmentParams,
  client?: IeltsServerClient,
): Promise<{ id: string }> {
  const supabase = client ?? (await createTypedServerClient());

  const { data: test, error: testError } = await supabase
    .from("ielts_tests")
    .select("id, title, status")
    .eq("id", params.testId)
    .maybeSingle();
  if (testError) throw new Error(`createIeltsMockAssignment: ${testError.message}`);
  if (!test) throw new Error("Mock test not found");
  if (test.status !== "published") throw new Error("Only published mocks can be assigned");

  const { data: cls, error: classError } = await supabase
    .from("classes")
    .select("id, club_id")
    .eq("id", params.classId)
    .maybeSingle();
  if (classError) throw new Error(`createIeltsMockAssignment: ${classError.message}`);
  if (!cls || cls.club_id !== params.clubId) {
    throw new Error("That class is not part of this club");
  }

  const { data, error } = await supabase
    .from("club_assignments")
    .insert({
      club_id: params.clubId,
      class_id: params.classId,
      ielts_test_id: params.testId,
      assignment_type: "ielts_mock",
      assigned_track: "ielts",
      title: params.title?.trim() || `IELTS Mock — ${test.title}`,
      rubric_key: "ielts_v1",
      status: "active",
      due_at: normalizeDueAt(params.dueAt),
      created_by: params.createdBy,
    })
    .select("id")
    .single();
  if (error) throw new Error(`createIeltsMockAssignment: ${error.message}`);
  return { id: data.id };
}

/** All IELTS-mock assignments in a club (manager-facing; RLS-scoped). */
export async function listClubIeltsAssignments(
  clubId: string,
  client?: IeltsServerClient,
): Promise<IeltsMockAssignmentRow[]> {
  const supabase = client ?? (await createTypedServerClient());
  const { data, error } = await supabase
    .from("club_assignments")
    .select(BASE_SELECT)
    .eq("club_id", clubId)
    .eq("assignment_type", "ielts_mock")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listClubIeltsAssignments: ${error.message}`);
  return decorateAssignments(supabase, data ?? []);
}

/** A single IELTS-mock assignment scoped to its club (or null). */
export async function getClubIeltsAssignment(
  clubId: string,
  assignmentId: string,
  client?: IeltsServerClient,
): Promise<IeltsMockAssignmentRow | null> {
  const supabase = client ?? (await createTypedServerClient());
  const { data, error } = await supabase
    .from("club_assignments")
    .select(BASE_SELECT)
    .eq("id", assignmentId)
    .eq("club_id", clubId)
    .eq("assignment_type", "ielts_mock")
    .maybeSingle();
  if (error) throw new Error(`getClubIeltsAssignment: ${error.message}`);
  if (!data) return null;
  const [decorated] = await decorateAssignments(supabase, [data]);
  return decorated ?? null;
}

/** Retire an assignment (manager-facing; gated by UPDATE RLS). */
export async function archiveIeltsMockAssignment(
  clubId: string,
  assignmentId: string,
  client?: IeltsServerClient,
): Promise<void> {
  const supabase = client ?? (await createTypedServerClient());
  const { error } = await supabase
    .from("club_assignments")
    .update({ status: "archived", updated_at: new Date().toISOString() })
    .eq("id", assignmentId)
    .eq("club_id", clubId)
    .eq("assignment_type", "ielts_mock");
  if (error) throw new Error(`archiveIeltsMockAssignment: ${error.message}`);
}

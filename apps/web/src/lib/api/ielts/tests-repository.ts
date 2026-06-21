/**
 * IELTS tests repository (WS-0.3 + WS-1.1) — the canonical container entity.
 * Create/update + admin listing + the Draft→Published status workflow (which
 * snapshots a content version on publish). All access is typed + RLS-enforced.
 */
import { parseInput } from "@/lib/api/boundary";
import type { Tables, TablesUpdate } from "@/types/supabase";
import { resolveIeltsClient, type IeltsDbClient } from "./client";
import {
  CreateIeltsTestSchema,
  UpdateIeltsTestSchema,
  toIeltsTestInsert,
  toIeltsTestUpdate,
} from "./schema";
import { snapshotTestVersion } from "./versions-repository";
import { assertTransition, isPublishTransition, type IeltsContentStatus } from "./workflow";

export type IeltsTest = Tables<"ielts_tests">;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function isGeneratedIeltsSkillDrill(test: Pick<IeltsTest, "metadata">): boolean {
  return (
    isRecord(test.metadata) &&
    (test.metadata.generated_kind === "b2c_skill_drill" ||
      test.metadata.generated_by === "ielts_skill_drill_v1")
  );
}

/** One canonical create path for `ielts_tests` (admin-authored; RLS-enforced). */
export async function createIeltsTest(
  raw: unknown,
  options: { authorId?: string | null } = {},
  client?: IeltsDbClient,
): Promise<IeltsTest> {
  const input = parseInput(CreateIeltsTestSchema, raw);
  const supabase = await resolveIeltsClient(client);
  const { data, error } = await supabase
    .from("ielts_tests")
    .insert({ ...toIeltsTestInsert(input), author_id: options.authorId ?? null })
    .select()
    .single();
  if (error) throw new Error(`createIeltsTest failed: ${error.message}`);
  return data;
}

export async function updateIeltsTest(
  testId: string,
  raw: unknown,
  client?: IeltsDbClient,
): Promise<IeltsTest> {
  const input = parseInput(UpdateIeltsTestSchema, raw);
  const supabase = await resolveIeltsClient(client);
  const { data, error } = await supabase
    .from("ielts_tests")
    .update({ ...toIeltsTestUpdate(input), updated_at: new Date().toISOString() })
    .eq("id", testId)
    .select()
    .single();
  if (error) throw new Error(`updateIeltsTest failed: ${error.message}`);
  return data;
}

/** Published tests, RLS-respecting (learner-facing read). */
export async function getPublishedIeltsTests(
  client?: IeltsDbClient,
  options: { includeGenerated?: boolean } = {},
): Promise<IeltsTest[]> {
  const supabase = await resolveIeltsClient(client);
  const { data, error } = await supabase
    .from("ielts_tests")
    .select()
    .eq("status", "published")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`getPublishedIeltsTests failed: ${error.message}`);
  const tests = data ?? [];
  return options.includeGenerated
    ? tests
    : tests.filter((test) => !isGeneratedIeltsSkillDrill(test));
}

/** Look up a single test by slug (null when absent / not visible under RLS). */
export async function getIeltsTestBySlug(
  slug: string,
  client?: IeltsDbClient,
): Promise<IeltsTest | null> {
  const supabase = await resolveIeltsClient(client);
  const { data, error } = await supabase
    .from("ielts_tests")
    .select()
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`getIeltsTestBySlug failed: ${error.message}`);
  return data;
}

/** All tests across statuses (admin authoring list; RLS admits admins only). */
export async function listIeltsTestsForAdmin(client?: IeltsDbClient): Promise<IeltsTest[]> {
  const supabase = await resolveIeltsClient(client);
  const { data, error } = await supabase
    .from("ielts_tests")
    .select()
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`listIeltsTestsForAdmin failed: ${error.message}`);
  return data ?? [];
}

export async function getIeltsTestForAdmin(
  testId: string,
  client?: IeltsDbClient,
): Promise<IeltsTest | null> {
  const supabase = await resolveIeltsClient(client);
  const { data, error } = await supabase
    .from("ielts_tests")
    .select()
    .eq("id", testId)
    .maybeSingle();
  if (error) throw new Error(`getIeltsTestForAdmin failed: ${error.message}`);
  return data;
}

/**
 * Move a test through the content workflow. Validates the transition, stamps
 * publish time + reviewer, and snapshots an immutable content version on publish.
 */
export async function transitionIeltsTestStatus(
  testId: string,
  toStatus: IeltsContentStatus,
  options: { reviewerId?: string | null; note?: string | null } = {},
  client?: IeltsDbClient,
): Promise<IeltsTest> {
  const supabase = await resolveIeltsClient(client);
  const current = await getIeltsTestForAdmin(testId, supabase);
  if (!current) throw new Error("transitionIeltsTestStatus: test not found");
  assertTransition(current.status, toStatus);

  const now = new Date().toISOString();
  const patch: TablesUpdate<"ielts_tests"> = { status: toStatus, updated_at: now };
  if (isPublishTransition(toStatus)) patch.published_at = now;
  if ((toStatus === "approved" || toStatus === "in_qa") && options.reviewerId) {
    patch.qa_reviewer_id = options.reviewerId;
  }

  const { data, error } = await supabase
    .from("ielts_tests")
    .update(patch)
    .eq("id", testId)
    .select()
    .single();
  if (error) throw new Error(`transitionIeltsTestStatus failed: ${error.message}`);

  if (isPublishTransition(toStatus)) {
    await snapshotTestVersion(
      testId,
      { note: options.note ?? "Published", createdBy: options.reviewerId ?? null },
      supabase,
    );
  }
  return data;
}

/**
 * Content versioning repository (WS-1.1). Snapshots the full test tree into
 * `ielts_content_versions` and bumps the working `ielts_tests.version`, so each
 * publish (or manual snapshot) freezes an immutable, admin-only copy. Read paths
 * power the version-history UI (summaries omit the heavy snapshot blob).
 */
import type { Json, Tables } from "@/types/supabase";
import { resolveIeltsClient, type IeltsDbClient } from "./client";
import { buildTestSnapshot } from "./snapshot";
import { getIeltsTestTree } from "./tree";

export type ContentVersion = Tables<"ielts_content_versions">;
export type ContentVersionSummary = Pick<
  ContentVersion,
  "id" | "test_id" | "version" | "status" | "note" | "created_by" | "created_at"
>;

const SUMMARY_COLUMNS = "id, test_id, version, status, note, created_by, created_at";

/**
 * Freeze the test's current working version into an immutable snapshot, then
 * advance the working version. Returns the created version row.
 */
export async function snapshotTestVersion(
  testId: string,
  options: { note?: string | null; createdBy?: string | null } = {},
  client?: IeltsDbClient,
): Promise<ContentVersion> {
  const supabase = await resolveIeltsClient(client);
  const tree = await getIeltsTestTree(testId, supabase);
  if (!tree) throw new Error("snapshotTestVersion: test not found");

  const snapshot = buildTestSnapshot(tree);
  const { data, error } = await supabase
    .from("ielts_content_versions")
    .insert({
      test_id: testId,
      version: tree.test.version,
      status: tree.test.status,
      snapshot: snapshot as unknown as Json,
      note: options.note ?? null,
      created_by: options.createdBy ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(`snapshotTestVersion failed: ${error.message}`);

  const { error: bumpError } = await supabase
    .from("ielts_tests")
    .update({ version: tree.test.version + 1, updated_at: new Date().toISOString() })
    .eq("id", testId);
  if (bumpError) {
    throw new Error(`snapshotTestVersion (version bump) failed: ${bumpError.message}`);
  }
  return data;
}

export async function listTestVersions(
  testId: string,
  client?: IeltsDbClient,
): Promise<ContentVersionSummary[]> {
  const supabase = await resolveIeltsClient(client);
  const { data, error } = await supabase
    .from("ielts_content_versions")
    .select(SUMMARY_COLUMNS)
    .eq("test_id", testId)
    .order("version", { ascending: false });
  if (error) throw new Error(`listTestVersions failed: ${error.message}`);
  return data ?? [];
}

export async function getTestVersion(
  testId: string,
  version: number,
  client?: IeltsDbClient,
): Promise<ContentVersion | null> {
  const supabase = await resolveIeltsClient(client);
  const { data, error } = await supabase
    .from("ielts_content_versions")
    .select()
    .eq("test_id", testId)
    .eq("version", version)
    .maybeSingle();
  if (error) throw new Error(`getTestVersion failed: ${error.message}`);
  return data;
}

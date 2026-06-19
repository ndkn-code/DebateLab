/**
 * IELTS tests repository (WS-0.3) — the typed read/write proof for the new
 * schema. All access goes through the typed client factories (the `<Database>`
 * generic schema-checks every from/insert/select) and external input is
 * validated with `parseInput` at the boundary. This is the single canonical
 * create path for `ielts_tests`.
 */
import { parseInput } from "@/lib/api/boundary";
import { createTypedServerClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/supabase";
import { CreateIeltsTestSchema, toIeltsTestInsert } from "./schema";

export type IeltsTest = Tables<"ielts_tests">;

/** One canonical create path for `ielts_tests` (admin-authored; RLS-enforced). */
export async function createIeltsTest(raw: unknown): Promise<IeltsTest> {
  const input = parseInput(CreateIeltsTestSchema, raw);
  const supabase = await createTypedServerClient();
  const { data, error } = await supabase
    .from("ielts_tests")
    .insert(toIeltsTestInsert(input))
    .select()
    .single();
  if (error) {
    throw new Error(`createIeltsTest failed: ${error.message}`);
  }
  return data;
}

/** Published tests, RLS-respecting (learner-facing read). */
export async function getPublishedIeltsTests(): Promise<IeltsTest[]> {
  const supabase = await createTypedServerClient();
  const { data, error } = await supabase
    .from("ielts_tests")
    .select()
    .eq("status", "published")
    .order("created_at", { ascending: false });
  if (error) {
    throw new Error(`getPublishedIeltsTests failed: ${error.message}`);
  }
  return data ?? [];
}

/** Look up a single test by slug (null when absent / not visible under RLS). */
export async function getIeltsTestBySlug(slug: string): Promise<IeltsTest | null> {
  const supabase = await createTypedServerClient();
  const { data, error } = await supabase
    .from("ielts_tests")
    .select()
    .eq("slug", slug)
    .maybeSingle();
  if (error) {
    throw new Error(`getIeltsTestBySlug failed: ${error.message}`);
  }
  return data;
}

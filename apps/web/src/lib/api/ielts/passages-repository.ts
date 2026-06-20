/**
 * Passages repository (WS-1.1). Canonical create/update/delete + admin read for
 * Reading stimulus. RLS-enforced (admin session or injected service-role client).
 */
import { parseInput } from "@/lib/api/boundary";
import type { Tables } from "@/types/supabase";
import { resolveIeltsClient, type IeltsDbClient } from "./client";
import {
  CreatePassageSchema,
  UpdatePassageSchema,
  toPassageInsert,
  toPassageUpdate,
} from "./content-schema";

export type Passage = Tables<"passages">;

/** One canonical create path for `passages`. */
export async function createPassage(
  raw: unknown,
  client?: IeltsDbClient,
): Promise<Passage> {
  const input = parseInput(CreatePassageSchema, raw);
  const supabase = await resolveIeltsClient(client);
  const { data, error } = await supabase
    .from("passages")
    .insert(toPassageInsert(input))
    .select()
    .single();
  if (error) throw new Error(`createPassage failed: ${error.message}`);
  return data;
}

export async function updatePassage(
  passageId: string,
  raw: unknown,
  client?: IeltsDbClient,
): Promise<Passage> {
  const input = parseInput(UpdatePassageSchema, raw);
  const supabase = await resolveIeltsClient(client);
  const { data, error } = await supabase
    .from("passages")
    .update({ ...toPassageUpdate(input), updated_at: new Date().toISOString() })
    .eq("id", passageId)
    .select()
    .single();
  if (error) throw new Error(`updatePassage failed: ${error.message}`);
  return data;
}

export async function deletePassage(passageId: string, client?: IeltsDbClient): Promise<void> {
  const supabase = await resolveIeltsClient(client);
  const { error } = await supabase.from("passages").delete().eq("id", passageId);
  if (error) throw new Error(`deletePassage failed: ${error.message}`);
}

export async function listPassagesByTest(
  testId: string,
  client?: IeltsDbClient,
): Promise<Passage[]> {
  const supabase = await resolveIeltsClient(client);
  const { data, error } = await supabase
    .from("passages")
    .select()
    .eq("test_id", testId)
    .order("order_index", { ascending: true });
  if (error) throw new Error(`listPassagesByTest failed: ${error.message}`);
  return data ?? [];
}

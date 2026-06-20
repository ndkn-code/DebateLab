/**
 * Listening-sections repository (WS-1.1). Canonical create/update/delete + admin
 * read for Listening stimulus (hand-authored scripts; TTS audio is WS-1.3, so
 * audio_asset_id stays null here).
 */
import { parseInput } from "@/lib/api/boundary";
import type { Tables } from "@/types/supabase";
import { resolveIeltsClient, type IeltsDbClient } from "./client";
import {
  CreateListeningSectionSchema,
  UpdateListeningSectionSchema,
  toListeningSectionInsert,
  toListeningSectionUpdate,
} from "./content-schema";

export type ListeningSection = Tables<"listening_sections">;

/** One canonical create path for `listening_sections`. */
export async function createListeningSection(
  raw: unknown,
  client?: IeltsDbClient,
): Promise<ListeningSection> {
  const input = parseInput(CreateListeningSectionSchema, raw);
  const supabase = await resolveIeltsClient(client);
  const { data, error } = await supabase
    .from("listening_sections")
    .insert(toListeningSectionInsert(input))
    .select()
    .single();
  if (error) throw new Error(`createListeningSection failed: ${error.message}`);
  return data;
}

export async function updateListeningSection(
  sectionId: string,
  raw: unknown,
  client?: IeltsDbClient,
): Promise<ListeningSection> {
  const input = parseInput(UpdateListeningSectionSchema, raw);
  const supabase = await resolveIeltsClient(client);
  const { data, error } = await supabase
    .from("listening_sections")
    .update({ ...toListeningSectionUpdate(input), updated_at: new Date().toISOString() })
    .eq("id", sectionId)
    .select()
    .single();
  if (error) throw new Error(`updateListeningSection failed: ${error.message}`);
  return data;
}

export async function deleteListeningSection(
  sectionId: string,
  client?: IeltsDbClient,
): Promise<void> {
  const supabase = await resolveIeltsClient(client);
  const { error } = await supabase.from("listening_sections").delete().eq("id", sectionId);
  if (error) throw new Error(`deleteListeningSection failed: ${error.message}`);
}

export async function listListeningSectionsByTest(
  testId: string,
  client?: IeltsDbClient,
): Promise<ListeningSection[]> {
  const supabase = await resolveIeltsClient(client);
  const { data, error } = await supabase
    .from("listening_sections")
    .select()
    .eq("test_id", testId)
    .order("section_number", { ascending: true });
  if (error) throw new Error(`listListeningSectionsByTest failed: ${error.message}`);
  return data ?? [];
}

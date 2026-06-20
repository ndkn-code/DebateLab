/**
 * Band-conversions repository (WS-1.1). Authoring create + read for raw→band
 * lookup rows. (WS-2.2 owns seeding exact per-test tables + the conversion math;
 * this card just gives authors a typed create path.)
 */
import { parseInput } from "@/lib/api/boundary";
import type { Tables } from "@/types/supabase";
import { resolveIeltsClient, type IeltsDbClient } from "./client";
import {
  CreateBandConversionSchema,
  ReplaceBandConversionTableSchema,
  toBandConversionInsert,
  toBandConversionRows,
  type BandConversionSkill,
  type BandConversionModuleKey,
} from "./content-schema";

export type BandConversion = Tables<"band_conversions">;

/** One canonical create path for `band_conversions`. */
export async function createBandConversion(
  raw: unknown,
  client?: IeltsDbClient,
): Promise<BandConversion> {
  const input = parseInput(CreateBandConversionSchema, raw);
  const supabase = await resolveIeltsClient(client);
  const { data, error } = await supabase
    .from("band_conversions")
    .insert(toBandConversionInsert(input))
    .select()
    .single();
  if (error) throw new Error(`createBandConversion failed: ${error.message}`);
  return data;
}

export async function listBandConversions(
  conversionKey: string,
  client?: IeltsDbClient,
): Promise<BandConversion[]> {
  const supabase = await resolveIeltsClient(client);
  const { data, error } = await supabase
    .from("band_conversions")
    .select()
    .eq("conversion_key", conversionKey)
    .order("band", { ascending: false });
  if (error) throw new Error(`listBandConversions failed: ${error.message}`);
  return data ?? [];
}

/** Every band_conversions row (admin management list; RLS admits admins only). */
export async function listAllBandConversions(
  client?: IeltsDbClient,
): Promise<BandConversion[]> {
  const supabase = await resolveIeltsClient(client);
  const { data, error } = await supabase
    .from("band_conversions")
    .select()
    .order("conversion_key")
    .order("skill")
    .order("band", { ascending: false });
  if (error) throw new Error(`listAllBandConversions failed: ${error.message}`);
  return data ?? [];
}

/**
 * Canonical "edit a table" path: replace every row of one
 * (conversion_key, skill, module) table with the validated set. Delete-then-
 * insert so removing a band actually drops it (a plain upsert would leave stale
 * rows). Admin-RLS enforced via the cookie-bound client.
 */
export async function replaceBandConversionTable(
  raw: unknown,
  client?: IeltsDbClient,
): Promise<BandConversion[]> {
  const input = parseInput(ReplaceBandConversionTableSchema, raw);
  const supabase = await resolveIeltsClient(client);

  await deleteBandConversionTable(
    { conversionKey: input.conversionKey, skill: input.skill, module: input.module ?? null },
    supabase,
  );

  const { data, error } = await supabase
    .from("band_conversions")
    .insert(toBandConversionRows(input))
    .select();
  if (error) throw new Error(`replaceBandConversionTable(insert): ${error.message}`);
  return data ?? [];
}

/** Delete one (conversion_key, skill, module) table outright. */
export async function deleteBandConversionTable(
  params: {
    conversionKey: string;
    skill: BandConversionSkill;
    module: BandConversionModuleKey | null;
  },
  client?: IeltsDbClient,
): Promise<void> {
  const supabase = await resolveIeltsClient(client);
  const base = supabase
    .from("band_conversions")
    .delete()
    .eq("conversion_key", params.conversionKey)
    .eq("skill", params.skill);
  const query = params.module === null ? base.is("module", null) : base.eq("module", params.module);
  const { error } = await query;
  if (error) throw new Error(`deleteBandConversionTable failed: ${error.message}`);
}

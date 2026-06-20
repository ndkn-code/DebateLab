/**
 * Band-conversions repository (WS-1.1). Authoring create + read for raw→band
 * lookup rows. (WS-2.2 owns seeding exact per-test tables + the conversion math;
 * this card just gives authors a typed create path.)
 */
import { parseInput } from "@/lib/api/boundary";
import type { Tables } from "@/types/supabase";
import { resolveIeltsClient, type IeltsDbClient } from "./client";
import { CreateBandConversionSchema, toBandConversionInsert } from "./content-schema";

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

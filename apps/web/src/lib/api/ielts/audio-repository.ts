/**
 * Typed data access for generated Listening audio (WS-1.3): the `audio_assets`
 * lifecycle and its link to `listening_sections`. One canonical asset per
 * section (reused on regeneration) keeps generation idempotent.
 *
 * Mutations run with the injected service-role client from the generation job;
 * reads default to the cookie-bound admin session (RLS authorizes). All access
 * is through the `<Database>`-typed client (quality bar §1).
 */
import "server-only";
import type { Json, Tables } from "@/types/supabase";
import {
  IELTS_LISTENING_AUDIO_BUCKET,
  publicListeningAudioUrl,
} from "@/lib/ielts/listening-audio/storage-paths";
import { resolveIeltsClient, type IeltsDbClient } from "./client";

export type AudioAsset = Tables<"audio_assets">;
export type ListeningSection = Tables<"listening_sections">;
export type IeltsAudioStatus = AudioAsset["status"];

export interface SectionWithAudio {
  section: ListeningSection;
  asset: AudioAsset | null;
}

/** Load a Listening section together with its linked audio asset (if any). */
export async function getSectionWithAudio(
  sectionId: string,
  client?: IeltsDbClient,
): Promise<SectionWithAudio> {
  const supabase = await resolveIeltsClient(client);
  const { data: section, error } = await supabase
    .from("listening_sections")
    .select()
    .eq("id", sectionId)
    .single();
  if (error) throw new Error(`getSectionWithAudio failed: ${error.message}`);

  if (!section.audio_asset_id) return { section, asset: null };
  const { data: asset, error: assetError } = await supabase
    .from("audio_assets")
    .select()
    .eq("id", section.audio_asset_id)
    .maybeSingle();
  if (assetError) throw new Error(`getSectionWithAudio (asset) failed: ${assetError.message}`);
  return { section, asset: asset ?? null };
}

/**
 * Return the section's audio asset, creating + linking a `pending` one if it
 * has none. Reusing the existing row is what makes regeneration replace rather
 * than duplicate.
 */
export async function ensureSectionAudioAsset(
  current: SectionWithAudio,
  client?: IeltsDbClient,
): Promise<AudioAsset> {
  if (current.asset) return current.asset;
  const supabase = await resolveIeltsClient(client);
  const { section } = current;

  const { data: asset, error } = await supabase
    .from("audio_assets")
    .insert({
      test_id: section.test_id,
      kind: "listening_section",
      script: section.script,
      accent: section.accent,
      status: "pending",
    })
    .select()
    .single();
  if (error) throw new Error(`ensureSectionAudioAsset failed: ${error.message}`);

  const { error: linkError } = await supabase
    .from("listening_sections")
    .update({ audio_asset_id: asset.id, updated_at: new Date().toISOString() })
    .eq("id", section.id);
  if (linkError) throw new Error(`ensureSectionAudioAsset (link) failed: ${linkError.message}`);

  return asset;
}

/** Move an asset to `generating` (clears any prior error). */
export async function markAudioGenerating(
  assetId: string,
  client?: IeltsDbClient,
): Promise<void> {
  const supabase = await resolveIeltsClient(client);
  const { error } = await supabase
    .from("audio_assets")
    .update({ status: "generating", metadata: {}, updated_at: new Date().toISOString() })
    .eq("id", assetId);
  if (error) throw new Error(`markAudioGenerating failed: ${error.message}`);
}

export interface FinalizeAudioFields {
  storagePath: string;
  voice: string | null;
  ttsProvider: string | null;
  version: number;
  metadata: Json;
}

/** Persist a successful take: `ready` + storage path + provenance metadata. */
export async function finalizeAudioAsset(
  assetId: string,
  fields: FinalizeAudioFields,
  client?: IeltsDbClient,
): Promise<AudioAsset> {
  const supabase = await resolveIeltsClient(client);
  const { data, error } = await supabase
    .from("audio_assets")
    .update({
      status: "ready",
      storage_path: fields.storagePath,
      voice: fields.voice,
      tts_provider: fields.ttsProvider,
      version: fields.version,
      metadata: fields.metadata,
      updated_at: new Date().toISOString(),
    })
    .eq("id", assetId)
    .select()
    .single();
  if (error) throw new Error(`finalizeAudioAsset failed: ${error.message}`);
  return data;
}

/** Mark an asset `failed`, recording the error message in metadata. */
export async function markAudioFailed(
  assetId: string,
  message: string,
  client?: IeltsDbClient,
): Promise<void> {
  const supabase = await resolveIeltsClient(client);
  const { error } = await supabase
    .from("audio_assets")
    .update({
      status: "failed",
      metadata: { error: message },
      updated_at: new Date().toISOString(),
    })
    .eq("id", assetId);
  if (error) throw new Error(`markAudioFailed failed: ${error.message}`);
}

export interface ListeningAudioSummary {
  status: IeltsAudioStatus;
  url: string | null;
  version: number;
  updatedAt: string;
}

/** Per-section audio status + playable URL, for the authoring UI. */
export async function getListeningAudioSummaries(
  testId: string,
  client?: IeltsDbClient,
): Promise<Record<string, ListeningAudioSummary>> {
  const supabase = await resolveIeltsClient(client);
  const { data: sections, error } = await supabase
    .from("listening_sections")
    .select("id, audio_asset_id")
    .eq("test_id", testId)
    .not("audio_asset_id", "is", null);
  if (error) throw new Error(`getListeningAudioSummaries failed: ${error.message}`);

  const byAsset = new Map(
    (sections ?? [])
      .filter((s): s is { id: string; audio_asset_id: string } => Boolean(s.audio_asset_id))
      .map((s) => [s.audio_asset_id, s.id]),
  );
  if (byAsset.size === 0) return {};

  const { data: assets, error: assetsError } = await supabase
    .from("audio_assets")
    .select("id, status, version, storage_path, updated_at")
    .in("id", [...byAsset.keys()]);
  if (assetsError) throw new Error(`getListeningAudioSummaries (assets) failed: ${assetsError.message}`);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const summaries: Record<string, ListeningAudioSummary> = {};
  for (const asset of assets ?? []) {
    const sectionId = byAsset.get(asset.id);
    if (!sectionId) continue;
    summaries[sectionId] = {
      status: asset.status,
      url:
        asset.status === "ready"
          ? publicListeningAudioUrl(supabaseUrl, asset.storage_path, asset.version)
          : null,
      version: asset.version,
      updatedAt: asset.updated_at,
    };
  }
  return summaries;
}

/** Re-exported for the upload step in the generation job. */
export { IELTS_LISTENING_AUDIO_BUCKET };

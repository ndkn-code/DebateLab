/**
 * Generate (or regenerate) a Listening section's multi-accent audio (WS-1.3).
 *
 * Flow: load section → ensure one linked `audio_assets` row → `generating` →
 * synthesize each turn with an accent-appropriate voice → upload one MP3 to
 * storage (overwriting the section's stable path) → `ready` with the storage
 * path, voice/provider provenance, and content hash. On error the asset is
 * marked `failed` with the message. Regeneration of an unchanged script is a
 * no-op (matched by content hash) unless `force` is set.
 *
 * Mutations and storage use the service-role client (the admin gate lives in
 * the calling server action).
 */
import "server-only";
import type { Json } from "@/types/supabase";
import { createTypedAdminClient } from "@/lib/supabase/admin";
import type { IeltsDbClient } from "@/lib/api/ielts/client";
import {
  IELTS_LISTENING_AUDIO_BUCKET,
  ensureSectionAudioAsset,
  finalizeAudioAsset,
  getSectionWithAudio,
  markAudioFailed,
  markAudioGenerating,
  markAudioQueued,
  type AudioAsset,
  type IeltsAudioStatus,
} from "@/lib/api/ielts/audio-repository";
import {
  listeningAudioStoragePath,
  publicListeningAudioUrl,
} from "./storage-paths";
import { buildListeningAudioPlan, type ListeningAudioPlan } from "./plan";
import { synthesizeListeningPlan, type TurnSynthesizer } from "./synthesize";
import {
  detectTtsProviderAvailability,
  isMissingProviderConfigError,
  missingProvidersForPlan,
} from "./provider-availability";

type StorageClient = ReturnType<typeof createTypedAdminClient>["storage"];

export interface GenerateListeningAudioOptions {
  /** Service-role client; defaults to {@link createTypedAdminClient}. */
  client?: IeltsDbClient;
  /** Per-turn synthesizer; defaults to the real TTS layer. */
  synth?: TurnSynthesizer;
  /** Regenerate even if the script's content hash is unchanged. */
  force?: boolean;
}

export interface GenerateListeningAudioResult {
  assetId: string;
  status: IeltsAudioStatus;
  url: string | null;
  version: number;
  /** True when an unchanged script short-circuited synthesis. */
  skipped: boolean;
  /**
   * True when synthesis was deferred because a required TTS provider has no
   * credentials (e.g. AUS needs a Google key). The asset stays `pending`; a
   * later run picks it up. This is the "skip/queue gracefully, never throw" path.
   */
  queued: boolean;
  /** Providers that blocked synthesis when `queued`; empty otherwise. */
  missingProviders: string[];
}

async function ensureBucket(storage: StorageClient): Promise<void> {
  const { error } = await storage.getBucket(IELTS_LISTENING_AUDIO_BUCKET);
  if (!error) return;
  const { error: createError } = await storage.createBucket(IELTS_LISTENING_AUDIO_BUCKET, {
    public: true,
    allowedMimeTypes: ["audio/mpeg", "audio/mp3"],
    fileSizeLimit: 26_214_400,
  });
  if (createError) throw new Error(`ensureBucket failed: ${createError.message}`);
}

async function uploadAudio(
  storage: StorageClient,
  storagePath: string,
  audio: Uint8Array,
): Promise<void> {
  await ensureBucket(storage);
  const { error } = await storage
    .from(IELTS_LISTENING_AUDIO_BUCKET)
    .upload(storagePath, Buffer.from(audio), {
      contentType: "audio/mpeg",
      cacheControl: "3600",
      upsert: true,
    });
  if (error) throw new Error(`uploadAudio failed: ${error.message}`);
}

function unchanged(asset: AudioAsset, plan: ListeningAudioPlan): boolean {
  return (
    asset.status === "ready" &&
    typeof asset.metadata === "object" &&
    asset.metadata !== null &&
    !Array.isArray(asset.metadata) &&
    (asset.metadata as Record<string, unknown>).contentHash === plan.contentHash
  );
}

function buildMetadata(
  plan: ListeningAudioPlan,
  turnCount: number,
  generatedAt: string,
): Json {
  return {
    contentHash: plan.contentHash,
    voiceIds: plan.voiceIds,
    providers: plan.providers,
    accents: plan.accents,
    turnCount,
    generatedAt,
  };
}

/** Generate (or regenerate) audio for one Listening section. */
export async function generateListeningSectionAudio(
  sectionId: string,
  options: GenerateListeningAudioOptions = {},
): Promise<GenerateListeningAudioResult> {
  const admin = options.client ?? createTypedAdminClient();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  const current = await getSectionWithAudio(sectionId, admin);
  const asset = await ensureSectionAudioAsset(current, admin);
  const plan = buildListeningAudioPlan({
    script: current.section.script,
    speakers: normalizeSpeakers(current.section.speakers),
    sectionAccent: current.section.accent,
  });

  if (!options.force && unchanged(asset, plan)) {
    return {
      assetId: asset.id,
      status: "ready",
      url: publicListeningAudioUrl(supabaseUrl, asset.storage_path, asset.version),
      version: asset.version,
      skipped: true,
      queued: false,
      missingProviders: [],
    };
  }

  // Gate on credentials BEFORE synthesizing: a plan that needs an unconfigured
  // provider (e.g. AUS → Google, an env gap) is queued, not run into a failure.
  // This avoids wasted provider calls and partial audio for mixed-accent
  // sections, and is the "skip/queue gracefully, never throw" contract.
  const missingProviders = missingProvidersForPlan(
    plan.providers,
    detectTtsProviderAvailability(),
  );
  if (missingProviders.length > 0) {
    await markAudioQueued(asset.id, missingProviders, admin);
    return {
      assetId: asset.id,
      status: "pending",
      url: null,
      version: asset.version,
      skipped: false,
      queued: true,
      missingProviders,
    };
  }

  try {
    await markAudioGenerating(asset.id, admin);
    const { audio, turnCount } = await synthesizeListeningPlan(plan, { synth: options.synth });
    const storagePath = listeningAudioStoragePath(sectionId);
    await uploadAudio(admin.storage, storagePath, audio);

    const version = asset.version + 1;
    await finalizeAudioAsset(
      asset.id,
      {
        storagePath,
        voice: plan.primaryVoiceId,
        ttsProvider: plan.primaryProvider,
        version,
        metadata: buildMetadata(plan, turnCount, new Date().toISOString()),
      },
      admin,
    );

    return {
      assetId: asset.id,
      status: "ready",
      url: publicListeningAudioUrl(supabaseUrl, storagePath, version),
      version,
      skipped: false,
      queued: false,
      missingProviders: [],
    };
  } catch (error) {
    // A missing-credentials error that slipped past the pre-check (e.g. a key
    // present in env but unreadable) is queued, not failed — honoring "never
    // throw" for the unconfigured-provider case.
    if (isMissingProviderConfigError(error)) {
      await markAudioQueued(asset.id, plan.providers, admin);
      return {
        assetId: asset.id,
        status: "pending",
        url: null,
        version: asset.version,
        skipped: false,
        queued: true,
        missingProviders: plan.providers,
      };
    }
    const message = error instanceof Error ? error.message : "unknown error";
    await markAudioFailed(asset.id, message, admin);
    throw error;
  }
}

/** Coerce the `listening_sections.speakers` jsonb into typed `SpeakerMeta[]`. */
function normalizeSpeakers(value: unknown): { name: string; accent: AudioAsset["accent"] }[] {
  if (!Array.isArray(value)) return [];
  const accents = new Set<AudioAsset["accent"]>(["uk", "us", "aus", "other"]);
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const record = entry as Record<string, unknown>;
    const name = typeof record.name === "string" ? record.name : "";
    const accent = accents.has(record.accent as AudioAsset["accent"])
      ? (record.accent as AudioAsset["accent"])
      : "uk";
    return name ? [{ name, accent }] : [];
  });
}

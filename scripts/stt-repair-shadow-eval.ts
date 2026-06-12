import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import {
  evaluateTranscriptLegitimacy,
  computeExtremeDuplicateRatio,
} from "../apps/web/src/lib/stt/evaluation";

type AttemptRow = {
  id: string;
  user_id: string;
  topic_title: string | null;
  side: string | null;
  practice_track: string | null;
  practice_language: string | null;
  transcript: string | null;
  duration_seconds: number | null;
  audio_storage_path: string | null;
  created_at: string | null;
};

type LegacySessionRow = {
  id: string;
  user_id?: string | null;
  topic_title?: string | null;
  topic?: string | null;
  side?: string | null;
  transcript?: string | null;
  duration?: number | null;
  duration_seconds?: number | null;
  created_at?: string | null;
};

function parseArgs() {
  const args = new Map<string, string>();
  for (let index = 2; index < process.argv.length; index += 1) {
    const arg = process.argv[index];
    if (!arg.startsWith("--")) continue;
    const [key, inlineValue] = arg.slice(2).split("=", 2);
    const nextValue = process.argv[index + 1];
    if (inlineValue != null) {
      args.set(key, inlineValue);
    } else if (nextValue && !nextValue.startsWith("--")) {
      args.set(key, nextValue);
      index += 1;
    } else {
      args.set(key, "true");
    }
  }
  return args;
}

function requireEnv(name: string, fallback?: string) {
  const value = process.env[name] ?? (fallback ? process.env[fallback] : undefined);
  if (!value) throw new Error(`Missing ${name}${fallback ? ` or ${fallback}` : ""}`);
  return value;
}

function hashTranscript(value: string | null | undefined) {
  return createHash("sha256").update(value ?? "").digest("hex").slice(0, 16);
}

async function audioObjectExists(
  supabase: ReturnType<typeof createClient>,
  path: string | null | undefined
) {
  if (!path) return null;
  const { error } = await supabase.storage
    .from("practice-audio")
    .createSignedUrl(path, 60);
  return !error;
}

function summarizeLegitimacy(rows: Array<{
  id: string;
  topic: string | null;
  side: string | null;
  transcript: string | null;
  durationSeconds: number | null;
  audioStoragePath: string | null;
  audioExists: boolean | null;
}>) {
  const samples = rows.map((row) => {
    const legitimacy = evaluateTranscriptLegitimacy({
      topic: row.topic,
      side: row.side,
      transcript: row.transcript,
      durationSeconds: row.durationSeconds,
      audioBacked: Boolean(row.audioStoragePath),
      audioExists: row.audioExists,
    });
    return {
      id: row.id,
      transcriptHash: hashTranscript(row.transcript),
      chars: row.transcript?.length ?? 0,
      duplicateRatio: computeExtremeDuplicateRatio(row.transcript ?? ""),
      audioBacked: Boolean(row.audioStoragePath),
      audioExists: row.audioExists,
      legit: legitimacy.legit,
      reasons: legitimacy.reasons,
    };
  });

  const reasonCounts = new Map<string, number>();
  for (const sample of samples) {
    for (const reason of sample.reasons) {
      reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
    }
  }

  return {
    count: samples.length,
    legitCount: samples.filter((sample) => sample.legit).length,
    audioBackedCount: samples.filter((sample) => sample.audioBacked).length,
    missingAudioCount: samples.filter((sample) => sample.audioExists === false).length,
    reasonCounts: Object.fromEntries(reasonCounts.entries()),
    samples,
  };
}

async function main() {
  const args = parseArgs();
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_KEY");
  const targetEmail = args.get("email") ?? "ndkn.work@gmail.com";
  const recentLimit = Number(args.get("recentLimit") ?? 50);
  const out = args.get("out");
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id,email")
    .eq("email", targetEmail)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile?.id) throw new Error(`Could not find profile for ${targetEmail}`);

  const { data: ndknAttempts, error: ndknAttemptsError } = await supabase
    .from("practice_attempts")
    .select(
      "id,user_id,topic_title,side,practice_track,practice_language,transcript,duration_seconds,audio_storage_path,created_at"
    )
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false });
  if (ndknAttemptsError) throw ndknAttemptsError;

  const { data: recentVietnamese, error: recentError } = await supabase
    .from("practice_attempts")
    .select(
      "id,user_id,topic_title,side,practice_track,practice_language,transcript,duration_seconds,audio_storage_path,created_at"
    )
    .eq("practice_track", "debate")
    .eq("practice_language", "vi")
    .not("audio_storage_path", "is", null)
    .order("created_at", { ascending: false })
    .limit(recentLimit);
  if (recentError) throw recentError;

  const { data: legacySessions, error: legacyError } = await supabase
    .from("debate_sessions")
    .select("*")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false });
  if (legacyError) throw legacyError;

  async function attachAudio(rows: AttemptRow[]) {
    return Promise.all(
      rows.map(async (row) => ({
        id: row.id,
        topic: row.topic_title,
        side: row.side,
        transcript: row.transcript,
        durationSeconds: row.duration_seconds,
        audioStoragePath: row.audio_storage_path,
        audioExists: await audioObjectExists(supabase, row.audio_storage_path),
      }))
    );
  }

  const ndknWithAudio = await attachAudio((ndknAttempts ?? []) as AttemptRow[]);
  const recentWithAudio = await attachAudio((recentVietnamese ?? []) as AttemptRow[]);
  const legacyRows = ((legacySessions ?? []) as LegacySessionRow[]).map((row) => ({
    id: row.id,
    topic: row.topic_title ?? row.topic ?? null,
    side: row.side ?? null,
    transcript: row.transcript ?? null,
    durationSeconds: row.duration_seconds ?? row.duration ?? null,
    audioStoragePath: null,
    audioExists: null,
  }));

  const summary = {
    generatedAt: new Date().toISOString(),
    targetEmail,
    targetUserId: profile.id,
    datasets: {
      ndknModern: summarizeLegitimacy(ndknWithAudio),
      recentVietnameseAudioBacked: summarizeLegitimacy(recentWithAudio),
      legacyTextOnly: summarizeLegitimacy(legacyRows),
      negativeCandidates: summarizeLegitimacy(
        [...ndknWithAudio, ...recentWithAudio, ...legacyRows].filter((row) => {
          const legitimacy = evaluateTranscriptLegitimacy({
            topic: row.topic,
            side: row.side,
            transcript: row.transcript,
            durationSeconds: row.durationSeconds,
            audioBacked: Boolean(row.audioStoragePath),
            audioExists: row.audioExists,
          });
          return !legitimacy.legit;
        })
      ),
    },
  };

  const pretty = JSON.stringify(summary, null, 2);
  if (out) {
    await writeFile(out, pretty);
    console.info(`Wrote STT repair shadow eval summary to ${out}`);
  } else {
    console.info(pretty);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

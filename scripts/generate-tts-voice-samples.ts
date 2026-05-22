import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const [{ createClient }, ttsVoices, ttsProviders] = await Promise.all([
    import("@supabase/supabase-js"),
    import("../apps/web/src/lib/tts-voices"),
    import("../apps/web/src/lib/tts-providers"),
  ]);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }

  const requestedVoiceIds = new Set(
    process.argv
      .slice(2)
      .filter((arg) => !arg.startsWith("--"))
  );
  const voices = ttsVoices
    .getVoicesForLanguage("vi")
    .filter((voice) => requestedVoiceIds.size === 0 || requestedVoiceIds.has(voice.id));

  if (voices.length === 0) {
    throw new Error("No Vietnamese voices matched the requested IDs.");
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  async function ensureBucket() {
    const { error } = await admin.storage.getBucket(ttsVoices.TTS_SAMPLE_BUCKET);
    if (!error) return;

    const { error: createError } = await admin.storage.createBucket(
      ttsVoices.TTS_SAMPLE_BUCKET,
      {
        public: true,
        allowedMimeTypes: ["audio/mpeg", "audio/mp3"],
        fileSizeLimit: 1048576,
      }
    );
    if (createError) throw new Error(createError.message);
  }

  await ensureBucket();

  for (const voice of voices) {
    const path = ttsVoices.getVoiceSampleStoragePath(voice.id);
    if (!path) continue;

    process.stdout.write(`Generating ${voice.id}... `);
    const audio = await ttsProviders.synthesizeTtsVoice(
      ttsVoices.TTS_SAMPLE_TEXT_BY_LANGUAGE.vi,
      voice
    );
    const { error } = await admin.storage
      .from(ttsVoices.TTS_SAMPLE_BUCKET)
      .upload(path, Buffer.from(audio), {
        contentType: "audio/mpeg",
        cacheControl: "31536000",
        upsert: true,
      });

    if (error) throw new Error(error.message);

    const { data } = admin.storage.from(ttsVoices.TTS_SAMPLE_BUCKET).getPublicUrl(path);
    process.stdout.write(`${data.publicUrl}\n`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

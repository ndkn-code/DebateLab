import assert from "node:assert/strict";
import {
  coerceVoiceForLanguage,
  getDefaultVoiceForLanguage,
  getVoiceById,
  getVoiceSampleStoragePath,
  getVoiceSampleUrl,
  getVoicesForLanguage,
  TTS_SAMPLE_BUCKET,
  TTS_SAMPLE_TEXT_BY_LANGUAGE,
} from "@/lib/tts-voices";
import {
  buildAzureSsml,
  buildGoogleSynthesizeRequest,
  escapeSsml,
  parseGoogleServiceAccount,
} from "@/lib/tts-providers";

const vietnameseVoices = getVoicesForLanguage("vi");
const vietnameseIds = vietnameseVoices.map((voice) => voice.id);

assert.equal(getDefaultVoiceForLanguage("vi"), "vi-VN-Wavenet-A");
assert.equal(coerceVoiceForLanguage("aura-asteria-en", "vi"), "vi-VN-Wavenet-A");
assert.equal(coerceVoiceForLanguage("vi-VN-HoaiMyNeural", "vi"), "vi-VN-HoaiMyNeural");

for (const voiceId of [
  "vi-VN-HoaiMyNeural",
  "vi-VN-NamMinhNeural",
  "vi-VN-Standard-A",
  "vi-VN-Standard-B",
  "vi-VN-Standard-C",
  "vi-VN-Standard-D",
  "vi-VN-Wavenet-A",
  "vi-VN-Wavenet-B",
  "vi-VN-Wavenet-C",
  "vi-VN-Wavenet-D",
  "vi-VN-Neural2-A",
  "vi-VN-Neural2-D",
  "vi-VN-Chirp3-HD-Kore",
  "vi-VN-Chirp3-HD-Zubenelgenubi",
]) {
  assert.ok(vietnameseIds.includes(voiceId), `${voiceId} should be in the Vietnamese catalog`);
}

assert.equal(getVoiceById("vi-VN-Standard-A")?.quality ?? null, null);
assert.equal(getVoiceById("vi-VN-Wavenet-A")?.quality, "high");
assert.equal(getVoiceById("vi-VN-HoaiMyNeural")?.quality, "high");
assert.equal(getVoiceById("vi-VN-Chirp3-HD-Kore")?.quality, "high");
assert.equal(getVoiceById("vi-VN-Wavenet-A")?.provider, "google");
assert.equal(getVoiceById("vi-VN-HoaiMyNeural")?.provider, "azure");

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co/";
assert.equal(
  getVoiceSampleStoragePath("vi-VN-Wavenet-A"),
  "vi/vi-VN-Wavenet-A.mp3"
);
assert.equal(
  getVoiceSampleUrl("vi-VN-Wavenet-A"),
  `https://example.supabase.co/storage/v1/object/public/${TTS_SAMPLE_BUCKET}/vi/vi-VN-Wavenet-A.mp3`
);
assert.match(TTS_SAMPLE_TEXT_BY_LANGUAGE.vi, /tiếng Việt/);

const googleVoice = getVoiceById("vi-VN-Wavenet-A");
assert.ok(googleVoice);
assert.deepEqual(buildGoogleSynthesizeRequest("Xin chào", googleVoice), {
  input: { text: "Xin chào" },
  voice: { languageCode: "vi-VN", name: "vi-VN-Wavenet-A" },
  audioConfig: { audioEncoding: "MP3" },
});

const azureVoice = getVoiceById("vi-VN-HoaiMyNeural");
assert.ok(azureVoice);
assert.equal(
  buildAzureSsml(`A&B "C"`, azureVoice),
  `<speak version="1.0" xml:lang="vi-VN"><voice xml:lang="vi-VN" name="vi-VN-HoaiMyNeural">A&amp;B &quot;C&quot;</voice></speak>`
);
assert.equal(escapeSsml("<tag>'"), "&lt;tag&gt;&apos;");

const serviceAccount = parseGoogleServiceAccount(
  JSON.stringify({
    client_email: "tts@example.iam.gserviceaccount.com",
    private_key: "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n",
  })
);
assert.equal(serviceAccount.client_email, "tts@example.iam.gserviceaccount.com");
assert.match(serviceAccount.private_key, /\nabc\n/);

console.log("TTS voice catalog tests passed");

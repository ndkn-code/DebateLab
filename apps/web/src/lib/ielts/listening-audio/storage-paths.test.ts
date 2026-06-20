import assert from "node:assert/strict";
import {
  IELTS_LISTENING_AUDIO_BUCKET,
  listeningAudioStoragePath,
  publicListeningAudioUrl,
} from "./storage-paths";

// --- stable, section-keyed path --------------------------------------------
assert.equal(listeningAudioStoragePath("abc-123"), "sections/abc-123.mp3");

// --- public URL: bucket + cache-buster, trailing slash trimmed -------------
assert.equal(
  publicListeningAudioUrl("https://x.supabase.co/", "sections/s1.mp3", 3),
  `https://x.supabase.co/storage/v1/object/public/${IELTS_LISTENING_AUDIO_BUCKET}/sections/s1.mp3?v=3`,
);

// --- null guards ------------------------------------------------------------
assert.equal(publicListeningAudioUrl(undefined, "sections/s1.mp3", 1), null);
assert.equal(publicListeningAudioUrl("https://x.supabase.co", null, 1), null);

console.log("ielts/listening-audio/storage-paths tests passed");

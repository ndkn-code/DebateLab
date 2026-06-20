/**
 * Map IELTS Listening accents to concrete TTS voices and assign a distinct
 * voice to each speaker (WS-1.3). Pure + unit tested.
 *
 * Reuses the existing TTS layer's voices — it does NOT mutate `TTS_VOICES`, so
 * the debate voice picker stays byte-identical (masterplan §2.7):
 *   - `us` / `uk` → Deepgram `aura` voices (en-US / en-GB), already configured.
 *   - `aus`       → Google `en-AU` voices — Deepgram `aura` has no Australian
 *                   voice, and Azure is reserved for phoneme (WS-3.3). Google is
 *                   already wired in `tts-providers.ts` (used for Vietnamese).
 *   - `other`     → falls back to the UK pool.
 *
 * Within an accent, distinct speakers get distinct voices (round-robin over a
 * gender-alternating pool) so a conversation sounds like different people. The
 * assignment is deterministic in first-appearance order, so regeneration of an
 * unchanged script always produces the same audio.
 */
import { getVoiceById, type TTSVoice } from "@/lib/tts-voices";
import type { IeltsAccent, ListeningTurn } from "./script-parser";

/** A turn paired with the resolved voice it should be synthesized with. */
export interface PlannedTurn extends ListeningTurn {
  voice: TTSVoice;
}

/** Google `en-AU` voices (gender-alternating). Not added to `TTS_VOICES`. */
const AUS_VOICES: TTSVoice[] = [
  { id: "en-AU-Neural2-A", name: "Australian Female", nameVi: "Giọng nữ Úc", gender: "female", accent: "Australian", accentVi: "Úc", language: "en", provider: "google", locale: "en-AU", quality: "high" },
  { id: "en-AU-Neural2-B", name: "Australian Male", nameVi: "Giọng nam Úc", gender: "male", accent: "Australian", accentVi: "Úc", language: "en", provider: "google", locale: "en-AU", quality: "high" },
  { id: "en-AU-Neural2-C", name: "Australian Female 2", nameVi: "Giọng nữ Úc 2", gender: "female", accent: "Australian", accentVi: "Úc", language: "en", provider: "google", locale: "en-AU", quality: "high" },
  { id: "en-AU-Neural2-D", name: "Australian Male 2", nameVi: "Giọng nam Úc 2", gender: "male", accent: "Australian", accentVi: "Úc", language: "en", provider: "google", locale: "en-AU", quality: "high" },
];

/** Resolve Deepgram voice ids from the shared catalog (throws if renamed). */
function deepgramPool(ids: readonly string[]): TTSVoice[] {
  return ids.map((id) => {
    const voice = getVoiceById(id);
    if (!voice) throw new Error(`listening-audio: unknown TTS voice "${id}"`);
    return voice;
  });
}

// Gender-alternating so multi-speaker turns sound contrasting.
const UK_POOL = deepgramPool(["aura-helios-en", "aura-athena-en"]);
const US_POOL = deepgramPool([
  "aura-orion-en",
  "aura-asteria-en",
  "aura-arcas-en",
  "aura-luna-en",
]);

const POOL_BY_ACCENT: Record<IeltsAccent, TTSVoice[]> = {
  uk: UK_POOL,
  us: US_POOL,
  aus: AUS_VOICES,
  other: UK_POOL,
};

/** The ordered voice pool for an accent (never empty). */
export function voicePoolForAccent(accent: IeltsAccent): TTSVoice[] {
  return POOL_BY_ACCENT[accent] ?? UK_POOL;
}

function speakerKey(turn: ListeningTurn): string {
  return turn.speaker ? turn.speaker.trim().toLowerCase() : "__narration__";
}

/**
 * Assign each turn a voice. Distinct speakers within the same accent rotate
 * through that accent's pool; the same speaker always reuses its voice.
 */
export function assignVoices(turns: readonly ListeningTurn[]): PlannedTurn[] {
  const voiceBySpeaker = new Map<string, TTSVoice>();
  const usedPerAccent = new Map<IeltsAccent, number>();

  return turns.map((turn) => {
    const key = `${turn.accent}:${speakerKey(turn)}`;
    let voice = voiceBySpeaker.get(key);
    if (!voice) {
      const pool = voicePoolForAccent(turn.accent);
      const index = usedPerAccent.get(turn.accent) ?? 0;
      voice = pool[index % pool.length];
      usedPerAccent.set(turn.accent, index + 1);
      voiceBySpeaker.set(key, voice);
    }
    return { ...turn, voice };
  });
}

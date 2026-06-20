/**
 * Build a deterministic Listening-audio synthesis plan (WS-1.3): parse the
 * script, assign per-speaker voices, and summarize the voices/providers used.
 * Pure + unit tested.
 *
 * `contentHash` is a stable digest of the planned turns (text + voice). The
 * generator stores it on the audio asset so an unchanged script is a no-op on
 * regeneration — the core of "regeneration is idempotent (replace, don't
 * duplicate)".
 */
import { createHash } from "node:crypto";
import { assignVoices, type PlannedTurn } from "./voice-map";
import {
  parseListeningScript,
  type IeltsAccent,
  type SpeakerMeta,
} from "./script-parser";

export interface ListeningAudioPlan {
  turns: PlannedTurn[];
  /** Distinct voice ids used, first-appearance order. */
  voiceIds: string[];
  /** Distinct TTS providers used (e.g. `["deepgram", "google"]`). */
  providers: string[];
  /** Distinct accents used, first-appearance order. */
  accents: IeltsAccent[];
  /** The first turn's voice id — stored in `audio_assets.voice`. */
  primaryVoiceId: string | null;
  /** The dominant provider — stored in `audio_assets.tts_provider`. */
  primaryProvider: string | null;
  /** Stable digest of `{ text, voiceId }[]` for idempotent regeneration. */
  contentHash: string;
}

function distinct<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function hashTurns(turns: readonly PlannedTurn[]): string {
  const canonical = turns.map((t) => ({ text: t.text, voice: t.voice.id }));
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

export interface ListeningAudioPlanInput {
  script: string;
  speakers: readonly SpeakerMeta[];
  sectionAccent: IeltsAccent;
}

/** Parse + voice-assign a section into a synthesis plan. */
export function buildListeningAudioPlan(
  input: ListeningAudioPlanInput,
): ListeningAudioPlan {
  const turns = assignVoices(
    parseListeningScript(input.script, input.speakers, input.sectionAccent),
  );
  const voiceIds = distinct(turns.map((t) => t.voice.id));
  const providers = distinct(turns.map((t) => t.voice.provider));
  const accents = distinct(turns.map((t) => t.accent));

  return {
    turns,
    voiceIds,
    providers,
    accents,
    primaryVoiceId: turns[0]?.voice.id ?? null,
    primaryProvider: providers[0] ?? null,
    contentHash: hashTurns(turns),
  };
}

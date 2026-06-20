/**
 * Synthesize a Listening-audio plan into one MP3 buffer (WS-1.3).
 *
 * Each turn is synthesized through the existing TTS layer
 * (`synthesizeTtsVoice`, which routes Deepgram / Google / Azure) with its
 * accent-appropriate voice, then the per-turn MP3s are concatenated. The
 * synthesizer is injectable so the orchestration is unit tested without network
 * calls or API keys.
 */
import { synthesizeTtsVoice } from "@/lib/tts-providers";
import type { TTSVoice } from "@/lib/tts-voices";
import { concatenateAudioBuffers } from "./audio-buffer";
import type { ListeningAudioPlan } from "./plan";

/** Synthesize one turn of text in a given voice → MP3 bytes. */
export type TurnSynthesizer = (
  text: string,
  voice: TTSVoice,
) => Promise<ArrayBuffer>;

export interface SynthesizeDeps {
  synth?: TurnSynthesizer;
}

export interface SynthesizedListeningAudio {
  audio: Uint8Array;
  turnCount: number;
}

/**
 * Synthesize every turn in `plan` and concatenate into a single MP3. Turns are
 * synthesized sequentially to bound provider concurrency and preserve order.
 * Throws `LISTENING_AUDIO_EMPTY_SCRIPT` when the plan has no spoken turns.
 */
export async function synthesizeListeningPlan(
  plan: ListeningAudioPlan,
  deps: SynthesizeDeps = {},
): Promise<SynthesizedListeningAudio> {
  if (plan.turns.length === 0) {
    throw new Error("LISTENING_AUDIO_EMPTY_SCRIPT");
  }

  const synth = deps.synth ?? synthesizeTtsVoice;
  const parts: ArrayBuffer[] = [];
  for (const turn of plan.turns) {
    parts.push(await synth(turn.text, turn.voice));
  }

  return {
    audio: concatenateAudioBuffers(parts),
    turnCount: plan.turns.length,
  };
}

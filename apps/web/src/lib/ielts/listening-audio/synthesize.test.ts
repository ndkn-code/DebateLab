import assert from "node:assert/strict";
import { synthesizeListeningPlan, type TurnSynthesizer } from "./synthesize";
import { buildListeningAudioPlan } from "./plan";
import type { SpeakerMeta } from "./script-parser";

const speakers: SpeakerMeta[] = [
  { name: "Host", accent: "uk" },
  { name: "Caller", accent: "aus" },
];
const plan = buildListeningAudioPlan({
  script: "HOST: Hello.\nCALLER: Hi there.",
  speakers,
  sectionAccent: "uk",
});

async function main() {
  // --- synthesizes each turn in order and concatenates ---------------------
  const calls: Array<{ text: string; voiceId: string }> = [];
  const fakeSynth: TurnSynthesizer = async (text, voice) => {
    calls.push({ text, voiceId: voice.id });
    return new TextEncoder().encode(text).buffer;
  };

  const result = await synthesizeListeningPlan(plan, { synth: fakeSynth });
  assert.equal(result.turnCount, 2);
  assert.deepEqual(
    calls.map((c) => c.text),
    ["Hello.", "Hi there."],
  );
  // Each turn used its own accent's voice (different providers → different ids).
  assert.notEqual(calls[0].voiceId, calls[1].voiceId);
  // Concatenated bytes equal the joined per-turn audio.
  assert.equal(new TextDecoder().decode(result.audio), "Hello.Hi there.");

  // --- empty plan throws a clear error -------------------------------------
  const emptyPlan = buildListeningAudioPlan({ script: "[silence]", speakers, sectionAccent: "uk" });
  await assert.rejects(
    () => synthesizeListeningPlan(emptyPlan, { synth: fakeSynth }),
    /LISTENING_AUDIO_EMPTY_SCRIPT/,
  );

  console.log("ielts/listening-audio/synthesize tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

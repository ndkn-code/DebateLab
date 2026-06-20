import assert from "node:assert/strict";
import { assignVoices, voicePoolForAccent } from "./voice-map";
import type { ListeningTurn } from "./script-parser";

// --- pools resolve to the right provider/locale ----------------------------
assert.equal(voicePoolForAccent("us")[0].provider, "deepgram");
assert.equal(voicePoolForAccent("us")[0].locale, "en-US");
assert.equal(voicePoolForAccent("uk")[0].locale, "en-GB");
assert.equal(voicePoolForAccent("aus")[0].provider, "google");
assert.equal(voicePoolForAccent("aus")[0].locale, "en-AU");
// `other` falls back to the UK pool.
assert.equal(voicePoolForAccent("other")[0].id, voicePoolForAccent("uk")[0].id);

// --- distinct speakers within an accent get distinct voices ----------------
const ukTurns: ListeningTurn[] = [
  { speaker: "Host", accent: "uk", text: "a" },
  { speaker: "Guest", accent: "uk", text: "b" },
  { speaker: "Host", accent: "uk", text: "c" },
];
const ukPlan = assignVoices(ukTurns);
assert.notEqual(ukPlan[0].voice.id, ukPlan[1].voice.id);
// Same speaker reuses its voice.
assert.equal(ukPlan[0].voice.id, ukPlan[2].voice.id);

// --- per-accent counters are independent; AUS uses Google ------------------
const mixed: ListeningTurn[] = [
  { speaker: null, accent: "us", text: "intro" },
  { speaker: "Caller", accent: "aus", text: "hello" },
  { speaker: "Agent", accent: "us", text: "hi" },
];
const mixedPlan = assignVoices(mixed);
assert.equal(mixedPlan[0].voice.provider, "deepgram");
assert.equal(mixedPlan[1].voice.provider, "google");
assert.equal(mixedPlan[2].voice.provider, "deepgram");
// Two distinct US speakers → two distinct US voices.
assert.notEqual(mixedPlan[0].voice.id, mixedPlan[2].voice.id);

// --- deterministic: same input → identical voice assignment ----------------
const again = assignVoices(mixed);
assert.deepEqual(
  again.map((t) => t.voice.id),
  mixedPlan.map((t) => t.voice.id),
);

console.log("ielts/listening-audio/voice-map tests passed");

import assert from "node:assert/strict";
import { buildListeningAudioPlan } from "./plan";
import type { SpeakerMeta } from "./script-parser";

const speakers: SpeakerMeta[] = [
  { name: "Guide", accent: "uk" },
  { name: "Tourist", accent: "aus" },
];

const plan = buildListeningAudioPlan({
  script: "GUIDE: Welcome to the museum.\nTOURIST: Thanks, it's lovely.",
  speakers,
  sectionAccent: "uk",
});

// --- summary fields ---------------------------------------------------------
assert.equal(plan.turns.length, 2);
assert.deepEqual(plan.accents, ["uk", "aus"]);
assert.equal(plan.providers.includes("deepgram"), true);
assert.equal(plan.providers.includes("google"), true);
assert.equal(plan.primaryVoiceId, plan.turns[0].voice.id);
assert.equal(plan.primaryProvider, "deepgram");
assert.equal(plan.voiceIds.length, 2);

// --- content hash is stable for identical input ----------------------------
const same = buildListeningAudioPlan({
  script: "GUIDE: Welcome to the museum.\nTOURIST: Thanks, it's lovely.",
  speakers,
  sectionAccent: "uk",
});
assert.equal(same.contentHash, plan.contentHash);

// --- content hash changes when the spoken text changes ---------------------
const changed = buildListeningAudioPlan({
  script: "GUIDE: Welcome to the gallery.\nTOURIST: Thanks, it's lovely.",
  speakers,
  sectionAccent: "uk",
});
assert.notEqual(changed.contentHash, plan.contentHash);

// --- a script with only stage directions yields no turns -------------------
const empty = buildListeningAudioPlan({
  script: "[door opens]\n[footsteps]",
  speakers,
  sectionAccent: "uk",
});
assert.equal(empty.turns.length, 0);
assert.equal(empty.primaryVoiceId, null);
assert.equal(empty.primaryProvider, null);
// Hash of the empty plan is still stable.
assert.equal(
  empty.contentHash,
  buildListeningAudioPlan({ script: "[x]", speakers, sectionAccent: "uk" }).contentHash,
);

console.log("ielts/listening-audio/plan tests passed");

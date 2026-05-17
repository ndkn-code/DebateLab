import assert from "node:assert/strict";
import {
  PRACTICE_LANGUAGE_CONFIG,
  coercePracticeLanguage,
} from "./practice-language";
import {
  coerceVoiceForLanguage,
  getVoicesForLanguage,
} from "./tts-voices";
import { normalizeSettingsPreferences } from "./settings";
import { buildPracticeHref, readPracticePrefill } from "./practice-prefill";
import { buildAnalysisPrompt, buildDuelJudgmentPrompt } from "./prompts";

assert.equal(coercePracticeLanguage("vi"), "vi");
assert.equal(coercePracticeLanguage("fr"), "en");
assert.equal(PRACTICE_LANGUAGE_CONFIG.vi.deepgramLanguage, "vi");
assert.equal(PRACTICE_LANGUAGE_CONFIG.vi.ttsLocale, "vi-VN");
assert.equal(getVoicesForLanguage("vi")[0]?.provider, "azure");
assert.equal(coerceVoiceForLanguage("aura-asteria-en", "vi"), "vi-VN-Wavenet-A");
assert.equal(coerceVoiceForLanguage("vi-VN-NamMinhNeural", "vi"), "vi-VN-NamMinhNeural");

const normalizedSettings = normalizeSettingsPreferences({
  practice_language: "vi",
  tts_voice: "aura-orion-en",
});
assert.equal(normalizedSettings.practiceLanguage, "vi");
assert.equal(normalizedSettings.ttsVoice, "vi-VN-Wavenet-A");

const href = buildPracticeHref({
  topicTitle: "Có nên cấm điện thoại trong lớp học?",
  practiceTrack: "debate",
  practiceLanguage: "vi",
  mode: "quick",
  side: "proposition",
});
const parsedPrefill = readPracticePrefill(new URLSearchParams(href.split("?")[1]));
assert.equal(parsedPrefill?.practiceLanguage, "vi");
assert.equal(parsedPrefill?.practiceTrack, "debate");

const viSpeakingPrompt = buildAnalysisPrompt({
  transcript:
    "Em tin rằng học sinh cần được luyện tranh biện bằng tiếng Việt để giải thích ý tưởng rõ ràng hơn.",
  topic: "Có nên cấm điện thoại trong lớp học?",
  side: "proposition",
  speechType: "Speaking Practice",
  timeLimit: 3,
  actualDuration: 90,
  practiceTrack: "speaking",
  practiceLanguage: "vi",
});
assert.match(viSpeakingPrompt, /Vietnamese diacritics/);
assert.match(viSpeakingPrompt, /Return all user-facing prose values in Vietnamese/);

const viDuelPrompt = buildDuelJudgmentPrompt({
  motion: "Có nên cấm điện thoại trong lớp học?",
  topicCategory: "Education",
  practiceLanguage: "vi",
  participants: {
    proposition: { participantId: "prop", displayName: "Prop" },
    opposition: { participantId: "opp", displayName: "Opp" },
  },
  speeches: [
    {
      id: "speech-1",
      roundNumber: 1,
      speechType: "opening",
      side: "proposition",
      label: "Proposition Opening",
      transcript: "Điện thoại làm gián đoạn sự tập trung của học sinh.",
      durationSeconds: 60,
    },
  ],
});
assert.match(viDuelPrompt, /Return all user-facing prose values in Vietnamese/);

console.log("practice-language tests passed");

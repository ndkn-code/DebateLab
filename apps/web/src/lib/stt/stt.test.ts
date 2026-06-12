import assert from "node:assert/strict";
import {
  analyzeGroqTranscriptQuality,
  isGroqTranscriptPlausible,
} from "./consensus";
import { appendDeepgramKeyterms, buildSttKeyterms } from "./keyterms";
import { normalizeTranscriptionText } from "./normalization";
import { buildSttJudgeGuardrailBlock } from "./prompt";
import {
  computeCharacterErrorRate,
  computeTermErrorRate,
  computeWordErrorRate,
  evaluateTranscriptLegitimacy,
} from "./evaluation";
import { parsePracticeAnalysisInput } from "@/lib/practice-analysis/request";

const keyterms = buildSttKeyterms({
  practiceLanguage: "vi",
  topic: "ECOWAS có nên can thiệp khi AES rời khỏi khối?",
  motionBrief: {
    keyTerms: ["Burkina Faso", "clash"],
    scope: "",
    propositionBurden: "",
    oppositionBurden: "",
    modelClarification: "",
  },
});
assert.ok(keyterms.includes("ECOWAS"));
assert.ok(keyterms.includes("AES"));
assert.ok(keyterms.includes("Burkina Faso"));

const deepgramUrl = new URL("https://api.deepgram.com/v1/listen");
appendDeepgramKeyterms(deepgramUrl, keyterms);
assert.ok(deepgramUrl.searchParams.getAll("keyterm").includes("ECOWAS"));

const normalized = normalizeTranscriptionText({
  practiceLanguage: "vi",
  topic: "ECOWAS và AES",
  transcript:
    "Tác động của SCOWS lên a e s và vupali khiến COAS chính bị hiểu sai trong vòng này.",
});
assert.match(normalized.normalizedTranscript, /ECOWAS/);
assert.match(normalized.normalizedTranscript, /AES/);
assert.match(normalized.normalizedTranscript, /Burkina Faso/);
assert.match(normalized.normalizedTranscript, /clash chính/);
assert.ok(normalized.warnings.includes("possible_stt_artifacts"));
assert.ok(normalized.normalizationHints.length >= 3);

const collapsed = normalizeTranscriptionText({
  practiceLanguage: "vi",
  topic: "ECOWAS và AES",
  transcript: "ECOWAS và AES tạo ra cla Faso, Niger, Ghana và Mali.",
});
assert.match(collapsed.normalizedTranscript, /clash về Burkina Faso/);

const guardrail = buildSttJudgeGuardrailBlock({
  transcript: normalized.normalizedTranscript,
  rawTranscript:
    "Tác động của SCOWS lên a e s và vupali khiến clash chính bị hiểu sai.",
  normalizedTranscript: normalized.normalizedTranscript,
  confidence: null,
  wordCount: normalized.wordCount,
  provider: "deepgram_groq_shadow",
  model: "nova-3+whisper-large-v3-turbo",
  requestId: null,
  language: "vi",
  warnings: normalized.warnings,
  normalizationHints: normalized.normalizationHints,
  audioBucket: "practice-audio",
  audioStoragePath: "user/test/source.webm",
  durationSeconds: 60,
  transcribedAt: "2026-05-25T00:00:00.000Z",
});
assert.match(guardrail, /Do not penalize the Language score/);
assert.match(guardrail, /mispronounced/);

const input = parsePracticeAnalysisInput({
  attemptId: "11111111-1111-4111-8111-111111111111",
  transcript: normalized.normalizedTranscript,
  topic: "ECOWAS và AES",
  side: "proposition",
  practiceTrack: "debate",
  practiceLanguage: "vi",
  mode: "quick",
  topicDifficulty: "intermediate",
  transcription: {
    transcript: normalized.normalizedTranscript,
    judgeTranscript: "ECOWAS và AES tạo clash chính rõ hơn.",
    rawTranscript: "SCOWS và a e s",
    confidence: null,
    wordCount: normalized.wordCount,
    provider: "deepgram_groq_shadow",
    model: "nova-3+whisper-large-v3-turbo",
    requestId: null,
    language: "vi",
    warnings: normalized.warnings,
    normalizationHints: normalized.normalizationHints,
    repair: {
      version: 1,
      provider: "google",
      model: "gemini-2.5-flash-lite",
      status: "repaired",
      mode: "shadow",
      latencyMs: 1200,
      rawTranscriptHash: "hash",
      edits: [
        {
          raw: "SCOWS",
          repaired: "ECOWAS",
          category: "proper_noun",
          reason: "Motion acronym supported by topic.",
          confidence: 0.97,
        },
      ],
      uncertainSpans: [],
      warnings: [],
      hallucinationRisk: 0,
      repairedAt: "2026-05-25T00:00:00.000Z",
    },
    audioBucket: "practice-audio",
    audioStoragePath: "11111111-1111-4111-8111-111111111111/test/source.webm",
    durationSeconds: 60,
    transcribedAt: "2026-05-25T00:00:00.000Z",
  },
});
assert.equal(input.transcription?.provider, "deepgram_groq_shadow");
assert.equal(input.transcription?.normalizationHints?.[0]?.normalized, "ECOWAS");
assert.equal(input.transcription?.judgeTranscript, "ECOWAS và AES tạo clash chính rõ hơn.");
assert.equal(input.transcription?.repair?.status, "repaired");
assert.equal(input.transcription?.repair?.edits[0]?.category, "proper_noun");

const deepgramReference =
  "ECOWAS cần cân nhắc tác động lên Nigeria Ghana Mali và Burkina Faso trước khi phản biện AES trong clash chính của vòng tranh biện này";
const groqGood =
  "ECOWAS cần cân nhắc tác động lên Nigeria, Ghana, Mali và Burkina Faso trước khi phản biện AES trong clash chính của vòng tranh biện này";
const groqTooShort = "ECOWAS AES clash";
const groqTooLong = `${groqGood} ${groqGood} ${groqGood}`;
assert.equal(isGroqTranscriptPlausible(deepgramReference, groqGood), true);
assert.equal(isGroqTranscriptPlausible(deepgramReference, groqTooShort), false);
assert.equal(isGroqTranscriptPlausible(deepgramReference, groqTooLong), false);

const collapsedGroq =
  "Ph bi 2 V Tr Nguy Bi K S S tr k hi V ngh quy n sng st v cc bn khng ch ra c i tng no";
const collapsedQuality = analyzeGroqTranscriptQuality(
  "Phản biện hai: về ngụy biện kẻ sống sót, các bạn không chỉ ra được đối tượng nào bị bỏ lại phía sau trong câu chuyện thành công sớm.",
  collapsedGroq
);
assert.equal(collapsedQuality.plausible, false);
assert.ok(
  collapsedQuality.qualityFlags.includes("groq_high_one_letter_token_ratio") ||
    collapsedQuality.qualityFlags.includes("groq_collapsed_consonant_fragments")
);

assert.equal(
  computeWordErrorRate(
    "ECOWAS cần impact weighing trong clash chính",
    "ECOWAS cần impact trong clash chính"
  ),
  1 / 7
);
assert.ok(
  computeCharacterErrorRate("ECOWAS cân tác động", "ECOWAS cân tac dong") > 0
);
const termMetrics = computeTermErrorRate(
  "ECOWAS cần phản biện AES trong clash chính",
  "ECOWAS cần phản biện trong clash chính",
  ["ECOWAS", "AES", "clash"]
);
assert.equal(termMetrics.recall, 2 / 3);
assert.equal(termMetrics.precision, 1);

assert.equal(
  evaluateTranscriptLegitimacy({
    topic: "ECOWAS và AES",
    side: "proposition",
    transcript:
      "ECOWAS cần cân tác động lên Nigeria Ghana Mali và Burkina Faso trước khi phản biện AES trong clash chính. " +
      "Phe ủng hộ phải chứng minh cơ chế can thiệp tạo ổn định khu vực thay vì làm xung đột leo thang. " +
      "Phe phản đối có thể nói rằng chủ quyền và chi phí quân sự khiến chính sách này không khả thi trong thực tế.",
    durationSeconds: 60,
    audioBacked: true,
    audioExists: true,
  }).legit,
  true
);
const fakeTranscript = evaluateTranscriptLegitimacy({
  topic: "",
  side: "proposition",
  transcript: "test test test",
  durationSeconds: null,
  audioBacked: true,
  audioExists: false,
});
assert.equal(fakeTranscript.legit, false);
assert.ok(fakeTranscript.reasons.includes("placeholder_text"));
assert.ok(fakeTranscript.reasons.includes("missing_audio_object"));

console.log("stt utilities passed");

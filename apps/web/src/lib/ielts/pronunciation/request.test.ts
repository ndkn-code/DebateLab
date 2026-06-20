import assert from "node:assert/strict";
import {
  buildAssessmentConfigHeader,
  buildAssessmentRequest,
} from "./request";

function decodeHeader(b64: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
}

// --- config header: defaults (IPA, prosody on) ------------------------------
const defaultHeader = decodeHeader(
  buildAssessmentConfigHeader({ referenceText: "a good answer" }),
);
assert.deepEqual(defaultHeader, {
  ReferenceText: "a good answer",
  GradingSystem: "HundredMark",
  Granularity: "Phoneme",
  Dimension: "Comprehensive",
  PhonemeAlphabet: "IPA",
  EnableProsodyAssessment: true,
});

// --- config header: overrides -----------------------------------------------
const overridden = decodeHeader(
  buildAssessmentConfigHeader({
    referenceText: "x",
    phonemeAlphabet: "SAPI",
    enableProsody: false,
  }),
);
assert.equal(overridden.PhonemeAlphabet, "SAPI");
assert.equal(overridden.EnableProsodyAssessment, false);

// --- full request: url + headers + body -------------------------------------
const audio = new Uint8Array([1, 2, 3, 4]);
const request = buildAssessmentRequest({
  config: { apiKey: "secret-key", region: "southeastasia" },
  audio,
  audioContentType: "audio/wav; codecs=audio/pcm; samplerate=16000",
  params: { referenceText: "a good answer" },
});

assert.equal(
  request.url,
  "https://southeastasia.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=en-US&format=detailed",
);
assert.equal(request.headers["Ocp-Apim-Subscription-Key"], "secret-key");
assert.equal(
  request.headers["Content-Type"],
  "audio/wav; codecs=audio/pcm; samplerate=16000",
);
assert.equal(request.headers.Accept, "application/json");
assert.equal(request.headers["User-Agent"], "Thinkfy");
assert.equal(request.body, audio);
// the header carries the assessment config
assert.equal(
  decodeHeader(request.headers["Pronunciation-Assessment"]).ReferenceText,
  "a good answer",
);

// --- locale is URL-encoded into the query -----------------------------------
const gb = buildAssessmentRequest({
  config: { apiKey: "k", region: "eastus" },
  audio,
  audioContentType: "audio/wav",
  params: { referenceText: "x", locale: "en-GB" },
});
assert.ok(gb.url.includes("https://eastus.stt.speech.microsoft.com"));
assert.ok(gb.url.includes("language=en-GB"));

console.log("ielts/pronunciation/request tests passed");

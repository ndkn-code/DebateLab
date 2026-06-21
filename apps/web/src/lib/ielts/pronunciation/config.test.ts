import assert from "node:assert/strict";
import {
  getAzureSpeechConfig,
  isAzurePronunciationConfigured,
  validateAzureSpeechEnv,
} from "./config";

// --- both creds present → config -------------------------------------------
assert.deepEqual(
  getAzureSpeechConfig({
    AZURE_SPEECH_KEY: "secret-key",
    AZURE_SPEECH_REGION: "southeastasia",
  }),
  { apiKey: "secret-key", region: "southeastasia" },
);
assert.equal(
  isAzurePronunciationConfigured({
    AZURE_SPEECH_KEY: "secret-key",
    AZURE_SPEECH_REGION: "southeastasia",
  }),
  true,
);

// --- whitespace is trimmed ---------------------------------------------------
assert.deepEqual(
  getAzureSpeechConfig({ AZURE_SPEECH_KEY: "  k  ", AZURE_SPEECH_REGION: "  eastus  " }),
  { apiKey: "k", region: "eastus" },
);

// --- aliases + endpoint mode ------------------------------------------------
assert.deepEqual(
  getAzureSpeechConfig({ SPEECH_KEY: "k", SPEECH_REGION: "westus2" }),
  { apiKey: "k", region: "westus2" },
);
assert.deepEqual(
  getAzureSpeechConfig({
    AZURE_SPEECH_KEY: "k",
    AZURE_SPEECH_ENDPOINT: "https://thinkfy-speech.cognitiveservices.azure.com/",
  }),
  {
    apiKey: "k",
    endpoint: "https://thinkfy-speech.cognitiveservices.azure.com",
  },
);
assert.deepEqual(
  getAzureSpeechConfig({
    SPEECH_KEY: "k",
    SPEECH_ENDPOINT:
      "https://thinkfy-speech.cognitiveservices.azure.com/stt/speech/recognition/conversation/cognitiveservices/v1",
  }),
  {
    apiKey: "k",
    endpoint:
      "https://thinkfy-speech.cognitiveservices.azure.com/stt/speech/recognition/conversation/cognitiveservices/v1",
  },
);

// --- missing / blank creds → null (degrade gracefully) ----------------------
assert.equal(getAzureSpeechConfig({ AZURE_SPEECH_REGION: "eastus" }), null);
assert.equal(getAzureSpeechConfig({ AZURE_SPEECH_KEY: "k" }), null);
assert.equal(getAzureSpeechConfig({ AZURE_SPEECH_KEY: "k", AZURE_SPEECH_ENDPOINT: "nope" }), null);
assert.equal(
  getAzureSpeechConfig({ AZURE_SPEECH_KEY: "   ", AZURE_SPEECH_REGION: "eastus" }),
  null,
);
assert.equal(getAzureSpeechConfig({}), null);
assert.equal(isAzurePronunciationConfigured({}), false);

assert.deepEqual(validateAzureSpeechEnv({}), { status: "unconfigured" });
assert.deepEqual(
  validateAzureSpeechEnv({ AZURE_SPEECH_REGION: "eastus" }),
  { status: "invalid", reason: "missing_key" },
);
assert.deepEqual(
  validateAzureSpeechEnv({ AZURE_SPEECH_KEY: "k" }),
  { status: "invalid", reason: "missing_region_or_endpoint" },
);
assert.deepEqual(
  validateAzureSpeechEnv({ AZURE_SPEECH_KEY: "k", AZURE_SPEECH_ENDPOINT: "x" }),
  { status: "invalid", reason: "invalid_endpoint" },
);

console.log("ielts/pronunciation/config tests passed");

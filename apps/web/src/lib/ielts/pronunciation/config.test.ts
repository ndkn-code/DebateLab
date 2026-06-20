import assert from "node:assert/strict";
import { getAzureSpeechConfig, isAzurePronunciationConfigured } from "./config";

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

// --- missing / blank creds → null (degrade gracefully) ----------------------
assert.equal(getAzureSpeechConfig({ AZURE_SPEECH_REGION: "eastus" }), null);
assert.equal(getAzureSpeechConfig({ AZURE_SPEECH_KEY: "k" }), null);
assert.equal(
  getAzureSpeechConfig({ AZURE_SPEECH_KEY: "   ", AZURE_SPEECH_REGION: "eastus" }),
  null,
);
assert.equal(getAzureSpeechConfig({}), null);
assert.equal(isAzurePronunciationConfigured({}), false);

console.log("ielts/pronunciation/config tests passed");

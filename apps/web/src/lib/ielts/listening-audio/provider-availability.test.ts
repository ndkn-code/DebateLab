import assert from "node:assert/strict";
import {
  detectTtsProviderAvailability,
  isMissingProviderConfigError,
  missingProvidersForPlan,
  planIsSynthesizable,
} from "./provider-availability";

async function main() {
  // --- missingProvidersForPlan: only flags providers without creds ----------
  const creds = { deepgram: true, google: false, azure: false };
  assert.deepEqual(missingProvidersForPlan(["deepgram"], creds), []);
  assert.deepEqual(missingProvidersForPlan(["google"], creds), ["google"]);
  // Mixed-accent section (uk + aus) is blocked by the one missing provider,
  // preserving plan order.
  assert.deepEqual(
    missingProvidersForPlan(["deepgram", "google"], creds),
    ["google"],
  );
  // An unknown provider (no entry) is treated as unavailable, not assumed ok.
  assert.deepEqual(missingProvidersForPlan(["mystery"], creds), ["mystery"]);

  // --- planIsSynthesizable: true only when nothing is missing ---------------
  assert.equal(planIsSynthesizable(["deepgram"], creds), true);
  assert.equal(planIsSynthesizable(["deepgram", "google"], creds), false);
  assert.equal(planIsSynthesizable([], creds), true);

  // --- isMissingProviderConfigError: matches the TTS-layer creds errors -----
  assert.equal(
    isMissingProviderConfigError(new Error("GOOGLE_TTS_MISSING_CONFIG")),
    true,
  );
  assert.equal(
    isMissingProviderConfigError(new Error("DEEPGRAM_TTS_MISSING_API_KEY")),
    true,
  );
  assert.equal(
    isMissingProviderConfigError(new Error("AZURE_TTS_MISSING_CONFIG")),
    true,
  );
  // A real synthesis fault must NOT be mistaken for a queue-able missing key.
  assert.equal(isMissingProviderConfigError(new Error("DEEPGRAM_TTS_FAILED")), false);
  assert.equal(isMissingProviderConfigError("boom"), false);

  // --- detectTtsProviderAvailability: reads env, safe-defaults to false -----
  assert.deepEqual(detectTtsProviderAvailability({ NODE_ENV: "test" }), {
    deepgram: false,
    google: false,
    azure: false,
  });
  assert.deepEqual(
    detectTtsProviderAvailability({
      NODE_ENV: "test",
      DEEPGRAM_API_KEY: "k",
      GOOGLE_APPLICATION_CREDENTIALS: "/creds.json",
      AZURE_SPEECH_KEY: "k",
      AZURE_SPEECH_REGION: "eastus",
    }),
    { deepgram: true, google: true, azure: true },
  );
  // Google via inline service-account JSON also counts; Azure needs BOTH parts.
  assert.deepEqual(
    detectTtsProviderAvailability({
      NODE_ENV: "test",
      GOOGLE_TTS_SERVICE_ACCOUNT_JSON: "{}",
      AZURE_SPEECH_KEY: "k",
    }),
    { deepgram: false, google: true, azure: false },
  );

  console.log("ielts/listening-audio/provider-availability tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

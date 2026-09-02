import { validateAzureSpeechEnv } from "@/lib/ielts/pronunciation/config";

type Environment = Record<string, string | undefined>;

const REQUIRED_RUNTIME_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "GROQ_API_KEY",
  "DEEPGRAM_API_KEY",
  "GCP_PROJECT_ID",
  "GCP_AI_GRADING_TOPIC",
  "CLOUD_RUN_SERVICE_URL",
  "GCP_PUBSUB_PUSH_SERVICE_ACCOUNT_EMAIL",
  "GCP_SCHEDULER_SERVICE_ACCOUNT_EMAIL",
  "K_REVISION",
  "AI_GRADING_IMAGE_DIGEST",
] as const;

export type WorkerReadiness = {
  ready: boolean;
  missing: string[];
  invalid: string[];
  capabilities: { azurePronunciation: boolean };
};

function present(env: Environment, name: string): boolean {
  return Boolean(env[name]?.trim());
}

/** Pure, secret-safe deployment preflight used by the private readiness route. */
export function checkWorkerReadiness(
  env: Environment = process.env,
): WorkerReadiness {
  const missing: string[] = REQUIRED_RUNTIME_ENV.filter(
    (name) => !present(env, name),
  );
  const invalid: string[] = [];
  const serviceUrl = env.CLOUD_RUN_SERVICE_URL?.trim();
  if (serviceUrl) {
    try {
      if (new URL(serviceUrl).protocol !== "https:") {
        invalid.push("CLOUD_RUN_SERVICE_URL");
      }
    } catch {
      invalid.push("CLOUD_RUN_SERVICE_URL");
    }
  }
  if (
    present(env, "AI_GRADING_IMAGE_DIGEST") &&
    !/^sha256:[a-f0-9]{64}$/.test(env.AI_GRADING_IMAGE_DIGEST!.trim())
  ) {
    invalid.push("AI_GRADING_IMAGE_DIGEST");
  }
  const azure = validateAzureSpeechEnv(env);
  const azurePronunciation = azure.status === "configured";
  const azureEnvironmentPresent = [
    "AZURE_SPEECH_KEY",
    "AZURE_SPEECH_REGION",
    "AZURE_SPEECH_ENDPOINT",
    "SPEECH_KEY",
    "SPEECH_REGION",
    "SPEECH_ENDPOINT",
  ].some((name) => present(env, name));
  if (azure.status === "invalid" && azureEnvironmentPresent) {
    invalid.push("AZURE_SPEECH_CONFIGURATION");
  }
  const azureRegion =
    azure.status === "configured" ? azure.config.region?.toLowerCase() : null;
  if (azureRegion && azureRegion !== "southeastasia") {
    invalid.push("AZURE_SPEECH_REGION");
  }
  if (env.AI_GRADING_REQUIRE_AZURE_PRONUNCIATION?.trim() === "true") {
    if (!azurePronunciation) {
      missing.push("AZURE_SPEECH_KEY+AZURE_SPEECH_REGION");
    } else if (azureRegion !== "southeastasia") {
      // A custom endpoint can be usable but does not prove the Singapore data
      // boundary. Release mode therefore requires the explicit Azure region.
      missing.push("AZURE_SPEECH_REGION");
    }
  }
  return {
    ready: missing.length === 0 && invalid.length === 0,
    missing: [...new Set(missing)].sort(),
    invalid: [...new Set(invalid)].sort(),
    capabilities: { azurePronunciation },
  };
}

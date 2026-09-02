import { validateAzureSpeechEnv } from "@/lib/ielts/pronunciation/config";
import { assertOperationalDatabaseIdentity } from "./operational-faults";
import type { AiGradingRepository } from "./repository";

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

export type OperationalDatabaseMarker = {
  environment: string;
  projectRef: string;
} | null;

function present(env: Environment, name: string): boolean {
  return Boolean(env[name]?.trim());
}

function normalizedRegion(env: Environment, name: string): string | null {
  const value = env[name]?.trim().toLowerCase();
  return value || null;
}

/** Pure, secret-safe deployment preflight used by the private readiness route. */
export function checkWorkerReadiness(
  env: Environment = process.env,
  operationalDatabaseMarker?: OperationalDatabaseMarker,
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
  const expectedAzureRegion = normalizedRegion(
    env,
    "AI_GRADING_AZURE_EXPECTED_REGION",
  );
  const expectedAzureRegionValid =
    expectedAzureRegion !== null && /^[a-z0-9-]+$/.test(expectedAzureRegion);
  if (expectedAzureRegion && !expectedAzureRegionValid) {
    invalid.push("AI_GRADING_AZURE_EXPECTED_REGION");
  }
  if (
    azureRegion &&
    expectedAzureRegionValid &&
    azureRegion !== expectedAzureRegion
  ) {
    invalid.push("AZURE_SPEECH_REGION");
  }
  if (env.AI_GRADING_REQUIRE_AZURE_PRONUNCIATION?.trim() === "true") {
    const hasExplicitKey =
      present(env, "AZURE_SPEECH_KEY") || present(env, "SPEECH_KEY");
    const hasExplicitRegion =
      present(env, "AZURE_SPEECH_REGION") || present(env, "SPEECH_REGION");
    if (!hasExplicitKey || !hasExplicitRegion || !azurePronunciation) {
      missing.push("AZURE_SPEECH_KEY+AZURE_SPEECH_REGION");
    }
    if (!expectedAzureRegion) {
      missing.push("AI_GRADING_AZURE_EXPECTED_REGION");
    }
  }
  if (
    env.AI_GRADING_OPERATIONAL_FAULT_INJECTION_ENABLED?.trim() === "true"
  ) {
    const operationalEnvironment =
      env.AI_GRADING_OPERATIONAL_ENVIRONMENT?.trim();
    if (
      operationalEnvironment !== "preview" &&
      operationalEnvironment !== "staging"
    ) {
      invalid.push("AI_GRADING_OPERATIONAL_ENVIRONMENT");
    }
    const operationalRevision = env.K_REVISION?.trim().toLowerCase() ?? "";
    let operationalHostname = "";
    try {
      operationalHostname = new URL(env.CLOUD_RUN_SERVICE_URL ?? "").hostname
        .toLowerCase();
    } catch {
      // CLOUD_RUN_SERVICE_URL is already reported by the generic check above.
    }
    if (
      (operationalEnvironment === "preview" ||
        operationalEnvironment === "staging") &&
      (!operationalHostname.includes(operationalEnvironment) ||
        !operationalRevision.includes(operationalEnvironment) ||
        /(^|[-_])(prod|production)(?=$|[-_])/i.test(operationalRevision))
    ) {
      invalid.push("AI_GRADING_OPERATIONAL_RUNTIME_IDENTITY");
    }
    if (
      env.AI_GRADING_OPERATIONAL_ATTESTATION_ENABLED?.trim() !== "true"
    ) {
      missing.push("AI_GRADING_OPERATIONAL_ATTESTATION_ENABLED");
    }
    const operationalDatabaseRef = present(
      env,
      "AI_GRADING_OPERATIONAL_DATABASE_REF",
    );
    const productionDatabaseRef = present(
      env,
      "AI_GRADING_PRODUCTION_DATABASE_REF",
    );
    if (!operationalDatabaseRef) {
      missing.push("AI_GRADING_OPERATIONAL_DATABASE_REF");
    }
    if (!productionDatabaseRef) {
      missing.push("AI_GRADING_PRODUCTION_DATABASE_REF");
    }
    if (operationalDatabaseRef && productionDatabaseRef) {
      try {
        const databaseRef = assertOperationalDatabaseIdentity(env);
        if (
          !operationalDatabaseMarker ||
          operationalDatabaseMarker.environment !== operationalEnvironment ||
          operationalDatabaseMarker.projectRef !== databaseRef ||
          (operationalDatabaseMarker.environment !== "preview" &&
            operationalDatabaseMarker.environment !== "staging")
        ) {
          invalid.push("AI_GRADING_OPERATIONAL_DATABASE_MARKER");
        }
      } catch {
        invalid.push("AI_GRADING_OPERATIONAL_DATABASE_IDENTITY");
      }
    }
    const injectionTokens =
      env.AI_GRADING_OPERATIONAL_FAULT_INJECTION_TOKENS?.split(",")
        .map((value) => value.trim())
        .filter(Boolean) ?? [];
    if (injectionTokens.length === 0) {
      missing.push("AI_GRADING_OPERATIONAL_FAULT_INJECTION_TOKENS");
    } else if (
      injectionTokens.length > 5 ||
      new Set(injectionTokens).size !== injectionTokens.length ||
      injectionTokens.some(
        (token) =>
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            token,
          ),
      )
    ) {
      invalid.push("AI_GRADING_OPERATIONAL_FAULT_INJECTION_TOKENS");
    }
  }
  return {
    ready: missing.length === 0 && invalid.length === 0,
    missing: [...new Set(missing)].sort(),
    invalid: [...new Set(invalid)].sort(),
    capabilities: { azurePronunciation },
  };
}

/** Readiness independently verifies the immutable marker stored by the target DB. */
export async function checkProductionWorkerReadiness(
  repository: Pick<AiGradingRepository, "loadOperationalEnvironmentMarker">,
  env: Environment = process.env,
): Promise<WorkerReadiness> {
  let marker: OperationalDatabaseMarker;
  try {
    marker = await repository.loadOperationalEnvironmentMarker?.() ?? null;
  } catch {
    marker = null;
  }
  return checkWorkerReadiness(env, marker);
}

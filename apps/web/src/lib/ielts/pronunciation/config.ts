import { z } from "zod";

/**
 * Env-gated Azure Speech credentials for pronunciation assessment (WS-3.3).
 *
 * Reuses the SAME Azure Speech resource as TTS. Preferred env:
 * `AZURE_SPEECH_KEY` + (`AZURE_SPEECH_REGION` or `AZURE_SPEECH_ENDPOINT`).
 * The common Azure sample aliases (`SPEECH_KEY`, `SPEECH_REGION`,
 * `SPEECH_ENDPOINT`) are accepted too. Returns `null` when unconfigured so
 * callers degrade to a no-op: phoneme detail augments the Pronunciation band,
 * it is never required.
 */
export interface AzureSpeechConfig {
  apiKey: string;
  region?: string;
  endpoint?: string;
}

type EnvSource = Record<string, string | undefined>;

export const azureSpeechEnvSchema = z
  .object({
    AZURE_SPEECH_KEY: z.string().optional(),
    AZURE_SPEECH_REGION: z.string().optional(),
    AZURE_SPEECH_ENDPOINT: z.string().optional(),
    SPEECH_KEY: z.string().optional(),
    SPEECH_REGION: z.string().optional(),
    SPEECH_ENDPOINT: z.string().optional(),
  })
  .passthrough();

export type AzureSpeechEnv = z.infer<typeof azureSpeechEnvSchema>;

export type AzureSpeechEnvValidation =
  | { status: "configured"; config: AzureSpeechConfig }
  | { status: "unconfigured" }
  | { status: "invalid"; reason: string };

function firstNonBlank(...values: Array<string | undefined>): string | null {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

function normalizeEndpoint(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}

/** Validate Azure Speech env into either a usable config or a no-op state. */
export function validateAzureSpeechEnv(
  env: EnvSource = process.env,
): AzureSpeechEnvValidation {
  const parsed = azureSpeechEnvSchema.safeParse(env);
  if (!parsed.success) return { status: "invalid", reason: "invalid_env_shape" };

  const apiKey = firstNonBlank(
    parsed.data.AZURE_SPEECH_KEY,
    parsed.data.SPEECH_KEY,
  );
  const region = firstNonBlank(
    parsed.data.AZURE_SPEECH_REGION,
    parsed.data.SPEECH_REGION,
  );
  const endpointRaw = firstNonBlank(
    parsed.data.AZURE_SPEECH_ENDPOINT,
    parsed.data.SPEECH_ENDPOINT,
  );
  const endpoint = normalizeEndpoint(endpointRaw);

  if (!apiKey && !region && !endpoint) return { status: "unconfigured" };
  if (!apiKey) return { status: "invalid", reason: "missing_key" };
  if (endpointRaw && !endpoint) return { status: "invalid", reason: "invalid_endpoint" };
  if (!region && !endpoint) {
    return { status: "invalid", reason: "missing_region_or_endpoint" };
  }

  return {
    status: "configured",
    config: {
      apiKey,
      ...(region ? { region } : {}),
      ...(endpoint ? { endpoint } : {}),
    },
  };
}

/** Read Azure Speech creds from the environment, or `null` if not configured. */
export function getAzureSpeechConfig(
  env: EnvSource = process.env,
): AzureSpeechConfig | null {
  const validation = validateAzureSpeechEnv(env);
  return validation.status === "configured" ? validation.config : null;
}

/** Whether Azure pronunciation assessment can run in this environment. */
export function isAzurePronunciationConfigured(env: EnvSource = process.env): boolean {
  return getAzureSpeechConfig(env) !== null;
}

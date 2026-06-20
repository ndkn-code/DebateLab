/**
 * Env-gated Azure Speech credentials for pronunciation assessment (WS-3.3).
 *
 * Reuses the SAME Azure Speech resource as TTS (`AZURE_SPEECH_KEY` /
 * `AZURE_SPEECH_REGION`) — no new secret is introduced. Returns `null` when
 * unconfigured so callers degrade to a no-op: phoneme detail augments the
 * Pronunciation band, it is never required.
 */
export interface AzureSpeechConfig {
  apiKey: string;
  region: string;
}

type EnvSource = Record<string, string | undefined>;

/** Read Azure Speech creds from the environment, or `null` if not configured. */
export function getAzureSpeechConfig(
  env: EnvSource = process.env,
): AzureSpeechConfig | null {
  const apiKey = env.AZURE_SPEECH_KEY?.trim();
  const region = env.AZURE_SPEECH_REGION?.trim();
  if (!apiKey || !region) return null;
  return { apiKey, region };
}

/** Whether Azure pronunciation assessment can run in this environment. */
export function isAzurePronunciationConfigured(env: EnvSource = process.env): boolean {
  return getAzureSpeechConfig(env) !== null;
}

/**
 * TTS-provider credential gating for Listening audio (WS-1.3 / Wave 6.3 C1).
 *
 * `us`/`uk` synthesize through Deepgram `aura`; `aus` through Google `en-AU`
 * (see {@link ./voice-map}). Deepgram creds are present, but the Google key is
 * an env gap — so a plan that needs an absent provider must be **queued, never
 * synthesized into a failure**. These helpers decide, from a plan's providers,
 * whether synthesis can proceed or must wait on credentials.
 *
 * The decision logic is pure (unit-tested); `detectTtsProviderAvailability`
 * reads env and is the only impure piece (it works in any runtime — absent env
 * simply reports the provider unavailable, which is the safe default).
 */

/** Map of TTS provider id → whether its credentials are configured. */
export type TtsProviderAvailability = Record<string, boolean>;

/**
 * The providers a plan requires that lack credentials, in plan order. Empty when
 * every required provider is available (so the plan is synthesizable now).
 */
export function missingProvidersForPlan(
  planProviders: readonly string[],
  availability: TtsProviderAvailability,
): string[] {
  return planProviders.filter((provider) => availability[provider] !== true);
}

/** True when every provider the plan needs has credentials. */
export function planIsSynthesizable(
  planProviders: readonly string[],
  availability: TtsProviderAvailability,
): boolean {
  return missingProvidersForPlan(planProviders, availability).length === 0;
}

/**
 * Whether an error thrown by the TTS layer means a provider is simply
 * unconfigured (so the section should be **queued**, not marked failed) rather
 * than a genuine synthesis fault. Matches the missing-credential errors raised
 * in `lib/tts-providers.ts` (`*_MISSING_CONFIG`, `*_MISSING_API_KEY`). Used as a
 * safety net behind the {@link missingProvidersForPlan} pre-check.
 */
export function isMissingProviderConfigError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /_MISSING_(?:CONFIG|API_KEY)$/.test(message);
}

/**
 * Read TTS-provider credentials from the environment. Deepgram needs an API
 * key; Google a service-account (inline JSON or a credentials path); Azure a
 * key + region. Absent env → provider reported unavailable (safe default: the
 * caller queues instead of throwing).
 */
export function detectTtsProviderAvailability(
  env: Record<string, string | undefined> = process.env,
): TtsProviderAvailability {
  return {
    deepgram: Boolean(env.DEEPGRAM_API_KEY),
    google: Boolean(
      env.GOOGLE_TTS_SERVICE_ACCOUNT_JSON || env.GOOGLE_APPLICATION_CREDENTIALS,
    ),
    azure: Boolean(env.AZURE_SPEECH_KEY && env.AZURE_SPEECH_REGION),
  };
}

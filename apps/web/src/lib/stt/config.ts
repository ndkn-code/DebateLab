export const STT_DEEPGRAM_MODEL = "nova-3";
export const STT_FINAL_PROVIDER = "deepgram_groq_shadow";
export const STT_FINAL_RETRANSCRIBE_LANGUAGES = ["vi"];
export const STT_GROQ_MODEL = "whisper-large-v3-turbo";
export const STT_GROQ_TIMEOUT_MS = 30_000;
export const STT_DEEPGRAM_TIMEOUT_MS = 30_000;
export const STT_GROQ_DAILY_SOFT_LIMIT_SECONDS = 21_600;
export const STT_KEYTERM_PROMPTING_ENABLED = true;
export const STT_NORMALIZATION_ENABLED = true;

function readBooleanEnv(name: string, fallback: boolean) {
  const value = process.env[name];
  if (value == null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

export function getSttConfig() {
  return {
    finalRetranscribeEnabled: readBooleanEnv(
      "STT_FINAL_RETRANSCRIBE_ENABLED",
      true
    ),
    finalRetranscribeLanguages: STT_FINAL_RETRANSCRIBE_LANGUAGES,
    finalProvider: STT_FINAL_PROVIDER,
    groqModel: STT_GROQ_MODEL,
    groqTimeoutMs: STT_GROQ_TIMEOUT_MS,
    deepgramTimeoutMs: STT_DEEPGRAM_TIMEOUT_MS,
    keytermPromptingEnabled: STT_KEYTERM_PROMPTING_ENABLED,
    normalizationEnabled: STT_NORMALIZATION_ENABLED,
    groqDailySoftLimitSeconds: STT_GROQ_DAILY_SOFT_LIMIT_SECONDS,
  };
}

export const STT_DEEPGRAM_MODEL = "nova-3";
export const STT_FINAL_PROVIDER = "deepgram_groq_shadow";
export const STT_FINAL_RETRANSCRIBE_LANGUAGES = ["vi"];
export const STT_GROQ_MODEL = "whisper-large-v3-turbo";
export const STT_GROQ_TIMEOUT_MS = 30_000;
export const STT_DEEPGRAM_TIMEOUT_MS = 30_000;
export const STT_GROQ_DAILY_SOFT_LIMIT_SECONDS = 21_600;
export const STT_KEYTERM_PROMPTING_ENABLED = true;
export const STT_NORMALIZATION_ENABLED = true;
export const STT_JUDGE_TRANSCRIPT_REPAIR_SHADOW_ENABLED = true;
export const STT_JUDGE_TRANSCRIPT_REPAIR_USE_FOR_JUDGE = false;
export const STT_REPAIR_LANGUAGES = ["vi"];
export const STT_REPAIR_TRACKS = ["debate"];
export const STT_REPAIR_TIMEOUT_MS = 8_000;
export const STT_REPAIR_VERSION = 1;

function readBooleanEnv(name: string, fallback: boolean) {
  const value = process.env[name];
  if (value == null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function readListEnv(name: string, fallback: string[]) {
  const value = process.env[name];
  if (value == null || value.trim() === "") return fallback;
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function readNumberEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
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
    judgeTranscriptRepairShadowEnabled: readBooleanEnv(
      "STT_JUDGE_TRANSCRIPT_REPAIR_SHADOW_ENABLED",
      STT_JUDGE_TRANSCRIPT_REPAIR_SHADOW_ENABLED
    ),
    judgeTranscriptRepairUseForJudge: readBooleanEnv(
      "STT_JUDGE_TRANSCRIPT_REPAIR_USE_FOR_JUDGE",
      STT_JUDGE_TRANSCRIPT_REPAIR_USE_FOR_JUDGE
    ),
    repairLanguages: readListEnv("STT_REPAIR_LANGUAGES", STT_REPAIR_LANGUAGES),
    repairTracks: readListEnv("STT_REPAIR_TRACKS", STT_REPAIR_TRACKS),
    repairTimeoutMs: readNumberEnv("STT_REPAIR_TIMEOUT_MS", STT_REPAIR_TIMEOUT_MS),
    repairModel:
      process.env.STT_REPAIR_MODEL ||
      process.env.GEMINI_FLASH_LITE_MODEL ||
      process.env.GEMINI_MODEL ||
      "gemini-2.5-flash",
    repairVersion: STT_REPAIR_VERSION,
  };
}

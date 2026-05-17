import type { PracticeLanguage } from "@/types";

export const PRACTICE_LANGUAGES = ["en", "vi"] as const;
export const DEFAULT_PRACTICE_LANGUAGE: PracticeLanguage = "en";

export interface PracticeLanguageConfig {
  code: PracticeLanguage;
  label: string;
  labelVi: string;
  deepgramLanguage: string;
  ttsLocale: string;
  aiName: string;
  aiInstruction: string;
}

export const PRACTICE_LANGUAGE_CONFIG: Record<
  PracticeLanguage,
  PracticeLanguageConfig
> = {
  en: {
    code: "en",
    label: "English",
    labelVi: "Tiếng Anh",
    deepgramLanguage: "en",
    ttsLocale: "en-US",
    aiName: "English",
    aiInstruction:
      "Respond in English. Coach Vietnamese high school students practicing English debate and public speaking.",
  },
  vi: {
    code: "vi",
    label: "Vietnamese",
    labelVi: "Tiếng Việt",
    deepgramLanguage: "vi",
    ttsLocale: "vi-VN",
    aiName: "Vietnamese",
    aiInstruction:
      "Respond in Vietnamese. Use natural Vietnamese coaching language for Vietnamese high school students practicing debate and public speaking.",
  },
};

export function isPracticeLanguage(value: unknown): value is PracticeLanguage {
  return PRACTICE_LANGUAGES.includes(value as PracticeLanguage);
}

export function coercePracticeLanguage(
  value: unknown,
  fallback: PracticeLanguage = DEFAULT_PRACTICE_LANGUAGE
): PracticeLanguage {
  return isPracticeLanguage(value) ? value : fallback;
}

export function getPracticeLanguageConfig(language: unknown) {
  return PRACTICE_LANGUAGE_CONFIG[coercePracticeLanguage(language)];
}

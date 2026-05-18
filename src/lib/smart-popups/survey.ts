import { RequestValidationError, isPlainRecord } from "@/lib/api/request-validation";
import type { SmartPopupLocale } from "@/lib/smart-popups/types";

export const SMART_POPUP_SURVEY_QUESTION_TYPES = [
  "rating",
  "nps",
  "single_choice",
  "multi_choice",
  "text",
] as const;

export type SmartPopupSurveyQuestionType =
  (typeof SMART_POPUP_SURVEY_QUESTION_TYPES)[number];

export interface LocalizedText {
  en: string;
  vi: string;
}

export interface SmartPopupSurveyOption {
  id: string;
  label: LocalizedText;
}

export interface SmartPopupSurveyQuestion {
  id: string;
  type: SmartPopupSurveyQuestionType;
  label: LocalizedText;
  description?: LocalizedText;
  placeholder?: LocalizedText;
  minLabel?: LocalizedText;
  maxLabel?: LocalizedText;
  required: boolean;
  min?: number;
  max?: number;
  options?: SmartPopupSurveyOption[];
}

export interface LocalizedSurveyQuestion {
  id: string;
  type: SmartPopupSurveyQuestionType;
  label: string;
  description?: string;
  placeholder?: string;
  minLabel?: string;
  maxLabel?: string;
  required: boolean;
  min?: number;
  max?: number;
  options?: Array<{ id: string; label: string }>;
}

export interface SmartPopupSurveyAnswer {
  questionId: string;
  type: SmartPopupSurveyQuestionType;
  value: number | string | string[];
}

export interface SmartPopupSurveyThankYouCopy {
  title: string;
  body: string;
}

const DEFAULT_QUESTION_LIMIT = 8;
const MAX_TEXT_LENGTH = 1200;

function asText(value: unknown, fallback = "") {
  if (typeof value !== "string") return fallback;
  return value.replace(/\s+/g, " ").trim();
}

function asLocalizedText(value: unknown, fallback: string): LocalizedText {
  const source = isPlainRecord(value) ? value : {};
  const en = asText(source.en, fallback);
  const vi = asText(source.vi, en || fallback);
  return {
    en: en || fallback,
    vi: vi || en || fallback,
  };
}

function asQuestionType(value: unknown): SmartPopupSurveyQuestionType {
  return SMART_POPUP_SURVEY_QUESTION_TYPES.includes(
    value as SmartPopupSurveyQuestionType
  )
    ? (value as SmartPopupSurveyQuestionType)
    : "rating";
}

function sanitizeId(value: unknown, fallback: string) {
  const raw = asText(value, fallback)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);

  return raw || fallback;
}

function asNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeOptions(
  value: unknown,
  questionId: string
): SmartPopupSurveyOption[] {
  if (!Array.isArray(value)) return [];

  return value.slice(0, 8).map((item, index) => {
    const source = isPlainRecord(item) ? item : {};
    const fallback = `Option ${index + 1}`;
    return {
      id: sanitizeId(source.id, `${questionId}-option-${index + 1}`),
      label: asLocalizedText(source.label, fallback),
    };
  });
}

export function normalizeSurveyQuestions(
  value: unknown,
  options: { maxQuestions?: number } = {}
): SmartPopupSurveyQuestion[] {
  if (!Array.isArray(value)) return [];

  return value
    .slice(0, options.maxQuestions ?? DEFAULT_QUESTION_LIMIT)
    .map((item, index) => {
      const source = isPlainRecord(item) ? item : {};
      const type = asQuestionType(source.type);
      const id = sanitizeId(source.id, `question-${index + 1}`);
      const min =
        type === "nps"
          ? 0
          : Math.max(1, Math.floor(asNumber(source.min, 1)));
      const max =
        type === "nps"
          ? 10
          : Math.max(min, Math.floor(asNumber(source.max, 5)));
      const question: SmartPopupSurveyQuestion = {
        id,
        type,
        label: asLocalizedText(source.label, `Question ${index + 1}`),
        required: source.required !== false,
      };

      if (source.description != null) {
        question.description = asLocalizedText(source.description, "");
      }
      if (source.placeholder != null) {
        question.placeholder = asLocalizedText(source.placeholder, "");
      }
      if (type === "rating" || type === "nps") {
        question.min = min;
        question.max = max;
        question.minLabel = asLocalizedText(source.minLabel, "");
        question.maxLabel = asLocalizedText(source.maxLabel, "");
      }
      if (type === "single_choice" || type === "multi_choice") {
        question.options = normalizeOptions(source.options, id);
      }

      return question;
    })
    .filter((question) => {
      if (question.type === "single_choice" || question.type === "multi_choice") {
        return (question.options?.length ?? 0) >= 2;
      }
      return question.label.en.length > 0;
    });
}

export function localizeSurveyQuestions(
  questions: SmartPopupSurveyQuestion[],
  locale: SmartPopupLocale
): LocalizedSurveyQuestion[] {
  return questions.map((question) => ({
    id: question.id,
    type: question.type,
    label: question.label[locale] || question.label.en,
    description: question.description?.[locale] || question.description?.en,
    placeholder: question.placeholder?.[locale] || question.placeholder?.en,
    minLabel: question.minLabel?.[locale] || question.minLabel?.en,
    maxLabel: question.maxLabel?.[locale] || question.maxLabel?.en,
    required: question.required,
    min: question.min,
    max: question.max,
    options: question.options?.map((option) => ({
      id: option.id,
      label: option.label[locale] || option.label.en,
    })),
  }));
}

export function getThankYouCopy(
  value: unknown,
  locale: SmartPopupLocale,
  rewardCredits: number
): SmartPopupSurveyThankYouCopy {
  const source = isPlainRecord(value) ? value : {};
  const localized = isPlainRecord(source[locale])
    ? (source[locale] as Record<string, unknown>)
    : {};
  const fallback = isPlainRecord(source.en) ? (source.en as Record<string, unknown>) : {};

  if (locale === "vi") {
    return {
      title: asText(localized.title, asText(fallback.title, "Cảm ơn bạn đã góp ý")),
      body: asText(
        localized.body,
        asText(
          fallback.body,
          `Bạn đã nhận ${rewardCredits} Credits. Tụi mình sẽ dùng góp ý này để cải thiện DebateLab.`
        )
      ),
    };
  }

  return {
    title: asText(localized.title, asText(fallback.title, "Thanks for the feedback")),
    body: asText(
      localized.body,
      asText(
        fallback.body,
        `You earned ${rewardCredits} Credits. We will use this to make DebateLab sharper.`
      )
    ),
  };
}

function normalizeAnswerValue(
  question: SmartPopupSurveyQuestion,
  rawValue: unknown
): SmartPopupSurveyAnswer["value"] | null {
  if (question.type === "rating" || question.type === "nps") {
    const value = typeof rawValue === "number" ? rawValue : Number(rawValue);
    if (!Number.isFinite(value)) return null;
    const rounded = Math.round(value);
    if (rounded < (question.min ?? 1) || rounded > (question.max ?? 5)) {
      return null;
    }
    return rounded;
  }

  if (question.type === "single_choice") {
    if (typeof rawValue !== "string") return null;
    const value = rawValue.trim();
    return question.options?.some((option) => option.id === value) ? value : null;
  }

  if (question.type === "multi_choice") {
    if (!Array.isArray(rawValue)) return null;
    const validIds = new Set(question.options?.map((option) => option.id) ?? []);
    const selected = rawValue
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter((item, index, all) => validIds.has(item) && all.indexOf(item) === index)
      .slice(0, 8);
    return selected.length > 0 ? selected : null;
  }

  if (typeof rawValue !== "string") return null;
  return rawValue.trim().slice(0, MAX_TEXT_LENGTH);
}

export function validateSurveyAnswers(
  questions: SmartPopupSurveyQuestion[],
  rawAnswers: unknown
): SmartPopupSurveyAnswer[] {
  if (!Array.isArray(rawAnswers)) {
    throw new RequestValidationError("answers must be an array.");
  }

  const rawByQuestion = new Map<string, unknown>();
  for (const item of rawAnswers) {
    if (!isPlainRecord(item)) continue;
    const questionId = asText(item.questionId);
    if (!questionId) continue;
    rawByQuestion.set(questionId, item.value);
  }

  const answers: SmartPopupSurveyAnswer[] = [];
  for (const question of questions) {
    const value = normalizeAnswerValue(question, rawByQuestion.get(question.id));
    const isEmptyText = question.type === "text" && value === "";

    if ((value == null || isEmptyText) && question.required) {
      throw new RequestValidationError(`${question.id} is required.`);
    }

    if (value != null && !isEmptyText) {
      answers.push({
        questionId: question.id,
        type: question.type,
        value,
      });
    }
  }

  return answers;
}

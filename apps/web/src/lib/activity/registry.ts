import type { ComponentType } from "react";
import type {
  ActivityContent,
  ActivityPhase,
  ActivityType,
  CoreActivityType,
  DragOrderContent,
  FillBlankContent,
  FlashcardContent,
  LessonContent,
  MatchingContent,
  QuizContent,
} from "@/lib/types/admin";
import {
  defaultIeltsTextActivityContent,
  scoreIeltsTextActivityPreview,
  validateIeltsTextActivityContent,
} from "@/lib/ielts/learn/text-activities";

export type ActivityResponses = Record<string, unknown>;

export type ValidationResult = {
  valid: boolean;
  errors: string[];
};

export type ScoreResult = {
  score: number;
  maxScore: number;
};

export type ActivityCompleteHandler = (
  score?: number,
  maxScore?: number,
  responses?: ActivityResponses,
) => void | Promise<void>;

export interface ActivityPlayerProps<TContent = unknown> {
  content: TContent;
  onComplete: ActivityCompleteHandler;
}

export type ActivityPlayer<TContent = unknown> = ComponentType<ActivityPlayerProps<TContent>>;

export interface ActivityDefinition<TType extends string = string, TContent = unknown> {
  type: TType;
  defaultPhase: ActivityPhase;
  defaultDuration: number;
  Player?: ActivityPlayer;
  defaultContent(): TContent;
  validate(content: TContent): ValidationResult;
  score(content: TContent, responses: ActivityResponses): ScoreResult;
}

export interface ActivityRegistry {
  register<TType extends string, TContent>(
    definition: ActivityDefinition<TType, TContent>,
  ): void;
  get(type: string): ActivityDefinition<string, unknown> | undefined;
  has(type: string): boolean;
  list(): ActivityDefinition<string, unknown>[];
}

type ActivityContentByType = {
  quiz: QuizContent;
  matching: MatchingContent;
  fill_blank: FillBlankContent;
  drag_order: DragOrderContent;
  flashcard: FlashcardContent;
  lesson: LessonContent;
};

type CoreActivityDefinitionMap = {
  [Type in CoreActivityType]: ActivityDefinition<Type, ActivityContentByType[Type]>;
};

export function defineActivityDefinition<TType extends string, TContent>(
  definition: ActivityDefinition<TType, TContent>,
): ActivityDefinition<TType, TContent> {
  return definition;
}

export function createActivityRegistry(): ActivityRegistry {
  const definitions = new Map<string, ActivityDefinition<string, unknown>>();

  return {
    register<TType extends string, TContent>(definition: ActivityDefinition<TType, TContent>) {
      definitions.set(definition.type, definition as ActivityDefinition<string, unknown>);
    },
    get: (type: string) => definitions.get(type),
    has: (type: string) => definitions.has(type),
    list: () => [...definitions.values()],
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asStringRecord(value: unknown): Record<string, string> {
  const record = asRecord(value);
  return Object.fromEntries(
    Object.entries(record).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

function validateQuiz(content: QuizContent): ValidationResult {
  const errors: string[] = [];
  if (!content.questions || content.questions.length === 0) {
    errors.push("At least 1 question required");
  }
  content.questions?.forEach((question, index) => {
    if (!question.question?.trim()) {
      errors.push(`Question ${index + 1}: text is empty`);
    }
    if (question.type === "multiple_choice") {
      if (!question.options || question.options.length < 2) {
        errors.push(`Question ${index + 1}: at least 2 options`);
      }
      if (!question.correctAnswer) {
        errors.push(`Question ${index + 1}: select correct answer`);
      }
    }
    if (!question.explanation?.trim()) {
      errors.push(`Question ${index + 1}: explanation is empty`);
    }
  });
  return { valid: errors.length === 0, errors };
}

function validateMatching(content: MatchingContent): ValidationResult {
  const errors: string[] = [];
  if (!content.pairs || content.pairs.length < 2) {
    errors.push("At least 2 pairs required");
  }
  content.pairs?.forEach((pair, index) => {
    if (!pair.left?.trim()) errors.push(`Pair ${index + 1}: left side is empty`);
    if (!pair.right?.trim()) errors.push(`Pair ${index + 1}: right side is empty`);
  });
  return { valid: errors.length === 0, errors };
}

function validateFillBlank(content: FillBlankContent): ValidationResult {
  const errors: string[] = [];
  if (!content.passages || content.passages.length === 0) {
    errors.push("At least 1 passage required");
  }
  content.passages?.forEach((passage, passageIndex) => {
    if (!passage.text?.trim()) {
      errors.push(`Passage ${passageIndex + 1}: text is empty`);
    }
    const blanksInText = (passage.text?.match(/__BLANK_\d+__/g) ?? []).length;
    if (blanksInText === 0) {
      errors.push(`Passage ${passageIndex + 1}: no blanks found`);
    }
    passage.blanks?.forEach((blank, blankIndex) => {
      if (!blank.answer?.trim()) {
        errors.push(
          `Passage ${passageIndex + 1}, Blank ${blankIndex + 1}: answer is empty`,
        );
      }
    });
  });
  return { valid: errors.length === 0, errors };
}

function validateDragOrder(content: DragOrderContent): ValidationResult {
  const errors: string[] = [];
  if (!content.items || content.items.length < 2) {
    errors.push("At least 2 items required");
  }
  content.items?.forEach((item, index) => {
    if (!item.text?.trim()) errors.push(`Item ${index + 1}: text is empty`);
  });
  return { valid: errors.length === 0, errors };
}

function validateFlashcard(content: FlashcardContent): ValidationResult {
  const errors: string[] = [];
  if (!content.cards || content.cards.length === 0) {
    errors.push("At least 1 card required");
  }
  content.cards?.forEach((card, index) => {
    if (!card.front?.trim()) errors.push(`Card ${index + 1}: front is empty`);
    if (!card.back?.trim()) errors.push(`Card ${index + 1}: back is empty`);
  });
  return { valid: errors.length === 0, errors };
}

function validateLesson(content: LessonContent): ValidationResult {
  const errors: string[] = [];
  if (content.type === "article" && !content.body?.trim()) {
    errors.push("Article body is empty");
  }
  if (content.type === "video" && !content.video_url?.trim()) {
    errors.push("Video URL is required");
  }
  return { valid: errors.length === 0, errors };
}

function scoreQuiz(
  content: QuizContent,
  responses: ActivityResponses,
): ScoreResult {
  const questions = content.questions ?? [];
  const answers = Array.isArray(responses.answers) ? responses.answers : [];
  const answerByQuestion = new Map<string, string>();

  for (const answer of answers) {
    const item = asRecord(answer);
    if (
      typeof item.questionId === "string" &&
      typeof item.selectedOptionId === "string"
    ) {
      answerByQuestion.set(item.questionId, item.selectedOptionId);
    }
  }

  return {
    score: questions.filter(
      (question) => answerByQuestion.get(question.id) === question.correctAnswer,
    ).length,
    maxScore: questions.length,
  };
}

function scoreMatching(
  content: MatchingContent,
  responses: ActivityResponses,
): ScoreResult {
  const pairs = content.pairs ?? [];
  const matches = asStringRecord(responses.matches);
  return {
    score: pairs.filter((pair) => matches[pair.id] === pair.id).length,
    maxScore: pairs.length,
  };
}

function scoreFillBlank(
  content: FillBlankContent,
  responses: ActivityResponses,
): ScoreResult {
  const answers = asStringRecord(responses.answers);
  const blanks = (content.passages ?? []).flatMap((passage) => passage.blanks ?? []);
  const score = blanks.filter((blank) => {
    const answer = (answers[blank.id] ?? "").trim();
    if (!answer) return false;
    const equals = (left: string, right: string) =>
      blank.caseSensitive ? left === right : left.toLowerCase() === right.toLowerCase();
    return (
      equals(answer, blank.answer) ||
      (blank.acceptedAnswers ?? []).some((candidate) => equals(answer, candidate))
    );
  }).length;

  return { score, maxScore: blanks.length };
}

function scoreDragOrder(
  content: DragOrderContent,
  responses: ActivityResponses,
): ScoreResult {
  const items = content.items ?? [];
  const order = Array.isArray(responses.order)
    ? responses.order.filter((item): item is string => typeof item === "string")
    : [];
  const itemById = new Map(items.map((item) => [item.id, item]));

  return {
    score: order.filter((id, index) => itemById.get(id)?.correctOrder === index + 1)
      .length,
    maxScore: items.length,
  };
}

function scoreFlashcard(
  content: FlashcardContent,
  responses: ActivityResponses,
): ScoreResult {
  const cards = content.cards ?? [];
  const gotOnFirst =
    typeof responses.gotOnFirst === "number" && Number.isFinite(responses.gotOnFirst)
      ? Math.floor(responses.gotOnFirst)
      : 0;

  return {
    score: Math.max(0, Math.min(cards.length, gotOnFirst)),
    maxScore: cards.length,
  };
}

export const CORE_ACTIVITY_DEFINITIONS = {
  quiz: defineActivityDefinition({
    type: "quiz",
    defaultPhase: "apply",
    defaultDuration: 5,
    defaultContent: () => ({ questions: [] }),
    validate: validateQuiz,
    score: scoreQuiz,
  }),
  matching: defineActivityDefinition({
    type: "matching",
    defaultPhase: "practice",
    defaultDuration: 5,
    defaultContent: () => ({ pairs: [] }),
    validate: validateMatching,
    score: scoreMatching,
  }),
  fill_blank: defineActivityDefinition({
    type: "fill_blank",
    defaultPhase: "practice",
    defaultDuration: 5,
    defaultContent: () => ({ passages: [] }),
    validate: validateFillBlank,
    score: scoreFillBlank,
  }),
  drag_order: defineActivityDefinition({
    type: "drag_order",
    defaultPhase: "practice",
    defaultDuration: 3,
    defaultContent: () => ({ items: [], instruction: "" }),
    validate: validateDragOrder,
    score: scoreDragOrder,
  }),
  flashcard: defineActivityDefinition({
    type: "flashcard",
    defaultPhase: "learn",
    defaultDuration: 5,
    defaultContent: () => ({ cards: [] }),
    validate: validateFlashcard,
    score: scoreFlashcard,
  }),
  lesson: defineActivityDefinition({
    type: "lesson",
    defaultPhase: "learn",
    defaultDuration: 10,
    defaultContent: (): LessonContent => ({ type: "article", body: "" }),
    validate: validateLesson,
    score: () => ({ score: 1, maxScore: 1 }),
  }),
} satisfies CoreActivityDefinitionMap;

export const IELTS_TEXT_ACTIVITY_DEFINITIONS = {
  ielts_vocab_collocation: defineActivityDefinition({
    type: "ielts_vocab_collocation",
    defaultPhase: "practice",
    defaultDuration: 4,
    defaultContent: () =>
      defaultIeltsTextActivityContent("ielts_vocab_collocation"),
    validate: validateIeltsTextActivityContent,
    score: scoreIeltsTextActivityPreview,
  }),
  ielts_paraphrase_transform: defineActivityDefinition({
    type: "ielts_paraphrase_transform",
    defaultPhase: "practice",
    defaultDuration: 4,
    defaultContent: () =>
      defaultIeltsTextActivityContent("ielts_paraphrase_transform"),
    validate: validateIeltsTextActivityContent,
    score: scoreIeltsTextActivityPreview,
  }),
  ielts_gap_fill: defineActivityDefinition({
    type: "ielts_gap_fill",
    defaultPhase: "practice",
    defaultDuration: 6,
    defaultContent: () => ({
      ...defaultIeltsTextActivityContent("ielts_gap_fill"),
      instruction: {
        en: "Complete the IELTS gap using the source question rules.",
        vi: "Hoàn thành chỗ trống IELTS theo quy tắc của câu hỏi gốc.",
      },
      rendererTags: ["completion", "gap_fill"],
    }),
    validate: validateIeltsTextActivityContent,
    score: scoreIeltsTextActivityPreview,
  }),
  ielts_tfng_reasoning: defineActivityDefinition({
    type: "ielts_tfng_reasoning",
    defaultPhase: "practice",
    defaultDuration: 4,
    defaultContent: () => ({
      ...defaultIeltsTextActivityContent("ielts_tfng_reasoning"),
      instruction: {
        en: "Choose True, False, or Not Given, then justify it from the passage.",
        vi: "Chọn Đúng, Sai hoặc Không có thông tin, rồi nêu lý do từ bài đọc.",
      },
      rendererTags: ["tfng", "reasoning", "reading"],
    }),
    validate: validateIeltsTextActivityContent,
    score: scoreIeltsTextActivityPreview,
  }),
  ielts_scan_detail: defineActivityDefinition({
    type: "ielts_scan_detail",
    defaultPhase: "practice",
    defaultDuration: 5,
    defaultContent: () => ({
      ...defaultIeltsTextActivityContent("ielts_scan_detail"),
      instruction: {
        en: "Scan the source quickly and answer the detail question.",
        vi: "Đọc quét nguồn thật nhanh và trả lời câu hỏi chi tiết.",
      },
      rendererTags: ["scan", "detail", "reading"],
    }),
    validate: validateIeltsTextActivityContent,
    score: scoreIeltsTextActivityPreview,
  }),
  ielts_sentence_transform: defineActivityDefinition({
    type: "ielts_sentence_transform",
    defaultPhase: "practice",
    defaultDuration: 4,
    defaultContent: () => ({
      ...defaultIeltsTextActivityContent("ielts_sentence_transform"),
      instruction: {
        en: "Transform the sentence without changing the meaning.",
        vi: "Chuyển đổi câu mà không làm đổi nghĩa.",
      },
      rendererTags: ["sentence_transform", "writing"],
    }),
    validate: validateIeltsTextActivityContent,
    score: scoreIeltsTextActivityPreview,
  }),
  ielts_cohesion_linker: defineActivityDefinition({
    type: "ielts_cohesion_linker",
    defaultPhase: "practice",
    defaultDuration: 5,
    defaultContent: () => ({
      ...defaultIeltsTextActivityContent("ielts_cohesion_linker"),
      instruction: {
        en: "Choose or type the linker that makes the writing cohesive.",
        vi: "Chọn hoặc nhập từ nối giúp bài viết liên kết mạch lạc.",
      },
      rendererTags: ["cohesion", "linker", "writing"],
    }),
    validate: validateIeltsTextActivityContent,
    score: scoreIeltsTextActivityPreview,
  }),
};

const ACTIVITY_REGISTRY = createActivityRegistry();

ACTIVITY_REGISTRY.register(CORE_ACTIVITY_DEFINITIONS.quiz);
ACTIVITY_REGISTRY.register(CORE_ACTIVITY_DEFINITIONS.matching);
ACTIVITY_REGISTRY.register(CORE_ACTIVITY_DEFINITIONS.fill_blank);
ACTIVITY_REGISTRY.register(CORE_ACTIVITY_DEFINITIONS.drag_order);
ACTIVITY_REGISTRY.register(CORE_ACTIVITY_DEFINITIONS.flashcard);
ACTIVITY_REGISTRY.register(CORE_ACTIVITY_DEFINITIONS.lesson);
ACTIVITY_REGISTRY.register(IELTS_TEXT_ACTIVITY_DEFINITIONS.ielts_vocab_collocation);
ACTIVITY_REGISTRY.register(IELTS_TEXT_ACTIVITY_DEFINITIONS.ielts_paraphrase_transform);
ACTIVITY_REGISTRY.register(IELTS_TEXT_ACTIVITY_DEFINITIONS.ielts_gap_fill);
ACTIVITY_REGISTRY.register(IELTS_TEXT_ACTIVITY_DEFINITIONS.ielts_tfng_reasoning);
ACTIVITY_REGISTRY.register(IELTS_TEXT_ACTIVITY_DEFINITIONS.ielts_scan_detail);
ACTIVITY_REGISTRY.register(IELTS_TEXT_ACTIVITY_DEFINITIONS.ielts_sentence_transform);
ACTIVITY_REGISTRY.register(IELTS_TEXT_ACTIVITY_DEFINITIONS.ielts_cohesion_linker);

export function registerActivityDefinition<TType extends string, TContent>(
  definition: ActivityDefinition<TType, TContent>,
): void {
  ACTIVITY_REGISTRY.register(definition);
}

export function getActivityDefinition(
  type: string,
): ActivityDefinition<string, unknown> | undefined {
  return ACTIVITY_REGISTRY.get(type);
}

export function getRegisteredActivityTypes(): string[] {
  return ACTIVITY_REGISTRY.list().map((definition) => definition.type);
}

export function getDefaultPhase(type: ActivityType): ActivityPhase {
  return getActivityDefinition(type)?.defaultPhase as ActivityPhase;
}

export function getDefaultContent(type: ActivityType): ActivityContent {
  return getActivityDefinition(type)?.defaultContent() as ActivityContent;
}

export function getDefaultDuration(type: ActivityType): number {
  return getActivityDefinition(type)?.defaultDuration as number;
}

export function validateActivityContent(
  type: string,
  content: unknown,
): ValidationResult {
  const definition = getActivityDefinition(type);
  if (!definition) {
    return { valid: false, errors: [`Unknown activity type: ${type}`] };
  }
  return definition.validate(content);
}

export function scoreActivityContent(
  type: string,
  content: unknown,
  responses: ActivityResponses,
): ScoreResult {
  const definition = getActivityDefinition(type);
  if (!definition) return { score: 0, maxScore: 0 };
  return definition.score(content, responses);
}

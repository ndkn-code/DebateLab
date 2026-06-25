import "server-only";

import type { Json, Tables } from "@/types/supabase";
import type { ActivityResponses } from "@/lib/activity/registry";
import { parseInput } from "@/lib/api/boundary";
import {
  IeltsTextActivityContentSchema,
  getIeltsTextResponseForQuestion,
  isIeltsFirstTextActivityType,
  type IeltsFirstTextActivityType,
  type IeltsTextActivityContent,
  type IeltsTextActivityFeedback,
  type IeltsTextActivityFeedbackItem,
  type IeltsTextActivityView,
} from "@/lib/ielts/learn/text-activities";
import { getFixedOptions } from "@/lib/ielts/question-types";
import { createTypedAdminClient } from "@/lib/supabase/admin";
import {
  isObjectiveType,
  scoreObjectiveAnswer,
} from "@/lib/scoring/ielts/objective-scoring";
import {
  extractValue,
  normalizeChoice,
  toAnswerStrings,
} from "@/lib/scoring/ielts/answer-normalize";
import { resolveIeltsClient, type IeltsDbClient } from "./client";

const QUESTION_COLUMNS =
  "id, skill, question_type, prompt, group_instructions, options, word_limit, max_points, metadata";

type QuestionRow = Pick<
  Tables<"ielts_questions">,
  | "id"
  | "skill"
  | "question_type"
  | "prompt"
  | "group_instructions"
  | "options"
  | "word_limit"
  | "max_points"
  | "metadata"
>;

type KeyRow = Pick<
  Tables<"ielts_question_keys">,
  | "question_id"
  | "correct_answer"
  | "accept_variants"
  | "explanation_en"
  | "explanation_vi"
>;

type SkippedSource = {
  questionId: string;
  subskillKey: string;
  reason: string;
};

type ScorableSource = {
  source: IeltsTextActivityContent["sources"][number];
  question: QuestionRow;
  key: KeyRow;
};

export type IeltsTextActivityScoreResult = {
  activityType: IeltsFirstTextActivityType;
  score: number;
  maxScore: number;
  feedback: IeltsTextActivityFeedback;
  sourceScores: Array<{
    questionId: string;
    subskillKey: string;
    skill: QuestionRow["skill"];
    questionType: QuestionRow["question_type"];
    awardedPoints: number;
    maxPoints: number;
  }>;
};

function normalizeOptions(
  options: Json,
  questionType: QuestionRow["question_type"],
): Array<{ value: string; label: string }> {
  const fixed = getFixedOptions(questionType).map((option) => ({
    value: option.id,
    label: option.label ? `${option.label} - ${option.text}` : option.text,
  }));
  if (fixed.length > 0) return fixed;
  if (!Array.isArray(options)) return [];
  return options.map((option, index) => {
    if (typeof option === "string") return { value: option, label: option };
    if (option && typeof option === "object" && !Array.isArray(option)) {
      const record = option as Record<string, unknown>;
      const value = String(record.value ?? record.id ?? record.key ?? index);
      const label = String(record.label ?? record.text ?? record.value ?? value);
      return { value, label };
    }
    return { value: String(index), label: String(index) };
  });
}

function toView(content: IeltsTextActivityContent, rows: QuestionRow[]): IeltsTextActivityView {
  const rowById = new Map(rows.map((row) => [row.id, row]));
  return {
    activityType: content.activityType,
    module: content.module,
    instruction: content.instruction,
    rationalePrompt:
      content.activityType === "ielts_tfng_reasoning"
        ? content.rationalePrompt
        : undefined,
    questions: content.sources.flatMap((source) => {
      const question = rowById.get(source.questionId);
      if (!question) return [];
      return [
        {
          questionId: question.id,
          skill: question.skill,
          questionType: question.question_type,
          prompt: question.prompt,
          groupInstructions: question.group_instructions,
          options: normalizeOptions(question.options, question.question_type),
          wordLimit: question.word_limit,
        },
      ];
    }),
  };
}

export async function loadIeltsTextActivityView(
  rawContent: unknown,
  client?: IeltsDbClient,
): Promise<IeltsTextActivityView> {
  const content = parseInput(IeltsTextActivityContentSchema, rawContent);
  const supabase = await resolveIeltsClient(client);
  const questionIds = content.sources.map((source) => source.questionId);

  const { data, error } = await supabase
    .from("ielts_questions")
    .select(QUESTION_COLUMNS)
    .in("id", questionIds);
  if (error) {
    throw new Error(`loadIeltsTextActivityView: ${error.message}`);
  }

  const view = toView(content, data ?? []);
  if (view.questions.length !== content.sources.length) {
    throw new Error("loadIeltsTextActivityView: one or more source questions are unavailable");
  }
  return view;
}

function scoreChoiceFromKey(key: KeyRow, response: unknown): {
  correct: boolean;
  awardedPoints: number;
  maxPoints: number;
} {
  const picked = extractValue(response);
  const accepted = [
    ...toAnswerStrings(key.correct_answer),
    ...toAnswerStrings(key.accept_variants),
  ].map(normalizeChoice);
  const correct = picked !== null && accepted.includes(normalizeChoice(picked));
  return { correct, awardedPoints: correct ? 1 : 0, maxPoints: 1 };
}

function scoreObjectiveFromKey(
  question: QuestionRow,
  key: KeyRow,
  response: unknown,
): {
  correct: boolean;
  awardedPoints: number;
  maxPoints: number;
} {
  const objective = scoreObjectiveAnswer(
    {
      question_type: question.question_type,
      max_points: question.max_points,
      word_limit: question.word_limit,
    },
    {
      correct_answer: key.correct_answer,
      accept_variants: key.accept_variants,
    },
    response,
  );
  return {
    correct: objective.isCorrect,
    awardedPoints: objective.awardedPoints,
    maxPoints: objective.maxPoints,
  };
}

function fallbackFeedback(correct: boolean): { en: string; vi: string } {
  return correct
    ? {
        en: "Correct. This response supports your IELTS subskill signal.",
        vi: "Chính xác. Câu trả lời này bổ sung tín hiệu kỹ năng IELTS của bạn.",
      }
    : {
        en: "Not quite yet. Review the source explanation, then try a short review card later.",
        vi: "Chưa đúng. Hãy xem lại giải thích gốc rồi luyện lại bằng thẻ ôn tập ngắn.",
      };
}

function itemFeedback(key: KeyRow, correct: boolean): { en: string; vi: string } {
  const fallback = fallbackFeedback(correct);
  return {
    en: key.explanation_en?.trim() || fallback.en,
    vi: key.explanation_vi?.trim() || fallback.vi,
  };
}

function overallFeedback(score: number, maxScore: number): { en: string; vi: string } {
  if (maxScore > 0 && score === maxScore) {
    return {
      en: "Strong work. This activity will raise confidence for the tagged IELTS subskill.",
      vi: "Làm tốt. Hoạt động này sẽ tăng độ tin cậy cho kỹ năng IELTS được gắn nhãn.",
    };
  }
  return {
    en: "Good practice signal recorded. Missed items will count toward your adaptive review priorities.",
    vi: "Đã ghi nhận tín hiệu luyện tập. Các câu sai sẽ ảnh hưởng đến ưu tiên ôn tập thích ứng.",
  };
}

function unscorableFeedback(): IeltsTextActivityFeedback {
  return {
    en: "This activity was completed, but its source item is not scorable yet. Your progress was saved without adding IELTS mastery evidence.",
    vi: "Bạn đã hoàn thành hoạt động này, nhưng câu nguồn chưa thể chấm điểm. Tiến độ đã được lưu mà không thêm tín hiệu năng lực IELTS.",
    items: [],
  };
}

function hasUsableKey(key: KeyRow): boolean {
  return (
    toAnswerStrings(key.correct_answer).length > 0 ||
    toAnswerStrings(key.accept_variants).length > 0
  );
}

function canScoreQuestionForActivity(
  activityType: IeltsFirstTextActivityType,
  question: QuestionRow,
): boolean {
  if (!isObjectiveType(question.question_type)) return false;
  if (
    activityType === "ielts_vocab_collocation" ||
    activityType === "ielts_paraphrase_transform"
  ) {
    return normalizeOptions(question.options, question.question_type).length > 0;
  }
  return true;
}

function skippedScoreResult(params: {
  activityType: IeltsFirstTextActivityType;
  skippedSources: SkippedSource[];
}): IeltsTextActivityScoreResult {
  console.error("[ielts-learn] activity has no scorable source questions", {
    activityType: params.activityType,
    skippedSources: params.skippedSources,
  });
  return {
    activityType: params.activityType,
    score: 0,
    maxScore: 0,
    feedback: unscorableFeedback(),
    sourceScores: [],
  };
}

function skippedSource(source: IeltsTextActivityContent["sources"][number], reason: string): {
  skipped: SkippedSource;
} {
  return {
    skipped: {
      questionId: source.questionId,
      subskillKey: source.subskillKey,
      reason,
    },
  };
}

function resolveScorableSource(params: {
  activityType: IeltsFirstTextActivityType;
  source: IeltsTextActivityContent["sources"][number];
  question?: QuestionRow;
  key?: KeyRow;
}): { scorable: ScorableSource } | { skipped: SkippedSource } {
  const { activityType, source, question, key } = params;
  if (!question) return skippedSource(source, "missing_question");
  if (!key || !hasUsableKey(key)) return skippedSource(source, "missing_or_empty_key");
  if (!source.subskillKey.startsWith(`${question.skill}:`)) {
    return skippedSource(source, `skill_mismatch:${question.skill}`);
  }
  if (!canScoreQuestionForActivity(activityType, question)) {
    return skippedSource(source, `unsupported_question_type:${question.question_type}`);
  }
  return { scorable: { source, question, key } };
}

export async function scoreIeltsTextActivity(params: {
  activityType: string;
  content: unknown;
  responses: ActivityResponses;
}): Promise<IeltsTextActivityScoreResult> {
  const activityType = params.activityType;
  if (!isIeltsFirstTextActivityType(activityType)) {
    throw new Error(`Unsupported IELTS text activity: ${activityType}`);
  }

  const content = parseInput(IeltsTextActivityContentSchema, params.content);
  const supabase = createTypedAdminClient();
  const questionIds = content.sources.map((source) => source.questionId);
  const [questionsResult, keysResult] = await Promise.all([
    supabase.from("ielts_questions").select(QUESTION_COLUMNS).in("id", questionIds),
    supabase
      .from("ielts_question_keys")
      .select("question_id, correct_answer, accept_variants, explanation_en, explanation_vi")
      .in("question_id", questionIds),
  ]);
  if (questionsResult.error) {
    throw new Error(`scoreIeltsTextActivity (questions): ${questionsResult.error.message}`);
  }
  if (keysResult.error) {
    throw new Error(`scoreIeltsTextActivity (keys): ${keysResult.error.message}`);
  }

  const questionById = new Map((questionsResult.data ?? []).map((row) => [row.id, row]));
  const keyByQuestion = new Map(
    (keysResult.data ?? []).map((row) => [row.question_id, row]),
  );
  const feedbackItems: IeltsTextActivityFeedbackItem[] = [];
  const sourceScores: IeltsTextActivityScoreResult["sourceScores"] = [];
  const skippedSources: SkippedSource[] = [];

  for (const source of content.sources) {
    const resolved = resolveScorableSource({
      activityType,
      source,
      question: questionById.get(source.questionId),
      key: keyByQuestion.get(source.questionId),
    });
    if ("skipped" in resolved) {
      skippedSources.push(resolved.skipped);
      continue;
    }
    const { question, key } = resolved.scorable;

    const response = getIeltsTextResponseForQuestion(
      params.responses,
      source.questionId,
    );
    const verdict =
      activityType === "ielts_vocab_collocation" ||
      activityType === "ielts_paraphrase_transform"
        ? scoreChoiceFromKey(key, response)
        : scoreObjectiveFromKey(question, key, response);
    const feedback = itemFeedback(key, verdict.correct);

    feedbackItems.push({
      questionId: source.questionId,
      correct: verdict.correct,
      awardedPoints: verdict.awardedPoints,
      maxPoints: verdict.maxPoints,
      feedbackEn: feedback.en,
      feedbackVi: feedback.vi,
    });
    sourceScores.push({
      questionId: source.questionId,
      subskillKey: source.subskillKey,
      skill: question.skill,
      questionType: question.question_type,
      awardedPoints: verdict.awardedPoints,
      maxPoints: verdict.maxPoints,
    });
  }

  if (sourceScores.length === 0) {
    return skippedScoreResult({
      activityType,
      skippedSources,
    });
  }
  if (skippedSources.length > 0) {
    console.warn("[ielts-learn] skipped unscorable source questions", {
      activityType,
      skippedSources,
    });
  }

  const score = sourceScores.reduce((sum, source) => sum + source.awardedPoints, 0);
  const maxScore = sourceScores.reduce((sum, source) => sum + source.maxPoints, 0);
  const overall = overallFeedback(score, maxScore);

  return {
    activityType,
    score,
    maxScore,
    feedback: {
      en: overall.en,
      vi: overall.vi,
      items: feedbackItems,
    },
    sourceScores,
  };
}

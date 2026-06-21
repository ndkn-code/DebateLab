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
import { createTypedAdminClient } from "@/lib/supabase/admin";
import { scoreObjectiveAnswer } from "@/lib/scoring/ielts/objective-scoring";
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

function normalizeOptions(options: Json): Array<{ value: string; label: string }> {
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
          options: normalizeOptions(question.options),
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

export async function scoreIeltsTextActivity(params: {
  activityType: string;
  content: unknown;
  responses: ActivityResponses;
}): Promise<IeltsTextActivityScoreResult> {
  if (!isIeltsFirstTextActivityType(params.activityType)) {
    throw new Error(`Unsupported IELTS text activity: ${params.activityType}`);
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

  for (const source of content.sources) {
    const question = questionById.get(source.questionId);
    const key = keyByQuestion.get(source.questionId);
    if (!question || !key) continue;
    if (!source.subskillKey.startsWith(`${question.skill}:`)) {
      throw new Error(
        `IELTS activity source ${source.questionId} has mismatched subskill ${source.subskillKey}`,
      );
    }

    const response = getIeltsTextResponseForQuestion(
      params.responses,
      source.questionId,
    );
    const verdict =
      params.activityType === "ielts_gap_fill"
        ? (() => {
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
          })()
        : scoreChoiceFromKey(key, response);
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
    throw new Error("scoreIeltsTextActivity: no gradable source questions");
  }

  const score = sourceScores.reduce((sum, source) => sum + source.awardedPoints, 0);
  const maxScore = sourceScores.reduce((sum, source) => sum + source.maxPoints, 0);
  const overall = overallFeedback(score, maxScore);

  return {
    activityType: params.activityType,
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

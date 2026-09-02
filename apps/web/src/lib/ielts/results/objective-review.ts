/**
 * Pure objective-review builder for the IELTS results screen (WS-2.2).
 *
 * Turns each graded objective question into a learner-facing review row:
 * prompt, the learner's formatted answer, the formatted correct answer, the
 * recorded correct/incorrect verdict, and the bilingual explanation. The secret
 * key has already been read server-side; here it is only formatted (option ids
 * → display labels) — never surfaced raw. Items are grouped by skill (R/L) in
 * the order the repository supplies (authored `order_index`).
 *
 * Formatting reuses the same tolerant extractors the grader uses
 * (`lib/scoring/ielts/answer-normalize`), so "your answer" mirrors exactly what
 * was scored, whatever envelope the renderer emitted.
 */
import {
  extractValue,
  extractValues,
  toAnswerStrings,
} from "@/lib/scoring/ielts/answer-normalize";
import type {
  IeltsAnswer,
  IeltsOption,
  IeltsQuestionView,
  IeltsVerdict,
} from "@/lib/ielts/question-types/types";
import {
  IeltsAnswerSchema,
  parseRawAnswerKey,
} from "@/lib/ielts/question-types/schemas";
import { DEFAULT_BLANK_ID } from "@/lib/ielts/question-types/registry";
import {
  indexGroupsByKey,
  type IeltsQuestionGroupView,
} from "@/lib/ielts/question-types/groups";
import { buildAnswerKey } from "@/lib/scoring/ielts/build-key";
import { gradeQuestion } from "@/lib/scoring/ielts/grade-question";
import type {
  IeltsQuestionView as IeltsPlayerQuestionView,
  IeltsResponseMap,
} from "@/lib/ielts/question-contract";
import type {
  AttemptResultsInput,
  ObjectiveReviewItem,
  ObjectiveReviewPart,
  ObjectiveReviewSection,
  ObjectiveSkillKey,
  ResultsObjectiveQuestion,
} from "./types";
import { SKILL_LABELS } from "./types";
import { displayValue, optionForValue, resolveSource } from "./source-locator";

const BLANK_MARKER = /__BLANK_[^_]+__/g;
const NOT_ANSWERED = "Not answered";
const EMPTY = "—";
/** Replace `__BLANK_x__` placeholders with a visible gap for readability. */
function cleanPrompt(prompt: string): string {
  return prompt.replace(BLANK_MARKER, "______").trim();
}

/**
 * Where a question's answers are looked up. A group bank (headings, features,
 * endings, word list) wins over the row's own options and is shown by LABEL
 * only ("A", "iii") — the set-level bank is rendered once by the review UI.
 */
interface AnswerLookup {
  options: IeltsOption[];
  labelOnly: boolean;
}

function answerLookup(
  view: IeltsQuestionView,
  group: IeltsQuestionGroupView | undefined,
): AnswerLookup {
  if (group && group.bank.length > 0) {
    return { options: group.bank, labelOnly: true };
  }
  return { options: view.options, labelOnly: false };
}

function displayWith(lookup: AnswerLookup, value: string): string {
  if (!lookup.labelOnly) return displayValue(lookup.options, value);
  const option = optionForValue(lookup.options, value);
  if (!option) return value.trim();
  return option.label || option.text || value.trim();
}

function formatList(
  view: IeltsQuestionView,
  lookup: AnswerLookup,
  values: string[],
  emptyLabel: string,
): string {
  const cleaned = values.map((value) => displayWith(lookup, value)).filter(Boolean);
  if (cleaned.length === 0) return emptyLabel;
  const separator = view.family === "multi_select" ? ", " : " / ";
  return cleaned.join(separator);
}

function learnerValues(question: ResultsObjectiveQuestion): string[] {
  if (question.view.family === "multi_select") {
    return extractValues(question.response);
  }
  const single = extractValue(question.response);
  return single === null ? [] : [single];
}

/** Tolerant response → answer envelope (mirrors the grader's fallback). */
function toIeltsAnswer(view: IeltsQuestionView, response: unknown): IeltsAnswer {
  const parsed = IeltsAnswerSchema.safeParse(response);
  if (parsed.success && Object.keys(parsed.data.values).length > 0) return parsed.data;
  if (view.family === "multi_select") {
    const values = extractValues(response);
    return values.length > 0 ? { values: { [DEFAULT_BLANK_ID]: values } } : { values: {} };
  }
  const single = extractValue(response);
  return single === null ? { values: {} } : { values: { [DEFAULT_BLANK_ID]: single } };
}

/**
 * Re-grade the row from its (server-read) key so the review can show per-blank
 * correctness. Null while the key is withheld (attempt in progress) or when
 * the key is malformed — the stored `isCorrect` remains the source of truth.
 */
function computeVerdict(
  question: ResultsObjectiveQuestion,
  lookup: AnswerLookup,
): IeltsVerdict | null {
  if (question.correctAnswer == null) return null;
  try {
    const raw = parseRawAnswerKey(question.correctAnswer, question.acceptVariants);
    if (Object.keys(raw.correctAnswer).length === 0) return null;
    const key = buildAnswerKey(raw, {
      family: question.view.family,
      hasOptionBank: lookup.options.length > 0,
      selectCount: question.view.selectCount,
    });
    return gradeQuestion(
      { wordLimit: question.view.wordLimit },
      key,
      toIeltsAnswer(question.view, question.response),
    );
  } catch {
    return null;
  }
}

function numberSpanOf(view: IeltsQuestionView): number {
  const span = view.numberSpan ?? 1;
  return Number.isInteger(span) && span > 1 ? span : 1;
}

function numberLabelFor(number: number, span: number): string {
  return span > 1 ? `${number}\u2013${number + span - 1}` : String(number);
}

function toReviewItem(
  question: ResultsObjectiveQuestion,
  number: number,
  group: IeltsQuestionGroupView | undefined,
): ObjectiveReviewItem {
  const { view } = question;
  const lookup = answerLookup(view, group);
  const values = learnerValues(question);
  const source = resolveSource(question);
  return {
    questionId: view.id,
    number,
    numberLabel: numberLabelFor(number, numberSpanOf(view)),
    questionType: view.questionType,
    prompt: cleanPrompt(view.prompt),
    groupInstructions: view.groupInstructions ?? group?.instructions ?? null,
    groupKey: question.groupKey ?? group?.groupKey ?? null,
    learnerAnswer: formatList(view, lookup, values, NOT_ANSWERED),
    correctAnswer: formatList(view, lookup, toAnswerStrings(question.correctAnswer), EMPTY),
    answered: values.length > 0,
    isCorrect: question.isCorrect === true,
    awardedPoints: question.awardedPoints ?? 0,
    maxPoints: view.maxPoints,
    verdict: computeVerdict(question, lookup),
    explanationEn: question.explanationEn,
    explanationVi: question.explanationVi,
    sourceContext: source.context,
    sourceRange: source.range,
    audioTimestamp: null,
  };
}

function partKeyFor(question: ResultsObjectiveQuestion, skill: ObjectiveSkillKey): string {
  const source = question.source;
  if (source?.partId) return source.partId;
  if (source?.title) return `${skill}:${source.title}`;
  return `${skill}:general`;
}

/** Player-shaped view (placement fields added) so group blocks can be rebuilt. */
function toPlayerView(
  question: ResultsObjectiveQuestion,
  orderIndex: number,
): IeltsPlayerQuestionView {
  const source = question.source ?? null;
  return {
    ...question.view,
    orderIndex,
    groupKey: question.groupKey ?? null,
    passageId: source?.kind === "reading" ? (source.partId ?? null) : null,
    listeningSectionId:
      source?.kind === "listening" ? (source.partId ?? null) : null,
  };
}

/** questionId → stored response for every answered objective question. */
export function buildObjectiveResponses(
  questions: readonly ResultsObjectiveQuestion[],
): IeltsResponseMap {
  const responses: IeltsResponseMap = {};
  for (const question of questions) {
    if (question.response != null) responses[question.view.id] = question.response;
  }
  return responses;
}

/** Split a skill's items into passage / section parts, in first-seen order. */
function buildParts(
  questions: ResultsObjectiveQuestion[],
  items: ObjectiveReviewItem[],
  skill: ObjectiveSkillKey,
): ObjectiveReviewPart[] {
  const parts = new Map<string, ObjectiveReviewPart>();
  questions.forEach((question, index) => {
    const key = partKeyFor(question, skill);
    let part = parts.get(key);
    if (!part) {
      const source = question.source ?? null;
      part = {
        partId: key,
        title:
          source?.title?.trim() ||
          `${skill === "reading" ? "Passage" : "Section"} ${parts.size + 1}`,
        sourceText: source?.text ?? null,
        audioUrl: source?.audioUrl ?? null,
        items: [],
        questions: [],
      };
      parts.set(key, part);
    }
    part.items.push(items[index]);
    part.questions.push(toPlayerView(question, index));
  });
  return [...parts.values()];
}

/** Group objective questions into per-skill review sections (R/L), numbered. */
/** Marks a review row is worth: its max points, never fewer than one. */
function marksFor(item: { maxPoints: number }): number {
  return item.maxPoints > 0 ? item.maxPoints : 1;
}

export function buildObjectiveReview(
  input: AttemptResultsInput,
): ObjectiveReviewSection[] {
  const groupsByKey = indexGroupsByKey(input.questionGroups ?? []);
  const bySkill = new Map<ObjectiveSkillKey, ResultsObjectiveQuestion[]>();
  for (const question of input.objectiveQuestions) {
    const skill = question.view.skill;
    if (skill !== "listening" && skill !== "reading") continue;
    const list = bySkill.get(skill) ?? [];
    list.push(question);
    bySkill.set(skill, list);
  }

  const sections: ObjectiveReviewSection[] = [];
  for (const skill of ["listening", "reading"] as const) {
    const questions = bySkill.get(skill);
    if (!questions || questions.length === 0) continue;
    let nextNumber = 1;
    const items = questions.map((question) => {
      const group = question.groupKey ? groupsByKey.get(question.groupKey) : undefined;
      const item = toReviewItem(question, nextNumber, group);
      nextNumber += numberSpanOf(question.view);
      return item;
    });
    sections.push({
      skill,
      label: SKILL_LABELS[skill],
      // Official raw score: a "21–22" row is worth two marks, so count marks
      // (a fully correct row earns its span; partial credit keeps its points).
      correctCount: items.reduce(
        (sum, item) => sum + (item.isCorrect ? marksFor(item) : item.awardedPoints),
        0,
      ),
      totalCount: items.reduce((sum, item) => sum + marksFor(item), 0),
      items,
      parts: buildParts(questions, items, skill),
    });
  }
  return sections;
}

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
  normalizeChoice,
  toAnswerStrings,
} from "@/lib/scoring/ielts/answer-normalize";
import type {
  IeltsOption,
  IeltsQuestionView,
} from "@/lib/ielts/question-types/types";
import type {
  AttemptResultsInput,
  ObjectiveSourceContext,
  ObjectiveReviewItem,
  ObjectiveReviewSection,
  ObjectiveSkillKey,
  ResultsObjectiveQuestion,
  ResultsTextSegment,
} from "./types";
import { SKILL_LABELS } from "./types";

const BLANK_MARKER = /__BLANK_[^_]+__/g;
const NOT_ANSWERED = "Not answered";
const EMPTY = "—";
const SOURCE_WINDOW = 220;
const HINT_KEYS = new Set([
  "answerLocation",
  "answer_location",
  "sourceLocation",
  "source_location",
  "sourceQuote",
  "source_quote",
  "evidenceQuote",
  "evidence_quote",
  "passageQuote",
  "passage_quote",
  "transcriptQuote",
  "transcript_quote",
  "quote",
  "text",
]);
const START_KEYS = ["start", "startIndex", "charStart", "char_start", "startOffset"];
const END_KEYS = ["end", "endIndex", "charEnd", "char_end", "endOffset"];
const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "by",
  "for",
  "from",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "the",
  "to",
  "was",
  "were",
  "with",
]);

interface SourceRange {
  start: number;
  end: number;
}

interface WordToken {
  value: string;
  start: number;
  end: number;
}

/** Replace `__BLANK_x__` placeholders with a visible gap for readability. */
function cleanPrompt(prompt: string): string {
  return prompt.replace(BLANK_MARKER, "______").trim();
}

function optionForValue(options: IeltsOption[], value: string): IeltsOption | null {
  const norm = normalizeChoice(value);
  return (
    options.find(
      (candidate) =>
        normalizeChoice(candidate.id) === norm ||
        (candidate.label != null && normalizeChoice(candidate.label) === norm),
    ) ?? null
  );
}

/** Map one option id / value to its display string, falling back to the raw value. */
function displayValue(options: IeltsOption[], value: string): string {
  const option = optionForValue(options, value);
  if (!option) return value.trim();
  if (option.label && option.text && option.label !== option.text) {
    return `${option.label}. ${option.text}`;
  }
  return option.text || option.label || value.trim();
}

function formatList(
  view: IeltsQuestionView,
  values: string[],
  emptyLabel: string,
): string {
  const cleaned = values.map((value) => displayValue(view.options, value)).filter(Boolean);
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

function tokenizeWithOffsets(text: string): WordToken[] {
  return Array.from(text.matchAll(/[\p{L}\p{N}']+/gu), (match) => ({
    value: normalizeChoice(match[0]),
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
  })).filter((token) => token.value.length > 0);
}

function findTokenPhraseRange(text: string, phrase: string): SourceRange | null {
  const source = tokenizeWithOffsets(text);
  const needle = tokenizeWithOffsets(phrase).map((token) => token.value);
  if (source.length === 0 || needle.length === 0) return null;
  for (let index = 0; index <= source.length - needle.length; index += 1) {
    const matched = needle.every((token, offset) => source[index + offset]?.value === token);
    if (matched) {
      return {
        start: source[index].start,
        end: source[index + needle.length - 1].end,
      };
    }
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readNumber(record: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function collectSpanHints(value: unknown, textLength: number, depth = 0): SourceRange[] {
  if (depth > 5 || value == null) return [];
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectSpanHints(item, textLength, depth + 1));
  }
  const record = asRecord(value);
  if (!record) return [];
  const start = readNumber(record, START_KEYS);
  const end = readNumber(record, END_KEYS);
  const own =
    start !== null && end !== null && start >= 0 && end > start && end <= textLength
      ? [{ start, end }]
      : [];
  return [
    ...own,
    ...Object.values(record).flatMap((item) => collectSpanHints(item, textLength, depth + 1)),
  ];
}

function collectStringHints(value: unknown, key = "", depth = 0): string[] {
  if (depth > 5 || value == null) return [];
  if (typeof value === "string") {
    return HINT_KEYS.has(key) ? [value] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectStringHints(item, key, depth + 1));
  }
  const record = asRecord(value);
  if (!record) return [];
  return Object.entries(record).flatMap(([entryKey, entryValue]) =>
    collectStringHints(entryValue, entryKey, depth + 1),
  );
}

function correctAnswerCandidates(question: ResultsObjectiveQuestion): string[] {
  const candidates: string[] = [];
  for (const value of toAnswerStrings(question.correctAnswer)) {
    candidates.push(value);
    const option = optionForValue(question.view.options, value);
    if (option?.text) candidates.push(option.text);
    if (option?.label) candidates.push(option.label);
    candidates.push(displayValue(question.view.options, value));
  }
  return candidates.filter((candidate) => candidate.trim().length >= 2);
}

function findExplanationRange(text: string, explanations: Array<string | null>): SourceRange | null {
  for (const explanation of explanations) {
    const tokens = tokenizeWithOffsets(explanation ?? "");
    const values = tokens.map((token) => token.value);
    for (let size = Math.min(12, values.length); size >= 2; size -= 1) {
      for (let start = 0; start <= values.length - size; start += 1) {
        const phraseTokens = values.slice(start, start + size);
        if (phraseTokens.every((token) => STOP_WORDS.has(token))) continue;
        const phrase = explanation!.slice(tokens[start].start, tokens[start + size - 1].end);
        const range = findTokenPhraseRange(text, phrase);
        if (range) return range;
      }
    }
  }
  return null;
}

function findSourceRange(question: ResultsObjectiveQuestion): SourceRange | null {
  const source = question.source;
  if (!source) return null;
  const hints = question.sourceHints ?? [];
  const span = hints
    .flatMap((hint) => collectSpanHints(hint, source.text.length))
    .find((candidate) => candidate.end > candidate.start);
  if (span) return span;

  const candidates = [
    ...hints.flatMap((hint) => collectStringHints(hint)),
    ...correctAnswerCandidates(question),
  ];
  for (const candidate of candidates) {
    const range = findTokenPhraseRange(source.text, candidate);
    if (range) return range;
  }

  return findExplanationRange(source.text, [question.explanationEn, question.explanationVi]);
}

function sourceSegments(text: string, range: SourceRange | null): ResultsTextSegment[] {
  if (!range) {
    const excerpt = text.length > SOURCE_WINDOW * 2 ? `${text.slice(0, SOURCE_WINDOW * 2).trim()}...` : text;
    return excerpt ? [{ text: excerpt, highlighted: false }] : [];
  }
  const start = Math.max(0, range.start - SOURCE_WINDOW);
  const end = Math.min(text.length, range.end + SOURCE_WINDOW);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < text.length ? "..." : "";
  return [
    { text: `${prefix}${text.slice(start, range.start).trimStart()}`, highlighted: false },
    { text: text.slice(range.start, range.end), highlighted: true },
    { text: `${text.slice(range.end, end).trimEnd()}${suffix}`, highlighted: false },
  ].filter((segment) => segment.text.length > 0);
}

function buildSourceContext(question: ResultsObjectiveQuestion): ObjectiveSourceContext | null {
  const source = question.source;
  if (!source || !source.text.trim()) return null;
  const range = findSourceRange(question);
  const highlighted = range ? source.text.slice(range.start, range.end) : null;
  return {
    kind: source.kind,
    label: source.kind === "reading" ? "Relevant passage span" : "Transcript answer location",
    title: source.title,
    segments: sourceSegments(source.text, range),
    answerLocation: highlighted?.trim() || null,
  };
}

function toReviewItem(
  question: ResultsObjectiveQuestion,
  number: number,
): ObjectiveReviewItem {
  const { view } = question;
  const values = learnerValues(question);
  return {
    questionId: view.id,
    number,
    questionType: view.questionType,
    prompt: cleanPrompt(view.prompt),
    groupInstructions: view.groupInstructions,
    learnerAnswer: formatList(view, values, NOT_ANSWERED),
    correctAnswer: formatList(view, toAnswerStrings(question.correctAnswer), EMPTY),
    answered: values.length > 0,
    isCorrect: question.isCorrect === true,
    awardedPoints: question.awardedPoints ?? 0,
    maxPoints: view.maxPoints,
    explanationEn: question.explanationEn,
    explanationVi: question.explanationVi,
    sourceContext: buildSourceContext(question),
  };
}

/** Group objective questions into per-skill review sections (R/L), numbered. */
export function buildObjectiveReview(
  input: AttemptResultsInput,
): ObjectiveReviewSection[] {
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
    const items = questions.map((question, index) => toReviewItem(question, index + 1));
    sections.push({
      skill,
      label: SKILL_LABELS[skill],
      correctCount: items.filter((item) => item.isCorrect).length,
      totalCount: items.length,
      items,
    });
  }
  return sections;
}

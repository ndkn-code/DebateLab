/**
 * Results data access for a completed IELTS attempt (WS-2.2).
 *
 * Security: ownership is proven by an RLS-bound read of the attempt (learners
 * have SELECT-own on `ielts_attempts`); a non-owner gets `null`. Every
 * learner-facing row (sections, responses, band scores, Writing/Speaking
 * responses, conversions, questions) is then read under that same RLS session —
 * "reads RLS-own". The ONE exception is the secret answer key
 * (`ielts_question_keys`, no learner policy): it is read with the service-role
 * client, gated behind the proven ownership AND a submitted attempt, and
 * is resolved into display strings by the pure builder before reaching a client.
 *
 * The output is the de-DB'd {@link AttemptResultsInput} the pure
 * `lib/ielts/results` builder consumes — no view logic lives here.
 */
import "server-only";
import { createTypedServerClient } from "@/lib/supabase/server";
import { createTypedAdminClient } from "@/lib/supabase/admin";
import type { Tables } from "@/types/supabase";
import { parseQuestionView } from "@/lib/ielts/question-types/schemas";
import { isObjectiveQuestionType } from "@/lib/ielts/question-types/registry";
import type { BandConversionRow } from "@/lib/scoring/ielts/band-conversion";
import type {
  AttemptResultsInput,
  IeltsSkillKey,
  ResultsObjectiveQuestion,
  ResultsSpeakingPart,
  ResultsWritingTask,
} from "@/lib/ielts/results/types";

const QUESTION_COLUMNS =
  "id, question_type, skill, prompt, group_instructions, word_limit, max_points, options, visual, metadata, passage_id, listening_section_id, order_index";
const WRITING_COLUMNS =
  "question_id, task_number, status, essay, word_count, task_response_band, coherence_cohesion_band, lexical_resource_band, grammar_band, task_band, criteria_feedback, inline_corrections, paragraph_feedback, model_answer, feedback_language";
const SPEAKING_COLUMNS =
  "question_id, part_number, status, transcript, fluency_coherence_band, lexical_resource_band, grammar_band, pronunciation_band, speaking_band, feedback, feedback_language, phoneme_report";

type ResponseRow = Pick<Tables<"ielts_question_responses">, "question_id" | "response" | "is_correct" | "awarded_points">;
type KeyRow = Pick<Tables<"ielts_question_keys">, "question_id" | "correct_answer" | "accept_variants" | "explanation_en" | "explanation_vi" | "model_answer" | "examiner_notes">;
type QuestionRow = Pick<Tables<"ielts_questions">, "id" | "question_type" | "skill" | "prompt" | "group_instructions" | "word_limit" | "max_points" | "options" | "visual" | "metadata" | "passage_id" | "listening_section_id">;
type WritingRow = Pick<Tables<"writing_responses">, "question_id" | "task_number" | "status" | "essay" | "word_count" | "task_response_band" | "coherence_cohesion_band" | "lexical_resource_band" | "grammar_band" | "task_band" | "criteria_feedback" | "inline_corrections" | "paragraph_feedback" | "model_answer" | "feedback_language">;
type SpeakingRow = Pick<Tables<"speaking_responses">, "question_id" | "part_number" | "status" | "transcript" | "fluency_coherence_band" | "lexical_resource_band" | "grammar_band" | "pronunciation_band" | "speaking_band" | "feedback" | "feedback_language" | "phoneme_report">;
type PassageRow = Pick<Tables<"passages">, "id" | "title" | "body">;
type ListeningSectionRow = Pick<Tables<"listening_sections">, "id" | "title" | "script">;
type ObjectiveSource = ResultsObjectiveQuestion["source"];

/** The per-test conversion key (test.metadata.band_conversion_key) → 'default'. */
function resolveConversionKey(metadata: Tables<"ielts_tests">["metadata"]): string {
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    const value = (metadata as Record<string, unknown>).band_conversion_key;
    if (typeof value === "string" && value.length > 0) return value;
  }
  return "default";
}

/** Distinct skills the attempt covers, in section (blueprint) order. */
function skillsInTest(
  sections: Pick<Tables<"ielts_attempt_sections">, "skill" | "section_order">[],
): IeltsSkillKey[] {
  const seen = new Set<IeltsSkillKey>();
  const ordered: IeltsSkillKey[] = [];
  for (const section of sections) {
    if (seen.has(section.skill)) continue;
    seen.add(section.skill);
    ordered.push(section.skill);
  }
  return ordered;
}

function buildObjectiveQuestions(
  questions: QuestionRow[],
  responses: ResponseRow[],
  keys: KeyRow[],
  passages: PassageRow[],
  listeningSections: ListeningSectionRow[],
): ResultsObjectiveQuestion[] {
  const responseByQuestion = new Map(responses.map((row) => [row.question_id, row]));
  const keyByQuestion = new Map(keys.map((row) => [row.question_id, row]));
  const passageById = new Map(passages.map((row) => [row.id, row]));
  const listeningById = new Map(listeningSections.map((row) => [row.id, row]));
  return questions
    .filter((question) => isObjectiveQuestionType(question.question_type))
    .map((question) =>
      toObjectiveQuestion({
        question,
        response: responseByQuestion.get(question.id),
        key: keyByQuestion.get(question.id),
        passage: question.passage_id ? (passageById.get(question.passage_id) ?? null) : null,
        listening: question.listening_section_id
          ? (listeningById.get(question.listening_section_id) ?? null)
          : null,
      }),
    );
}

function sourceForQuestion(
  question: QuestionRow,
  passage: PassageRow | null,
  listening: ListeningSectionRow | null,
): ObjectiveSource {
  if (question.skill === "reading" && passage) {
    return { kind: "reading", title: passage.title, text: passage.body };
  }
  if (question.skill === "listening" && listening) {
    return { kind: "listening", title: listening.title, text: listening.script };
  }
  return null;
}

function sourceHintsForQuestion(
  question: QuestionRow,
  key: KeyRow | undefined,
): ResultsObjectiveQuestion["sourceHints"] {
  return [question.metadata, key?.examiner_notes].filter(
    (value): value is NonNullable<typeof value> => value != null,
  );
}

function objectiveResponseFields(
  response: ResponseRow | undefined,
): Pick<ResultsObjectiveQuestion, "response" | "isCorrect" | "awardedPoints"> {
  if (!response) {
    return { response: null, isCorrect: null, awardedPoints: null };
  }
  return {
    response: response.response,
    isCorrect: response.is_correct,
    awardedPoints: response.awarded_points,
  };
}

function objectiveKeyFields(
  key: KeyRow | undefined,
): Pick<
  ResultsObjectiveQuestion,
  "correctAnswer" | "acceptVariants" | "explanationEn" | "explanationVi"
> {
  if (!key) {
    return {
      correctAnswer: null,
      acceptVariants: [],
      explanationEn: null,
      explanationVi: null,
    };
  }
  return {
    correctAnswer: key.correct_answer,
    acceptVariants: key.accept_variants ?? [],
    explanationEn: key.explanation_en,
    explanationVi: key.explanation_vi,
  };
}

function toObjectiveQuestion(params: {
  question: QuestionRow;
  response: ResponseRow | undefined;
  key: KeyRow | undefined;
  passage: PassageRow | null;
  listening: ListeningSectionRow | null;
}): ResultsObjectiveQuestion {
  const { question, response, key, passage, listening } = params;
  return {
    view: parseQuestionView(question),
    ...objectiveResponseFields(response),
    ...objectiveKeyFields(key),
    source: sourceForQuestion(question, passage, listening),
    sourceHints: sourceHintsForQuestion(question, key),
  };
}

function mapWritingTask(
  row: WritingRow,
  question: QuestionRow | undefined,
  key: KeyRow | undefined,
): ResultsWritingTask {
  return {
    questionId: row.question_id,
    prompt: question?.prompt ?? null,
    taskNumber: row.task_number,
    status: row.status,
    essay: row.essay,
    wordCount: row.word_count,
    taskResponseBand: row.task_response_band,
    coherenceCohesionBand: row.coherence_cohesion_band,
    lexicalResourceBand: row.lexical_resource_band,
    grammarBand: row.grammar_band,
    taskBand: row.task_band,
    criteriaFeedback: row.criteria_feedback,
    inlineCorrections: row.inline_corrections,
    paragraphFeedback: row.paragraph_feedback,
    modelAnswer: key?.model_answer ?? row.model_answer,
    feedbackLanguage: row.feedback_language,
  };
}

function mapSpeakingPart(
  row: SpeakingRow,
  question: QuestionRow | undefined,
  key: KeyRow | undefined,
): ResultsSpeakingPart {
  return {
    questionId: row.question_id,
    prompt: question?.prompt ?? null,
    partNumber: row.part_number,
    status: row.status,
    transcript: row.transcript,
    fluencyCoherenceBand: row.fluency_coherence_band,
    lexicalResourceBand: row.lexical_resource_band,
    grammarBand: row.grammar_band,
    pronunciationBand: row.pronunciation_band,
    speakingBand: row.speaking_band,
    feedback: row.feedback,
    feedbackLanguage: row.feedback_language,
    modelAnswer: key?.model_answer ?? null,
    phonemeReport: row.phoneme_report,
  };
}

/** Service-role read of the secret keys (gated on proven ownership + status). */
async function loadQuestionKeys(questionIds: string[]): Promise<KeyRow[]> {
  if (questionIds.length === 0) return [];
  const admin = createTypedAdminClient();
  const { data, error } = await admin
    .from("ielts_question_keys")
    .select(
      "question_id, correct_answer, accept_variants, explanation_en, explanation_vi, model_answer, examiner_notes",
    )
    .in("question_id", questionIds);
  if (error) throw new Error(`loadAttemptResults(keys): ${error.message}`);
  return data ?? [];
}

type SessionClient = Awaited<ReturnType<typeof createTypedServerClient>>;
type BandScoreRow = Pick<Tables<"attempt_band_scores">, "listening_raw" | "reading_raw" | "listening_band" | "reading_band" | "writing_band" | "speaking_band">;

interface AttemptReads {
  bandScore: BandScoreRow | null;
  sections: Pick<Tables<"ielts_attempt_sections">, "skill" | "section_order">[];
  responses: ResponseRow[];
  questions: QuestionRow[];
  conversions: BandConversionRow[];
  passages: PassageRow[];
  listeningSections: ListeningSectionRow[];
  writing: WritingRow[];
  speaking: SpeakingRow[];
}

/** All learner-RLS reads for the attempt, run in parallel + error-checked. */
async function runAttemptReads(
  supabase: SessionClient,
  testId: string,
  attemptId: string,
  conversionKey: string,
): Promise<AttemptReads> {
  const [
    bandScore,
    sections,
    responses,
    questions,
    conversions,
    passages,
    listeningSections,
    writing,
    speaking,
  ] = await Promise.all([
      supabase
        .from("attempt_band_scores")
        .select(
          "listening_raw, reading_raw, listening_band, reading_band, writing_band, speaking_band",
        )
        .eq("attempt_id", attemptId)
        .maybeSingle(),
      supabase
        .from("ielts_attempt_sections")
        .select("skill, section_order")
        .eq("attempt_id", attemptId)
        .order("section_order"),
      supabase
        .from("ielts_question_responses")
        .select("question_id, response, is_correct, awarded_points")
        .eq("attempt_id", attemptId),
      supabase
        .from("ielts_questions")
        .select(QUESTION_COLUMNS)
        .eq("test_id", testId)
        .order("order_index"),
      supabase
        .from("band_conversions")
        .select("conversion_key, skill, module, band, raw_min, raw_max")
        .in("conversion_key", [...new Set(["default", conversionKey])])
        .in("skill", ["listening", "reading"]),
      supabase
        .from("passages")
        .select("id, title, body")
        .eq("test_id", testId)
        .order("order_index"),
      supabase
        .from("listening_sections")
        .select("id, title, script")
        .eq("test_id", testId)
        .order("section_number"),
      supabase.from("writing_responses").select(WRITING_COLUMNS).eq("attempt_id", attemptId),
      supabase.from("speaking_responses").select(SPEAKING_COLUMNS).eq("attempt_id", attemptId),
    ]);

  for (const result of [
    sections,
    responses,
    questions,
    conversions,
    passages,
    listeningSections,
    writing,
    speaking,
  ]) {
    if (result.error) throw new Error(`loadAttemptResults: ${result.error.message}`);
  }

  return {
    bandScore: bandScore.data ?? null,
    sections: sections.data ?? [],
    responses: responses.data ?? [],
    questions: questions.data ?? [],
    conversions: (conversions.data ?? []) as BandConversionRow[],
    passages: passages.data ?? [],
    listeningSections: listeningSections.data ?? [],
    writing: writing.data ?? [],
    speaking: speaking.data ?? [],
  };
}

/** The six stored skill rollups (immutable record), null-safe. */
function bandFields(row: BandScoreRow | null) {
  return {
    listeningRaw: row?.listening_raw ?? null,
    readingRaw: row?.reading_raw ?? null,
    listeningBand: row?.listening_band ?? null,
    readingBand: row?.reading_band ?? null,
    storedWritingBand: row?.writing_band ?? null,
    storedSpeakingBand: row?.speaking_band ?? null,
  };
}

/**
 * Assemble the results input bundle for a completed attempt, or null if the
 * caller does not own it (RLS returns no attempt row). The review (correct
 * answers + explanations) is withheld while the attempt is still in progress.
 */
export async function loadAttemptResults(
  attemptId: string,
): Promise<AttemptResultsInput | null> {
  const supabase = await createTypedServerClient();

  const { data: attempt, error } = await supabase
    .from("ielts_attempts")
    .select("id, test_id, module, status, submitted_at")
    .eq("id", attemptId)
    .maybeSingle();
  if (error) throw new Error(`loadAttemptResults(attempt): ${error.message}`);
  if (!attempt) return null;

  const { data: test } = await supabase
    .from("ielts_tests")
    .select("title, slug, metadata")
    .eq("id", attempt.test_id)
    .maybeSingle();

  const reads = await runAttemptReads(
    supabase,
    attempt.test_id,
    attemptId,
    resolveConversionKey(test?.metadata ?? null),
  );

  const questionById = new Map(reads.questions.map((question) => [question.id, question]));
  // Reveal keys only once the sitting has been submitted (never mid-attempt).
  const keys =
    attempt.status === "in_progress" || attempt.submitted_at === null
      ? []
      : await loadQuestionKeys(reads.questions.map((question) => question.id));
  const keyByQuestion = new Map(keys.map((key) => [key.question_id, key]));

  return {
    attemptId: attempt.id,
    testTitle: test?.title ?? "IELTS mock",
    testSlug: test?.slug ?? "",
    module: attempt.module,
    attemptStatus: attempt.status,
    submittedAt: attempt.submitted_at,
    skillsInTest: skillsInTest(reads.sections),
    ...bandFields(reads.bandScore),
    objectiveQuestions: buildObjectiveQuestions(
      reads.questions,
      reads.responses,
      keys,
      reads.passages,
      reads.listeningSections,
    ),
    bandConversions: reads.conversions,
    writingTasks: reads.writing.map((row) =>
      mapWritingTask(row, questionById.get(row.question_id), keyByQuestion.get(row.question_id)),
    ),
    speakingParts: reads.speaking.map((row) =>
      mapSpeakingPart(row, questionById.get(row.question_id), keyByQuestion.get(row.question_id)),
    ),
  };
}

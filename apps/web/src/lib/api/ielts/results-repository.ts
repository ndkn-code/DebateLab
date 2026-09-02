/* eslint-disable max-lines -- cohesive results projection and ownership boundary */
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
import { sanitizeLearnerGradingMetadata } from "@/lib/ielts/scoring-adjudication";
import { projectEffectiveBands } from "./effective-score-contract";
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
  "id, revision, question_id, task_number, status, essay, word_count, task_response_band, coherence_cohesion_band, lexical_resource_band, grammar_band, task_band, criteria_feedback, inline_corrections, paragraph_feedback, model_answer, feedback_language, grading_metadata";
const SPEAKING_COLUMNS =
  "id, revision, question_id, part_number, status, transcript, fluency_coherence_band, lexical_resource_band, grammar_band, pronunciation_band, speaking_band, feedback, feedback_language, phoneme_report, grading_metadata";

type ResponseRow = Pick<
  Tables<"ielts_question_responses">,
  "question_id" | "response" | "is_correct" | "awarded_points"
>;
type KeyRow = Pick<
  Tables<"ielts_question_keys">,
  | "question_id"
  | "correct_answer"
  | "accept_variants"
  | "explanation_en"
  | "explanation_vi"
  | "model_answer"
  | "examiner_notes"
>;
type QuestionRow = Pick<
  Tables<"ielts_questions">,
  | "id"
  | "question_type"
  | "skill"
  | "prompt"
  | "group_instructions"
  | "word_limit"
  | "max_points"
  | "options"
  | "visual"
  | "metadata"
  | "passage_id"
  | "listening_section_id"
  | "order_index"
>;
type FrozenQuestionRow = Pick<
  Tables<"ielts_attempt_question_blueprints">,
  | "question_id"
  | "question_type"
  | "skill"
  | "prompt"
  | "group_instructions"
  | "word_limit"
  | "max_points"
  | "options"
  | "visual"
  | "metadata"
  | "passage_id"
  | "listening_section_id"
  | "question_order"
  | "source_title"
  | "source_body"
  | "source_audio_asset_id"
  | "source_audio_storage_path"
  | "source_audio_version"
  | "source_audio_status"
>;
type WritingRow = Pick<
  Tables<"writing_responses">,
  | "id"
  | "revision"
  | "question_id"
  | "task_number"
  | "status"
  | "essay"
  | "word_count"
  | "task_response_band"
  | "coherence_cohesion_band"
  | "lexical_resource_band"
  | "grammar_band"
  | "task_band"
  | "criteria_feedback"
  | "inline_corrections"
  | "paragraph_feedback"
  | "model_answer"
  | "feedback_language"
  | "grading_metadata"
>;
type SpeakingRow = Pick<
  Tables<"speaking_responses">,
  | "id"
  | "revision"
  | "question_id"
  | "part_number"
  | "status"
  | "transcript"
  | "fluency_coherence_band"
  | "lexical_resource_band"
  | "grammar_band"
  | "pronunciation_band"
  | "speaking_band"
  | "feedback"
  | "feedback_language"
  | "phoneme_report"
  | "grading_metadata"
>;
type PassageRow = Pick<Tables<"passages">, "id" | "title" | "body">;
type ListeningSectionRow = Pick<
  Tables<"listening_sections">,
  "id" | "title" | "script"
>;
type ObjectiveSource = ResultsObjectiveQuestion["source"];
type PublishedReview = {
  writing_response_id: string | null;
  speaking_response_id: string | null;
  revision: number;
  task_number: number | null;
  part_number: number | null;
  reviewer_note: string | null;
  criterion_feedback: unknown;
  task_response_band: number | null;
  coherence_cohesion_band: number | null;
  lexical_resource_band: number | null;
  grammar_band: number | null;
  fluency_coherence_band: number | null;
  pronunciation_band: number | null;
  task_band: number | null;
  skill_band: number | null;
};

type PublishedBandKey =
  | "task_response_band"
  | "coherence_cohesion_band"
  | "lexical_resource_band"
  | "grammar_band"
  | "fluency_coherence_band"
  | "pronunciation_band"
  | "task_band"
  | "skill_band";

function effectivePublishedBand(
  review: PublishedReview | undefined,
  key: PublishedBandKey,
  aiBand: number | null,
): number | null {
  const teacherBand = review?.[key];
  return teacherBand === null || teacherBand === undefined
    ? aiBand
    : teacherBand;
}

/** The per-test conversion key (test.metadata.band_conversion_key) → 'default'. */
function resolveConversionKey(
  metadata: Tables<"ielts_tests">["metadata"],
): string {
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
  const responseByQuestion = new Map(
    responses.map((row) => [row.question_id, row]),
  );
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
        passage: question.passage_id
          ? (passageById.get(question.passage_id) ?? null)
          : null,
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
    return {
      kind: "listening",
      title: listening.title,
      text: listening.script,
    };
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
  review: PublishedReview | undefined,
): ResultsWritingTask {
  return {
    questionId: row.question_id,
    prompt: question?.prompt ?? null,
    taskNumber: row.task_number,
    status: row.status,
    essay: row.essay,
    wordCount: row.word_count,
    taskResponseBand: effectivePublishedBand(
      review,
      "task_response_band",
      null,
    ),
    coherenceCohesionBand: effectivePublishedBand(
      review,
      "coherence_cohesion_band",
      null,
    ),
    lexicalResourceBand: effectivePublishedBand(
      review,
      "lexical_resource_band",
      null,
    ),
    grammarBand: effectivePublishedBand(
      review,
      "grammar_band",
      null,
    ),
    taskBand: effectivePublishedBand(review, "task_band", null),
    criteriaFeedback: review ? row.criteria_feedback : {},
    inlineCorrections: review ? row.inline_corrections : [],
    paragraphFeedback: review ? row.paragraph_feedback : [],
    modelAnswer: key?.model_answer ?? row.model_answer,
    feedbackLanguage: row.feedback_language,
    gradingMetadata: sanitizeLearnerGradingMetadata(row.grading_metadata),
    teacherFeedback: review?.reviewer_note ?? null,
    teacherCriterionFeedback: review?.criterion_feedback ?? {},
  };
}

function mapSpeakingPart(
  row: SpeakingRow,
  question: QuestionRow | undefined,
  key: KeyRow | undefined,
  review: PublishedReview | undefined,
): ResultsSpeakingPart {
  return {
    questionId: row.question_id,
    prompt: question?.prompt ?? null,
    partNumber: row.part_number,
    status: row.status,
    transcript: row.transcript,
    fluencyCoherenceBand: effectivePublishedBand(
      review,
      "fluency_coherence_band",
      null,
    ),
    lexicalResourceBand: effectivePublishedBand(
      review,
      "lexical_resource_band",
      null,
    ),
    grammarBand: effectivePublishedBand(
      review,
      "grammar_band",
      null,
    ),
    pronunciationBand: effectivePublishedBand(
      review,
      "pronunciation_band",
      null,
    ),
    speakingBand: effectivePublishedBand(
      review,
      "skill_band",
      null,
    ),
    feedback: review ? row.feedback : null,
    feedbackLanguage: row.feedback_language,
    modelAnswer: key?.model_answer ?? null,
    phonemeReport: row.phoneme_report,
    gradingMetadata: sanitizeLearnerGradingMetadata(row.grading_metadata),
    teacherFeedback: review?.reviewer_note ?? null,
    teacherCriterionFeedback: review?.criterion_feedback ?? {},
  };
}

/** Service-role read of secret keys (gated on proven ownership + status). */
async function loadQuestionKeys(params: {
  questionIds: string[];
  attemptId: string;
  frozen: boolean;
}): Promise<KeyRow[]> {
  const { questionIds, attemptId, frozen } = params;
  if (questionIds.length === 0) return [];
  const admin = createTypedAdminClient();
  const { data, error } = frozen
    ? await admin
        .from("ielts_attempt_question_keys")
        .select(
          "question_id, correct_answer, accept_variants, explanation_en, explanation_vi, model_answer, examiner_notes",
        )
        .eq("attempt_id", attemptId)
        .in("question_id", questionIds)
    : await admin
        .from("ielts_question_keys")
        .select(
          "question_id, correct_answer, accept_variants, explanation_en, explanation_vi, model_answer, examiner_notes",
        )
        .in("question_id", questionIds);
  if (error) throw new Error(`loadAttemptResults(keys): ${error.message}`);
  return data ?? [];
}

type SessionClient = Awaited<ReturnType<typeof createTypedServerClient>>;
type BandScoreRow = Pick<
  Tables<"attempt_band_scores">,
  | "listening_raw"
  | "reading_raw"
  | "listening_band"
  | "reading_band"
  | "writing_band"
  | "speaking_band"
>;

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
  effectiveScore: Record<string, unknown> | null;
  publishedReviews: PublishedReview[];
}

function mapAttemptContent(
  questions: Array<QuestionRow | FrozenQuestionRow>,
  frozen: boolean,
  sourcePassages: PassageRow[],
  sourceListeningSections: ListeningSectionRow[],
): Pick<AttemptReads, "questions" | "passages" | "listeningSections"> {
  if (!frozen) {
    return {
      questions: questions as QuestionRow[],
      passages: sourcePassages,
      listeningSections: sourceListeningSections,
    };
  }
  const frozenQuestions = questions as FrozenQuestionRow[];
  const mappedQuestions = frozenQuestions.map((row) => ({
    id: row.question_id,
    question_type: row.question_type,
    skill: row.skill,
    prompt: row.prompt,
    group_instructions: row.group_instructions,
    word_limit: row.word_limit,
    max_points: row.max_points,
    options: row.options,
    visual: row.visual,
    metadata: row.metadata,
    passage_id: row.passage_id,
    listening_section_id: row.listening_section_id,
    order_index: row.question_order,
  }));
  const passages = new Map<string, PassageRow>();
  const listeningSections = new Map<string, ListeningSectionRow>();
  for (const row of frozenQuestions) {
    if (row.passage_id && row.source_body !== null) {
      passages.set(row.passage_id, {
        id: row.passage_id,
        title: row.source_title ?? "",
        body: row.source_body,
      });
    }
    if (row.listening_section_id && row.source_body !== null) {
      listeningSections.set(row.listening_section_id, {
        id: row.listening_section_id,
        title: row.source_title,
        script: row.source_body,
      });
    }
  }
  return {
    questions: mappedQuestions,
    passages: [...passages.values()],
    listeningSections: [...listeningSections.values()],
  };
}

function loadQuestionRead(
  supabase: SessionClient,
  testId: string,
  attemptId: string,
  frozen: boolean,
) {
  if (frozen) {
    return supabase
      .from("ielts_attempt_question_blueprints")
      .select(
        "question_id, question_type, skill, prompt, group_instructions, word_limit, max_points, options, visual, metadata, passage_id, listening_section_id, question_order, source_title, source_body, source_audio_asset_id, source_audio_storage_path, source_audio_version, source_audio_status",
      )
      .eq("attempt_id", attemptId)
      .order("question_order");
  }
  return supabase
    .from("ielts_questions")
    .select(QUESTION_COLUMNS)
    .eq("test_id", testId)
    .order("order_index");
}

function loadAttemptPassages(supabase: SessionClient, testId: string, frozen: boolean) {
  return frozen
    ? Promise.resolve({ data: [], error: null })
    : supabase
        .from("passages")
        .select("id, title, body")
        .eq("test_id", testId)
        .order("order_index");
}

function loadAttemptListeningSections(
  supabase: SessionClient,
  testId: string,
  frozen: boolean,
) {
  return frozen
    ? Promise.resolve({ data: [], error: null })
    : supabase
        .from("listening_sections")
        .select("id, title, script")
        .eq("test_id", testId)
        .order("section_number");
}

function validateAttemptReads(
  results: Array<{ error: { message: string } | null }>,
): void {
  for (const result of results) {
    if (result.error) {
      throw new Error(`loadAttemptResults: ${result.error.message}`);
    }
  }
}

/** All learner-RLS reads for the attempt, run in parallel + error-checked. */
async function runAttemptReads(
  supabase: SessionClient,
  testId: string,
  attemptId: string,
  conversionKey: string,
  frozen: boolean,
): Promise<AttemptReads> {
  const questionRead = loadQuestionRead(supabase, testId, attemptId, frozen);
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
    effectiveScore,
    publishedReviews,
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
    questionRead,
    supabase
      .from("band_conversions")
      .select("conversion_key, skill, module, band, raw_min, raw_max")
      .in("conversion_key", [...new Set(["default", conversionKey])])
      .in("skill", ["listening", "reading"]),
    loadAttemptPassages(supabase, testId, frozen),
    loadAttemptListeningSections(supabase, testId, frozen),
    supabase
      .from("writing_responses")
      .select(WRITING_COLUMNS)
      .eq("attempt_id", attemptId),
    supabase
      .from("speaking_responses")
      .select(SPEAKING_COLUMNS)
      .eq("attempt_id", attemptId),
    (supabase as unknown as import("@supabase/supabase-js").SupabaseClient)
      .from("ielts_effective_attempt_scores")
      .select(
        "listening_band, reading_band, writing_band, speaking_band, overall_band, provisional_band, overall_is_provisional, score_source",
      )
      .eq("attempt_id", attemptId)
      .maybeSingle(),
    (supabase as unknown as import("@supabase/supabase-js").SupabaseClient)
      .from("ielts_teacher_reviews")
      .select(
        "writing_response_id, speaking_response_id, revision, task_number, part_number, reviewer_note, criterion_feedback, task_response_band, coherence_cohesion_band, lexical_resource_band, grammar_band, fluency_coherence_band, pronunciation_band, task_band, skill_band",
      )
      .eq("attempt_id", attemptId)
      .eq("status", "published")
      .order("published_at", { ascending: false }),
  ]);

  validateAttemptReads([
    sections,
    responses,
    questions,
    conversions,
    passages,
    listeningSections,
    writing,
    speaking,
    effectiveScore,
    publishedReviews,
  ]);

  const questionRows = (questions.data ?? []) as Array<
    QuestionRow | FrozenQuestionRow
  >;
  const content = mapAttemptContent(
    questionRows,
    frozen,
    passages.data ?? [],
    listeningSections.data ?? [],
  );
  return {
    bandScore: bandScore.data ?? null,
    sections: sections.data ?? [],
    responses: responses.data ?? [],
    questions: content.questions,
    conversions: (conversions.data ?? []) as BandConversionRow[],
    passages: content.passages,
    listeningSections: content.listeningSections,
    writing: writing.data ?? [],
    speaking: speaking.data ?? [],
    effectiveScore:
      (effectiveScore.data as Record<string, unknown> | null) ?? null,
    publishedReviews: (publishedReviews.data ?? []) as PublishedReview[],
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

function publishedReviewIndexes(reviews: PublishedReview[]): {
  byResponse: Map<string, PublishedReview>;
  writingTasks: Set<number>;
  speakingParts: Set<number>;
} {
  const byResponse = new Map<string, PublishedReview>();
  const writingTasks = new Set<number>();
  const speakingParts = new Set<number>();
  for (const review of reviews) {
    const responseId = review.writing_response_id ?? review.speaking_response_id;
    if (responseId && !byResponse.has(`${responseId}:${review.revision}`)) {
      byResponse.set(`${responseId}:${review.revision}`, review);
    }
    if (review.writing_response_id && (review.task_number === 1 || review.task_number === 2)) {
      writingTasks.add(review.task_number);
    }
    if (
      review.speaking_response_id &&
      (review.part_number === 1 || review.part_number === 2 || review.part_number === 3)
    ) {
      speakingParts.add(review.part_number);
    }
  }
  return { byResponse, writingTasks, speakingParts };
}

function publishedScoreVisibility(reviews: PublishedReview[]): {
  writing: boolean;
  speaking: boolean;
  allSubjective: boolean;
} {
  const indexes = publishedReviewIndexes(reviews);
  const writing = indexes.writingTasks.has(1) && indexes.writingTasks.has(2);
  const speaking = indexes.speakingParts.size === 3;
  return { writing, speaking, allSubjective: writing && speaking };
}

async function loadSubmittedQuestionKeys(
  attempt: { status: string; submitted_at: string | null; blueprint_frozen_at: string | null },
  reads: AttemptReads,
  attemptId: string,
): Promise<KeyRow[]> {
  if (attempt.status === "in_progress" || attempt.submitted_at === null) return [];
  return loadQuestionKeys({
    questionIds: reads.questions.map((question) => question.id),
    attemptId,
    frozen: Boolean(attempt.blueprint_frozen_at),
  });
}

function visibleScoreFields(
  effective: ReturnType<typeof projectEffectiveBands>,
  visibility: ReturnType<typeof publishedScoreVisibility>,
) {
  return {
    storedWritingBand: visibility.writing ? effective.writingBand : null,
    storedSpeakingBand: visibility.speaking ? effective.speakingBand : null,
    publishedOverallBand: visibility.allSubjective ? effective.overallBand : null,
    provisionalBand: visibility.allSubjective ? effective.provisionalBand : null,
    overallIsProvisional: !visibility.allSubjective || effective.overallIsProvisional,
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
    .select(
      "id, user_id, test_id, module, status, submitted_at, blueprint_frozen_at",
    )
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
    Boolean(attempt.blueprint_frozen_at),
  );

  const questionById = new Map(
    reads.questions.map((question) => [question.id, question]),
  );
  // Reveal keys only once the sitting has been submitted (never mid-attempt).
  const keys = await loadSubmittedQuestionKeys(attempt, reads, attemptId);
  const keyByQuestion = new Map(keys.map((key) => [key.question_id, key]));
  const effective = projectEffectiveBands(
    reads.effectiveScore,
    reads.bandScore as unknown as Record<string, unknown> | null,
  );
  const reviewIndexes = publishedReviewIndexes(reads.publishedReviews);
  const scoreVisibility = publishedScoreVisibility(reads.publishedReviews);

  return {
    attemptId: attempt.id,
    userId: attempt.user_id,
    testTitle: test?.title ?? "IELTS mock",
    testSlug: test?.slug ?? "",
    module: attempt.module,
    attemptStatus: attempt.status,
    submittedAt: attempt.submitted_at,
    skillsInTest: skillsInTest(reads.sections),
    ...bandFields(reads.bandScore),
    listeningBand: effective.listeningBand,
    readingBand: effective.readingBand,
    ...visibleScoreFields(effective, scoreVisibility),
    scoreSource: effective.scoreSource,
    objectiveQuestions: buildObjectiveQuestions(
      reads.questions,
      reads.responses,
      keys,
      reads.passages,
      reads.listeningSections,
    ),
    bandConversions: reads.conversions,
    writingTasks: reads.writing.map((row) =>
      mapWritingTask(
        row,
        questionById.get(row.question_id),
        keyByQuestion.get(row.question_id),
        reviewIndexes.byResponse.get(`${row.id}:${row.revision}`),
      ),
    ),
    speakingParts: reads.speaking.map((row) =>
      mapSpeakingPart(
        row,
        questionById.get(row.question_id),
        keyByQuestion.get(row.question_id),
        reviewIndexes.byResponse.get(`${row.id}:${row.revision}`),
      ),
    ),
  };
}

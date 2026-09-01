/**
 * Objective grading orchestration (WS-2.1, server-only). Reads the secret answer
 * keys with the SERVICE-ROLE client (the only client that may read
 * `ielts_question_keys`), runs the pure grader (lib/scoring/ielts), and persists
 * per-question results + the per-skill band rollup. Writing/Speaking are left
 * `pending` for WS-3.x. Idempotent: re-grading upserts.
 */
import "server-only";
import { createTypedAdminClient } from "@/lib/supabase/admin";
import type { Json, Tables } from "@/types/supabase";
import {
  gradeObjectiveAttempt,
  type AttemptGrade,
  type GradableQuestion,
} from "@/lib/scoring/ielts/grade-objective";
import type {
  BandConversionRow,
  IeltsModule,
} from "@/lib/scoring/ielts/band-conversion";
import type { ObjectiveKey } from "@/lib/scoring/ielts/objective-scoring";
import { parseQuestionView } from "@/lib/ielts/question-types";
import { recomputeAttemptOverallBand } from "./overall-band-repository";
import { completeSimulationAttemptIfReady } from "./band-scores-repository";
import { recordIeltsObjectiveAttemptEvidence } from "./assess-evidence";
import { maybeReplanAfterEvidence } from "./replan-hook";
import { isFrozenObjectiveBlueprintMissing } from "./objective-blueprint";

type AdminClient = ReturnType<typeof createTypedAdminClient>;

const OBJECTIVE_SKILLS = ["listening", "reading"] as const;

function resolveConversionKey(
  metadata: Tables<"ielts_tests">["metadata"] | undefined,
): string {
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    const value = (metadata as Record<string, unknown>).band_conversion_key;
    if (typeof value === "string" && value.length > 0) return value;
  }
  return "default";
}

interface GradingInputs {
  attempt: Pick<
    Tables<"ielts_attempts">,
    "id" | "user_id" | "test_id" | "module" | "status" | "blueprint_frozen_at"
  >;
  questions: GradableQuestion[];
  responseIdByQuestion: Map<string, string>;
  grade: AttemptGrade;
}

async function loadObjectiveKeys(params: {
  admin: AdminClient;
  attemptId: string;
  questionIds: string[];
  frozen: boolean;
}): Promise<Map<string, ObjectiveKey>> {
  if (params.questionIds.length === 0) return new Map();

  let rows: Array<{
    question_id: string;
    correct_answer: Json;
    accept_variants: Json;
  }>;
  if (params.frozen) {
    const { data, error } = await params.admin
      .from("ielts_attempt_question_keys")
      .select("question_id, correct_answer, accept_variants")
      .eq("attempt_id", params.attemptId)
      .in("question_id", params.questionIds);
    if (error) throw new Error(`grade(frozen keys): ${error.message}`);
    rows = data ?? [];
  } else {
    const { data, error } = await params.admin
      .from("ielts_question_keys")
      .select("question_id, correct_answer, accept_variants")
      .in("question_id", params.questionIds);
    if (error) throw new Error(`grade(keys): ${error.message}`);
    rows = data ?? [];
  }
  return new Map(
    rows.map((key) => [
      key.question_id,
      {
        correct_answer: key.correct_answer,
        accept_variants: key.accept_variants,
      },
    ]),
  );
}

async function loadAndGrade(
  admin: AdminClient,
  attemptId: string,
): Promise<GradingInputs> {
  const { data: attempt, error } = await admin
    .from("ielts_attempts")
    .select("id, user_id, test_id, module, status, blueprint_frozen_at")
    .eq("id", attemptId)
    .maybeSingle();
  if (error) throw new Error(`grade(attempt): ${error.message}`);
  if (!attempt) throw new Error("grade: attempt not found");
  if (!["submitted", "scoring", "completed"].includes(attempt.status)) {
    throw new Error("grade: attempt is not ready for grading");
  }

  const { data: test } = await admin
    .from("ielts_tests")
    .select("metadata")
    .eq("id", attempt.test_id)
    .maybeSingle();
  const conversionKey = resolveConversionKey(test?.metadata);

  const [snapshotRes, objectiveSectionRes, responseRes, bandRes] =
    await Promise.all([
      admin
        .from("ielts_attempt_question_blueprints")
        .select(
          "id, question_id, skill, question_type, prompt, group_instructions, max_points, word_limit, options, visual, metadata, question_order, group_key, passage_id, listening_section_id, test_id, source_updated_at",
        )
        .eq("attempt_id", attemptId)
        .in("skill", OBJECTIVE_SKILLS)
        .order("question_order"),
      admin
        .from("ielts_attempt_sections")
        .select("skill")
        .eq("attempt_id", attemptId)
        .in("skill", OBJECTIVE_SKILLS),
      admin
        .from("ielts_question_responses")
        .select("id, question_id, response")
        .eq("attempt_id", attemptId),
      admin
        .from("band_conversions")
        .select("conversion_key, skill, module, band, raw_min, raw_max")
        .in("conversion_key", [...new Set(["default", conversionKey])])
        .in("skill", OBJECTIVE_SKILLS),
    ]);
  if (snapshotRes.error)
    throw new Error(`grade(blueprint): ${snapshotRes.error.message}`);
  if (objectiveSectionRes.error)
    throw new Error(`grade(sections): ${objectiveSectionRes.error.message}`);
  if (responseRes.error)
    throw new Error(`grade(responses): ${responseRes.error.message}`);
  if (bandRes.error) throw new Error(`grade(bands): ${bandRes.error.message}`);

  const snapshotRows = snapshotRes.data ?? [];
  if (
    isFrozenObjectiveBlueprintMissing({
      frozen: Boolean(attempt.blueprint_frozen_at),
      objectiveSectionCount: objectiveSectionRes.data?.length ?? 0,
      objectiveBlueprintCount: snapshotRows.length,
    })
  ) {
    throw new Error("grade: frozen attempt blueprint missing");
  }
  // Attempts created before the frozen-blueprint migration retain a bounded
  // compatibility path. New attempts always have snapshot rows.
  const questionRows = snapshotRows.length
    ? snapshotRows.map((row) => ({ ...row, id: row.question_id }))
    : ((
        await admin
          .from("ielts_questions")
          .select(
            "id, skill, question_type, prompt, group_instructions, max_points, word_limit, options, visual, metadata",
          )
          .eq("test_id", attempt.test_id)
          .in("skill", OBJECTIVE_SKILLS)
      ).data ?? []);

  const questions: GradableQuestion[] = questionRows.map((q) => {
    const view = parseQuestionView(q);
    return {
      id: q.id,
      skill: q.skill,
      questionType: q.question_type,
      maxPoints: q.max_points,
      wordLimit: q.word_limit,
      family: view.family,
      hasOptionBank: view.options.length > 0,
      selectCount: view.selectCount,
    };
  });

  const responseRows = responseRes.data ?? [];
  const questionIds = questions.map((q) => q.id);
  const keys = await loadObjectiveKeys({
    admin,
    attemptId,
    questionIds,
    frozen: snapshotRows.length > 0,
  });
  const responses = new Map<string, unknown>(
    responseRows.map((r) => [r.question_id, r.response]),
  );

  const grade = gradeObjectiveAttempt({
    questions,
    keys,
    responses,
    module: attempt.module as IeltsModule,
    bandRows: (bandRes.data ?? []) as BandConversionRow[],
  });

  return {
    attempt,
    questions,
    responseIdByQuestion: new Map(
      responseRows.map((r) => [r.question_id, r.id]),
    ),
    grade,
  };
}

async function persist(
  admin: AdminClient,
  inputs: GradingInputs,
): Promise<void> {
  const { attempt, responseIdByQuestion, grade } = inputs;
  const nowIso = new Date().toISOString();

  await Promise.all(
    grade.graded.map((g) => {
      const rowId = responseIdByQuestion.get(g.questionId);
      if (!rowId) return Promise.resolve(undefined);
      return admin
        .from("ielts_question_responses")
        .update({
          is_correct: g.isCorrect,
          awarded_points: g.awardedPoints,
          graded_at: nowIso,
          updated_at: nowIso,
        })
        .eq("id", rowId)
        .eq("attempt_id", attempt.id)
        .eq("question_id", g.questionId)
        .then(({ error }) => {
          if (error) throw new Error(`grade(response): ${error.message}`);
        });
    }),
  );

  const { error: bandError } = await admin.from("attempt_band_scores").upsert(
    {
      attempt_id: attempt.id,
      user_id: attempt.user_id,
      listening_raw: grade.listeningRaw,
      reading_raw: grade.readingRaw,
      listening_band: grade.bands.listeningBand,
      reading_band: grade.bands.readingBand,
      computed_at: nowIso,
      updated_at: nowIso,
    },
    { onConflict: "attempt_id" },
  );
  if (bandError) throw new Error(`grade(band upsert): ${bandError.message}`);

  // The cross-skill overall is owned by the results layer (WS-2.2): recompute it
  // from all four skill bands so it stays correct as Writing/Speaking land.
  await recomputeAttemptOverallBand(admin, attempt.id, attempt.user_id);

  // Writing is required for simulation completion; Speaking remains optional.
  // The Writing scorer invokes the same gate after its band lands.
  await completeSimulationAttemptIfReady(admin, attempt.id);
}

/** Grade an attempt's objective responses and persist results + bands. */
export async function gradeAttemptObjective(
  attemptId: string,
): Promise<AttemptGrade> {
  const admin = createTypedAdminClient();
  const { data: gradingAttempt, error: gradingError } = await admin
    .from("ielts_attempts")
    .update({ status: "scoring", updated_at: new Date().toISOString() })
    .eq("id", attemptId)
    .eq("status", "submitted")
    .select("id")
    .maybeSingle();
  if (gradingError) throw new Error(`grade(claim): ${gradingError.message}`);
  // A completed attempt is safe to re-grade idempotently; an in-progress or
  // terminal attempt is not. A concurrent worker may already own scoring.
  if (!gradingAttempt) {
    const { data: existing, error: existingError } = await admin
      .from("ielts_attempts")
      .select("status")
      .eq("id", attemptId)
      .maybeSingle();
    if (existingError)
      throw new Error(`grade(state): ${existingError.message}`);
    if (!existing || !["scoring", "completed"].includes(existing.status)) {
      throw new Error("grade: attempt is not submitted");
    }
  }
  const inputs = await loadAndGrade(admin, attemptId);
  await persist(admin, inputs);
  await recordIeltsObjectiveAttemptEvidence({ client: admin, attemptId });
  // WS-6.2.4: adapt the learner's future plan to the fresh result (best-effort;
  // never throws, so grading is unaffected if the replan fails).
  await maybeReplanAfterEvidence({
    client: admin,
    userId: inputs.attempt.user_id,
    trigger: "attempt_graded",
    source: { type: "ielts_attempt", id: attemptId },
  });
  return inputs.grade;
}

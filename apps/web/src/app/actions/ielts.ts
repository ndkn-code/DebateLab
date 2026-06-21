"use server";

/**
 * IELTS server actions.
 *
 * Two surfaces share this module:
 *  - Content authoring (WS-1.1): an admin-guarded mutation surface for the
 *    authoring UI. Every action: verify admin → call the canonical
 *    lib/api/ielts create/update path (typed + Zod) → log → revalidate. Data
 *    access lives in lib/api/ielts, never inline here.
 *  - Objective grading (WS-1.2): submit one answer → receive a server-graded,
 *    key-free verdict (Learn-mode immediate feedback). Grading is
 *    server-authoritative; the answer key is read only on the server
 *    (service-role) and never returned.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Json } from "@/types/supabase";
import { parseInput } from "@/lib/api/boundary";
import { createTypedServerClient } from "@/lib/supabase/server";
import { generateListeningSectionAudio } from "@/lib/ielts/listening-audio/generate";
import { backfillListeningSectionAudio } from "@/lib/ielts/listening-audio/backfill";
import { gradeQuestionResponse } from "@/lib/api/ielts/grading-repository";
import type { IeltsVerdict } from "@/lib/ielts/question-types/types";
import {
  createBandConversion,
  deleteBandConversionTable,
  replaceBandConversionTable,
} from "@/lib/api/ielts/band-conversions-repository";
import { DeleteBandConversionTableSchema } from "@/lib/api/ielts/content-schema";
import {
  createListeningSection,
  deleteListeningSection,
  updateListeningSection,
} from "@/lib/api/ielts/listening-repository";
import { createPassage, deletePassage, updatePassage } from "@/lib/api/ielts/passages-repository";
import { createQuestion, deleteQuestion, updateQuestion } from "@/lib/api/ielts/questions-repository";
import {
  createIeltsTest,
  transitionIeltsTestStatus,
  updateIeltsTest,
} from "@/lib/api/ielts/tests-repository";
import { snapshotTestVersion } from "@/lib/api/ielts/versions-repository";
import type { IeltsContentStatus } from "@/lib/api/ielts/workflow";
import {
  generateMicroItemDraftsForQuestion,
  publishMicroItemDraft,
  reviewMicroItemDraft,
  updateMicroItemDraft,
} from "@/lib/ielts/micro-drafts/repository";

type TypedServerClient = Awaited<ReturnType<typeof createTypedServerClient>>;

async function requireAdmin(): Promise<{ supabase: TypedServerClient; adminId: string }> {
  const supabase = await createTypedServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") throw new Error("Forbidden");
  return { supabase, adminId: user.id };
}

async function logIelts(
  supabase: TypedServerClient,
  adminId: string,
  action: string,
  entityType: string,
  entityId: string | null,
  changes: Json = {},
): Promise<void> {
  await supabase.from("admin_activity_log").insert({
    admin_user_id: adminId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    changes,
  });
}

function revalidateTest(testId?: string): void {
  revalidatePath("/dashboard/admin/ielts");
  if (testId) revalidatePath(`/dashboard/admin/ielts/${testId}`);
}

// --- Objective grading (learner-facing, WS-1.2) ---------------------------

/**
 * Submit one objective IELTS answer and receive a server-graded, key-free
 * verdict (Learn-mode immediate feedback).
 *
 * Grading is server-authoritative: the answer key is read only on the server
 * (service-role) and never returned. WS-2.1 owns persisting responses inside a
 * timed attempt — this action only grades, it does not write.
 */
export async function submitIeltsAnswer(raw: unknown): Promise<IeltsVerdict> {
  const supabase = await createTypedServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  return gradeQuestionResponse(raw);
}

// --- Tests + workflow -----------------------------------------------------

export async function createIeltsTestAction(input: unknown) {
  const { supabase, adminId } = await requireAdmin();
  const test = await createIeltsTest(input, { authorId: adminId }, supabase);
  await logIelts(supabase, adminId, "create_ielts_test", "ielts_test", test.id, { slug: test.slug });
  revalidateTest(test.id);
  return test;
}

export async function updateIeltsTestAction(testId: string, input: unknown) {
  const { supabase, adminId } = await requireAdmin();
  const test = await updateIeltsTest(testId, input, supabase);
  await logIelts(supabase, adminId, "update_ielts_test", "ielts_test", testId);
  revalidateTest(testId);
  return test;
}

export async function transitionIeltsTestStatusAction(
  testId: string,
  toStatus: IeltsContentStatus,
  note?: string,
) {
  const { supabase, adminId } = await requireAdmin();
  const test = await transitionIeltsTestStatus(
    testId,
    toStatus,
    { reviewerId: adminId, note: note ?? null },
    supabase,
  );
  await logIelts(supabase, adminId, "transition_ielts_test", "ielts_test", testId, { toStatus });
  revalidateTest(testId);
  return test;
}

export async function snapshotIeltsTestVersionAction(testId: string, note?: string) {
  const { supabase, adminId } = await requireAdmin();
  const version = await snapshotTestVersion(testId, { note: note ?? null, createdBy: adminId }, supabase);
  await logIelts(supabase, adminId, "snapshot_ielts_test", "ielts_test", testId, {
    version: version.version,
  });
  revalidateTest(testId);
  return version;
}

// --- Passages -------------------------------------------------------------

export async function createPassageAction(input: unknown) {
  const { supabase, adminId } = await requireAdmin();
  const passage = await createPassage(input, supabase);
  await logIelts(supabase, adminId, "create_ielts_passage", "ielts_passage", passage.id);
  revalidateTest(passage.test_id);
  return passage;
}

export async function updatePassageAction(passageId: string, input: unknown) {
  const { supabase, adminId } = await requireAdmin();
  const passage = await updatePassage(passageId, input, supabase);
  await logIelts(supabase, adminId, "update_ielts_passage", "ielts_passage", passageId);
  revalidateTest(passage.test_id);
  return passage;
}

export async function deletePassageAction(passageId: string, testId: string) {
  const { supabase, adminId } = await requireAdmin();
  await deletePassage(passageId, supabase);
  await logIelts(supabase, adminId, "delete_ielts_passage", "ielts_passage", passageId);
  revalidateTest(testId);
}

// --- Listening sections ---------------------------------------------------

export async function createListeningSectionAction(input: unknown) {
  const { supabase, adminId } = await requireAdmin();
  const section = await createListeningSection(input, supabase);
  await logIelts(supabase, adminId, "create_ielts_listening_section", "ielts_listening_section", section.id);
  revalidateTest(section.test_id);
  return section;
}

export async function updateListeningSectionAction(sectionId: string, input: unknown) {
  const { supabase, adminId } = await requireAdmin();
  const section = await updateListeningSection(sectionId, input, supabase);
  await logIelts(supabase, adminId, "update_ielts_listening_section", "ielts_listening_section", sectionId);
  revalidateTest(section.test_id);
  return section;
}

export async function deleteListeningSectionAction(sectionId: string, testId: string) {
  const { supabase, adminId } = await requireAdmin();
  await deleteListeningSection(sectionId, supabase);
  await logIelts(supabase, adminId, "delete_ielts_listening_section", "ielts_listening_section", sectionId);
  revalidateTest(testId);
}

const GenerateListeningAudioSchema = z.object({
  sectionId: z.string().uuid(),
  testId: z.string().uuid().optional(),
  force: z.boolean().optional(),
});

/**
 * Generate (or regenerate) a Listening section's multi-accent audio (WS-1.3):
 * synthesize the authored script, store one MP3, link it, and drive the asset
 * status. Synthesis + storage run under the service-role client inside the
 * generator; this action only gates on admin and logs the outcome.
 */
export async function generateListeningAudioAction(rawInput: unknown) {
  const { supabase, adminId } = await requireAdmin();
  const { sectionId, testId, force } = parseInput(GenerateListeningAudioSchema, rawInput);
  const result = await generateListeningSectionAudio(sectionId, { force });
  await logIelts(supabase, adminId, "generate_ielts_listening_audio", "ielts_listening_section", sectionId, {
    status: result.status,
    skipped: result.skipped,
    queued: result.queued,
    version: result.version,
  });
  revalidateTest(testId);
  return result;
}

const BackfillListeningAudioSchema = z.object({
  testId: z.string().uuid().optional(),
  force: z.boolean().optional(),
});

/**
 * Backfill audio for every Listening section that needs it (WS-1.3): the demo
 * mock and any other already-authored sections shipped script-only. Generates
 * the missing audio, skips unchanged ready sections, and queues sections whose
 * accent needs an unconfigured provider (AUS → Google) instead of failing. One
 * test when `testId` is given, else all. Returns a per-outcome summary.
 */
export async function backfillListeningAudioAction(rawInput: unknown) {
  const { supabase, adminId } = await requireAdmin();
  const { testId, force } = parseInput(BackfillListeningAudioSchema, rawInput);
  const summary = await backfillListeningSectionAudio({ testId: testId ?? null, force });
  await logIelts(
    supabase,
    adminId,
    "backfill_ielts_listening_audio",
    "ielts_test",
    testId ?? null,
    {
      total: summary.total,
      generated: summary.generated,
      skipped: summary.skipped,
      queued: summary.queued,
      failed: summary.failed,
      missingProviders: summary.missingProviders,
    },
  );
  revalidateTest(testId);
  return summary;
}

// --- Questions ------------------------------------------------------------

export async function createQuestionAction(input: unknown) {
  const { supabase, adminId } = await requireAdmin();
  const question = await createQuestion(input, supabase);
  await logIelts(supabase, adminId, "create_ielts_question", "ielts_question", question.id, {
    type: question.question_type,
  });
  revalidateTest(question.test_id);
  return question;
}

export async function updateQuestionAction(input: unknown) {
  const { supabase, adminId } = await requireAdmin();
  const question = await updateQuestion(input, supabase);
  await logIelts(supabase, adminId, "update_ielts_question", "ielts_question", question.id);
  revalidateTest(question.test_id);
  return question;
}

export async function deleteQuestionAction(questionId: string, testId: string) {
  const { supabase, adminId } = await requireAdmin();
  await deleteQuestion(questionId, supabase);
  await logIelts(supabase, adminId, "delete_ielts_question", "ielts_question", questionId);
  revalidateTest(testId);
}

// --- Micro-item draft queue -----------------------------------------------

export async function generateMicroItemDraftsAction(input: unknown) {
  const { supabase, adminId } = await requireAdmin();
  const drafts = await generateMicroItemDraftsForQuestion(input, {
    adminId,
    client: supabase,
  });
  const testId = drafts[0]?.test_id ?? undefined;
  await logIelts(supabase, adminId, "generate_ielts_micro_item_drafts", "ielts_question", null, {
    count: drafts.length,
    questionId: drafts[0]?.source_question_id ?? null,
  });
  revalidateTest(testId);
  return drafts;
}

export async function updateMicroItemDraftAction(input: unknown) {
  const { supabase, adminId } = await requireAdmin();
  const draft = await updateMicroItemDraft(input, { adminId, client: supabase });
  await logIelts(
    supabase,
    adminId,
    "update_ielts_micro_item_draft",
    "ielts_micro_item_draft",
    draft.id,
    { status: draft.status },
  );
  revalidateTest(draft.test_id ?? undefined);
  return draft;
}

export async function reviewMicroItemDraftAction(input: unknown) {
  const { supabase, adminId } = await requireAdmin();
  const draft = await reviewMicroItemDraft(input, { adminId, client: supabase });
  await logIelts(
    supabase,
    adminId,
    "review_ielts_micro_item_draft",
    "ielts_micro_item_draft",
    draft.id,
    { status: draft.status },
  );
  revalidateTest(draft.test_id ?? undefined);
  return draft;
}

export async function publishMicroItemDraftAction(input: unknown) {
  const { supabase, adminId } = await requireAdmin();
  const result = await publishMicroItemDraft(input, { adminId, client: supabase });
  await logIelts(
    supabase,
    adminId,
    "publish_ielts_micro_item_draft",
    "ielts_micro_item_draft",
    result.draft.id,
    { activityId: result.activityId },
  );
  revalidateTest(result.draft.test_id ?? undefined);
  revalidatePath("/dashboard/admin/courses");
  return result;
}

// --- Band conversions -----------------------------------------------------

export async function createBandConversionAction(input: unknown) {
  const { supabase, adminId } = await requireAdmin();
  const row = await createBandConversion(input, supabase);
  await logIelts(supabase, adminId, "create_ielts_band_conversion", "ielts_band_conversion", row.id);
  revalidateTest();
  return row;
}

function revalidateBandConversions(): void {
  revalidatePath("/dashboard/admin/ielts/band-conversions");
}

/** Replace an entire (conversion_key, skill, module) band table (WS-2.2). */
export async function replaceBandConversionTableAction(input: unknown) {
  const { supabase, adminId } = await requireAdmin();
  const rows = await replaceBandConversionTable(input, supabase);
  await logIelts(
    supabase,
    adminId,
    "replace_ielts_band_conversion_table",
    "ielts_band_conversion",
    null,
    { count: rows.length },
  );
  revalidateBandConversions();
  return rows;
}

/** Delete an entire (conversion_key, skill, module) band table (WS-2.2). */
export async function deleteBandConversionTableAction(input: unknown) {
  const { supabase, adminId } = await requireAdmin();
  const parsed = parseInput(DeleteBandConversionTableSchema, input);
  await deleteBandConversionTable(
    { conversionKey: parsed.conversionKey, skill: parsed.skill, module: parsed.module ?? null },
    supabase,
  );
  await logIelts(
    supabase,
    adminId,
    "delete_ielts_band_conversion_table",
    "ielts_band_conversion",
    null,
    { conversionKey: parsed.conversionKey, skill: parsed.skill },
  );
  revalidateBandConversions();
}

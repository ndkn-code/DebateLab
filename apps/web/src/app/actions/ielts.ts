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
import type { Json } from "@/types/supabase";
import { createTypedServerClient } from "@/lib/supabase/server";
import { gradeQuestionResponse } from "@/lib/api/ielts/grading-repository";
import type { IeltsVerdict } from "@/lib/ielts/question-types/types";
import {
  createBandConversion,
  deleteBandConversionTable,
  replaceBandConversionTable,
} from "@/lib/api/ielts/band-conversions-repository";
import { parseInput } from "@/lib/api/boundary";
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

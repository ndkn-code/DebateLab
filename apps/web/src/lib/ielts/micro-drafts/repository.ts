import "server-only";

import type { Json, TablesUpdate } from "@/types/supabase";
import { parseInput } from "@/lib/api/boundary";
import { resolveIeltsClient, type IeltsDbClient } from "@/lib/api/ielts/client";
import { buildMicroDraftPrompt } from "./prompt";
import { runMicroDraftModel } from "./provider";
import { buildMicroDraftInsert, buildPublishedActivityInsert } from "./model";
import {
  GenerateMicroItemDraftsSchema,
  IeltsMicroDraftAnswerKeySchema,
  IeltsMicroDraftPublicContentSchema,
  PublishMicroItemDraftSchema,
  ReviewMicroItemDraftSchema,
  UpdateMicroItemDraftSchema,
  assertContentMatchesAnswerKey,
  type IeltsMicroDraftAnswerKey,
  type IeltsMicroDraftPublicContent,
} from "./schema";
import { loadQuestionSource } from "./source";
import type {
  MicroItemDraftRow,
  MicroItemDraftView,
  MicroItemPublishTarget,
} from "./types";

export async function generateMicroItemDraftsForQuestion(
  rawInput: unknown,
  params: { adminId: string; client?: IeltsDbClient },
): Promise<MicroItemDraftRow[]> {
  const input = parseInput(GenerateMicroItemDraftsSchema, rawInput);
  const supabase = await resolveIeltsClient(params.client);
  const source = await loadQuestionSource(input.questionId, supabase);
  const prompt = buildMicroDraftPrompt(source);
  const result = await runMicroDraftModel({
    prompt,
    audit: { userId: params.adminId, questionId: source.questionId },
  });
  const generatedAt = new Date().toISOString();
  const inserts = result.drafts.map((draft) =>
    buildMicroDraftInsert({
      source,
      draft,
      audit: {
        providerLabel: result.providerLabel,
        modelName: result.modelName,
        generatedAt,
      },
      createdBy: params.adminId,
    }),
  );

  const { data, error } = await supabase
    .from("ielts_micro_item_drafts")
    .insert(inserts)
    .select();
  if (error) throw new Error(`generateMicroItemDraftsForQuestion failed: ${error.message}`);
  return data ?? [];
}

export async function listMicroItemDraftsForTest(
  testId: string,
  client?: IeltsDbClient,
): Promise<MicroItemDraftView[]> {
  const supabase = await resolveIeltsClient(client);
  const { data: drafts, error } = await supabase
    .from("ielts_micro_item_drafts")
    .select()
    .eq("test_id", testId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listMicroItemDraftsForTest failed: ${error.message}`);
  const rows = drafts ?? [];
  if (rows.length === 0) return [];

  const questionIds = rows
    .map((draft) => draft.source_question_id)
    .filter((id): id is string => Boolean(id));
  const activityIds = rows
    .map((draft) => draft.published_activity_id)
    .filter((id): id is string => Boolean(id));

  const [questionsRes, activitiesRes] = await Promise.all([
    questionIds.length > 0
      ? supabase
          .from("ielts_questions")
          .select("id, prompt, question_type, skill")
          .in("id", questionIds)
      : Promise.resolve({ data: [], error: null }),
    activityIds.length > 0
      ? supabase.from("activities").select("id, title").in("id", activityIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const firstError = questionsRes.error ?? activitiesRes.error;
  if (firstError) throw new Error(`listMicroItemDraftsForTest (labels) failed: ${firstError.message}`);

  const questionsById = new Map(
    (questionsRes.data ?? []).map((question) => [question.id, question]),
  );
  const activitiesById = new Map(
    (activitiesRes.data ?? []).map((activity) => [activity.id, activity]),
  );

  return rows.map((draft) => {
    const question = draft.source_question_id
      ? questionsById.get(draft.source_question_id)
      : null;
    const prompt = question?.prompt ?? "Source content";
    const sourceLabel = question
      ? `${question.skill} / ${question.question_type}: ${prompt.slice(0, 90)}`
      : "Source content";
    const publishedActivityTitle = draft.published_activity_id
      ? activitiesById.get(draft.published_activity_id)?.title ?? null
      : null;
    return { draft, sourceLabel, publishedActivityTitle };
  });
}

export async function updateMicroItemDraft(
  rawInput: unknown,
  params: { adminId: string; client?: IeltsDbClient },
): Promise<MicroItemDraftRow> {
  const input = parseInput(UpdateMicroItemDraftSchema, rawInput);
  const supabase = await resolveIeltsClient(params.client);
  const existing = await loadDraft(input.draftId, supabase);
  if (existing.status === "published") {
    throw new Error("Published micro-item drafts cannot be edited.");
  }

  const content = (input.content
    ? input.content
    : IeltsMicroDraftPublicContentSchema.parse(existing.draft_content)) as IeltsMicroDraftPublicContent;
  const answerKey = (input.answerKey
    ? input.answerKey
    : IeltsMicroDraftAnswerKeySchema.parse(existing.answer_key)) as IeltsMicroDraftAnswerKey;
  assertContentMatchesAnswerKey(content, answerKey);

  const patch: TablesUpdate<"ielts_micro_item_drafts"> = {
    activity_type: content.type,
    draft_content: content as unknown as Json,
    answer_key: answerKey as unknown as Json,
    rationale_en: input.rationaleEn ?? existing.rationale_en,
    rationale_vi: input.rationaleVi ?? existing.rationale_vi,
    subskill_key: input.subskillKey === undefined ? existing.subskill_key : input.subskillKey,
    qa_notes: input.qaNotes === undefined ? existing.qa_notes : input.qaNotes,
    edited_by: params.adminId,
    status: existing.status === "approved" ? "needs_review" : existing.status,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("ielts_micro_item_drafts")
    .update(patch)
    .eq("id", input.draftId)
    .select()
    .single();
  if (error) throw new Error(`updateMicroItemDraft failed: ${error.message}`);
  return data;
}

export async function reviewMicroItemDraft(
  rawInput: unknown,
  params: { adminId: string; client?: IeltsDbClient },
): Promise<MicroItemDraftRow> {
  const input = parseInput(ReviewMicroItemDraftSchema, rawInput);
  const supabase = await resolveIeltsClient(params.client);
  const existing = await loadDraft(input.draftId, supabase);
  if (existing.status === "published") {
    throw new Error("Published micro-item drafts cannot be reviewed again.");
  }
  if (input.status === "approved") {
    const content = IeltsMicroDraftPublicContentSchema.parse(existing.draft_content);
    const answerKey = IeltsMicroDraftAnswerKeySchema.parse(existing.answer_key);
    assertContentMatchesAnswerKey(content, answerKey);
  }

  const { data, error } = await supabase
    .from("ielts_micro_item_drafts")
    .update({
      status: input.status,
      qa_notes: input.qaNotes ?? existing.qa_notes,
      reviewer_id: params.adminId,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.draftId)
    .select()
    .single();
  if (error) throw new Error(`reviewMicroItemDraft failed: ${error.message}`);
  return data;
}

async function loadDraft(draftId: string, supabase: IeltsDbClient): Promise<MicroItemDraftRow> {
  const { data, error } = await supabase
    .from("ielts_micro_item_drafts")
    .select()
    .eq("id", draftId)
    .maybeSingle();
  if (error) throw new Error(`loadMicroItemDraft failed: ${error.message}`);
  if (!data) throw new Error("Micro-item draft not found.");
  return data;
}

async function assertIeltsModule(
  moduleId: string,
  supabase: IeltsDbClient,
): Promise<void> {
  const { data: moduleRow, error } = await supabase
    .from("course_modules")
    .select("id, course_id")
    .eq("id", moduleId)
    .maybeSingle();
  if (error) throw new Error(`assertIeltsModule failed: ${error.message}`);
  if (!moduleRow) throw new Error("Publish target module not found.");

  const { data: course, error: courseError } = await supabase
    .from("courses")
    .select("id, subject")
    .eq("id", moduleRow.course_id)
    .maybeSingle();
  if (courseError) throw new Error(`assertIeltsModule (course) failed: ${courseError.message}`);
  if (course?.subject !== "ielts") {
    throw new Error("Micro-items can only be published into IELTS course modules.");
  }
}

async function nextActivityOrderIndex(
  moduleId: string,
  supabase: IeltsDbClient,
): Promise<number> {
  const { data, error } = await supabase
    .from("activities")
    .select("order_index")
    .eq("module_id", moduleId)
    .order("order_index", { ascending: false })
    .limit(1);
  if (error) throw new Error(`nextActivityOrderIndex failed: ${error.message}`);
  return ((data ?? [])[0]?.order_index ?? -1) + 1;
}

export async function publishMicroItemDraft(
  rawInput: unknown,
  params: { adminId: string; client?: IeltsDbClient },
): Promise<{ draft: MicroItemDraftRow; activityId: string }> {
  const input = parseInput(PublishMicroItemDraftSchema, rawInput);
  const supabase = await resolveIeltsClient(params.client);
  await assertIeltsModule(input.moduleId, supabase);
  const draft = await loadDraft(input.draftId, supabase);

  if (draft.status !== "approved") {
    throw new Error("Review and approve the micro-item draft before publishing.");
  }
  if (draft.published_activity_id) {
    throw new Error("This micro-item draft has already been published.");
  }

  const content = IeltsMicroDraftPublicContentSchema.parse(draft.draft_content);
  const answerKey = IeltsMicroDraftAnswerKeySchema.parse(draft.answer_key);
  assertContentMatchesAnswerKey(content, answerKey);

  const orderIndex = await nextActivityOrderIndex(input.moduleId, supabase);
  const activityInsert = buildPublishedActivityInsert({
    draftId: draft.id,
    draft,
    moduleId: input.moduleId,
    orderIndex,
    title: input.title,
  });
  const { data: activity, error } = await supabase
    .from("activities")
    .insert(activityInsert)
    .select("id")
    .single();
  if (error) throw new Error(`publishMicroItemDraft (activity) failed: ${error.message}`);

  const now = new Date().toISOString();
  const { data: updatedDraft, error: updateError } = await supabase
    .from("ielts_micro_item_drafts")
    .update({
      status: "published",
      published_activity_id: activity.id,
      published_at: now,
      updated_at: now,
      reviewer_id: draft.reviewer_id ?? params.adminId,
      reviewed_at: draft.reviewed_at ?? now,
    })
    .eq("id", draft.id)
    .select()
    .single();
  if (updateError) {
    throw new Error(`publishMicroItemDraft (draft) failed: ${updateError.message}`);
  }

  return { draft: updatedDraft, activityId: activity.id };
}

export async function listIeltsMicroItemPublishTargets(
  client?: IeltsDbClient,
): Promise<MicroItemPublishTarget[]> {
  const supabase = await resolveIeltsClient(client);
  const { data: courses, error } = await supabase
    .from("courses")
    .select("id, title")
    .eq("subject", "ielts")
    .eq("is_archived", false)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(`listIeltsMicroItemPublishTargets failed: ${error.message}`);
  const courseRows = courses ?? [];
  if (courseRows.length === 0) return [];

  const { data: modules, error: moduleError } = await supabase
    .from("course_modules")
    .select("id, course_id, title, sort_order")
    .in("course_id", courseRows.map((course) => course.id))
    .eq("is_archived", false)
    .order("sort_order", { ascending: true });
  if (moduleError) {
    throw new Error(`listIeltsMicroItemPublishTargets (modules) failed: ${moduleError.message}`);
  }
  const coursesById = new Map(courseRows.map((course) => [course.id, course.title]));
  return (modules ?? []).map((moduleRow) => ({
    moduleId: moduleRow.id,
    moduleTitle: moduleRow.title,
    courseId: moduleRow.course_id,
    courseTitle: coursesById.get(moduleRow.course_id) ?? "IELTS course",
  }));
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseInput } from "@/lib/api/boundary";
import { requireClassManager } from "@/lib/api/class-manager-access";
import { createTypedServerClient } from "@/lib/supabase/server";
import { createTypedAdminClient } from "@/lib/supabase/admin";
import {
  loadReviewForActor,
  loadReviewForManager,
  publishTeacherReview as publishReview,
  returnTeacherReview as returnReview,
  upsertTeacherReview,
} from "@/lib/api/ielts/teacher-review-repository";
import { loadIeltsClassGradebook as loadGradebook } from "@/lib/api/ielts/gradebook-repository";
import {
  TeacherReviewBandsSchema,
  TeacherReviewExpectedRevisionSchema,
} from "@/lib/api/ielts/teacher-review-contract";
import { buildIeltsReviewQueue } from "@/lib/api/ielts/review-queue-contract";
import {
  reserveIeltsManualRetry,
  type IeltsScoringKind,
} from "@/lib/api/ielts/manual-retry-repository";
import { isGcpAiGradingEnabled } from "@/lib/ai/grading/backend";
import { enqueueIeltsSpeakingScoring } from "@/lib/queues/ielts-speaking";
import { enqueueIeltsWritingScoring } from "@/lib/queues/ielts-writing";

const SaveSchema = z.object({
  clubId: z.string().uuid(),
  classId: z.string().uuid(),
  attemptId: z.string().uuid(),
  writingResponseId: z.string().uuid().optional(),
  speakingResponseId: z.string().uuid().optional(),
  bands: TeacherReviewBandsSchema,
  expectedRevision: TeacherReviewExpectedRevisionSchema,
  reviewerNote: z.string().trim().max(4000).nullish(),
  assignmentId: z.string().uuid().nullish(),
});
const ReviewActionSchema = z.object({
  clubId: z.string().uuid(),
  classId: z.string().uuid(),
  reviewId: z.string().uuid(),
});
const ReturnSchema = ReviewActionSchema.extend({
  note: z.string().trim().max(4000).nullish(),
});
const GradebookSchema = z.object({
  clubId: z.string().uuid(),
  classId: z.string().uuid(),
  cursor: z.string().nullish(),
  limit: z.number().int().positive().max(100).optional(),
});
const ManualRetrySchema = z.object({
  clubId: z.string().uuid(),
  classId: z.string().uuid(),
  attemptId: z.string().uuid(),
  responseId: z.string().uuid(),
  responseKind: z.enum(["writing", "speaking"]),
  expectedRevision: TeacherReviewExpectedRevisionSchema,
  idempotencyKey: z.string().uuid(),
});

async function assertAttemptScope(
  client: Awaited<ReturnType<typeof createTypedServerClient>>,
  input: {
    clubId: string;
    classId: string;
    attemptId: string;
    assignmentId?: string | null;
  },
) {
  const { data, error } = await client
    .from("ielts_attempts")
    .select("id, club_id, class_id, assignment_id")
    .eq("id", input.attemptId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (
    !data ||
    data.club_id !== input.clubId ||
    data.class_id !== input.classId ||
    (input.assignmentId && data.assignment_id !== input.assignmentId)
  )
    throw new Error("IELTS attempt is outside this class");
  return data;
}

export async function saveTeacherReview(raw: unknown) {
  const input = parseInput(SaveSchema, raw);
  const client = await createTypedServerClient();
  const manager = await requireClassManager(client, input.classId);
  if (manager.clubId !== input.clubId)
    throw new Error("That class is not part of this club");
  const attempt = await assertAttemptScope(client, input);
  const review = await upsertTeacherReview(client, createTypedAdminClient(), {
    ...input,
    reviewerId: manager.userId,
    assignmentId: attempt.assignment_id,
  });
  revalidatePath(`/dashboard/clubs/${input.clubId}/ielts`);
  return { ok: true, review };
}

export async function publishTeacherReview(raw: unknown) {
  const input = parseInput(ReviewActionSchema, raw);
  const client = await createTypedServerClient();
  const manager = await requireClassManager(client, input.classId);
  if (manager.clubId !== input.clubId)
    throw new Error("That class is not part of this club");
  const review = await loadReviewForActor(
    client,
    input.reviewId,
    manager.userId,
  );
  if (review.class_id !== input.classId || review.club_id !== input.clubId)
    throw new Error("IELTS review is outside this class");
  const published = await publishReview(
    client,
    createTypedAdminClient(),
    review,
    manager.userId,
  );
  revalidatePath(`/dashboard/clubs/${input.clubId}/ielts`);
  return { ok: true, review: published };
}

export async function returnTeacherReview(raw: unknown) {
  const input = parseInput(ReturnSchema, raw);
  const client = await createTypedServerClient();
  const manager = await requireClassManager(client, input.classId);
  if (manager.clubId !== input.clubId)
    throw new Error("That class is not part of this club");
  const review = await loadReviewForManager(
    client,
    input.reviewId,
    input.classId,
    input.clubId,
  );
  const returned = await returnReview(
    client,
    createTypedAdminClient(),
    review,
    manager.userId,
    input.note,
  );
  revalidatePath(`/dashboard/clubs/${input.clubId}/ielts`);
  return { ok: true, review: returned };
}

export async function loadIeltsClassGradebook(raw: unknown) {
  const input = parseInput(GradebookSchema, raw);
  const client = await createTypedServerClient();
  const manager = await requireClassManager(client, input.classId);
  if (manager.clubId !== input.clubId)
    throw new Error("That class is not part of this club");
  return loadGradebook(client, input, createTypedAdminClient());
}

export async function loadIeltsClassReviewQueue(raw: unknown) {
  const gradebook = await loadIeltsClassGradebook(raw);
  return buildIeltsReviewQueue(gradebook);
}

/** Reserve and launch the bounded, teacher-visible retry for an exhausted W/S score. */
export async function retryIeltsScoringWorkflow(raw: unknown) {
  const input = parseInput(ManualRetrySchema, raw);
  if (!isGcpAiGradingEnabled())
    throw new Error("IELTS scoring retries are unavailable");
  const client = await createTypedServerClient();
  const manager = await requireClassManager(client, input.classId);
  if (manager.clubId !== input.clubId)
    throw new Error("That class is not part of this club");
  await assertAttemptScope(client, { ...input, assignmentId: undefined });
  const response = await assertResponseScope(client, input);

  // This RPC is the transaction boundary. It consumes the single manual
  // retry, records the actor/idempotency key, and puts the existing durable
  // source run back in queued state before the normal launcher is called.
  const retry = await reserveIeltsManualRetry(client, {
    ...input,
    actorId: manager.userId,
  });
  const published =
    retry.responseKind === "writing"
      ? await enqueueIeltsWritingScoring({
          writingResponseId: retry.responseId,
          userId: response.user_id,
        })
      : await enqueueIeltsSpeakingScoring({
          speakingResponseId: retry.responseId,
          userId: response.user_id,
        });
  revalidatePath(`/dashboard/clubs/${input.clubId}/ielts`);
  return {
    ok: true,
    responseId: retry.responseId,
    responseKind: retry.responseKind,
    responseRevision: retry.responseRevision,
    workflowRunId: published.workflowRunId,
    manualRetryCount: retry.manualRetryCount,
    idempotentReplay: retry.idempotentReplay,
  };
}

async function assertResponseScope(
  client: Awaited<ReturnType<typeof createTypedServerClient>>,
  input: {
    responseId: string;
    responseKind: IeltsScoringKind;
    attemptId: string;
    expectedRevision: number;
  },
) {
  const table =
    input.responseKind === "writing"
      ? "writing_responses"
      : "speaking_responses";
  const { data, error } = await client
    .from(table)
    .select("id, attempt_id, revision, user_id")
    .eq("id", input.responseId)
    .maybeSingle();
  if (error) throw new Error(`load IELTS response: ${error.message}`);
  if (!data || data.attempt_id !== input.attemptId)
    throw new Error("IELTS response is outside this attempt");
  if (data.revision !== input.expectedRevision)
    throw new Error("IELTS response revision changed concurrently");
  return data;
}

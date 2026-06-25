"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseInput } from "@/lib/api/boundary";
import {
  getIeltsReviewItem,
  rateIeltsReviewItem,
} from "@/lib/api/ielts/review-repository";
import { IELTS_REVIEW_RATINGS } from "@/lib/ielts/review";
import { PostgresUuidSchema } from "@/lib/ielts/review/schema";
import { requireIeltsUserId } from "@/lib/ielts/access";
import { createTypedAdminClient } from "@/lib/supabase/admin";

const GradeIeltsReviewItemActionSchema = z.object({
  reviewItemId: PostgresUuidSchema,
  rating: z.enum(IELTS_REVIEW_RATINGS),
  responseMs: z.number().int().nonnegative().max(24 * 60 * 60 * 1000).optional(),
});

export async function gradeIeltsReviewItemAction(raw: unknown) {
  const input = parseInput(GradeIeltsReviewItemActionSchema, raw);
  const userId = await requireIeltsUserId();
  const item = await getIeltsReviewItem(input.reviewItemId);
  if (!item || item.user_id !== userId) {
    throw new Error("Review item not found");
  }

  const updated = await rateIeltsReviewItem(
    {
      reviewItemId: input.reviewItemId,
      rating: input.rating,
      reviewedAt: new Date(),
      isCorrect: input.rating !== "again",
      responseMs: input.responseMs,
      metadata: {
        surface: "ielts_review",
      },
    },
    createTypedAdminClient(),
  );

  revalidatePath("/ielts");
  revalidatePath("/ielts/review");
  revalidatePath("/ielts/study-plan");

  return {
    ok: true,
    reviewItemId: updated.id,
    nextState: updated.state,
    nextDueAt: updated.due_at,
  };
}

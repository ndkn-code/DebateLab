"use server";

import { revalidatePath } from "next/cache";
import { parseInput } from "@/lib/api/boundary";
import { generateAndPersistIeltsStudyPlanForUser } from "@/lib/api/ielts/study-plan-repository";
import { requireIeltsUserId } from "@/lib/ielts/access";
import { IeltsGoalModelSchema } from "@/lib/ielts/adaptive/contracts";

function revalidateStudyPlan() {
  revalidatePath("/ielts/study-plan");
  revalidatePath("/ielts");
}

/**
 * Edit the goal (target band, per-skill targets, focus skills, test date,
 * availability) and regenerate the future plan from the latest prediction.
 * Completed history is preserved by the generator; revision logging is owned by
 * WS-6.2.4's replan triggers.
 */
export async function updateIeltsStudyPlanGoalAction(raw: unknown) {
  const userId = await requireIeltsUserId();
  const goal = parseInput(IeltsGoalModelSchema, raw);
  const result = await generateAndPersistIeltsStudyPlanForUser({ userId, goal });
  revalidateStudyPlan();
  return {
    ok: true as const,
    planId: result.plan.id,
    persistedItemCount: result.persistedItems.length,
    skippedItemCount: result.skippedItems.length,
  };
}

/** Regenerate the future plan from the current goal + latest prediction. */
export async function regenerateIeltsStudyPlanAction() {
  const userId = await requireIeltsUserId();
  const result = await generateAndPersistIeltsStudyPlanForUser({ userId });
  revalidateStudyPlan();
  return {
    ok: true as const,
    planId: result.plan.id,
    persistedItemCount: result.persistedItems.length,
    skippedItemCount: result.skippedItems.length,
  };
}

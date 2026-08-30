"use server";

import { revalidatePath } from "next/cache";
import { parseInput } from "@/lib/api/boundary";
import {
  generateAndPersistIeltsStudyPlanForUser,
  findQuickDiagnosticTest,
  saveIeltsStudyPlanGoal,
} from "@/lib/api/ielts/study-plan-repository";
import { requireIeltsUserId } from "@/lib/ielts/access";
import {
  IeltsOnboardingGoalInputSchema,
} from "@/lib/ielts/onboarding/model";

export async function saveIeltsOnboardingGoalAction(raw: unknown) {
  const userId = await requireIeltsUserId();
  const goal = parseInput(IeltsOnboardingGoalInputSchema, raw);
  const plan = await saveIeltsStudyPlanGoal({ userId, goal });
  const diagnosticTest = await findQuickDiagnosticTest();
  revalidatePath("/ielts");
  revalidatePath("/ielts/onboarding");
  return {
    ok: true,
    planId: plan.id,
    diagnosticTest,
  };
}

export async function generateIeltsOnboardingPlanAction() {
  const userId = await requireIeltsUserId();
  const result = await generateAndPersistIeltsStudyPlanForUser({ userId });
  revalidatePath("/ielts");
  revalidatePath("/ielts/onboarding");
  return {
    ok: true,
    planId: result.plan.id,
    prediction: result.prediction,
    generatedPlan: result.generatedPlan,
    persistedItemCount: result.persistedItems.length,
    skippedItemCount: result.skippedItems.length,
    diagnosticTest: result.diagnosticTest,
  };
}

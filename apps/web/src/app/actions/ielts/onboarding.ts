"use server";

import { revalidatePath } from "next/cache";
import { parseInput } from "@/lib/api/boundary";
import {
  generateAndPersistIeltsStudyPlanForUser,
  findQuickDiagnosticTest,
  saveIeltsStudyPlanGoal,
} from "@/lib/api/ielts/study-plan-repository";
import { IELTS_ENABLED } from "@/lib/features";
import {
  IeltsOnboardingGoalInputSchema,
} from "@/lib/ielts/onboarding/model";
import { createTypedServerClient } from "@/lib/supabase/server";

async function requireIeltsUser(): Promise<string> {
  if (!IELTS_ENABLED) throw new Error("IELTS is not available.");
  const supabase = await createTypedServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user.id;
}

export async function saveIeltsOnboardingGoalAction(raw: unknown) {
  const userId = await requireIeltsUser();
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
  const userId = await requireIeltsUser();
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

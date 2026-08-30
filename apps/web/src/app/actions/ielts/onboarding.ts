"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { parseInput } from "@/lib/api/boundary";
import { createTypedServerClient } from "@/lib/supabase/server";
import { recordAnalyticsEvent } from "@/lib/analytics/server-events";
import {
  generateAndPersistIeltsStudyPlanForUser,
  findQuickDiagnosticTest,
  saveIeltsStudyPlanGoal,
} from "@/lib/api/ielts/study-plan-repository";
import { requireIeltsUserId } from "@/lib/ielts/access";
import {
  IELTS_ONBOARDING_VERSION,
  IeltsOnboardingGoalSubmissionSchema,
} from "@/lib/ielts/onboarding/model";
import { SUBJECT_COOKIE_MAX_AGE, SUBJECT_COOKIE_NAME } from "@/lib/subject";
import type { Json } from "@/types/supabase";

async function completeIeltsProfileOnboarding(userId: string) {
  const supabase = await createTypedServerClient();
  const { data: profile, error: readError } = await supabase
    .from("profiles")
    .select("preferences")
    .eq("id", userId)
    .single();

  if (readError) throw new Error(readError.message);

  const existing = (profile?.preferences ?? {}) as Record<string, Json>;
  const preferences: Json = {
    ...existing,
    subject: "ielts",
    first_dashboard_visit: true,
    ielts_onboarding_version: IELTS_ONBOARDING_VERSION,
    ielts_onboarding_completed_at: new Date().toISOString(),
  };
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ onboarding_completed: true, preferences })
    .eq("id", userId);

  if (updateError) throw new Error(updateError.message);

  await recordAnalyticsEvent(supabase, userId, {
    eventName: "ielts_onboarding_completed",
    featureArea: "ielts",
    route: "/ielts/onboarding",
    metadata: { onboardingVersion: IELTS_ONBOARDING_VERSION },
  });

  const cookieStore = await cookies();
  cookieStore.set(SUBJECT_COOKIE_NAME, "ielts", {
    httpOnly: false,
    maxAge: SUBJECT_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function saveIeltsOnboardingGoalAction(raw: unknown) {
  const userId = await requireIeltsUserId();
  const { goal, currentBand } = parseInput(
    IeltsOnboardingGoalSubmissionSchema,
    raw,
  );
  const plan = await saveIeltsStudyPlanGoal({ userId, goal });
  const diagnosticTest = await findQuickDiagnosticTest();
  const supabase = await createTypedServerClient();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("preferences")
    .eq("id", userId)
    .single();
  if (profileError) throw new Error(profileError.message);
  const existingPreferences = (profile.preferences ?? {}) as Record<
    string,
    Json
  >;
  const { error: answersError } = await supabase
    .from("profiles")
    .update({
      preferences: {
        ...existingPreferences,
        subject: "ielts",
        ielts_onboarding_version: IELTS_ONBOARDING_VERSION,
        ielts_onboarding_answers: {
          current_band: currentBand,
          target_band: goal.targetOverallBand,
          test_date: goal.targetTestDate,
          weekly_commitment: {
            study_days: goal.availability.studyDays,
            daily_minutes: goal.availability.dailyMinutes,
          },
          module: goal.module,
          focus_skills: goal.focusSkills ?? [],
        },
      },
    })
    .eq("id", userId);
  if (answersError) throw new Error(answersError.message);
  await recordAnalyticsEvent(supabase, userId, {
    eventName: "ielts_onboarding_started",
    featureArea: "ielts",
    route: "/ielts/onboarding",
    metadata: { onboardingVersion: IELTS_ONBOARDING_VERSION },
  });
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
  await completeIeltsProfileOnboarding(userId);
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

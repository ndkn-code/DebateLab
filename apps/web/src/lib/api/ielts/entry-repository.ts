import "server-only";

import { IELTS_ROUTES } from "@/lib/ielts/routes";
import { loadActiveIeltsStudyPlan } from "./study-plan-repository";
import type { IeltsDbClient } from "./client";

export async function resolveSignedInIeltsEntry(
  userId: string,
  client: IeltsDbClient,
): Promise<string> {
  const { data: profile, error } = await client
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(`resolveSignedInIeltsEntry: ${error.message}`);

  if (profile?.role === "teacher" || profile?.role === "admin") {
    return IELTS_ROUTES.teacherWorkspace;
  }

  const activePlan = await loadActiveIeltsStudyPlan(userId, client);
  return activePlan ? IELTS_ROUTES.home : IELTS_ROUTES.onboarding;
}

"use server";

import { createClient } from "@/lib/supabase/server";
import type { PracticeTrack } from "@/types/feedback";

const CREDIT_COSTS: Record<PracticeTrack, number> = {
  speaking: 100,
  debate: 200,
};

export async function deductOrbsAction(practiceTrack: PracticeTrack) {
  const cost = CREDIT_COSTS[practiceTrack];
  const balance = await getOrbBalanceAction();
  return {
    success: false,
    newBalance: balance,
    error: `Credit reservation occurs when the ${cost}-Credit analysis attempt is submitted.`,
  };
}

export async function getOrbBalanceAction() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const { data } = await supabase
    .from("profiles")
    .select("orb_balance")
    .eq("id", user.id)
    .single();

  return data?.orb_balance ?? 0;
}

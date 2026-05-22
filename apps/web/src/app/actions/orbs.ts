"use server";

import { createClient } from "@/lib/supabase/server";
import type { PracticeTrack } from "@/types/feedback";

const CREDIT_COSTS: Record<PracticeTrack, number> = {
  speaking: 100,
  debate: 200,
};

export async function deductOrbsAction(practiceTrack: PracticeTrack) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, newBalance: 0, error: "Not authenticated" };

  const cost = CREDIT_COSTS[practiceTrack];

  // Check balance
  const { data: profile } = await supabase
    .from("profiles")
    .select("orb_balance")
    .eq("id", user.id)
    .single();

  const balance = profile?.orb_balance ?? 0;
  if (balance < cost) {
    return { success: false, newBalance: balance, error: "Insufficient Credits" };
  }

  // Atomic deduction
  const type =
    practiceTrack === "speaking" ? "practice_speaking" : "practice_debate";
  const { data, error } = await supabase.rpc("adjust_orb_balance", {
    p_user_id: user.id,
    p_amount: -cost,
    p_type: type,
  });

  if (error) {
    return { success: false, newBalance: balance, error: error.message };
  }

  return { success: true, newBalance: data as number };
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

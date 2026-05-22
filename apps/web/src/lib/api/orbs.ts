import { createClient } from "@/lib/supabase/server";
import type { PracticeTrack } from "@/types/feedback";

const CREDIT_COSTS: Record<PracticeTrack, number> = {
  speaking: 100,
  debate: 200,
} as const;

export async function getOrbBalance(userId: string): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("orb_balance")
    .eq("id", userId)
    .single();
  return data?.orb_balance ?? 0;
}

export async function hasEnoughOrbs(
  userId: string,
  practiceTrack: PracticeTrack
): Promise<boolean> {
  const balance = await getOrbBalance(userId);
  return balance >= CREDIT_COSTS[practiceTrack];
}

export async function deductOrbs(
  userId: string,
  practiceTrack: PracticeTrack
): Promise<{ success: boolean; newBalance: number; error?: string }> {
  const cost = CREDIT_COSTS[practiceTrack];
  const supabase = await createClient();

  // Check balance first
  const balance = await getOrbBalance(userId);
  if (balance < cost) {
    return {
      success: false,
      newBalance: balance,
      error: "Insufficient Credits",
    };
  }

  // Atomic deduction via Postgres function
  const type =
    practiceTrack === "speaking" ? "practice_speaking" : "practice_debate";
  const { data, error } = await supabase.rpc("adjust_orb_balance", {
    p_user_id: userId,
    p_amount: -cost,
    p_type: type,
  });

  if (error) {
    return { success: false, newBalance: balance, error: error.message };
  }

  return { success: true, newBalance: data as number };
}

export function getOrbCost(practiceTrack: PracticeTrack): number {
  return CREDIT_COSTS[practiceTrack];
}

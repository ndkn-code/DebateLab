import { createClient } from "@/lib/supabase/server";

const ORB_COSTS = {
  quick: 1,
  full: 2,
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
  mode: "quick" | "full"
): Promise<boolean> {
  const balance = await getOrbBalance(userId);
  return balance >= ORB_COSTS[mode];
}

export async function deductOrbs(
  userId: string,
  mode: "quick" | "full"
): Promise<{ success: boolean; newBalance: number; error?: string }> {
  const cost = ORB_COSTS[mode];
  const supabase = await createClient();

  // Check balance first
  const balance = await getOrbBalance(userId);
  if (balance < cost) {
    return {
      success: false,
      newBalance: balance,
      error: "Insufficient Orbs",
    };
  }

  // Atomic deduction via Postgres function
  const type = mode === "quick" ? "practice_quick" : "practice_full";
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

export function getOrbCost(mode: "quick" | "full"): number {
  return ORB_COSTS[mode];
}

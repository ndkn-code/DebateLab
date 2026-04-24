import { createClient } from "@/lib/supabase/server";

export async function getReferralCode(userId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("referral_code")
    .eq("id", userId)
    .single();
  return data?.referral_code ?? null;
}

export async function getReferrerByCode(
  code: string
): Promise<{ id: string; display_name: string } | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, display_name")
    .eq("referral_code", code.toUpperCase())
    .single();
  return data ?? null;
}

export async function createReferral(
  referrerId: string,
  refereeId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  // Don't allow self-referral
  if (referrerId === refereeId) {
    return { success: false, error: "Cannot refer yourself" };
  }

  // Check if referee already has a referral
  const { data: existing } = await supabase
    .from("referrals")
    .select("id")
    .eq("referee_id", refereeId)
    .maybeSingle();

  if (existing) {
    return { success: false, error: "Already referred" };
  }

  // Create referral and update referred_by
  const { error } = await supabase.from("referrals").insert({
    referrer_id: referrerId,
    referee_id: refereeId,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  await supabase
    .from("profiles")
    .update({ referred_by: referrerId })
    .eq("id", refereeId);

  return { success: true };
}

export async function qualifyReferral(
  refereeId: string,
  transcriptWordCount: number
): Promise<void> {
  if (transcriptWordCount < 30) return;

  const supabase = await createClient();

  const { error: creditError } = await supabase.rpc(
    "qualify_and_credit_referral",
    {
      p_referee_id: refereeId,
      p_transcript_word_count: transcriptWordCount,
    }
  );

  if (creditError) {
    throw new Error(`Unable to qualify referral: ${creditError.message}`);
  }
}

export interface ReferralStats {
  referralCode: string;
  totalReferred: number;
  totalCredited: number;
  totalOrbsEarned: number;
  referredUsers: { display_name: string; status: string; created_at: string }[];
}

export async function getReferralStats(
  userId: string
): Promise<ReferralStats> {
  const supabase = await createClient();

  const [profileRes, referralsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("referral_code")
      .eq("id", userId)
      .single(),
    supabase
      .from("referrals")
      .select("id, referee_id, status, referrer_orbs_awarded, created_at")
      .eq("referrer_id", userId)
      .order("created_at", { ascending: false }),
  ]);

  const referrals = referralsRes.data ?? [];
  const refereeIds = referrals.map((r) => r.referee_id);

  let referredUsers: { display_name: string; status: string; created_at: string }[] = [];
  if (refereeIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", refereeIds);

    const profileMap = new Map(
      (profiles ?? []).map((p) => [p.id, p.display_name])
    );

    referredUsers = referrals.map((r) => ({
      display_name: profileMap.get(r.referee_id) ?? "User",
      status: r.status,
      created_at: r.created_at,
    }));
  }

  return {
    referralCode: profileRes.data?.referral_code ?? "",
    totalReferred: referrals.length,
    totalCredited: referrals.filter((r) => r.status === "credited").length,
    totalOrbsEarned: referrals.reduce((sum, r) => sum + r.referrer_orbs_awarded, 0),
    referredUsers,
  };
}

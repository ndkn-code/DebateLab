"use server";

import { createClient } from "@/lib/supabase/server";
import { qualifyReferral } from "@/lib/api/referrals";

export async function qualifyReferralAction(transcriptWordCount: number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await qualifyReferral(user.id, transcriptWordCount);
}

export async function getReferralCodeAction(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "";

  const { data } = await supabase
    .from("profiles")
    .select("referral_code")
    .eq("id", user.id)
    .single();

  return data?.referral_code ?? "";
}

"use server";

import { createClient } from "@/lib/supabase/server";

export async function saveAnalyticsConsentPreferenceAction(enabled: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: true as const, saved: false as const };

  const { data: profile, error: readError } = await supabase
    .from("profiles")
    .select("preferences")
    .eq("id", user.id)
    .single();
  if (readError) return { ok: false as const };

  const preferences =
    (profile?.preferences as Record<string, unknown> | null) ?? {};
  const { error } = await supabase
    .from("profiles")
    .update({
      preferences: {
        ...preferences,
        analytics_cookies_enabled: enabled,
      },
    })
    .eq("id", user.id);

  return error
    ? { ok: false as const }
    : { ok: true as const, saved: true as const };
}

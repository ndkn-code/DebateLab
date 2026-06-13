import { createClient } from "@/lib/supabase/server";
import { DEV_ADMIN_PROFILE } from "@/lib/dev-admin-bypass";
import { DUEL_ENABLED } from "@/lib/features";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export async function isAdminUser(
  supabase: SupabaseServerClient,
  userId: string
) {
  if (process.env.NODE_ENV !== "production" && userId === DEV_ADMIN_PROFILE.id) {
    return true;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  return profile?.role === "admin";
}

/**
 * Access gate for the 1v1 Duel feature. Open to everyone once DUEL_ENABLED is
 * set (the launch switch); until then only admins can reach it, so the team can
 * keep shadow-testing the hidden ELO in production.
 */
export async function canAccessDuels(
  supabase: SupabaseServerClient,
  userId: string
) {
  if (DUEL_ENABLED) {
    return true;
  }
  return isAdminUser(supabase, userId);
}

import { createClient } from "@/lib/supabase/server";
import { DEV_ADMIN_PROFILE } from "@/lib/dev-admin-bypass";

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

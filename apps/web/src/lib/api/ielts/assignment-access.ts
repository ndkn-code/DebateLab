/**
 * Authorization helpers for the IELTS class-assignment surface (WS-5.3).
 *
 * The data layer is org-scoped by RLS (`private.can_manage_club` /
 * `can_manage_class` / `can_view_class`), but the teacher-facing loaders also
 * gate explicitly so a club *student* can't open a manager view and read the
 * RLS-narrowed slice as if it were a dashboard. Mirrors `verifyClubManager` in
 * `app/actions/admin-clubs.ts`, including the dev bypasses, but on the typed
 * client.
 */
import "server-only";
import { createTypedServerClient } from "@/lib/supabase/server";
import { DEV_ADMIN_PROFILE, isDevAdminBypassEnabled } from "@/lib/dev-admin-bypass";
import { getDevAuthBypassUserFromServerContext } from "@/lib/dev-auth-bypass";

export type IeltsServerClient = Awaited<ReturnType<typeof createTypedServerClient>>;

async function devBypassUserId(): Promise<string | null> {
  if (isDevAdminBypassEnabled() || (await getDevAuthBypassUserFromServerContext())) {
    return DEV_ADMIN_PROFILE.id;
  }
  return null;
}

/** The caller's user id, or the dev-bypass id; throws when unauthenticated. */
export async function getSessionUserId(supabase: IeltsServerClient): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) return user.id;
  const bypass = await devBypassUserId();
  if (bypass) return bypass;
  throw new Error("Not authenticated");
}

/**
 * Throw unless the caller is a platform admin or an active owner/coach of the
 * club. Returns the manager's user id on success.
 */
export async function requireClubManager(
  supabase: IeltsServerClient,
  clubId: string,
): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const bypass = await devBypassUserId();
    if (bypass) return bypass;
    throw new Error("Unauthorized");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role === "admin") return user.id;

  const { data: membership } = await supabase
    .from("club_memberships")
    .select("id")
    .eq("club_id", clubId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .in("role", ["owner", "coach"])
    .maybeSingle();
  if (membership) return user.id;

  if (isDevAdminBypassEnabled()) return user.id;
  throw new Error("Forbidden");
}

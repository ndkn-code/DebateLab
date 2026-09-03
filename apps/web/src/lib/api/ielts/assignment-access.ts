/**
 * Authorization helpers for the IELTS class-assignment surface (WS-5.3).
 *
 * The data layer is org-scoped by RLS (`private.can_manage_club` /
 * `can_manage_class` / `can_view_class`), but the teacher-facing loaders also
 * gate explicitly so a club *student* can't open a manager view and read the
 * RLS-narrowed slice as if it were a dashboard. Mirrors `verifyClubManager` in
 * `app/actions/admin-clubs.ts`, but on the typed
 * client.
 */
import "server-only";
import { createTypedServerClient } from "@/lib/supabase/server";
import { normalizeOrganizationRole } from "@/lib/organizations/compatibility";

export type IeltsServerClient = Awaited<
  ReturnType<typeof createTypedServerClient>
>;

/** The caller's user id; throws when unauthenticated. */
export async function getSessionUserId(
  supabase: IeltsServerClient,
): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) return user.id;
  throw new Error("Not authenticated");
}

/**
 * Throw unless the caller is a platform admin or an active organization
 * owner/admin/teacher. Teachers are further restricted to explicitly assigned
 * classes by the page/model layer.
 */
export async function requireClubManager(
  supabase: IeltsServerClient,
  clubId: string,
): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
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
    .select("id, role")
    .eq("club_id", clubId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .in("role", ["owner", "admin", "head_teacher", "teacher", "coach"])
    .maybeSingle();
  const role = normalizeOrganizationRole(membership?.role);
  if (
    role === "owner" ||
    role === "admin" ||
    role === "head_teacher" ||
    (role === "teacher" && profile?.role === "teacher")
  ) {
    return user.id;
  }
  throw new Error("Forbidden");
}

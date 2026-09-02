import "server-only";

import { createTypedServerClient } from "@/lib/supabase/server";
import type { OrganizationCapabilities } from "./contracts";

export type OrganizationCapability = keyof OrganizationCapabilities;

/**
 * The database membership is the source of truth. This projection is a UX
 * guard only; every mutation repeats the same decision inside an RPC/RLS.
 */
export async function loadOrganizationCapabilities(
  organizationId: string,
): Promise<OrganizationCapabilities> {
  const db = await createTypedServerClient();
  const { data: authData, error: authError } = await db.auth.getUser();
  if (authError) throw new Error(authError.message);
  const userId = authData.user?.id;
  if (!userId) throw new Error("Unauthorized");

  const [{ data: profile, error: profileError }, { data: membership, error: membershipError }] =
    await Promise.all([
      db.from("profiles").select("role").eq("id", userId).maybeSingle(),
      db.from("club_memberships").select("role").eq("club_id", organizationId)
        .eq("user_id", userId).eq("status", "active").maybeSingle(),
    ]);
  if (profileError) throw new Error(profileError.message);
  if (membershipError) throw new Error(membershipError.message);

  const platformAdmin = profile?.role === "admin";
  const role = membership?.role;
  const owner = role === "owner";
  const admin = role === "admin";
  const academic = platformAdmin || owner || admin || role === "head_teacher";
  return {
    canManageAcademicProfile: academic,
    canManagePeople: academic,
    canManageClasses: academic,
    canManageCurriculum: academic,
    canOverrideReview: platformAdmin || role === "head_teacher",
    canManagePrivilegedRoles: platformAdmin || owner || admin,
    canManageBilling: platformAdmin || owner,
    canManageSecurity: platformAdmin || owner,
    canTransferOwnership: platformAdmin || owner,
  };
}

export async function requireOrganizationCapability(
  organizationId: string,
  capability: OrganizationCapability,
): Promise<OrganizationCapabilities> {
  const capabilities = await loadOrganizationCapabilities(organizationId);
  if (!capabilities[capability]) throw new Error("Forbidden");
  return capabilities;
}

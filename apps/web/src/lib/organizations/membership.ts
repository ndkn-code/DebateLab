import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrganizationAffiliationSummary } from "@/lib/leaderboards/types";
import { normalizeOrganizationRole } from "@/lib/organizations/compatibility";
import type { OrganizationRole } from "@/lib/organizations/contracts";

type Supabase =
  | SupabaseClient
  | {
      from: SupabaseClient["from"];
    };

export type StoredOrganizationRole = OrganizationRole | "coach";

/** Canonical role at the application boundary; legacy coach is read as teacher. */
export function canonicalOrganizationRole(
  value: unknown,
): OrganizationRole | null {
  return normalizeOrganizationRole(value);
}

export function isOrganizationWideManagerRole(value: unknown): boolean {
  const role = canonicalOrganizationRole(value);
  return role === "owner" || role === "admin" || role === "head_teacher";
}

export function isOrganizationTeacherRole(value: unknown): boolean {
  return canonicalOrganizationRole(value) === "teacher";
}

function subtitleForClub(row: {
  club_type?: string | null;
  city?: string | null;
}) {
  const type = row.club_type
    ? row.club_type.charAt(0).toUpperCase() + row.club_type.slice(1)
    : "Organization";
  return row.city ? `${type} - ${row.city}` : type;
}

export async function getUserOrganizationAffiliation(
  supabase: Supabase,
  userId: string,
): Promise<OrganizationAffiliationSummary | null> {
  const { data: membership, error: membershipError } = await supabase
    .from("club_memberships")
    .select("club_id, role, joined_at, metadata")
    .eq("user_id", userId)
    .eq("role", "student")
    .eq("status", "active")
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    return null;
  }

  if (!membership?.club_id) {
    return null;
  }

  const { data: club, error: clubError } = await supabase
    .from("clubs")
    .select("id, name, club_type, city, logo_url")
    .eq("id", membership.club_id)
    .maybeSingle();

  if (clubError || !club) {
    return null;
  }

  const metadata = (membership.metadata ?? {}) as Record<string, unknown>;

  return {
    organizationId: String(club.id),
    organizationType: "club",
    name: String(club.name ?? "Organization"),
    subtitle: subtitleForClub({
      club_type: club.club_type as string | null,
      city: club.city as string | null,
    }),
    logoUrl: (club.logo_url as string | null | undefined) ?? null,
    role: "student",
    joinedAt: String(membership.joined_at ?? new Date().toISOString()),
    verificationMethod:
      typeof metadata.verification_method === "string"
        ? metadata.verification_method
        : "admin",
  };
}

import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrganizationAffiliationSummary } from "@/lib/leaderboards/types";
import { isDevAdminBypassEnabled } from "@/lib/dev-admin-bypass";

type Supabase = SupabaseClient | {
  from: SupabaseClient["from"];
};

function subtitleForClub(row: {
  club_type?: string | null;
  city?: string | null;
}) {
  const type = row.club_type
    ? row.club_type.charAt(0).toUpperCase() + row.club_type.slice(1)
    : "Organization";
  return row.city ? `${type} - ${row.city}` : type;
}

export function getDevOrganizationAffiliation(): OrganizationAffiliationSummary {
  return {
    organizationId: "00000000-0000-4c00-8000-000000000002",
    organizationType: "club",
    name: "DebateLab Academy",
    subtitle: "School - Ho Chi Minh City",
    logoUrl: null,
    role: "student",
    joinedAt: new Date("2026-05-01T09:00:00.000Z").toISOString(),
    verificationMethod: "join_code",
  };
}

export async function getUserOrganizationAffiliation(
  supabase: Supabase,
  userId: string
): Promise<OrganizationAffiliationSummary | null> {
  if (isDevAdminBypassEnabled() && userId.startsWith("00000000-0000-4000-8000-")) {
    return getDevOrganizationAffiliation();
  }

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
    role:
      membership.role === "owner" || membership.role === "coach"
        ? membership.role
        : "student",
    joinedAt: String(membership.joined_at ?? new Date().toISOString()),
    verificationMethod:
      typeof metadata.verification_method === "string"
        ? metadata.verification_method
        : "admin",
  };
}

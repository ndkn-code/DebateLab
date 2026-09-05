import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getDefaultLeaderboardPrivacySettings } from "@/lib/leaderboards/social-trust";
import { normalizeLeaderboardPrivacySettings } from "@/lib/leaderboards/social-trust-server";
import type {
  LeaderboardPrivacySettings,
  OrganizationAffiliationSummary,
} from "@/lib/leaderboards/types";

export const SETTINGS_OPTIONAL_READ_TIMEOUT_MS = 3_000;

export type OptionalReadStatus = "ready" | "absent" | "unavailable";

export type OptionalReadResult<T> =
  | { status: "ready"; data: T }
  | { status: "absent"; data: null }
  | { status: "unavailable"; data: null; error: Error };

class OptionalReadTimeoutError extends Error {
  constructor() {
    super("Settings optional read timed out.");
    this.name = "OptionalReadTimeoutError";
  }
}

export async function readOptional<T>(
  read: (signal: AbortSignal) => Promise<T | null>,
  timeoutMs = SETTINGS_OPTIONAL_READ_TIMEOUT_MS,
): Promise<OptionalReadResult<T>> {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    const value = await Promise.race([
      read(controller.signal),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(new OptionalReadTimeoutError());
        }, timeoutMs);
      }),
    ]);

    return value === null
      ? { status: "absent", data: null }
      : { status: "ready", data: value };
  } catch (error) {
    return {
      status: "unavailable",
      data: null,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  } finally {
    if (timeout) clearTimeout(timeout);
  }
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

async function readOrganizationAffiliation(
  supabase: SupabaseClient,
  userId: string,
  signal: AbortSignal,
): Promise<OrganizationAffiliationSummary | null> {
  const membershipQuery = supabase
    .from("club_memberships")
    .select("club_id, role, joined_at, metadata")
    .eq("user_id", userId)
    .eq("role", "student")
    .eq("status", "active")
    .order("joined_at", { ascending: true })
    .limit(1)
    .abortSignal(signal)
    .maybeSingle();
  const membershipResult = await membershipQuery;

  if (membershipResult.error) throw membershipResult.error;
  if (!membershipResult.data?.club_id) return null;

  const clubQuery = supabase
    .from("clubs")
    .select("id, name, club_type, city, logo_url")
    .eq("id", membershipResult.data.club_id)
    .abortSignal(signal)
    .maybeSingle();
  const clubResult = await clubQuery;

  if (clubResult.error) throw clubResult.error;
  if (!clubResult.data) throw new Error("Organization record unavailable.");
  if (typeof membershipResult.data.joined_at !== "string") {
    throw new Error("Organization membership is incomplete.");
  }

  const metadata = (membershipResult.data.metadata ?? {}) as Record<
    string,
    unknown
  >;
  return {
    organizationId: String(clubResult.data.id),
    organizationType: "club",
    name: String(clubResult.data.name ?? "Organization"),
    subtitle: subtitleForClub({
      club_type: clubResult.data.club_type as string | null,
      city: clubResult.data.city as string | null,
    }),
    logoUrl: (clubResult.data.logo_url as string | null | undefined) ?? null,
    role: "student",
    joinedAt: membershipResult.data.joined_at,
    verificationMethod:
      typeof metadata.verification_method === "string"
        ? metadata.verification_method
        : "admin",
  };
}

async function readLeaderboardPrivacy(
  supabase: SupabaseClient,
  userId: string,
  signal: AbortSignal,
): Promise<LeaderboardPrivacySettings> {
  const fallback = getDefaultLeaderboardPrivacySettings({
    userId,
    isStudent: true,
  });
  const result = await supabase
    .rpc("get_leaderboard_privacy_settings", { p_user_id: userId })
    .abortSignal(signal);
  if (result.error) throw result.error;
  return normalizeLeaderboardPrivacySettings(result.data, fallback);
}

export async function readSettingsOptionalData(input: {
  supabase: SupabaseClient;
  userId: string;
  includeOrganization: boolean;
  includeLeaderboard: boolean;
}) {
  const organization = input.includeOrganization
    ? readOptional((signal) =>
        readOrganizationAffiliation(input.supabase, input.userId, signal),
      )
    : Promise.resolve<OptionalReadResult<OrganizationAffiliationSummary>>({
        status: "absent",
        data: null,
      });
  const leaderboard = input.includeLeaderboard
    ? readOptional((signal) =>
        readLeaderboardPrivacy(input.supabase, input.userId, signal),
      )
    : Promise.resolve<OptionalReadResult<LeaderboardPrivacySettings>>({
        status: "absent",
        data: null,
      });

  const [organizationAffiliation, leaderboardPrivacySettings] =
    await Promise.all([organization, leaderboard]);

  return { organizationAffiliation, leaderboardPrivacySettings };
}

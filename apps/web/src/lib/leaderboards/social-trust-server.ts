import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  LEADERBOARD_ABUSE_GUARDS_ENABLED,
  LEADERBOARD_PRIVACY_CONTROLS_ENABLED,
} from "@/lib/features";
import {
  getDefaultLeaderboardPrivacySettings,
  getLeaderboardRolloutGuardrailStatus,
} from "@/lib/leaderboards/social-trust";
import type {
  LeaderboardAuditEvent,
  LeaderboardPrivacySettings,
  LeaderboardSafetyAuditData,
  LeaderboardXpEventFlag,
} from "@/lib/leaderboards/types";

type RpcClient = SupabaseClient & {
  rpc: (
    fn: string,
    args?: Record<string, unknown>
  ) => Promise<{ data: unknown; error: { message?: string; code?: string } | null }>;
};

function isMissingLeaderboardSocialTrustError(error: { message?: string; code?: string } | null) {
  if (!error) return false;
  const message = error.message?.toLowerCase() ?? "";
  return (
    error.code === "42P01" ||
    error.code === "42883" ||
    error.code === "PGRST202" ||
    message.includes("does not exist") ||
    message.includes("could not find the function") ||
    message.includes("could not find the table") ||
    message.includes("schema cache")
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeLeaderboardPrivacySettings(
  value: unknown,
  fallback: LeaderboardPrivacySettings
): LeaderboardPrivacySettings {
  if (!isRecord(value)) return fallback;

  const displayMode =
    value.displayMode === "public_name" ||
    value.displayMode === "initials_only" ||
    value.displayMode === "hidden"
      ? value.displayMode
      : fallback.displayMode;

  return {
    userId: typeof value.userId === "string" ? value.userId : fallback.userId,
    displayMode,
    allowKudos:
      typeof value.allowKudos === "boolean" ? value.allowKudos : fallback.allowKudos,
    showOrganization:
      typeof value.showOrganization === "boolean"
        ? value.showOrganization
        : fallback.showOrganization,
    participateInLeaderboards:
      typeof value.participateInLeaderboards === "boolean"
        ? value.participateInLeaderboards
        : fallback.participateInLeaderboards,
    isDefault:
      typeof value.isDefault === "boolean" ? value.isDefault : fallback.isDefault,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : fallback.updatedAt,
  };
}

export async function getLeaderboardPrivacySettings(input: {
  supabase: SupabaseClient;
  userId: string;
  isStudent?: boolean;
}): Promise<LeaderboardPrivacySettings> {
  const fallback = getDefaultLeaderboardPrivacySettings({
    userId: input.userId,
    isStudent: input.isStudent,
  });

  if (!LEADERBOARD_PRIVACY_CONTROLS_ENABLED) {
    return fallback;
  }

  const { data, error } = await (input.supabase as RpcClient).rpc(
    "get_leaderboard_privacy_settings",
    { p_user_id: input.userId }
  );

  if (error) {
    if (isMissingLeaderboardSocialTrustError(error)) {
      return fallback;
    }
    throw new Error(error.message ?? "Unable to load leaderboard privacy settings.");
  }

  return normalizeLeaderboardPrivacySettings(data, fallback);
}

function normalizeFlag(row: Record<string, unknown>): LeaderboardXpEventFlag {
  const status =
    row.status === "allowed" ||
    row.status === "suppressed_from_leaderboards" ||
    row.status === "resolved_allowed"
      ? row.status
      : "flagged_pending_review";
  const flagType =
    row.flagType === "duplicate_submission" ||
    row.flagType === "low_duration" ||
    row.flagType === "duel_integrity" ||
    row.flagType === "organization_hopping" ||
    row.flagType === "missing_quality_metadata"
      ? row.flagType
      : "manual_review";

  return {
    id: String(row.id ?? ""),
    xpEventId: String(row.xpEventId ?? ""),
    seasonId: String(row.seasonId ?? ""),
    userId: String(row.userId ?? ""),
    displayName: typeof row.displayName === "string" ? row.displayName : undefined,
    flagType,
    severity: row.severity === "low" || row.severity === "high" ? row.severity : "medium",
    status,
    reason: typeof row.reason === "string" ? row.reason : null,
    source: row.source === "admin" || row.source === "coach" ? row.source : "system",
    createdAt: String(row.createdAt ?? new Date().toISOString()),
    resolvedAt: typeof row.resolvedAt === "string" ? row.resolvedAt : null,
  };
}

function normalizeAudit(row: Record<string, unknown>): LeaderboardAuditEvent {
  return {
    id: String(row.id ?? ""),
    eventType: String(row.eventType ?? "leaderboard_audit_event"),
    actorUserId: typeof row.actorUserId === "string" ? row.actorUserId : null,
    targetUserId: typeof row.targetUserId === "string" ? row.targetUserId : null,
    clubId: typeof row.clubId === "string" ? row.clubId : null,
    xpEventId: typeof row.xpEventId === "string" ? row.xpEventId : null,
    flagId: typeof row.flagId === "string" ? row.flagId : null,
    metadata: isRecord(row.metadata) ? row.metadata : {},
    createdAt: String(row.createdAt ?? new Date().toISOString()),
  };
}

export function makeEmptyLeaderboardSafetyAudit(
  loadError: string | null = null
): LeaderboardSafetyAuditData {
  return {
    flags: [],
    audit: [],
    guardrails: getLeaderboardRolloutGuardrailStatus({
      suppressionRate: 0,
      optOutRate: 0,
      orgJoinAbuseRate: 0,
      churnRate: 0,
    }),
    loadError,
  };
}

export async function getLeaderboardSafetyAudit(input: {
  supabase: SupabaseClient;
  clubId?: string | null;
  limit?: number;
}): Promise<LeaderboardSafetyAuditData> {
  if (!LEADERBOARD_ABUSE_GUARDS_ENABLED) {
    return makeEmptyLeaderboardSafetyAudit();
  }

  const { data, error } = await (input.supabase as RpcClient).rpc(
    "get_leaderboard_safety_audit",
    {
      p_club_id: input.clubId ?? null,
      p_limit: input.limit ?? 50,
    }
  );

  if (error) {
    return makeEmptyLeaderboardSafetyAudit(
      isMissingLeaderboardSocialTrustError(error)
        ? "Leaderboard safety tables are not available yet."
        : error.message ?? "Unable to load leaderboard safety audit."
    );
  }

  if (!isRecord(data)) {
    return makeEmptyLeaderboardSafetyAudit(
      "Leaderboard safety audit returned an unexpected payload."
    );
  }

  const flags = Array.isArray(data.flags)
    ? data.flags.filter(isRecord).map(normalizeFlag)
    : [];
  const audit = Array.isArray(data.audit)
    ? data.audit.filter(isRecord).map(normalizeAudit)
    : [];
  const suppressed = flags.filter((flag) => flag.status === "suppressed_from_leaderboards").length;
  const pending = flags.filter((flag) => flag.status === "flagged_pending_review").length;
  const total = Math.max(flags.length, 1);

  return {
    flags,
    audit,
    guardrails: getLeaderboardRolloutGuardrailStatus({
      suppressionRate: suppressed / total,
      optOutRate: 0,
      orgJoinAbuseRate:
        flags.filter((flag) => flag.flagType === "organization_hopping").length / total,
      churnRate: pending / Math.max(total * 4, 1),
    }),
    loadError: null,
  };
}

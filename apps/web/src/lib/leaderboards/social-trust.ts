import type {
  LeaderboardDisplayMode,
  LeaderboardGuardrailMetric,
  LeaderboardKudosKind,
  LeaderboardKudosTargetState,
  LeaderboardPrivacySettings,
  LeaderboardRolloutStage,
  LeaderboardScoreExplanationItem,
  LeaderboardXpEventFlagStatus,
  LeaderboardXpEventFlagType,
} from "@/lib/leaderboards/types";

export const LEADERBOARD_KUDOS_KINDS: readonly LeaderboardKudosKind[] = [
  "keep_going",
  "great_round",
  "strong_improvement",
] as const;

export const LEADERBOARD_DISPLAY_MODES: readonly LeaderboardDisplayMode[] = [
  "public_name",
  "initials_only",
  "hidden",
] as const;

const SENSITIVE_METADATA_KEYS = [
  "email",
  "emails",
  "rawEmail",
  "raw_email",
  "code",
  "joinCode",
  "join_code",
  "rawJoinCode",
  "raw_join_code",
  "token",
  "tokenHash",
  "token_hash",
  "codeHash",
  "code_hash",
  "password",
  "secret",
] as const;

export function getDefaultLeaderboardPrivacySettings(input: {
  userId: string;
  isStudent?: boolean;
  now?: Date;
}): LeaderboardPrivacySettings {
  return {
    userId: input.userId,
    displayMode: input.isStudent ? "initials_only" : "public_name",
    allowKudos: true,
    showOrganization: true,
    participateInLeaderboards: true,
    isDefault: true,
    updatedAt: (input.now ?? new Date()).toISOString(),
  };
}

export function normalizeLeaderboardDisplayMode(value: unknown): LeaderboardDisplayMode {
  return LEADERBOARD_DISPLAY_MODES.includes(value as LeaderboardDisplayMode)
    ? (value as LeaderboardDisplayMode)
    : "initials_only";
}

export function normalizeLeaderboardKudosKind(value: unknown): LeaderboardKudosKind {
  return LEADERBOARD_KUDOS_KINDS.includes(value as LeaderboardKudosKind)
    ? (value as LeaderboardKudosKind)
    : "keep_going";
}

export function canSendLeaderboardKudos(input: {
  viewerUserId: string;
  targetUserId: string;
  targetAllowsKudos: boolean;
  viewerHasSent: boolean;
  socialSignalsEnabled: boolean;
}): LeaderboardKudosTargetState {
  const viewerCanSend =
    input.socialSignalsEnabled &&
    input.viewerUserId !== input.targetUserId &&
    input.targetAllowsKudos &&
    !input.viewerHasSent;

  return {
    targetUserId: input.targetUserId,
    viewerCanSend,
    viewerHasSent: input.viewerHasSent,
  };
}

export function applyLeaderboardPrivacyDisplay(input: {
  displayName: string;
  initials: string;
  rank: number;
  isViewer: boolean;
  isAdmin?: boolean;
  privacy: Pick<LeaderboardPrivacySettings, "displayMode">;
}) {
  if (input.isViewer || input.isAdmin || input.privacy.displayMode === "public_name") {
    return {
      displayName: input.displayName,
      initials: input.initials,
      avatarVisible: true,
      titleVisible: true,
    };
  }

  if (input.privacy.displayMode === "hidden") {
    return {
      displayName: "Private debater",
      initials: "TF",
      avatarVisible: false,
      titleVisible: false,
    };
  }

  return {
    displayName: `Debater #${input.rank}`,
    initials: input.initials,
    avatarVisible: false,
    titleVisible: true,
  };
}

export function isLeaderboardXpEventCounted(status: LeaderboardXpEventFlagStatus | null) {
  return status !== "suppressed_from_leaderboards";
}

export function getLeaderboardXpEventFlagStatus(input: {
  durationSeconds?: number | null;
  sourceType?: string | null;
  hasQualityMetadata?: boolean;
  duplicateSourceCount?: number;
  organizationSwitchesThisSeason?: number;
  duelIntegrityScore?: number | null;
}): {
  flagType: LeaderboardXpEventFlagType | null;
  status: LeaderboardXpEventFlagStatus;
  severity: "low" | "medium" | "high";
  reason: string | null;
} {
  if ((input.duplicateSourceCount ?? 0) > 1) {
    return {
      flagType: "duplicate_submission",
      status: "suppressed_from_leaderboards",
      severity: "high",
      reason: "Duplicate source event detected.",
    };
  }

  if (typeof input.durationSeconds === "number" && input.durationSeconds > 0 && input.durationSeconds < 30) {
    return {
      flagType: "low_duration",
      status: "suppressed_from_leaderboards",
      severity: "medium",
      reason: "Session duration is below the minimum effort threshold.",
    };
  }

  if (input.sourceType === "duel" && typeof input.duelIntegrityScore === "number" && input.duelIntegrityScore < 0.5) {
    return {
      flagType: "duel_integrity",
      status: "flagged_pending_review",
      severity: "high",
      reason: "Duel integrity score needs review.",
    };
  }

  if ((input.organizationSwitchesThisSeason ?? 0) > 1) {
    return {
      flagType: "organization_hopping",
      status: "flagged_pending_review",
      severity: "medium",
      reason: "Multiple organization changes detected this season.",
    };
  }

  if (input.hasQualityMetadata === false) {
    return {
      flagType: "missing_quality_metadata",
      status: "flagged_pending_review",
      severity: "low",
      reason: "Missing quality metadata for scored leaderboard XP.",
    };
  }

  return {
    flagType: null,
    status: "allowed",
    severity: "low",
    reason: null,
  };
}

export function summarizeLeaderboardScoreExplanation(
  items: readonly LeaderboardScoreExplanationItem[]
) {
  return items.reduce(
    (summary, item) => {
      if (item.status === "suppressed" || item.status === "ineligible") {
        summary.suppressedXp += item.seasonXp;
        summary.suppressedEvents += 1;
      } else {
        summary.visibleXp += item.seasonXp;
        summary.visibleEvents += 1;
      }

      return summary;
    },
    {
      visibleXp: 0,
      suppressedXp: 0,
      visibleEvents: 0,
      suppressedEvents: 0,
    }
  );
}

export function sanitizeLeaderboardAnalyticsMetadata(
  metadata: Record<string, unknown>
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  const blocked = new Set<string>(SENSITIVE_METADATA_KEYS.map((key) => key.toLowerCase()));

  for (const [key, value] of Object.entries(metadata)) {
    if (blocked.has(key.toLowerCase())) {
      sanitized[key] = "[redacted]";
      continue;
    }

    if (value && typeof value === "object" && !Array.isArray(value)) {
      sanitized[key] = sanitizeLeaderboardAnalyticsMetadata(
        value as Record<string, unknown>
      );
      continue;
    }

    sanitized[key] = value;
  }

  return sanitized;
}

export function getLeaderboardRolloutGuardrailStatus(input: {
  suppressionRate: number;
  optOutRate: number;
  orgJoinAbuseRate: number;
  churnRate: number;
}): LeaderboardGuardrailMetric[] {
  const metrics: LeaderboardGuardrailMetric[] = [
    {
      key: "xp_suppression_rate",
      label: "XP suppression rate",
      value: input.suppressionRate,
      threshold: 0.08,
      status: input.suppressionRate > 0.12 ? "stop" : input.suppressionRate > 0.08 ? "watch" : "ok",
    },
    {
      key: "privacy_opt_out_rate",
      label: "Privacy opt-out rate",
      value: input.optOutRate,
      threshold: 0.12,
      status: input.optOutRate > 0.18 ? "stop" : input.optOutRate > 0.12 ? "watch" : "ok",
    },
    {
      key: "org_join_abuse_rate",
      label: "Organization join abuse",
      value: input.orgJoinAbuseRate,
      threshold: 0.04,
      status: input.orgJoinAbuseRate > 0.08 ? "stop" : input.orgJoinAbuseRate > 0.04 ? "watch" : "ok",
    },
    {
      key: "weekly_churn_rate",
      label: "Weekly churn",
      value: input.churnRate,
      threshold: 0.1,
      status: input.churnRate > 0.16 ? "stop" : input.churnRate > 0.1 ? "watch" : "ok",
    },
  ];

  return metrics;
}

export function isLeaderboardRolloutActive(stage: LeaderboardRolloutStage) {
  return stage !== "off";
}

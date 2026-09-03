"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  LEADERBOARD_ABUSE_GUARDS_ENABLED,
  LEADERBOARD_ANALYTICS_ENABLED,
  LEADERBOARD_PRIVACY_CONTROLS_ENABLED,
  LEADERBOARD_SOCIAL_SIGNALS_ENABLED,
} from "@/lib/features";
import {
  normalizeLeaderboardKudosKind,
  sanitizeLeaderboardAnalyticsMetadata,
} from "@/lib/leaderboards/social-trust";
import {
  getDefaultLeaderboardPrivacySettings,
  normalizeLeaderboardDisplayMode,
} from "@/lib/leaderboards/social-trust";
import { normalizeLeaderboardPrivacySettings } from "@/lib/leaderboards/social-trust-server";
import { recordAnalyticsEvent } from "@/lib/analytics/server-events";
import type {
  LeaderboardDisplayMode,
  LeaderboardKudosKind,
  LeaderboardPrivacySettings,
  LeaderboardXpEventFlagStatus,
  LeaderboardXpEventFlagType,
} from "@/lib/leaderboards/types";

type RpcResult = {
  data: unknown;
  error: { message?: string; code?: string } | null;
};
type RpcClient = {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<RpcResult>;
};

async function getActionUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  return {
    supabase,
    userId: user.id,
  };
}

async function verifyAdminAction() {
  const { supabase, userId } = await getActionUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (profile?.role !== "admin") {
    throw new Error("Forbidden");
  }

  return { supabase, userId };
}

function rpcClient(supabase: unknown): RpcClient {
  return supabase as RpcClient;
}

function revalidateLeaderboardRoutes() {
  revalidatePath("/leaderboards");
  revalidatePath("/en/leaderboards");
  revalidatePath("/vi/leaderboards");
}

async function recordLeaderboardActionEvent(input: {
  userId: string;
  eventName: string;
  route?: string | null;
  metadata?: Record<string, unknown>;
}) {
  if (!LEADERBOARD_ANALYTICS_ENABLED) return;

  const admin = createAdminClient();
  await recordAnalyticsEvent(
    admin,
    input.userId,
    {
      eventName: input.eventName,
      featureArea: "leaderboards",
      route: input.route ?? "/leaderboards",
      metadata: sanitizeLeaderboardAnalyticsMetadata(input.metadata ?? {}),
    },
    "server",
  );
}

export async function sendLeaderboardKudos(input: {
  recipientUserId: string;
  seasonId: string;
  kind?: LeaderboardKudosKind;
}) {
  const { supabase, userId } = await getActionUser();
  const kind = normalizeLeaderboardKudosKind(input.kind);

  if (!LEADERBOARD_SOCIAL_SIGNALS_ENABLED) {
    return {
      status: "disabled" as const,
      message: "Kudos are not enabled yet.",
    };
  }

  const { data, error } = await rpcClient(supabase).rpc(
    "send_leaderboard_kudos",
    {
      p_recipient_user_id: input.recipientUserId,
      p_season_id: input.seasonId,
      p_kudos_kind: kind,
    },
  );

  if (error) {
    throw new Error(error.message ?? "Unable to send kudos.");
  }

  const row = Array.isArray(data)
    ? (data[0] as { status?: string; message?: string } | undefined)
    : null;
  const status = row?.status ?? "sent";

  await recordLeaderboardActionEvent({
    userId,
    eventName: "leaderboard_kudos_sent",
    metadata: { seasonId: input.seasonId, kind, status },
  });
  revalidateLeaderboardRoutes();

  return {
    status,
    message: row?.message ?? "Encouragement sent.",
  };
}

export async function updateLeaderboardPrivacySettings(input: {
  displayMode: LeaderboardDisplayMode;
  allowKudos: boolean;
  showOrganization: boolean;
  participateInLeaderboards: boolean;
}): Promise<LeaderboardPrivacySettings> {
  const { supabase, userId } = await getActionUser();
  if (!LEADERBOARD_PRIVACY_CONTROLS_ENABLED) {
    throw new Error("Leaderboard privacy controls are not enabled yet.");
  }

  const fallback = getDefaultLeaderboardPrivacySettings({
    userId,
    isStudent: true,
  });

  const { data, error } = await rpcClient(supabase).rpc(
    "update_leaderboard_privacy_settings",
    {
      p_display_mode: normalizeLeaderboardDisplayMode(input.displayMode),
      p_allow_kudos: Boolean(input.allowKudos),
      p_show_organization: Boolean(input.showOrganization),
      p_participate_in_leaderboards: Boolean(input.participateInLeaderboards),
    },
  );

  if (error) {
    throw new Error(error.message ?? "Unable to update leaderboard privacy.");
  }

  await recordLeaderboardActionEvent({
    userId,
    eventName: "leaderboard_privacy_updated",
    route: "/settings",
    metadata: {
      displayMode: normalizeLeaderboardDisplayMode(input.displayMode),
      allowKudos: Boolean(input.allowKudos),
      showOrganization: Boolean(input.showOrganization),
      participateInLeaderboards: Boolean(input.participateInLeaderboards),
    },
  });

  revalidateLeaderboardRoutes();
  revalidatePath("/settings");
  revalidatePath("/en/settings");
  revalidatePath("/vi/settings");

  return normalizeLeaderboardPrivacySettings(data, fallback);
}

export async function flagLeaderboardXpEvent(input: {
  xpEventId: string;
  flagType: LeaderboardXpEventFlagType;
  reason?: string | null;
  severity?: "low" | "medium" | "high";
  status?: LeaderboardXpEventFlagStatus;
}) {
  const { supabase, userId } = await verifyAdminAction();
  if (!LEADERBOARD_ABUSE_GUARDS_ENABLED) {
    throw new Error("Leaderboard abuse guards are not enabled yet.");
  }

  const { data, error } = await rpcClient(supabase).rpc(
    "flag_leaderboard_xp_event",
    {
      p_xp_event_id: input.xpEventId,
      p_flag_type: input.flagType,
      p_reason: input.reason ?? null,
      p_severity: input.severity ?? "medium",
      p_status: input.status ?? "flagged_pending_review",
    },
  );

  if (error) {
    throw new Error(error.message ?? "Unable to flag XP event.");
  }

  await recordLeaderboardActionEvent({
    userId,
    eventName: "leaderboard_abuse_flag_created",
    route: "/dashboard/admin/clubs",
    metadata: {
      xpEventId: input.xpEventId,
      flagType: input.flagType,
      severity: input.severity ?? "medium",
      status: input.status ?? "flagged_pending_review",
    },
  });
  revalidateLeaderboardRoutes();

  return data;
}

export async function resolveLeaderboardXpEventFlag(input: {
  flagId: string;
  status: LeaderboardXpEventFlagStatus;
  note?: string | null;
}) {
  const { supabase } = await verifyAdminAction();
  if (!LEADERBOARD_ABUSE_GUARDS_ENABLED) {
    throw new Error("Leaderboard abuse guards are not enabled yet.");
  }

  const { data, error } = await rpcClient(supabase).rpc(
    "resolve_leaderboard_xp_event_flag",
    {
      p_flag_id: input.flagId,
      p_status: input.status,
      p_note: input.note ?? null,
    },
  );

  if (error) {
    throw new Error(error.message ?? "Unable to resolve XP event flag.");
  }

  revalidateLeaderboardRoutes();
  return data;
}

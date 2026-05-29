"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEV_ADMIN_PROFILE, isDevAdminBypassEnabled } from "@/lib/dev-admin-bypass";
import { getDevAuthBypassUserFromServerContext } from "@/lib/dev-auth-bypass";
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
import {
  normalizeLeaderboardPrivacySettings,
} from "@/lib/leaderboards/social-trust-server";
import { recordAnalyticsEvent } from "@/lib/analytics/server-events";
import type {
  LeaderboardDisplayMode,
  LeaderboardKudosKind,
  LeaderboardPrivacySettings,
  LeaderboardXpEventFlagStatus,
  LeaderboardXpEventFlagType,
} from "@/lib/leaderboards/types";

type RpcResult = { data: unknown; error: { message?: string; code?: string } | null };
type RpcClient = { rpc: (fn: string, args?: Record<string, unknown>) => Promise<RpcResult> };

async function getActionUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const devUser = user ? null : await getDevAuthBypassUserFromServerContext();

  if (!user && !devUser) {
    throw new Error("Unauthorized");
  }

  return {
    supabase,
    userId: user?.id ?? devUser?.id ?? DEV_ADMIN_PROFILE.id,
    isDevBypass: !user && Boolean(devUser),
  };
}

async function verifyAdminAction() {
  const { supabase, userId, isDevBypass } = await getActionUser();

  if (isDevBypass || isDevAdminBypassEnabled()) {
    return { supabase, userId, isDevBypass: true };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (profile?.role !== "admin") {
    throw new Error("Forbidden");
  }

  return { supabase, userId, isDevBypass: false };
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
  await recordAnalyticsEvent(admin, input.userId, {
    eventName: input.eventName,
    featureArea: "leaderboards",
    route: input.route ?? "/leaderboards",
    metadata: sanitizeLeaderboardAnalyticsMetadata(input.metadata ?? {}),
  }, "server");
}

export async function sendLeaderboardKudos(input: {
  recipientUserId: string;
  seasonId: string;
  kind?: LeaderboardKudosKind;
}) {
  const { supabase, userId, isDevBypass } = await getActionUser();
  const kind = normalizeLeaderboardKudosKind(input.kind);

  if (!LEADERBOARD_SOCIAL_SIGNALS_ENABLED && !isDevBypass) {
    return { status: "disabled" as const, message: "Kudos are not enabled yet." };
  }

  if (isDevBypass) {
    await recordLeaderboardActionEvent({
      userId,
      eventName: "leaderboard_kudos_sent",
      metadata: { seasonId: input.seasonId, kind, dev: true },
    });
    return { status: "sent" as const, message: "Encouragement sent." };
  }

  const { data, error } = await rpcClient(supabase).rpc("send_leaderboard_kudos", {
    p_recipient_user_id: input.recipientUserId,
    p_season_id: input.seasonId,
    p_kudos_kind: kind,
  });

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
  const { supabase, userId, isDevBypass } = await getActionUser();
  if (!LEADERBOARD_PRIVACY_CONTROLS_ENABLED && !isDevBypass) {
    throw new Error("Leaderboard privacy controls are not enabled yet.");
  }

  const fallback = getDefaultLeaderboardPrivacySettings({
    userId,
    isStudent: true,
  });

  if (isDevBypass) {
    return {
      ...fallback,
      displayMode: normalizeLeaderboardDisplayMode(input.displayMode),
      allowKudos: Boolean(input.allowKudos),
      showOrganization: Boolean(input.showOrganization),
      participateInLeaderboards: Boolean(input.participateInLeaderboards),
      isDefault: false,
      updatedAt: new Date().toISOString(),
    };
  }

  const { data, error } = await rpcClient(supabase).rpc(
    "update_leaderboard_privacy_settings",
    {
      p_display_mode: normalizeLeaderboardDisplayMode(input.displayMode),
      p_allow_kudos: Boolean(input.allowKudos),
      p_show_organization: Boolean(input.showOrganization),
      p_participate_in_leaderboards: Boolean(input.participateInLeaderboards),
    }
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
  const { supabase, userId, isDevBypass } = await verifyAdminAction();
  if (!LEADERBOARD_ABUSE_GUARDS_ENABLED && !isDevBypass) {
    throw new Error("Leaderboard abuse guards are not enabled yet.");
  }

  if (isDevBypass) {
    return { status: input.status ?? "flagged_pending_review" };
  }

  const { data, error } = await rpcClient(supabase).rpc("flag_leaderboard_xp_event", {
    p_xp_event_id: input.xpEventId,
    p_flag_type: input.flagType,
    p_reason: input.reason ?? null,
    p_severity: input.severity ?? "medium",
    p_status: input.status ?? "flagged_pending_review",
  });

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
  const { supabase, isDevBypass } = await verifyAdminAction();
  if (!LEADERBOARD_ABUSE_GUARDS_ENABLED && !isDevBypass) {
    throw new Error("Leaderboard abuse guards are not enabled yet.");
  }

  if (isDevBypass) {
    return { status: input.status };
  }

  const { data, error } = await rpcClient(supabase).rpc(
    "resolve_leaderboard_xp_event_flag",
    {
      p_flag_id: input.flagId,
      p_status: input.status,
      p_note: input.note ?? null,
    }
  );

  if (error) {
    throw new Error(error.message ?? "Unable to resolve XP event flag.");
  }

  revalidateLeaderboardRoutes();
  return data;
}

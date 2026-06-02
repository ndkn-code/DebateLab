"use server";

import { revalidatePath } from "next/cache";

import { DEV_ADMIN_PROFILE } from "@/lib/dev-admin-bypass";
import { getDevAuthBypassUserFromServerContext } from "@/lib/dev-auth-bypass";
import {
  PROFILE_DISCOVERY_ENABLED,
  PROFILE_FRIEND_CODES_ENABLED,
  PROFILE_PUBLIC_READS_ENABLED,
  PROFILE_CONNECTIONS_ENABLED,
  PROFILE_SOCIAL_ENABLED,
} from "@/lib/features";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordAnalyticsEvent } from "@/lib/analytics/server-events";
import {
  coerceProfileConnectionCenterData,
  coerceProfileDiscoveryResult,
  coerceProfileDiscoverySuggestionsData,
  normalizeProfileReportReason,
  type ProfileConnectionCenterData,
  type ProfileDiscoveryResult,
  type ProfileDiscoverySuggestionsData,
} from "@/lib/profile-social/model";
import { normalizeFeaturedAchievementIds } from "@/lib/profile-social/tab-model";
import { createClient } from "@/lib/supabase/server";

type RpcResult = { data: unknown; error: { message?: string; code?: string } | null };
type RpcClient = { rpc: (fn: string, args?: Record<string, unknown>) => Promise<RpcResult> };

function rpcClient(supabase: unknown): RpcClient {
  return supabase as RpcClient;
}

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

function assertConnectionsEnabled(isDevBypass: boolean) {
  if ((!PROFILE_SOCIAL_ENABLED || !PROFILE_CONNECTIONS_ENABLED) && !isDevBypass) {
    throw new Error("Profile connections are not enabled yet.");
  }
}

function assertSocialEnabled(isDevBypass: boolean) {
  if (!PROFILE_SOCIAL_ENABLED && !isDevBypass) {
    throw new Error("Profile social features are not enabled yet.");
  }
}

function assertDiscoveryEnabled(isDevBypass: boolean) {
  if (
    (!PROFILE_SOCIAL_ENABLED ||
      !PROFILE_PUBLIC_READS_ENABLED ||
      !PROFILE_DISCOVERY_ENABLED) &&
    !isDevBypass
  ) {
    throw new Error("Profile discovery is not enabled yet.");
  }
}

function assertFriendCodesEnabled(isDevBypass: boolean) {
  if (
    (!PROFILE_SOCIAL_ENABLED ||
      !PROFILE_PUBLIC_READS_ENABLED ||
      !PROFILE_FRIEND_CODES_ENABLED) &&
    !isDevBypass
  ) {
    throw new Error("Profile friend codes are not enabled yet.");
  }
}

function revalidateProfileRoutes() {
  revalidatePath("/profile");
  revalidatePath("/en/profile");
  revalidatePath("/vi/profile");
  revalidatePath("/leaderboards");
  revalidatePath("/en/leaderboards");
  revalidatePath("/vi/leaderboards");
}

async function recordProfileActionEvent(input: {
  userId: string;
  eventName: string;
  route?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    const admin = createAdminClient();
    await recordAnalyticsEvent(
      admin,
      input.userId,
      {
        eventName: input.eventName,
        featureArea: "profile",
        route: input.route ?? "/profile",
        metadata: input.metadata ?? {},
      },
      "server"
    );
  } catch {
    // Analytics should not block profile safety actions.
  }
}

async function runProfileRpc(
  rpcName: string,
  args: Record<string, unknown>,
  devResult: Record<string, unknown>,
  options: { requireConnections?: boolean } = { requireConnections: true }
): Promise<{ data: unknown; userId: string }> {
  const { supabase, userId, isDevBypass } = await getActionUser();
  if (options.requireConnections ?? true) {
    assertConnectionsEnabled(isDevBypass);
  } else {
    assertSocialEnabled(isDevBypass);
  }

  if (isDevBypass) {
    return { data: devResult, userId };
  }

  const { data, error } = await rpcClient(supabase).rpc(rpcName, args);
  if (error) {
    throw new Error(error.message ?? "Unable to update profile connection.");
  }

  revalidateProfileRoutes();
  return { data, userId };
}

export async function requestProfileConnection(input: { targetUserId: string }) {
  const result = await runProfileRpc(
    "request_profile_connection",
    { p_target_user_id: input.targetUserId },
    { status: "pending_sent", connectionId: "dev-connection" }
  );
  await recordProfileActionEvent({
    userId: result.userId,
    eventName: "profile_connection_requested",
    metadata: { targetUserId: input.targetUserId, result: result.data },
  });
  return result.data;
}

export async function respondToProfileConnection(input: {
  requesterUserId: string;
  response: "accept" | "accepted" | "decline" | "declined";
}) {
  const result = await runProfileRpc(
    "respond_to_profile_connection",
    {
      p_requester_user_id: input.requesterUserId,
      p_response: input.response,
    },
    {
      status: input.response.startsWith("accept") ? "accepted" : "declined",
      connectionId: "dev-connection",
    }
  );
  await recordProfileActionEvent({
    userId: result.userId,
    eventName: input.response.startsWith("accept")
      ? "profile_connection_accepted"
      : "profile_connection_declined",
    metadata: { requesterUserId: input.requesterUserId, result: result.data },
  });
  return result.data;
}

export async function cancelProfileConnection(input: { targetUserId: string }) {
  const result = await runProfileRpc(
    "cancel_profile_connection",
    { p_target_user_id: input.targetUserId },
    { status: "cancelled", connectionId: "dev-connection" }
  );
  await recordProfileActionEvent({
    userId: result.userId,
    eventName: "profile_connection_cancelled",
    metadata: { targetUserId: input.targetUserId, result: result.data },
  });
  return result.data;
}

export async function removeProfileConnection(input: { targetUserId: string }) {
  const result = await runProfileRpc(
    "remove_profile_connection",
    { p_target_user_id: input.targetUserId },
    { status: "removed", connectionId: "dev-connection" }
  );
  await recordProfileActionEvent({
    userId: result.userId,
    eventName: "profile_connection_removed",
    metadata: { targetUserId: input.targetUserId, result: result.data },
  });
  return result.data;
}

export async function blockProfile(input: { targetUserId: string }) {
  const result = await runProfileRpc(
    "block_profile",
    { p_target_user_id: input.targetUserId },
    { status: "blocked" },
    { requireConnections: false }
  );
  await recordProfileActionEvent({
    userId: result.userId,
    eventName: "profile_blocked",
    metadata: { targetUserId: input.targetUserId },
  });
  return result.data;
}

export async function unblockProfile(input: { targetUserId: string }) {
  const result = await runProfileRpc(
    "unblock_profile",
    { p_target_user_id: input.targetUserId },
    { status: "unblocked" },
    { requireConnections: false }
  );
  await recordProfileActionEvent({
    userId: result.userId,
    eventName: "profile_unblocked",
    metadata: { targetUserId: input.targetUserId },
  });
  return result.data;
}

export async function reportProfile(input: {
  targetUserId: string;
  reason: string;
  details?: string | null;
}) {
  const result = await runProfileRpc(
    "report_profile",
    {
      p_target_user_id: input.targetUserId,
      p_reason: normalizeProfileReportReason(input.reason),
      p_details: input.details ?? null,
    },
    { status: "submitted", reportId: "dev-report" },
    { requireConnections: false }
  );
  await recordProfileActionEvent({
    userId: result.userId,
    eventName: "profile_report_submitted",
    metadata: {
      targetUserId: input.targetUserId,
      reason: normalizeProfileReportReason(input.reason),
    },
  });
  return result.data;
}

export async function setProfileFeaturedAchievements(input: {
  achievementIds: string[];
}) {
  const result = await runProfileRpc(
    "set_profile_featured_achievements",
    {
      p_achievement_ids: normalizeFeaturedAchievementIds(input.achievementIds),
    },
    {
      status: "ok",
      featuredCount: normalizeFeaturedAchievementIds(input.achievementIds).length,
    },
    { requireConnections: false }
  );
  return result.data;
}

export async function searchProfileDiscovery(input: {
  query: string;
  leaderboardLanguage?: "en" | "vi";
}): Promise<ProfileDiscoveryResult> {
  const { supabase, userId, isDevBypass } = await getActionUser();
  assertDiscoveryEnabled(isDevBypass);

  if (isDevBypass) {
    const isMatch = input.query.trim().length > 0;
    return coerceProfileDiscoveryResult({
      status: isMatch ? "found" : "empty",
      queryKind: input.query.toUpperCase().includes("DBT") ? "friend_code" : "handle",
      result: isMatch
        ? {
            state: "visible",
            connection: { status: "none", viewerCanRequest: true },
            profile: {
              userId: "dev-friend",
              handle: "maya.tran",
              displayName: "Maya Tran",
              avatarUrl: null,
              selectedTitle: "Evidence Builder",
              profileStatus: "Drilling rebuttals",
              organization: {
                type: "club",
                id: "dev-club",
                name: "Riverside Debate",
                role: "student",
              },
              friendCounts: { friends: 8 },
              isPrivate: false,
            },
          }
        : null,
    });
  }

  const { data, error } = await rpcClient(supabase).rpc("search_profile_discovery", {
    p_query: input.query,
    p_leaderboard_language: input.leaderboardLanguage ?? "en",
  });

  if (error) {
    throw new Error(error.message ?? "Unable to search profiles.");
  }

  const result = coerceProfileDiscoveryResult(data);
  await recordProfileActionEvent({
    userId,
    eventName: "profile_search_performed",
    metadata: {
      status: result.status,
      queryKind: result.queryKind,
    },
  });
  return result;
}

export async function getProfileConnectionCenter(): Promise<ProfileConnectionCenterData> {
  const { supabase, isDevBypass } = await getActionUser();
  assertDiscoveryEnabled(isDevBypass);

  if (isDevBypass) {
    return coerceProfileConnectionCenterData({
      status: "ok",
      friendCode: { code: "DBT-7K2M-Q8R4", discoveryEnabled: true },
      incoming: [
        {
          state: "visible",
          connection: { status: "pending_received", viewerCanRequest: false },
          profile: {
            userId: "dev-incoming",
            handle: "noah.chen",
            displayName: "Noah Chen",
            avatarUrl: null,
            selectedTitle: "Case Builder",
            profileStatus: null,
            organization: null,
            friendCounts: { friends: 4 },
            isPrivate: false,
          },
        },
      ],
      outgoing: [],
      friends: [],
    });
  }

  const { data, error } = await rpcClient(supabase).rpc(
    "get_profile_connection_center"
  );
  if (error) {
    throw new Error(error.message ?? "Unable to load friends.");
  }

  return coerceProfileConnectionCenterData(data);
}

export async function getProfileDiscoverySuggestions(): Promise<ProfileDiscoverySuggestionsData> {
  const { supabase, isDevBypass } = await getActionUser();
  assertDiscoveryEnabled(isDevBypass);

  if (isDevBypass) {
    return coerceProfileDiscoverySuggestionsData({
      status: "ok",
      suggestions: [],
    });
  }

  const { data, error } = await rpcClient(supabase).rpc(
    "get_profile_discovery_suggestions",
    { p_limit: 10 }
  );
  if (error) {
    throw new Error(error.message ?? "Unable to load friend suggestions.");
  }

  return coerceProfileDiscoverySuggestionsData(data);
}

export async function rotateProfileFriendCode(): Promise<{
  status: string;
  code?: string | null;
}> {
  const { supabase, userId, isDevBypass } = await getActionUser();
  assertFriendCodesEnabled(isDevBypass);

  if (isDevBypass) {
    return { status: "rotated", code: "DBT-2V7Q-M9XA" };
  }

  const { data, error } = await rpcClient(supabase).rpc("rotate_profile_friend_code");
  if (error) {
    throw new Error(error.message ?? "Unable to rotate friend code.");
  }

  await recordProfileActionEvent({
    userId,
    eventName: "profile_friend_code_rotated",
  });

  const result = data as { status?: string; code?: string | null } | null;
  return {
    status: result?.status ?? "rotated",
    code: result?.code ?? null,
  };
}

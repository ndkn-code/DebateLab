import "server-only";

import { DEV_ADMIN_PROFILE } from "@/lib/dev-admin-bypass";
import { getDevAuthBypassUserFromServerContext } from "@/lib/dev-auth-bypass";
import {
  PROFILE_PUBLIC_READS_ENABLED,
  PROFILE_SOCIAL_ENABLED,
} from "@/lib/features";
import { createClient } from "@/lib/supabase/server";
import {
  coercePublicProfileData,
  type PublicProfileData,
} from "@/lib/profile-social/model";

type RpcResult = { data: unknown; error: { message?: string; code?: string } | null };
type RpcClient = { rpc: (fn: string, args?: Record<string, unknown>) => Promise<RpcResult> };
type QueryClient = RpcClient & {
  // Generated Supabase table types are not available in this narrow server helper.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
};

type PublicPreviewPrivacyRow = {
  profile_visibility?: string | null;
  analytics_visibility?: string | null;
  activities_visibility?: string | null;
  achievements_visibility?: string | null;
  organization_visibility?: string | null;
};

export interface GetPublicProfileDataInput {
  targetUserId?: string | null;
  handle?: string | null;
  leaderboardLanguage?: "en" | "vi";
  previewAsPublic?: boolean;
}

function rpcClient(supabase: unknown): RpcClient {
  return supabase as RpcClient;
}

function queryClient(supabase: unknown): QueryClient {
  return supabase as QueryClient;
}

function isMissingRpc(error: { message?: string; code?: string } | null) {
  return (
    error?.code === "PGRST202" ||
    Boolean(error?.message?.includes("Could not find the function"))
  );
}

function isDevSelfTarget(input: GetPublicProfileDataInput) {
  if (input.targetUserId) {
    return input.targetUserId === DEV_ADMIN_PROFILE.id;
  }

  if (input.handle) {
    return input.handle === DEV_ADMIN_PROFILE.handle;
  }

  return true;
}

function getDevDisplayName(handle: string | null | undefined) {
  if (!handle) return "Riverside Debater";
  return handle
    .split(".")
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}

function makeDevPublicProfileData(input: GetPublicProfileDataInput): PublicProfileData {
  const isSelf = isDevSelfTarget(input);
  const handle = input.handle ?? DEV_ADMIN_PROFILE.handle;
  const data: PublicProfileData = {
    state: isSelf ? "self" : "visible",
    visibleSections: {
      analytics: true,
      activities: true,
      achievements: true,
      organization: true,
    },
    connection: {
      status: isSelf ? "self" : "none",
      viewerCanRequest: !isSelf,
    },
    profile: {
      userId: input.targetUserId ?? (isSelf ? DEV_ADMIN_PROFILE.id : `dev-${handle}`),
      handle,
      displayName: isSelf ? DEV_ADMIN_PROFILE.display_name : getDevDisplayName(handle),
      avatarUrl: null,
      selectedTitle: "Constructive Climber",
      profileStatus: isSelf ? DEV_ADMIN_PROFILE.profile_status : "Practicing rebuttals",
      level: isSelf ? DEV_ADMIN_PROFILE.level : 3,
      lifetimeXp: isSelf ? DEV_ADMIN_PROFILE.xp : 860,
      season: {
        language: input.leaderboardLanguage ?? "en",
        seasonXp: isSelf ? 420 : 315,
        rank: isSelf ? 1 : 8,
        leagueTier: "constructive",
        cohortIndex: 0,
      },
      organization: {
        type: "club",
        id: "dev-club",
        name: "Riverside Debate",
        role: "student",
      },
      friendCounts: {
        friends: isSelf ? 12 : 7,
      },
      featuredAchievements: [],
    },
  };

  if (isSelf && input.previewAsPublic) {
    return {
      ...data,
      state: "visible",
      connection: {
        status: "none",
        viewerCanRequest: false,
      },
    };
  }

  return data;
}

function isEveryoneVisible(value: unknown) {
  return value === "public";
}

async function getPublicPreviewPrivacy(
  supabase: unknown,
  userId: string
): Promise<PublicPreviewPrivacyRow> {
  const { data, error } = await queryClient(supabase)
    .from("profile_privacy_settings")
    .select(
      "profile_visibility, analytics_visibility, activities_visibility, achievements_visibility, organization_visibility"
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message ?? "Unable to load profile visibility.");
  }

  return (data ?? {}) as PublicPreviewPrivacyRow;
}

function applyPublicPreview(
  data: PublicProfileData,
  privacy: PublicPreviewPrivacyRow
): PublicProfileData {
  const visibleSections = {
    analytics: isEveryoneVisible(privacy.analytics_visibility),
    activities: isEveryoneVisible(privacy.activities_visibility),
    achievements: isEveryoneVisible(privacy.achievements_visibility),
    organization: isEveryoneVisible(privacy.organization_visibility),
  };

  if (!data.profile || !isEveryoneVisible(privacy.profile_visibility)) {
    return {
      state: "private",
      visibleSections,
      connection: {
        status: "none",
        viewerCanRequest: false,
      },
      profile: null,
    };
  }

  return {
    ...data,
    state: "visible",
    visibleSections,
    connection: {
      status: "none",
      viewerCanRequest: false,
    },
    profile: {
      ...data.profile,
      organization: visibleSections.organization ? data.profile.organization : null,
      featuredAchievements: visibleSections.achievements
        ? data.profile.featuredAchievements
        : [],
    },
  };
}

export async function getPublicProfileData(
  input: GetPublicProfileDataInput = {}
): Promise<PublicProfileData> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const devUser = user ? null : await getDevAuthBypassUserFromServerContext();

  if (!user && !devUser) {
    throw new Error("Unauthorized");
  }

  if (!PROFILE_SOCIAL_ENABLED || !PROFILE_PUBLIC_READS_ENABLED) {
    if (devUser) {
      return makeDevPublicProfileData(input);
    }

    throw new Error("Profile public reads are not enabled yet.");
  }

  if (devUser) {
    return makeDevPublicProfileData(input);
  }

  if (!input.previewAsPublic && !input.targetUserId && !input.handle) {
    const { data, error } = await rpcClient(supabase).rpc("get_profile_self_shell", {
      p_leaderboard_language: input.leaderboardLanguage ?? "en",
    });

    if (!error) {
      return coercePublicProfileData(data);
    }

    if (!isMissingRpc(error)) {
      throw new Error(error.message ?? "Unable to load profile.");
    }
  }

  const { data, error } = await rpcClient(supabase).rpc("get_profile_public_data", {
    p_target_user_id: input.targetUserId ?? null,
    p_handle: input.handle ?? null,
    p_leaderboard_language: input.leaderboardLanguage ?? "en",
  });

  if (error) {
    throw new Error(error.message ?? "Unable to load profile.");
  }

  const publicProfile = coercePublicProfileData(data);

  if (input.previewAsPublic && publicProfile.state === "self" && publicProfile.profile) {
    const privacy = await getPublicPreviewPrivacy(supabase, publicProfile.profile.userId);
    return applyPublicPreview(publicProfile, privacy);
  }

  return publicProfile;
}

import "server-only";

import {
  PROFILE_PUBLIC_READS_ENABLED,
  PROFILE_SOCIAL_ENABLED,
} from "@/lib/features";
import { createClient } from "@/lib/supabase/server";
import {
  coercePublicProfileData,
  type PublicProfileData,
} from "@/lib/profile-social/model";

type RpcResult = {
  data: unknown;
  error: { message?: string; code?: string } | null;
};
type RpcClient = {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<RpcResult>;
};
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

function isEveryoneVisible(value: unknown) {
  return value === "public";
}

async function getPublicPreviewPrivacy(
  supabase: unknown,
  userId: string,
): Promise<PublicPreviewPrivacyRow> {
  const { data, error } = await queryClient(supabase)
    .from("profile_privacy_settings")
    .select(
      "profile_visibility, analytics_visibility, activities_visibility, achievements_visibility, organization_visibility",
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
  privacy: PublicPreviewPrivacyRow,
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
      organization: visibleSections.organization
        ? data.profile.organization
        : null,
      featuredAchievements: visibleSections.achievements
        ? data.profile.featuredAchievements
        : [],
    },
  };
}

export async function getPublicProfileData(
  input: GetPublicProfileDataInput = {},
): Promise<PublicProfileData> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  if (!PROFILE_SOCIAL_ENABLED || !PROFILE_PUBLIC_READS_ENABLED) {
    throw new Error("Profile public reads are not enabled yet.");
  }

  if (!input.previewAsPublic && !input.targetUserId && !input.handle) {
    const { data, error } = await rpcClient(supabase).rpc(
      "get_profile_self_shell",
      {
        p_leaderboard_language: input.leaderboardLanguage ?? "en",
      },
    );

    if (!error) {
      return coercePublicProfileData(data);
    }

    if (!isMissingRpc(error)) {
      throw new Error(error.message ?? "Unable to load profile.");
    }
  }

  const { data, error } = await rpcClient(supabase).rpc(
    "get_profile_public_data",
    {
      p_target_user_id: input.targetUserId ?? null,
      p_handle: input.handle ?? null,
      p_leaderboard_language: input.leaderboardLanguage ?? "en",
    },
  );

  if (error) {
    throw new Error(error.message ?? "Unable to load profile.");
  }

  const publicProfile = coercePublicProfileData(data);

  if (
    input.previewAsPublic &&
    publicProfile.state === "self" &&
    publicProfile.profile
  ) {
    const privacy = await getPublicPreviewPrivacy(
      supabase,
      publicProfile.profile.userId,
    );
    return applyPublicPreview(publicProfile, privacy);
  }

  return publicProfile;
}

import type {
  LeaderboardDataSource,
  LeaderboardRolloutStage,
} from "@/lib/leaderboards/types";

function isEnabled(value: string | undefined) {
  return value === "1" || value?.toLowerCase() === "true";
}

function isEnabledByDefault(value: string | undefined) {
  return value ? isEnabled(value) : true;
}

function getRolloutStage(value: string | undefined): LeaderboardRolloutStage {
  if (value === "internal" || value === "clubs" || value === "public") {
    return value;
  }

  return "off";
}

export const STUDENT_COURSES_ENABLED: boolean = false;

const leaderboardEnabledValue =
  process.env.NEXT_PUBLIC_LEADERBOARDS_ENABLED ?? process.env.LEADERBOARDS_ENABLED;

export const LEADERBOARDS_ENABLED: boolean = leaderboardEnabledValue
  ? isEnabled(leaderboardEnabledValue)
  : true;

const leaderboardDataSourceValue =
  process.env.LEADERBOARDS_DATA_SOURCE ?? process.env.NEXT_PUBLIC_LEADERBOARDS_DATA_SOURCE;

export const LEADERBOARDS_DATA_SOURCE: LeaderboardDataSource =
  leaderboardDataSourceValue === "mock" ? "mock" : "ledger";

export const LEADERBOARD_SEASON_REPLAY_ENABLED: boolean =
  isEnabled(process.env.NEXT_PUBLIC_LEADERBOARD_SEASON_REPLAY_ENABLED) ||
  isEnabled(process.env.LEADERBOARD_SEASON_REPLAY_ENABLED);

export const ORGANIZATION_JOIN_CODES_ENABLED: boolean =
  isEnabled(process.env.NEXT_PUBLIC_ORGANIZATION_JOIN_CODES_ENABLED) ||
  isEnabled(process.env.ORGANIZATION_JOIN_CODES_ENABLED);

export const LEADERBOARD_SOCIAL_SIGNALS_ENABLED: boolean =
  isEnabled(process.env.NEXT_PUBLIC_LEADERBOARD_SOCIAL_SIGNALS_ENABLED) ||
  isEnabled(process.env.LEADERBOARD_SOCIAL_SIGNALS_ENABLED);

export const LEADERBOARD_ABUSE_GUARDS_ENABLED: boolean =
  isEnabled(process.env.NEXT_PUBLIC_LEADERBOARD_ABUSE_GUARDS_ENABLED) ||
  isEnabled(process.env.LEADERBOARD_ABUSE_GUARDS_ENABLED);

export const LEADERBOARD_PRIVACY_CONTROLS_ENABLED: boolean =
  isEnabled(process.env.NEXT_PUBLIC_LEADERBOARD_PRIVACY_CONTROLS_ENABLED) ||
  isEnabled(process.env.LEADERBOARD_PRIVACY_CONTROLS_ENABLED);

export const LEADERBOARD_ANALYTICS_ENABLED: boolean =
  isEnabled(process.env.NEXT_PUBLIC_LEADERBOARD_ANALYTICS_ENABLED) ||
  isEnabled(process.env.LEADERBOARD_ANALYTICS_ENABLED);

export const LEADERBOARD_ROLLOUT_STAGE: LeaderboardRolloutStage = getRolloutStage(
  process.env.NEXT_PUBLIC_LEADERBOARD_ROLLOUT_STAGE ??
    process.env.LEADERBOARD_ROLLOUT_STAGE
);

const profileSocialEnabledValue =
  process.env.NEXT_PUBLIC_PROFILE_SOCIAL_ENABLED ?? process.env.PROFILE_SOCIAL_ENABLED;

export const PROFILE_SOCIAL_ENABLED: boolean =
  isEnabledByDefault(profileSocialEnabledValue);

export const PROFILE_PUBLIC_READS_ENABLED: boolean =
  PROFILE_SOCIAL_ENABLED &&
  isEnabledByDefault(
    process.env.NEXT_PUBLIC_PROFILE_PUBLIC_READS_ENABLED ??
      process.env.PROFILE_PUBLIC_READS_ENABLED
  );

export const PROFILE_CONNECTIONS_ENABLED: boolean =
  PROFILE_SOCIAL_ENABLED &&
  isEnabledByDefault(
    process.env.NEXT_PUBLIC_PROFILE_CONNECTIONS_ENABLED ??
      process.env.PROFILE_CONNECTIONS_ENABLED
  );

export const PROFILE_DISCOVERY_ENABLED: boolean =
  PROFILE_SOCIAL_ENABLED &&
  isEnabledByDefault(
    process.env.NEXT_PUBLIC_PROFILE_DISCOVERY_ENABLED ??
      process.env.PROFILE_DISCOVERY_ENABLED
  );

export const PROFILE_FRIEND_CODES_ENABLED: boolean =
  PROFILE_SOCIAL_ENABLED &&
  isEnabledByDefault(
    process.env.NEXT_PUBLIC_PROFILE_FRIEND_CODES_ENABLED ??
      process.env.PROFILE_FRIEND_CODES_ENABLED
  );

export const PROFILE_SOCIAL_GUARDRAILS_ENABLED: boolean =
  PROFILE_SOCIAL_ENABLED &&
  isEnabledByDefault(
    process.env.NEXT_PUBLIC_PROFILE_SOCIAL_GUARDRAILS_ENABLED ??
      process.env.PROFILE_SOCIAL_GUARDRAILS_ENABLED
  );

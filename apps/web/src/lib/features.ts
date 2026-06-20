import type {
  LeaderboardDataSource,
  LeaderboardRolloutStage,
} from "@/lib/leaderboards/types";
import type { Subject } from "@thinkfy/shared/subject";

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

/**
 * IELTS launch switch (WS-5.1). Gates the entire IELTS learner shell — the
 * `/ielts` home + test library, the IELTS nav set, and the IELTS option in the
 * subject switcher. Default OFF so debate is byte-identical until the track is
 * launched; flip `NEXT_PUBLIC_IELTS_ENABLED=true` (or `IELTS_ENABLED=true`) to
 * turn it on for everyone — no code change to the gate needed.
 *
 * Engine-purity (masterplan §2.7): a per-track launch gate, never exam logic
 * inside the core engine. `getActiveSubject()` (lib/subject/server.ts) honours
 * this flag so a stale `ielts` cookie cannot activate the track while it is off.
 */
const ieltsEnabledValue =
  process.env.NEXT_PUBLIC_IELTS_ENABLED ?? process.env.IELTS_ENABLED;

export const IELTS_ENABLED: boolean = ieltsEnabledValue
  ? isEnabled(ieltsEnabledValue)
  : false;

/** Subjects a learner may switch to, given the launch flags. */
export function availableSubjects(): Subject[] {
  return IELTS_ENABLED ? ["debate", "ielts"] : ["debate"];
}

/**
 * Subject-scoped enablement for the Duolingo-style activity/course engine
 * (WS-0.2). The engine stays flagged OFF for debate (`STUDENT_COURSES_ENABLED`
 * is unchanged) but ON for the IELTS track, so selecting IELTS reaches the
 * (currently empty) engine surface while debate behavior is byte-identical.
 *
 * Engine-purity (masterplan §2.7): this is a per-subject feature gate, never
 * exam logic inside the engine itself.
 */
export function areStudentCoursesEnabled(subject: Subject): boolean {
  return subject === "ielts" ? true : STUDENT_COURSES_ENABLED;
}

// 1v1 Duel ("debate-duel") launch switch. Default off → only admins can reach
// the feature (so the team keeps shadow-testing in production). Set
// NEXT_PUBLIC_DUEL_ENABLED=true (or DUEL_ENABLED=true) to launch it for
// everyone — no code change to the gate needed.
const duelEnabledValue =
  process.env.NEXT_PUBLIC_DUEL_ENABLED ?? process.env.DUEL_ENABLED;

export const DUEL_ENABLED: boolean = duelEnabledValue
  ? isEnabled(duelEnabledValue)
  : false;

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

import type {
  LeaderboardLanguage,
  LeaderboardPageData,
  LeagueTierId,
  OrganizationLeaderboardCandidate,
  PersonalLeaderboardCandidate,
} from "@/lib/leaderboards/types";
import { getDefaultLeaderboardPrivacySettings } from "@/lib/leaderboards/social-trust";
import {
  CHAMPION_RECOGNITION_COUNT,
  LEAGUE_TIERS,
  ORGANIZATION_BANDS,
  PERSONAL_COHORT_SIZE,
  PERSONAL_DEMOTION_COUNT,
  PERSONAL_PROMOTION_COUNT,
  buildTierProgress,
  getLeagueTier,
  getSeasonDaysRemaining,
  isDemotionEnabled,
  rankOrganizationLeaderboardRows,
  rankPersonalLeaderboardRows,
} from "@/lib/leaderboards/model";

export type LeaderboardFixtureState =
  | "normal"
  | "promotion"
  | "promotion-100"
  | "demotion"
  | "demotion-100"
  | "champion"
  | "held"
  | "held-down"
  | "outside"
  | "empty"
  | "low-pop";

const FIXTURE_NOW = new Date("2026-05-29T15:00:00.000Z");
const FIXTURE_SEASON_START = "2026-05-25T04:00:00.000Z";
const FIXTURE_SEASON_END = "2026-06-01T04:00:00.000Z";

const BASE_NAMES = [
  ["Maya Tran", "MT", "Rebuttal tactician"],
  ["Noah Chen", "NC", "Case builder"],
  ["Aisha Patel", "AP", "Evidence hunter"],
  ["Leo Morgan", "LM", "Crossfire lead"],
  ["Sofia Reyes", "SR", "Delivery specialist"],
  ["Jensen Nguyen", "JN", "Thinkfy debater"],
  ["Ethan Brooks", "EB", "Impact weigher"],
  ["Lina Park", "LP", "POI striker"],
  ["Arun Shah", "AS", "Framework lead"],
  ["Camille Duong", "CD", "Clash mapper"],
  ["Iris Williams", "IW", "Prep room captain"],
  ["Minh Le", "ML", "Whip speaker"],
  ["Omar Hassan", "OH", "Logic grinder"],
  ["Priya Menon", "PM", "Policy scout"],
  ["Hannah Kim", "HK", "Summary closer"],
  ["Daniel Reed", "DR", "Opening speaker"],
  ["Zara Ali", "ZA", "Definition guard"],
  ["Mateo Silva", "MS", "Extension builder"],
  ["Nina Okafor", "NO", "Judge adaptation"],
  ["Felix Hart", "FH", "Clarity coach"],
  ["Ella Stone", "ES", "Motion analyst"],
  ["Kai Pham", "KP", "Comparative lead"],
  ["Tara Singh", "TS", "Mechanism builder"],
  ["Ben Carter", "BC", "Final focus"],
  ["Yuna Sato", "YS", "Prep sprinter"],
  ["Sam Rivera", "SR", "Round reviewer"],
  ["Mei Lin", "ML", "Stakeholder mapper"],
  ["Jon Bell", "JB", "Point refiner"],
  ["Grace Kim", "GK", "Flow keeper"],
  ["Victor Lam", "VL", "Strategy lead"],
] as const;

function makeSeasonSummary() {
  return {
    id: "weekly:2026-05-25",
    label: "May 25 - Jun 1",
    startsAt: FIXTURE_SEASON_START,
    endsAt: FIXTURE_SEASON_END,
    timezone: "America/New_York",
    daysRemaining: getSeasonDaysRemaining(FIXTURE_NOW, FIXTURE_SEASON_END),
  };
}

function getFixtureTierId(state: LeaderboardFixtureState): LeagueTierId {
  if (state === "promotion" || state === "promotion-100") return "constructive";
  if (state === "demotion" || state === "demotion-100") return "constructive";
  if (state === "champion") return "champion";
  if (state === "low-pop") return "novice";
  return "rebuttal";
}

function getFixtureCurrentRank(state: LeaderboardFixtureState) {
  if (state === "promotion") return 4;
  if (state === "promotion-100") return 5;
  if (state === "demotion") return 27;
  if (state === "demotion-100") return 97;
  if (state === "champion") return 2;
  if (state === "held") return 14;
  if (state === "held-down") return 18;
  if (state === "outside") return 24;
  if (state === "low-pop") return 7;
  return 6;
}

function makePersonalCandidates(
  viewerUserId: string,
  state: LeaderboardFixtureState
): PersonalLeaderboardCandidate[] {
  if (state === "empty") {
    return [];
  }

  const activeCount =
    state === "low-pop"
      ? 10
      : state === "promotion-100" || state === "demotion-100"
        ? 100
        : PERSONAL_COHORT_SIZE;
  const currentRank = getFixtureCurrentRank(state);

  return Array.from({ length: activeCount }, (_, index) => {
    const rank = index + 1;
    const [name, initials, title] = BASE_NAMES[index % BASE_NAMES.length] ?? BASE_NAMES[0];
    const handle = name.toLowerCase().replace(/\s+/g, ".");
    const jitter = (index % 4) * 17;
    const isCurrentUser = rank === currentRank;
    const seasonXp = Math.max(80, 3120 - index * 104 - jitter);
    const previousRank = rank + (index % 3 === 0 ? 2 : index % 4 === 0 ? -1 : 0);

    return {
      userId: isCurrentUser ? viewerUserId : `fixture-user-${rank}`,
      displayName: isCurrentUser ? "You" : name,
      handle: isCurrentUser ? "dev.admin" : handle,
      profileHref: isCurrentUser ? "/profile" : `/profile/${handle}`,
      connection: {
        status: isCurrentUser ? "self" : "none",
        viewerCanRequest: !isCurrentUser,
      },
      viewerCanRequest: !isCurrentUser,
      avatarUrl: null,
      initials: isCurrentUser ? "YOU" : initials,
      title: isCurrentUser ? "Debate climber" : title,
      seasonXp,
      averageScore: 92 - (index % 13),
      previousRank: Math.max(1, previousRank),
      lastEventAt: `2026-05-${String(28 - (index % 5)).padStart(2, "0")}T${String(
        9 + (index % 10)
      ).padStart(2, "0")}:20:00.000Z`,
      isCurrentUser,
    };
  });
}

const ORG_CANDIDATES: readonly OrganizationLeaderboardCandidate[] = [
  {
    organizationId: "club-debate-lab",
    organizationType: "club",
    name: "DebateLab Academy",
    subtitle: "School - Ho Chi Minh City",
    logoUrl: null,
    seasonXp: 4820,
    activeMembers: 9,
    contributingMembers: 8,
    previousRank: 3,
    lastEventAt: "2026-05-29T13:00:00.000Z",
    isCurrentOrganization: true,
  },
  {
    organizationId: "club-hanoi-speakers",
    organizationType: "club",
    name: "Hanoi Speakers",
    subtitle: "Center - Ha Noi",
    logoUrl: null,
    seasonXp: 5220,
    activeMembers: 8,
    contributingMembers: 7,
    previousRank: 1,
    lastEventAt: "2026-05-29T11:00:00.000Z",
    isCurrentOrganization: false,
  },
  {
    organizationId: "club-saigon",
    organizationType: "club",
    name: "Saigon Debate Union",
    subtitle: "School - Ho Chi Minh City",
    logoUrl: null,
    seasonXp: 12940,
    activeMembers: 24,
    contributingMembers: 20,
    previousRank: 1,
    lastEventAt: "2026-05-29T12:00:00.000Z",
    isCurrentOrganization: false,
  },
  {
    organizationId: "club-global",
    organizationType: "club",
    name: "Global Debate School",
    subtitle: "Online",
    logoUrl: null,
    seasonXp: 24120,
    activeMembers: 46,
    contributingMembers: 31,
    previousRank: 2,
    lastEventAt: "2026-05-29T15:30:00.000Z",
    isCurrentOrganization: false,
  },
  {
    organizationId: "club-city",
    organizationType: "club",
    name: "City Youth Debaters",
    subtitle: "Independent - Da Nang",
    logoUrl: null,
    seasonXp: 19540,
    activeMembers: 39,
    contributingMembers: 28,
    previousRank: 4,
    lastEventAt: "2026-05-28T17:40:00.000Z",
    isCurrentOrganization: false,
  },
  {
    organizationId: "club-inactive",
    organizationType: "club",
    name: "Inactive Fixture",
    subtitle: "School",
    logoUrl: null,
    seasonXp: 999999,
    activeMembers: 0,
    contributingMembers: 0,
    previousRank: null,
    lastEventAt: null,
    isCurrentOrganization: false,
  },
] as const;

export function makeMockLeaderboardPageData({
  viewerUserId,
  state = "normal",
  leaderboardLanguage = "en",
}: {
  viewerUserId: string;
  state?: LeaderboardFixtureState;
  leaderboardLanguage?: LeaderboardLanguage;
}): LeaderboardPageData {
  const currentTierId = getFixtureTierId(state);
  const personalRows = rankPersonalLeaderboardRows(
    makePersonalCandidates(viewerUserId, state),
    currentTierId
  );
  const personalCohortSize =
    state === "promotion-100" || state === "demotion-100"
      ? 100
      : PERSONAL_COHORT_SIZE;
  const currentUser = personalRows.find((row) => row.isCurrentUser) ?? null;
  const organizationRows = ORGANIZATION_BANDS.flatMap((band) =>
    rankOrganizationLeaderboardRows(
      state === "empty" ? [] : ORG_CANDIDATES,
      band
    )
  );
  const outcome =
    state === "promotion" || state === "promotion-100"
      ? {
          seasonId: "weekly:2026-05-18",
          leaderboardLanguage,
          finalRank: 5,
          finalZone: "promote" as const,
          seasonXp: state === "promotion-100" ? 9840 : 2840,
          fromLeagueTier: "novice" as const,
          nextLeagueTier: currentTierId,
          outcome: "promoted" as const,
          resolvedAt: "2026-05-25T04:00:00.000Z",
          ...(state === "promotion-100"
            ? {
                replayStartRank: 95,
                replayCohortSize: 100,
              }
            : {}),
        }
      : state === "demotion" || state === "demotion-100"
        ? {
            seasonId: "weekly:2026-05-18",
            leaderboardLanguage,
            finalRank: state === "demotion-100" ? 97 : 27,
            finalZone: "demote" as const,
            seasonXp: state === "demotion-100" ? 360 : 420,
            fromLeagueTier: "rebuttal" as const,
            nextLeagueTier: currentTierId,
            outcome: "demoted" as const,
            resolvedAt: "2026-05-25T04:00:00.000Z",
            replayStartRank: state === "demotion-100" ? 5 : 10,
            ...(state === "demotion-100"
              ? {
                  replayCohortSize: 100,
                }
              : {}),
          }
        : state === "champion"
          ? {
              seasonId: "weekly:2026-05-18",
              leaderboardLanguage,
              finalRank: 2,
              finalZone: "champion" as const,
              seasonXp: 4210,
              fromLeagueTier: "champion" as const,
              nextLeagueTier: "champion" as const,
              outcome: "champion" as const,
              resolvedAt: "2026-05-25T04:00:00.000Z",
            }
          : state === "held" || state === "held-down"
            ? {
                seasonId: "weekly:2026-05-18",
                leaderboardLanguage,
                finalRank: state === "held-down" ? 18 : 14,
                finalZone: "hold" as const,
                seasonXp: state === "held-down" ? 1180 : 1630,
                fromLeagueTier: currentTierId,
                nextLeagueTier: currentTierId,
                outcome: "held" as const,
                resolvedAt: "2026-05-25T04:00:00.000Z",
                ...(state === "held-down"
                  ? {
                      replayStartRank: 8,
                    }
                  : {}),
              }
            : null;

  return {
    source: "mock",
    status: personalRows.length > 0 || organizationRows.length > 0 ? "ready" : "empty",
    leaderboardLanguage,
    reason:
      state === "empty"
        ? "No leaderboard activity has been recorded for this fixture season."
        : null,
    season: makeSeasonSummary(),
    personal: {
      league: {
        ...getLeagueTier(currentTierId),
        status: "current",
      },
      tiers: buildTierProgress(currentTierId),
      cohort: {
        seasonId: makeSeasonSummary().id,
        leaderboardLanguage,
        leagueTier: currentTierId,
        cohortIndex: 0,
        cohortSize: personalCohortSize,
      },
      cohortSize: personalCohortSize,
      activeCount: personalRows.length,
      promotionCount: PERSONAL_PROMOTION_COUNT,
      demotionCount: PERSONAL_DEMOTION_COUNT,
      demotionEnabled: isDemotionEnabled(personalRows.length, currentTierId),
      championCount: CHAMPION_RECOGNITION_COUNT,
      outcome,
      rows: personalRows,
      currentUser,
    },
    organizations: {
      bands: [...ORGANIZATION_BANDS],
      affiliation:
        state === "empty"
          ? null
          : {
              organizationId: "club-debate-lab",
              organizationType: "club",
              name: "DebateLab Academy",
              subtitle: "School - Ho Chi Minh City",
              logoUrl: null,
              role: "student",
              joinedAt: "2026-05-01T09:00:00.000Z",
              verificationMethod: "join_code",
            },
      rows: organizationRows,
      currentOrganization:
        organizationRows.find((row) => row.isCurrentOrganization) ?? null,
    },
    socialTrust: {
      privacy: getDefaultLeaderboardPrivacySettings({
        userId: viewerUserId,
        isStudent: true,
        now: FIXTURE_NOW,
      }),
      kudos: {
        receivedThisSeason: state === "empty" ? 0 : 3,
        sentThisSeason: state === "empty" ? 0 : 1,
        availableKinds: ["keep_going", "great_round", "strong_improvement"],
        byUserId: Object.fromEntries(
          personalRows.map((row, index) => [
            row.userId,
            {
              targetUserId: row.userId,
              viewerCanSend: !row.isCurrentUser && index < 8 && index !== 2,
              viewerHasSent: !row.isCurrentUser && index === 2,
            },
          ])
        ),
      },
      scoreExplanation: currentUser
        ? [
            {
              id: "fixture-xp-practice",
              category: "practice",
              label: "Scored practice",
              seasonXp: Math.round(currentUser.seasonXp * 0.62),
              lifetimeXp: Math.round(currentUser.seasonXp * 0.62),
              status: "counted",
              reason: null,
              occurredAt: "2026-05-29T14:00:00.000Z",
            },
            {
              id: "fixture-xp-quality",
              category: "quality",
              label: "Quality bonus",
              seasonXp: Math.round(currentUser.seasonXp * 0.24),
              lifetimeXp: Math.round(currentUser.seasonXp * 0.24),
              status: "counted",
              reason: "Average score stayed above the weekly quality threshold.",
              occurredAt: "2026-05-28T14:00:00.000Z",
            },
            {
              id: "fixture-xp-cap",
              category: "practice",
              label: "Extra practice",
              seasonXp: Math.round(currentUser.seasonXp * 0.14),
              lifetimeXp: Math.round(currentUser.seasonXp * 0.14),
              status: "capped",
              reason: "Daily category cap applied.",
              occurredAt: "2026-05-27T14:00:00.000Z",
            },
          ]
        : [],
    },
  };
}

export function makeUnavailableLeaderboardPageData(
  reason: string,
  leaderboardLanguage: LeaderboardLanguage = "en"
): LeaderboardPageData {
  const data = makeMockLeaderboardPageData({
    viewerUserId: "unavailable-user",
    state: "empty",
    leaderboardLanguage,
  });

  return {
    ...data,
    source: "ledger",
    status: "unavailable",
    reason,
    personal: {
      ...data.personal,
      league: {
        ...LEAGUE_TIERS[0],
        status: "current",
      },
      tiers: buildTierProgress("novice"),
    },
  };
}
